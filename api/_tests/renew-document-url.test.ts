import { describe, it, expect, beforeEach, vi } from 'vitest';
import renewDocumentUrlHandler from '../renew-document-url.js';
import { saveOrUpdateApplication, addDocumentToApplication, updateDocumentMetadata } from '../_lib/applicationRepository.js';

function createMockReqRes(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'POST',
    body: options.body || {},
    headers: options.headers || {},
  };

  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};

  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    },
    end: () => res,
    _getStatusCode: () => statusCode,
    _getData: () => responseData,
    _getHeaders: () => headers,
  };

  return { req, res };
}

describe('Document Identity, Versioning & URL Renewal Test Suite', () => {
  const testAdminKey = 'test_admin_secret_key_999';
  const appId = 'app_renew_test_101';
  const ref = 'FF-2026-RENEW01';

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.ADMIN_API_KEY = testAdminKey;

    await saveOrUpdateApplication(appId, ref, 'submitted', {
      business: { company_name: 'Apex Renewal Haulage Ltd' },
      contact: { contact_full_name: 'Robert Vance', email: 'robert@apexhaulage.co.uk' },
    } as any);

    // Seed application PDF
    await updateDocumentMetadata(appId, {
      documentId: `doc_app_pdf_${appId}`,
      documentVersion: 'gen_1000001',
      documentType: 'completed_application',
      fileName: `${ref}-application.pdf`,
      fileSize: 45000,
      contentType: 'application/pdf',
      generatedPdfPath: `applications/ff/${appId}/generated/${ref}-application.pdf`,
      pdfDownloadUrl: 'https://mock-storage.example.invalid/expired_pdf_url',
      downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z', // Expired
      generatedAt: '2026-10-10T00:00:00.000Z',
    });

    // Seed supporting document
    await addDocumentToApplication(appId, {
      documentId: 'doc_bank_stmt_555',
      documentVersion: 'gen_2000002',
      documentType: 'bank_statement',
      fileName: 'Bank_Statement_September_2026.pdf',
      fileSize: 125000,
      contentType: 'application/pdf',
      storagePath: `applications/ff/${appId}/documents/bank_statement/Bank_Statement.pdf`,
      downloadUrl: 'https://mock-storage.example.invalid/expired_bank_stmt',
      downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z', // Expired
      uploadedAt: '2026-10-10T00:00:00.000Z',
    });
  });

  it('1. Rejects unauthorized renewal requests when ADMIN_API_KEY is missing or invalid', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer invalid_wrong_token' },
      body: {
        applicationId: appId,
        submissionRef: ref,
        documentId: 'doc_bank_stmt_555',
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(res._getData().error).toContain('Unauthorized');
  });

  it('2. Rejects request with missing required parameters', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        // missing submissionRef & documentId
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getData().error).toContain('Missing required parameters');
  });

  it('3. Rejects cross-case / mismatched submissionRef requests (Case Association Guard)', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        submissionRef: 'FF-2026-DIFFERENT_CASE',
        documentId: 'doc_bank_stmt_555',
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(res._getData().error).toContain('Case association mismatch');
  });

  it('4. Rejects request for unknown documentId', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        submissionRef: ref,
        documentId: 'doc_non_existent_99999',
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getData().error).toContain('not associated with this application');
  });

  it('5. Rejects request when documentVersion mismatch occurs (Version Pinning Guard)', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        submissionRef: ref,
        documentId: 'doc_bank_stmt_555',
        documentVersion: 'gen_wrong_version_999',
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(409);
    expect(res._getData().error).toContain('Document version mismatch');
  });

  it('6. Successfully renews an expired supporting document URL with fresh expiry and pinned version', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        submissionRef: ref,
        documentId: 'doc_bank_stmt_555',
        documentVersion: 'gen_2000002',
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.success).toBe(true);
    expect(data.document.documentId).toBe('doc_bank_stmt_555');
    expect(data.document.documentVersion).toBe('gen_2000002');
    expect(data.document.downloadUrl).toBeDefined();
    expect(data.document.downloadUrlExpiresAt).toBeDefined();

    // Verify expiry date is in the future
    const expiry = new Date(data.document.downloadUrlExpiresAt).getTime();
    expect(expiry).toBeGreaterThan(Date.now());

    // Deduplication Key Stability: applicationId + documentId + documentVersion
    const dedupKey = `${data.applicationId}_${data.document.documentId}_${data.document.documentVersion}`;
    expect(dedupKey).toBe('app_renew_test_101_doc_bank_stmt_555_gen_2000002');
  });

  it('7. Successfully renews generated application PDF URL and can replay webhook', async () => {
    let webhookCalled = false;
    let dispatchedPayload: any = null;
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url === 'https://crm-test.example.com/webhook') {
        webhookCalled = true;
        dispatchedPayload = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => ({ status: 'received' }) };
      }
      return originalFetch(url, options);
    });

    process.env.MONDAY_WEBHOOK_URL = 'https://crm-test.example.com/webhook';

    try {
      const { req, res } = createMockReqRes({
        method: 'POST',
        headers: { authorization: `Bearer ${testAdminKey}` },
        body: {
          applicationId: appId,
          submissionRef: ref,
          documentId: `doc_app_pdf_${appId}`,
          replayWebhook: true,
        },
      });

      await renewDocumentUrlHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const data = res._getData();
      expect(data.success).toBe(true);
      expect(data.document.documentId).toBe(`doc_app_pdf_${appId}`);
      expect(data.replayed).toBe(true);
      expect(webhookCalled).toBe(true);
      expect(dispatchedPayload.event).toBe('new_factoring_enquiry');
      expect(dispatchedPayload.reference).toBe(ref);
      expect(dispatchedPayload.data.pdfDownloadUrl).toBeDefined();
      expect(dispatchedPayload.data.downloadUrlExpiresAt).toBeDefined();
    } finally {
      delete process.env.MONDAY_WEBHOOK_URL;
      global.fetch = originalFetch;
    }
  });
});
