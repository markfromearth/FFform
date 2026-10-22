import { describe, it, expect, beforeEach, vi } from 'vitest';
import renewDocumentUrlHandler from '../renew-document-url.js';
import recordDocumentUploadHandler from '../record-document-upload.js';
import completeDocumentUploadHandler from '../complete-document-upload.js';
import submitApplicationHandler from '../submit-application.js';
import {
  saveOrUpdateApplication,
  addDocumentToApplication,
  updateDocumentMetadata,
  getApplicationById,
  createDocumentRequestToken,
} from '../_lib/applicationRepository.js';
import * as firebaseAdmin from '../_lib/firebaseAdmin.js';

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

describe('Replication Suite: Document Reliability & CRM Integration Remediation Suite', () => {
  const testAdminKey = 'test_audit_admin_key_123';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ADMIN_API_KEY = testAdminKey;
  });

  /**
   * Test 1: Deduplication Overwrite
   * When uploading two documents with the same fileName but different documentIds,
   * both documents must be retained in the database.
   */
  it('Test 1: Deduplication uses documentId instead of fileName, preserving distinct documents', async () => {
    const appId = 'app_test_dedup_overwrite_01';
    const ref = 'FF-2026-DEDUP01';

    await saveOrUpdateApplication(appId, ref, 'submitted', {
      business: { company_name: 'Dedup Overwrite Ltd' },
    } as any);

    // First upload: Bank Statement for Month 1
    const doc1 = {
      documentId: 'doc_bank_stmt_january_001',
      documentVersion: 'gen_1001',
      documentType: 'bank_statement',
      fileName: 'Bank_Statement.pdf',
      fileSize: 50000,
      contentType: 'application/pdf',
      storagePath: `applications/ff/${appId}/documents/bank_statement/statement_jan.pdf`,
      uploadedAt: '2026-10-01T00:00:00.000Z',
    };

    // Second upload: Bank Statement for Month 2 (different documentId, different path, same fileName)
    const doc2 = {
      documentId: 'doc_bank_stmt_february_002',
      documentVersion: 'gen_1002',
      documentType: 'bank_statement',
      fileName: 'Bank_Statement.pdf',
      fileSize: 52000,
      contentType: 'application/pdf',
      storagePath: `applications/ff/${appId}/documents/bank_statement/statement_feb.pdf`,
      uploadedAt: '2026-10-02T00:00:00.000Z',
    };

    await addDocumentToApplication(appId, doc1);
    await addDocumentToApplication(appId, doc2);

    const app = await getApplicationById(appId);
    expect(app).not.toBeNull();
    const storedDocs = Array.isArray(app!.documentMetadata) ? app!.documentMetadata : [];

    // TDD Assertion: Both distinct documents must be retained
    expect(storedDocs.length).toBe(2);
    expect(storedDocs.some((d: any) => d.documentId === 'doc_bank_stmt_january_001')).toBe(true);
    expect(storedDocs.some((d: any) => d.documentId === 'doc_bank_stmt_february_002')).toBe(true);
  });

  /**
   * Test 2: Array Destruction on Renewal
   * Renewing the application PDF URL must not corrupt the documentMetadata array
   * or strip secondary supporting documents.
   */
  it('Test 2: Renewing application PDF URL preserves secondary documents and array structure', async () => {
    const appId = 'app_test_pdf_renew_destruct_02';
    const ref = 'FF-2026-RENEW02';

    await saveOrUpdateApplication(appId, ref, 'submitted', {
      business: { company_name: 'Apex Destruction Ltd' },
    } as any);

    // Seed Application PDF
    await updateDocumentMetadata(appId, {
      documentId: `doc_app_pdf_${appId}`,
      documentVersion: 'gen_pdf_v1',
      documentType: 'completed_application',
      fileName: `${ref}-application.pdf`,
      generatedPdfPath: `applications/ff/${appId}/generated/${ref}-application.pdf`,
      storagePath: `applications/ff/${appId}/generated/${ref}-application.pdf`,
      downloadUrl: 'https://mock-storage.example.invalid/expired_pdf',
      downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z',
    });

    // Seed Secondary Supporting Document
    await addDocumentToApplication(appId, {
      documentId: 'doc_supporting_aged_debtor_999',
      documentVersion: 'gen_debtor_v1',
      documentType: 'aged_debtor_report',
      fileName: 'Aged_Debtors_Q3.pdf',
      storagePath: `applications/ff/${appId}/documents/aged_debtor_report/Aged_Debtors_Q3.pdf`,
      downloadUrl: 'https://mock-storage.example.invalid/debtors_expired',
      downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z',
    });

    // Execute renewal of the PDF
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        submissionRef: ref,
        documentId: `doc_app_pdf_${appId}`,
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(200);

    // TDD Assertion: Secondary document and array integrity must be preserved
    const appAfter = await getApplicationById(appId);
    expect(Array.isArray(appAfter!.documentMetadata)).toBe(true);
    expect(appAfter!.documentMetadata.length).toBe(2);

    const secondaryDoc = appAfter!.documentMetadata.find(
      (d: any) => d.documentId === 'doc_supporting_aged_debtor_999'
    );
    expect(secondaryDoc).toBeDefined();
    expect(secondaryDoc.fileName).toBe('Aged_Debtors_Q3.pdf');
  });

  /**
   * Test 3: Enforce Server-Side Storage Paths
   * Client-provided storagePath and documentId are ignored.
   * Path must be deterministically constructed server-side, and GCS existence must be verified.
   */
  it('Test 3: record-document-upload enforces server-side storage paths and validates existence', async () => {
    const appId = 'app_test_tenant_a_123';
    const ref = 'FF-2026-TENANT-A';

    await saveOrUpdateApplication(appId, ref, 'submitted', {
      business: { company_name: 'Tenant A Victim' },
    } as any);

    const { token } = await createDocumentRequestToken({
      applicationId: appId,
      submissionRef: ref,
    });

    // Case A: File does NOT exist in GCS -> must reject with 404
    const mockFileNotExist = {
      exists: vi.fn().mockResolvedValue([false]),
    };
    const mockBucket = {
      file: vi.fn().mockImplementation((path: string) => {
        if (path.includes('non_existent.pdf')) {
          return mockFileNotExist;
        }
        return {
          exists: vi.fn().mockResolvedValue([true]),
          getMetadata: vi.fn().mockResolvedValue([{ generation: '123456789', contentType: 'application/pdf', size: 1000 }]),
          getSignedUrl: vi.fn().mockResolvedValue(['https://storage.googleapis.com/valid?generation=123456789']),
        };
      }),
    };

    vi.spyOn(firebaseAdmin, 'isFirebaseConfigured').mockReturnValue(true);
    vi.spyOn(firebaseAdmin, 'getAdminStorage').mockReturnValue({
      bucket: () => mockBucket,
    } as any);

    const { req: reqFail, res: resFail } = createMockReqRes({
      body: {
        token,
        document: {
          documentType: 'bank_statement',
          fileName: 'non_existent.pdf',
          storagePath: `applications/ff/${appId}/documents/bank_statement/non_existent.pdf`,
        },
      },
    });

    await recordDocumentUploadHandler(reqFail, resFail);
    expect(resFail._getStatusCode()).toBe(404);

    // Case B: Valid existing file -> deterministic path enforced server-side
    const { req: reqSuccess, res: resSuccess } = createMockReqRes({
      body: {
        token,
        document: {
          documentType: 'bank_statement',
          fileName: 'valid_statement.pdf',
          storagePath: 'tenants/other_tenant/spoofed.pdf', // Should be IGNORED
          documentId: 'client_spoofed_id', // Should be IGNORED
        },
      },
    });

    await recordDocumentUploadHandler(reqSuccess, resSuccess);
    expect(resSuccess._getStatusCode()).toBe(200);

    const recordedDoc = resSuccess._getData().document;
    const expectedPath = `applications/ff/${appId}/documents/bank_statement/valid_statement.pdf`;
    expect(recordedDoc.storagePath).toBe(expectedPath);
    expect(recordedDoc.documentId).not.toBe('client_spoofed_id');
    expect(recordedDoc.documentId).toMatch(/^doc_/);
  });

  /**
   * Test 4: Pin Download URLs to Object Generation
   * Download URLs generated by GCS getSignedUrl must include queryParams.generation.
   */
  it('Test 4: GCS getSignedUrl call pins generation in signed URL query parameters', async () => {
    const appId = 'app_test_unpinned_gen_04';
    const ref = 'FF-2026-UNPIN04';

    await saveOrUpdateApplication(appId, ref, 'submitted', {
      business: { company_name: 'Pinned Gen Test' },
    } as any);

    const docVersion = '1792259589793971';
    await addDocumentToApplication(appId, {
      documentId: 'doc_unpinned_test_04',
      documentVersion: docVersion,
      documentType: 'bank_statement',
      fileName: 'Statement.pdf',
      storagePath: `applications/ff/${appId}/documents/bank_statement/Statement.pdf`,
      downloadUrl: 'https://storage.googleapis.com/test-bucket/old?expires=123',
      downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z',
    });

    const mockGetSignedUrl = vi.fn().mockImplementation(async (options: any) => {
      const queryParams = new URLSearchParams();
      if (options.queryParams?.generation) {
        queryParams.set('generation', String(options.queryParams.generation));
      }
      return [`https://storage.googleapis.com/bucket/doc.pdf?${queryParams.toString()}`];
    });

    const mockFile = {
      exists: vi.fn().mockResolvedValue([true]),
      getMetadata: vi.fn().mockResolvedValue([{ generation: docVersion, contentType: 'application/pdf', size: 12345 }]),
      getSignedUrl: mockGetSignedUrl,
    };

    const mockBucket = {
      file: vi.fn().mockReturnValue(mockFile),
    };

    vi.spyOn(firebaseAdmin, 'isFirebaseConfigured').mockReturnValue(true);
    vi.spyOn(firebaseAdmin, 'getAdminStorage').mockReturnValue({
      bucket: () => mockBucket,
    } as any);

    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${testAdminKey}` },
      body: {
        applicationId: appId,
        submissionRef: ref,
        documentId: 'doc_unpinned_test_04',
      },
    });

    await renewDocumentUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(200);

    const data = res._getData();
    expect(data.success).toBe(true);
    const downloadUrl = data.document.downloadUrl;

    // TDD Assertion: downloadUrl must contain pinned generation parameter
    expect(downloadUrl).toContain(`generation=${docVersion}`);

    const calledOptions = mockGetSignedUrl.mock.calls[0][0];
    expect(calledOptions.queryParams?.generation).toBe(docVersion);
  });

  /**
   * Test 5: Persist and Reuse Event IDs
   * Webhook dispatch must reuse the persistent crmEventId across replays.
   */
  it('Test 5: Persists crmEventId on application and reuses it on renewal webhook replay', async () => {
    const appId = 'app_test_event_churn_05';
    const mondayWebhookUrl = 'https://crm-mock.example.com/webhook';
    process.env.MONDAY_WEBHOOK_URL = mondayWebhookUrl;

    const dispatchedPayloads: any[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url === mondayWebhookUrl) {
        dispatchedPayloads.push(JSON.parse(options.body));
        return { ok: true, status: 200, json: async () => ({ status: 'received' }) };
      }
      return originalFetch(url, options);
    });

    try {
      // 1. Initial application submission triggers first webhook dispatch
      const { req: submitReq, res: submitRes } = createMockReqRes({
        body: {
          id: appId,
          status: 'contact_captured',
          application: {
            business: { company_name: 'Event Churn Logistics Ltd' },
            contact: { contact_full_name: 'Robert Vance', email: 'robert@churn.co.uk' },
          },
        },
      });

      await submitApplicationHandler(submitReq, submitRes);
      expect(submitRes._getStatusCode()).toBe(200);
      const generatedRef = submitRes._getData().submissionRef;
      expect(dispatchedPayloads.length).toBe(1);
      const payload1 = dispatchedPayloads[0];

      // Seed PDF for renewal
      await updateDocumentMetadata(appId, {
        documentId: `doc_app_pdf_${appId}`,
        documentVersion: 'gen_pdf_05',
        documentType: 'completed_application',
        fileName: `${generatedRef}-application.pdf`,
        generatedPdfPath: `applications/ff/${appId}/generated/${generatedRef}-application.pdf`,
        storagePath: `applications/ff/${appId}/generated/${generatedRef}-application.pdf`,
        downloadUrl: 'https://mock-storage.example.invalid/expired_pdf',
        downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z',
      });

      // 2. Trigger renewal replay webhook dispatch
      const { req: renewReq, res: renewRes } = createMockReqRes({
        headers: { authorization: `Bearer ${testAdminKey}` },
        body: {
          applicationId: appId,
          submissionRef: generatedRef,
          documentId: `doc_app_pdf_${appId}`,
          replayWebhook: true,
        },
      });

      await renewDocumentUrlHandler(renewReq, renewRes);
      expect(renewRes._getStatusCode()).toBe(200);
      expect(dispatchedPayloads.length).toBe(2);
      const payload2 = dispatchedPayloads[1];

      // TDD Assertion: Replay must reuse the persistent eventId from initial dispatch
      expect(payload1.eventId).toBeDefined();
      expect(payload2.eventId).toBe(payload1.eventId);
    } finally {
      delete process.env.MONDAY_WEBHOOK_URL;
      global.fetch = originalFetch;
    }
  });

  /**
   * Test 6: Implement Durable Retry Records
   * Webhook 500 error must persist a record into webhook_failures on the application record.
   */
  it('Test 6: Webhook 500 failure persists durable retry record in webhook_failures', async () => {
    const appId = 'app_test_webhook_fail_06';
    const ref = 'FF-2026-FAIL06';
    const mondayWebhookUrl = 'https://crm-mock.example.com/webhook-500';
    process.env.MONDAY_WEBHOOK_URL = mondayWebhookUrl;

    const originalFetch = global.fetch;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === mondayWebhookUrl) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'CRM service unavailable' }),
        };
      }
      return originalFetch(url);
    });

    try {
      await saveOrUpdateApplication(appId, ref, 'submitted', {
        business: { company_name: 'Retry Fail Ltd' },
        contact: { contact_full_name: 'Jane Doe', email: 'jane@retryfail.co.uk' },
      } as any);

      const { token } = await createDocumentRequestToken({
        applicationId: appId,
        submissionRef: ref,
      });

      await addDocumentToApplication(appId, {
        documentId: 'doc_stmt_fail_06',
        documentVersion: 'gen_06',
        documentType: 'bank_statement',
        fileName: 'Statement_Fail.pdf',
        storagePath: `applications/ff/${appId}/documents/bank_statement/Statement_Fail.pdf`,
        downloadUrl: 'https://mock.example.invalid/url',
        downloadUrlExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const { req, res } = createMockReqRes({
        body: { token },
      });

      await completeDocumentUploadHandler(req, res);
      expect(res._getStatusCode()).toBe(200);

      // TDD Assertion: Durable failure record must be stored on application
      const app = await getApplicationById(appId);
      expect(app).not.toBeNull();
      const failures = (app as any).webhook_failures;
      expect(Array.isArray(failures)).toBe(true);
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].error).toContain('500');
      expect(failures[0].payload).toBeDefined();
      expect(failures[0].timestamp).toBeDefined();
    } finally {
      delete process.env.MONDAY_WEBHOOK_URL;
      global.fetch = originalFetch;
      consoleErrorSpy.mockRestore();
    }
  });

  /**
   * Pre-Launch Issue 1: Normal uploads via get-upload-url resolve the server-stored upload record
   * without encountering a 404, matching timestamped GCS paths.
   */
  it('Pre-Launch Issue 1: Normal upload flow resolves server-stored upload record and registers successfully', async () => {
    const appId = 'app_test_normal_upload_07';
    const ref = 'FF-2026-NORM07';

    await saveOrUpdateApplication(appId, ref, 'submitted', {
      business: { company_name: 'Normal Upload Haulage Ltd' },
    } as any);

    const { token } = await createDocumentRequestToken({
      applicationId: appId,
      submissionRef: ref,
    });

    const getUploadUrlHandler = (await import('../get-upload-url.js')).default;

    // 1. Client calls get-upload-url to initialize upload session
    const { req: getReq, res: getRes } = createMockReqRes({
      body: {
        token,
        fileName: 'Bank_Statement_October.pdf',
        fileType: 'application/pdf',
        fileSize: 102400,
        documentType: 'bank_statement',
      },
    });

    await getUploadUrlHandler(getReq, getRes);
    expect(getRes._getStatusCode()).toBe(200);
    const getResData = getRes._getData();
    expect(getResData.success).toBe(true);
    expect(getResData.storagePath).toMatch(/applications\/ff\/app_test_normal_upload_07\/documents\/bank_statement\/\d+_Bank_Statement_October\.pdf/);

    // Mock GCS file existence at the exact storagePath generated by get-upload-url
    const mockFile = {
      exists: vi.fn().mockResolvedValue([true]),
      getMetadata: vi.fn().mockResolvedValue([{ generation: '1792259999', contentType: 'application/pdf', size: 102400 }]),
      getSignedUrl: vi.fn().mockResolvedValue([`https://storage.googleapis.com/${getResData.storagePath}?generation=1792259999`]),
    };
    const mockBucket = {
      file: vi.fn().mockReturnValue(mockFile),
    };
    vi.spyOn(firebaseAdmin, 'isFirebaseConfigured').mockReturnValue(true);
    vi.spyOn(firebaseAdmin, 'getAdminStorage').mockReturnValue({
      bucket: () => mockBucket,
    } as any);

    // 2. Client records the upload using the storagePath provided by get-upload-url
    const { req: recordReq, res: recordRes } = createMockReqRes({
      body: {
        token,
        document: {
          documentType: 'bank_statement',
          fileName: 'Bank_Statement_October.pdf',
          fileSize: 102400,
          storagePath: getResData.storagePath,
        },
      },
    });

    await recordDocumentUploadHandler(recordReq, recordRes);
    expect(recordRes._getStatusCode()).toBe(200);
    const recordData = recordRes._getData();
    expect(recordData.success).toBe(true);
    expect(recordData.document.storagePath).toBe(getResData.storagePath);
    expect(recordData.document.documentId).toBe(getResData.documentId);

    // Verify persisted record in DB
    const app = await getApplicationById(appId);
    expect(app).not.toBeNull();
    const storedDoc = (app!.documentMetadata as any[]).find(
      (d: any) => d.storagePath === getResData.storagePath
    );
    expect(storedDoc).toBeDefined();
    expect(storedDoc.documentId).toBe(getResData.documentId);
  });

  /**
   * Pre-Launch Issue 2: Distinct events have their own event IDs.
   * Document upload batches have their own persistent event ID (not reusing the application event ID),
   * and retries retain that batch's event ID.
   */
  it('Pre-Launch Issue 2: Upload batches have dedicated persistent event ID distinct from application submission', async () => {
    const appId = 'app_test_batch_event_08';
    const mondayWebhookUrl = 'https://crm-mock.example.com/webhook-batches';
    process.env.MONDAY_WEBHOOK_URL = mondayWebhookUrl;

    const dispatchedPayloads: any[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url === mondayWebhookUrl) {
        dispatchedPayloads.push(JSON.parse(options.body));
        return { ok: true, status: 200, json: async () => ({ status: 'received' }) };
      }
      return originalFetch(url, options);
    });

    try {
      // 1. Initial application submission
      const { req: subReq, res: subRes } = createMockReqRes({
        body: {
          id: appId,
          status: 'contact_captured',
          application: {
            business: { company_name: 'Batch Event Ltd' },
            contact: { contact_full_name: 'Robert Vance', email: 'robert@batchevent.co.uk' },
          },
        },
      });
      await submitApplicationHandler(subReq, subRes);
      expect(subRes._getStatusCode()).toBe(200);
      expect(dispatchedPayloads.length).toBe(1);
      const appPayload = dispatchedPayloads[0];
      expect(appPayload.event).toBe('new_factoring_enquiry');
      expect(appPayload.eventId).toMatch(/^evt_sub_/);

      // 2. Create upload token and add document for upload batch
      const { token } = await createDocumentRequestToken({
        applicationId: appId,
        submissionRef: subRes._getData().submissionRef,
      });

      await addDocumentToApplication(appId, {
        documentId: 'doc_batch_item_01',
        documentVersion: 'gen_batch_01',
        documentType: 'bank_statement',
        fileName: 'Batch_Statement.pdf',
        storagePath: `applications/ff/${appId}/documents/bank_statement/Batch_Statement.pdf`,
        downloadUrl: 'https://mock.example.invalid/batch_doc',
        downloadUrlExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      // 3. Complete first upload batch
      const { req: compReq1, res: compRes1 } = createMockReqRes({ body: { token } });
      await completeDocumentUploadHandler(compReq1, compRes1);
      expect(compRes1._getStatusCode()).toBe(200);
      expect(dispatchedPayloads.length).toBe(2);
      const batchPayload1 = dispatchedPayloads[1];

      // Verified: Upload batch has its own event ID, NOT sharing application event ID
      expect(batchPayload1.event).toBe('documents_uploaded');
      expect(batchPayload1.eventId).toMatch(/^evt_docs_/);
      expect(batchPayload1.eventId).not.toBe(appPayload.eventId);

      // 4. Retry the same upload batch (e.g. webhook replay / retry) -> must retain batch event ID
      const { req: compReq2, res: compRes2 } = createMockReqRes({ body: { token } });
      await completeDocumentUploadHandler(compReq2, compRes2);
      expect(compRes2._getStatusCode()).toBe(200);
      expect(dispatchedPayloads.length).toBe(3);
      const batchPayload2 = dispatchedPayloads[2];

      expect(batchPayload2.eventId).toBe(batchPayload1.eventId);
    } finally {
      delete process.env.MONDAY_WEBHOOK_URL;
      global.fetch = originalFetch;
    }
  });

  /**
   * Pre-Launch Issue 3: Failure records are complete with full payload and event ID.
   * Both initial submission failures and renewal network failures persist recoverable records.
   */
  it('Pre-Launch Issue 3: Submission failure and renewal network failure store full payload and event ID', async () => {
    const appId = 'app_test_full_failures_09';
    const mondayWebhookUrl = 'https://crm-mock.example.com/webhook-failures';
    process.env.MONDAY_WEBHOOK_URL = mondayWebhookUrl;

    const originalFetch = global.fetch;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock fetch to simulate 500 on submission, and network TypeError on renewal
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === mondayWebhookUrl) {
        callCount++;
        if (callCount === 1) {
          // Submission failure (500)
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'CRM Down' }),
          };
        } else {
          // Renewal network failure
          throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:443');
        }
      }
      return originalFetch(url);
    });

    try {
      // 1. Trigger failing submission
      const { req: subReq, res: subRes } = createMockReqRes({
        body: {
          id: appId,
          status: 'contact_captured',
          application: {
            business: { company_name: 'Failure Record Ltd' },
            contact: { contact_full_name: 'Alice Vance', email: 'alice@failurerecord.co.uk' },
          },
        },
      });

      await submitApplicationHandler(subReq, subRes);
      expect(subRes._getStatusCode()).toBe(200);

      // Check DB for initial submission failure record
      let app = await getApplicationById(appId);
      expect(app).not.toBeNull();
      expect(Array.isArray(app!.webhook_failures)).toBe(true);
      expect(app!.webhook_failures!.length).toBe(1);

      const subFailure = app!.webhook_failures![0];
      expect(subFailure.eventId).toMatch(/^evt_sub_/);
      expect(subFailure.payload).toBeDefined();
      expect(subFailure.payload.event).toBe('new_factoring_enquiry');
      expect(subFailure.payload.data.business.company_name).toBe('Failure Record Ltd');
      expect(subFailure.error).toContain('500');

      // 2. Trigger renewal network failure
      const ref = subRes._getData().submissionRef;
      await updateDocumentMetadata(appId, {
        documentId: `doc_app_pdf_${appId}`,
        documentVersion: 'gen_pdf_09',
        documentType: 'completed_application',
        fileName: `${ref}-application.pdf`,
        generatedPdfPath: `applications/ff/${appId}/generated/${ref}-application.pdf`,
        storagePath: `applications/ff/${appId}/generated/${ref}-application.pdf`,
        downloadUrl: 'https://mock-storage.example.invalid/expired_pdf',
        downloadUrlExpiresAt: '2026-10-10T00:00:00.000Z',
      });

      const { req: renewReq, res: renewRes } = createMockReqRes({
        headers: { authorization: `Bearer ${testAdminKey}` },
        body: {
          applicationId: appId,
          submissionRef: ref,
          documentId: `doc_app_pdf_${appId}`,
          replayWebhook: true,
        },
      });

      await renewDocumentUrlHandler(renewReq, renewRes);
      expect(renewRes._getStatusCode()).toBe(200);

      // Check DB for renewal network failure record
      app = await getApplicationById(appId);
      expect(app!.webhook_failures!.length).toBe(2);

      const renewFailure = app!.webhook_failures![1];
      expect(renewFailure.eventId).toMatch(/^evt_sub_/); // Pinned to logical event ID
      expect(renewFailure.payload).toBeDefined();
      expect(renewFailure.payload.event).toBe('new_factoring_enquiry');
      expect(renewFailure.payload.data.submissionRef).toBe(ref);
      expect(renewFailure.payload.data.pdfDownloadUrl).toBeDefined(); // Contains full replay payload!
      expect(renewFailure.error).toContain('ECONNREFUSED');
    } finally {
      delete process.env.MONDAY_WEBHOOK_URL;
      global.fetch = originalFetch;
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    }
  });
});
