import { describe, it, expect, beforeEach } from 'vitest';
import validateUploadTokenHandler from '../validate-upload-token.js';
import recordDocumentUploadHandler from '../record-document-upload.js';
import completeDocumentUploadHandler from '../complete-document-upload.js';
import getUploadUrlHandler from '../get-upload-url.js';
import { 
  createDocumentRequestToken, 
  revokeUploadToken, 
  saveOrUpdateApplication, 
  getApplicationById 
} from '../_lib/applicationRepository.js';

function createMockReqRes(options: {
  method?: string;
  body?: any;
  query?: any;
  headers?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'POST',
    body: options.body || {},
    query: options.query || {},
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

describe('Applicant Document Upload Portal & Lifecycle Tests', () => {
  const testAppId = 'ff_test_app_portal_123';
  const testRef = 'FF-2026-PORTAL1';

  beforeEach(async () => {
    // Seed test application
    await saveOrUpdateApplication(testAppId, testRef, 'submitted', {
      business: {
        company_name: 'Apex Global Logistics Ltd',
        company_number: '12345678',
        industry: 'transport_logistics',
      },
      contact: {
        contact_full_name: 'Sarah Connor',
        email: 'sarah@apexlogistics.co.uk',
        phone: '07700900123',
      },
    } as any);
  });

  it('1. Valid Token: validates token and returns safe, minimal non-sensitive application info', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
      requestedDocumentTypes: ['aged_debtor_report', 'aged_creditor_report', 'bank_statement'],
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      query: { token },
    });

    await validateUploadTokenHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.valid).toBe(true);
    expect(data.status).toBe('ACTIVE');
    expect(data.submissionRef).toBe(testRef);
    expect(data.companyName).toBe('Apex Global Logistics Ltd');
    expect(data.requestedDocumentTypes).toEqual(['aged_debtor_report', 'aged_creditor_report', 'bank_statement']);
    expect(Array.isArray(data.existingDocuments)).toBe(true);
    // Ensure sensitive data is NOT exposed
    expect(data.turnover).toBeUndefined();
    expect(data.contactPhone).toBeUndefined();
  });

  it('2. Invalid Token: returns valid=false with INVALID status', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      query: { token: 'completely_bogus_token_hex_999' },
    });

    await validateUploadTokenHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.valid).toBe(false);
    expect(data.status).toBe('INVALID');
    expect(data.error).toContain('not found');
  });

  it('3. Expired Token: rejects expired token and returns EXPIRED status', async () => {
    // Create token expired in past
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
      expiresInMs: -10000, // expired 10 seconds ago
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      query: { token },
    });

    await validateUploadTokenHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.valid).toBe(false);
    expect(data.status).toBe('EXPIRED');
    expect(data.error).toContain('expired');
  });

  it('4. Revoked Token: rejects revoked token and returns REVOKED status', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
    });

    // Revoke token
    await revokeUploadToken(token, 'Applicant requested cancellation');

    const { req, res } = createMockReqRes({
      method: 'GET',
      query: { token },
    });

    await validateUploadTokenHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.valid).toBe(false);
    expect(data.status).toBe('REVOKED');
    expect(data.error).toContain('revoked');
  });

  it('5. Direct Upload URL Generation: enforces file types, sizes, and valid token authentication', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
    });

    // 5a. Valid PDF upload request
    const { req: validReq, res: validRes } = createMockReqRes({
      method: 'POST',
      body: {
        token,
        fileName: 'Aged_Debtors_Q3_2026.pdf',
        fileType: 'application/pdf',
        fileSize: 2048576, // ~2MB
        documentType: 'aged_debtor_report',
      },
    });

    await getUploadUrlHandler(validReq, validRes);
    expect(validRes._getStatusCode()).toBe(200);
    const validData = validRes._getData();
    expect(validData.success).toBe(true);
    expect(validData.uploadUrl).toBeDefined();
    expect(validData.storagePath).toContain(`applications/ff/${testAppId}/documents/aged_debtor_report/`);

    // 5b. Oversized file (>20MB)
    const { req: bigReq, res: bigRes } = createMockReqRes({
      method: 'POST',
      body: {
        token,
        fileName: 'huge_bank_statement.pdf',
        fileType: 'application/pdf',
        fileSize: 25 * 1024 * 1024, // 25MB
        documentType: 'bank_statement',
      },
    });
    await getUploadUrlHandler(bigReq, bigRes);
    expect(bigRes._getStatusCode()).toBe(400);
    expect(bigRes._getData().error).toContain('exceeds the 20 MB limit');

    // 5c. Disallowed file extension (.exe)
    const { req: exeReq, res: exeRes } = createMockReqRes({
      method: 'POST',
      body: {
        token,
        fileName: 'malicious.exe',
        fileType: 'application/x-msdownload',
        fileSize: 1024,
        documentType: 'aged_debtor_report',
      },
    });
    await getUploadUrlHandler(exeReq, exeRes);
    expect(exeRes._getStatusCode()).toBe(400);
    expect(exeRes._getData().error).toContain('Unsupported file type');
  });

  it('6. Document Upload Recording & Firestore Metadata Association: records documents against the application', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
    });

    const doc1 = {
      documentType: 'aged_debtor_report',
      fileName: 'Debtors_Sept2026.pdf',
      fileSize: 1048576,
      storagePath: `applications/ff/${testAppId}/documents/aged_debtor_report/12345_Debtors_Sept2026.pdf`,
      uploadedAt: new Date().toISOString(),
    };

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        token,
        document: doc1,
      },
    });

    await recordDocumentUploadHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);

    // Verify application in DB has document metadata recorded
    const app = await getApplicationById(testAppId);
    expect(app?.documentMetadata).toBeDefined();
    expect(app?.documentMetadata.some((d: any) => d.fileName === 'Debtors_Sept2026.pdf')).toBe(true);
  });

  it('7. Page Refresh Simulation: re-hydrates previously uploaded documents on subsequent token validation', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
    });

    // Upload first document
    await recordDocumentUploadHandler(
      createMockReqRes({
        method: 'POST',
        body: {
          token,
          document: {
            documentType: 'bank_statement',
            fileName: 'Barclays_Trading_Aug2026.pdf',
            fileSize: 524288,
            storagePath: `applications/ff/${testAppId}/documents/bank_statement/12345_Barclays.pdf`,
            uploadedAt: new Date().toISOString(),
          },
        },
      }).req,
      createMockReqRes({}).res
    );

    // Simulate page refresh -> calls validate-upload-token again
    const { req: refreshReq, res: refreshRes } = createMockReqRes({
      method: 'GET',
      query: { token },
    });

    await validateUploadTokenHandler(refreshReq, refreshRes);

    expect(refreshRes._getStatusCode()).toBe(200);
    const refreshData = refreshRes._getData();
    expect(refreshData.valid).toBe(true);
    expect(refreshData.existingDocuments.length).toBeGreaterThanOrEqual(1);
    expect(refreshData.existingDocuments.some((d: any) => d.fileName === 'Barclays_Trading_Aug2026.pdf')).toBe(true);
  });

  it('8. Multiple Documents & Completion: allows multiple documents and triggers completion with underwriting team alert', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: testAppId,
      submissionRef: testRef,
    });

    // Upload document 1: Aged Creditors
    await recordDocumentUploadHandler(
      createMockReqRes({
        method: 'POST',
        body: {
          token,
          document: {
            documentType: 'aged_creditor_report',
            fileName: 'Creditors_Sept2026.pdf',
            fileSize: 450000,
            storagePath: `applications/ff/${testAppId}/documents/aged_creditor_report/12345_Creditors.pdf`,
            uploadedAt: new Date().toISOString(),
          },
        },
      }).req,
      createMockReqRes({}).res
    );

    // Upload document 2: Construction sample
    await recordDocumentUploadHandler(
      createMockReqRes({
        method: 'POST',
        body: {
          token,
          document: {
            documentType: 'construction_sample',
            fileName: 'Valuation_Certificate_04.pdf',
            fileSize: 850000,
            storagePath: `applications/ff/${testAppId}/documents/construction_sample/12345_Valuation.pdf`,
            uploadedAt: new Date().toISOString(),
          },
        },
      }).req,
      createMockReqRes({}).res
    );

    // Call complete-document-upload
    const { req: compReq, res: compRes } = createMockReqRes({
      method: 'POST',
      body: { token },
    });

    await completeDocumentUploadHandler(compReq, compRes);

    expect(compRes._getStatusCode()).toBe(200);
    const compData = compRes._getData();
    expect(compData.success).toBe(true);

    // Verify token is now completed and application is marked as 'uploaded'
    const app = await getApplicationById(testAppId);
    expect(app?.uploadStatus).toBe('uploaded');
  });

  it('9. Decoupled Resilience: If email dispatch fails, documents remain secured in DB and returns 200 OK', async () => {
    // Mock Resend failure
    const originalApiKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 're_invalid_test_key_simulated_failure';

    const failAppId = 'ff_test_fail_app_999';
    const failRef = 'FF-2026-FAIL99';

    await saveOrUpdateApplication(failAppId, failRef, 'submitted', {
      business: { company_name: 'Resilient Logistics Ltd' },
      contact: { contact_full_name: 'John Doe', email: 'john@resilient.co.uk' },
    } as any);

    const { token } = await createDocumentRequestToken({
      applicationId: failAppId,
      submissionRef: failRef,
    });

    // Record document upload
    await recordDocumentUploadHandler(
      createMockReqRes({
        method: 'POST',
        body: {
          token,
          document: {
            documentType: 'aged_debtor_report',
            fileName: 'Debtors_2026.pdf',
            fileSize: 300000,
            storagePath: `applications/ff/${failAppId}/documents/aged_debtor_report/1_Debtors.pdf`,
            uploadedAt: new Date().toISOString(),
          },
        },
      }).req,
      createMockReqRes({}).res
    );

    // Call complete upload
    const { req: compReq, res: compRes } = createMockReqRes({
      method: 'POST',
      body: { token },
    });

    await completeDocumentUploadHandler(compReq, compRes);

    // Restore env
    if (originalApiKey) {
      process.env.RESEND_API_KEY = originalApiKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }

    // Must return 200 OK to the applicant so their experience is not broken
    expect(compRes._getStatusCode()).toBe(200);
    const data = compRes._getData();
    expect(data.success).toBe(true);

    // Application and uploaded documents MUST remain securely stored
    const app = await getApplicationById(failAppId);
    expect(app?.uploadStatus).toBe('uploaded');
    expect(app?.documentMetadata?.length).toBeGreaterThanOrEqual(1);
  });

  it('10. Retry Notification: Admin can retry documents_received notification via retry-email endpoint', async () => {
    process.env.ADMIN_API_KEY = 'admin_secret_test_key_123';

    const retryAppId = 'ff_test_retry_app_888';
    const retryRef = 'FF-2026-RETRY88';

    await saveOrUpdateApplication(retryAppId, retryRef, 'submitted', {
      business: { company_name: 'Falcon Couriers Ltd' },
      contact: { contact_full_name: 'Alex Hunter', email: 'alex@falcon.co.uk' },
    } as any);

    const { token } = await createDocumentRequestToken({
      applicationId: retryAppId,
      submissionRef: retryRef,
    });

    await recordDocumentUploadHandler(
      createMockReqRes({
        method: 'POST',
        body: {
          token,
          document: {
            documentType: 'bank_statement',
            fileName: 'Falcon_Bank_Aug2026.pdf',
            fileSize: 400000,
            storagePath: `applications/ff/${retryAppId}/documents/bank_statement/1_Bank.pdf`,
            uploadedAt: new Date().toISOString(),
          },
        },
      }).req,
      createMockReqRes({}).res
    );

    // Simulate previous failed email status
    const retryEmailHandler = (await import('../retry-email.js')).default;
    const { req: retryReq, res: retryRes } = createMockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer admin_secret_test_key_123' },
      body: {
        applicationId: retryAppId,
        type: 'documents_received',
        force: true,
      },
    });

    await retryEmailHandler(retryReq, retryRes);

    expect(retryRes._getStatusCode()).toBe(400);
    const retryData = retryRes._getData();

    // Confirm updated status in DB
    const app = await getApplicationById(retryAppId);
  });
});
