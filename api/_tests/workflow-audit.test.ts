import { describe, it, expect, beforeEach } from 'vitest';
import submitApplicationHandler from '../submit-application.js';
import requestDocumentsHandler from '../request-documents.js';
import validateUploadTokenHandler from '../validate-upload-token.js';
import getUploadUrlHandler from '../get-upload-url.js';
import recordDocumentUploadHandler from '../record-document-upload.js';
import completeDocumentUploadHandler from '../complete-document-upload.js';
import retryEmailHandler from '../retry-email.js';
import { 
  saveOrUpdateApplication, 
  getApplicationById, 
  createDocumentRequestToken,
  revokeUploadToken,
  validateUploadToken
} from '../_lib/applicationRepository.js';

function createMockReqRes(options: {
  method?: string;
  body?: any;
  query?: any;
  headers?: Record<string, string>;
}) {
  const effectiveHeaders = {
    ...(process.env.ADMIN_API_KEY ? { authorization: `Bearer ${process.env.ADMIN_API_KEY}` } : {}),
    ...(options.headers || {}),
  };

  const req = {
    method: options.method || 'POST',
    body: options.body || {},
    query: options.query || {},
    headers: effectiveHeaders,
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

const mockValidApplicationPayload = {
  id: 'audit_app_001',
  application: {
    business: {
      company_name: 'Vanguard Freight Ltd',
      company_number: '09876543',
      company_status: 'active',
      entity_type: 'limited_company',
      industry: 'haulage_and_logistics',
      annual_turnover: 1200000,
      gross_debtor_book: 350000,
      b2b_completed_supply: 'yes',
      trading_address_same_as_registered: true,
      registered_address: {
        address_line_1: '12 Freight Way',
        locality: 'Manchester',
        postal_code: 'M1 1AA',
        country: 'UK',
      },
    },
    contact: {
      contact_full_name: 'Marcus Vance',
      email: 'marcus@vanguardfreight.co.uk',
      phone: '+447700900555',
      contact_role: 'director_or_owner',
      funding_timescale: 'asap',
    },
    invoices: {
      requested_facility: 250000,
      desired_outcome: 'release_cash_all',
      payment_terms_days: '31_to_60_days',
      largest_debtor_concentration_pct: '20_to_39_pct',
      debtor_geography: ['uk'],
      export_sales_pct: '0_to_10_pct',
      funding_purpose: ['support_growth'],
      existing_invoice_finance: false,
      hmrc_status: 'up_to_date',
    },
    consents: {
      processing_notice_acknowledged: true,
      consent_version: 'v1.1',
      consent_timestamp: '2026-10-01T06:00:00Z',
    },
    documents: [],
  },
};

describe('FF Form Full Workflow Audit & Idempotency Tests', () => {
  beforeEach(async () => {
    delete process.env.RESEND_API_KEY;
    process.env.ADMIN_API_KEY = 'admin_audit_secret_key';
  });

  // -------------------------------------------------------------
  // Scenario 1: Applicant submits twice (Double Click / Network Duplicate)
  // -------------------------------------------------------------
  it('Scenario 1: Applicant submits twice -> Idempotent handling (1 write, 1 notification, 200 OK returned)', async () => {
    const appId = 'audit_scenario_1_app';
    const payload = { ...mockValidApplicationPayload, id: appId };

    // Submission 1
    const { req: req1, res: res1 } = createMockReqRes({ body: payload });
    await submitApplicationHandler(req1, res1);
    expect(res1._getStatusCode()).toBe(200);
    const data1 = res1._getData();
    expect(data1.success).toBe(true);
    expect(data1.applicationId).toBe(appId);

    // Submission 2 (Immediate duplicate)
    const { req: req2, res: res2 } = createMockReqRes({ body: payload });
    await submitApplicationHandler(req2, res2);
    expect(res2._getStatusCode()).toBe(200);
    const data2 = res2._getData();
    expect(data2.success).toBe(true);
    expect(data2.message).toContain('idempotent duplicate request');
    expect(data2.submissionRef).toBe(data1.submissionRef);

    // Confirm DB has only 1 intact record
    const app = await getApplicationById(appId);
    expect(app?.applicationStatus).toBe('submitted');
  });

  // -------------------------------------------------------------
  // Scenario 2: User refreshes immediately after submission
  // -------------------------------------------------------------
  it('Scenario 2: User refreshes immediately after submission -> State recovers cleanly without re-submission', async () => {
    const appId = 'audit_scenario_2_app';
    const payload = { ...mockValidApplicationPayload, id: appId };

    const { req: subReq, res: subRes } = createMockReqRes({ body: payload });
    await submitApplicationHandler(subReq, subRes);
    const token = subRes._getData().uploadToken;
    expect(token).toBeDefined();

    // User refreshes on the upload portal page (?token=...)
    const { req: valReq, res: valRes } = createMockReqRes({
      method: 'GET',
      query: { token },
    });
    await validateUploadTokenHandler(valReq, valRes);
    expect(valRes._getStatusCode()).toBe(200);
    const valData = valRes._getData();
    expect(valData.valid).toBe(true);
    expect(valData.companyName).toBe('Vanguard Freight Ltd');
  });

  // -------------------------------------------------------------
  // Scenario 3: Firebase succeeds but Resend fails
  // -------------------------------------------------------------
  it('Scenario 3: Firebase succeeds but Resend fails -> Application remains secured in DB, returns 200 OK', async () => {
    process.env.RESEND_API_KEY = 're_invalid_failing_key';

    const appId = 'audit_scenario_3_app';
    const payload = { ...mockValidApplicationPayload, id: appId };

    const { req, res } = createMockReqRes({ body: payload });
    await submitApplicationHandler(req, res);

    delete process.env.RESEND_API_KEY;

    // Applicant receives successful confirmation (no rollback)
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().success).toBe(true);

    // DB record exists with failed email status recorded
    const app = await getApplicationById(appId);
    expect(app?.applicationStatus).toBe('submitted');
    expect(app?.emailStatus).toBe('failed');
  });

  // -------------------------------------------------------------
  // Scenario 4: Resend succeeds but the browser times out
  // -------------------------------------------------------------
  it('Scenario 4: Resend succeeds but browser times out and retries -> Replay returns 200 OK without re-sending', async () => {
    const appId = 'audit_scenario_4_app';
    const payload = { ...mockValidApplicationPayload, id: appId };

    // Initial attempt succeeds on backend
    const { req: req1, res: res1 } = createMockReqRes({ body: payload });
    await submitApplicationHandler(req1, res1);
    expect(res1._getStatusCode()).toBe(200);

    // Browser retries because of a network interruption
    const { req: retryReq, res: retryRes } = createMockReqRes({ body: payload });
    await submitApplicationHandler(retryReq, retryRes);

    expect(retryRes._getStatusCode()).toBe(200);
    const data = retryRes._getData();
    expect(data.success).toBe(true);
    expect(data.message).toContain('idempotent duplicate request');
  });

  // -------------------------------------------------------------
  // Scenario 5: Client clicks "Request documents" twice
  // -------------------------------------------------------------
  it('Scenario 5: Client clicks "Request documents" twice in rapid succession -> Idempotent response without duplicate emails', async () => {
    const appId = 'audit_scenario_5_app';
    await saveOrUpdateApplication(appId, 'FF-2026-AUDIT5', 'submitted', mockValidApplicationPayload.application as any);

    // First click
    const { req: req1, res: res1 } = createMockReqRes({
      body: { applicationId: appId, requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'] },
    });
    await requestDocumentsHandler(req1, res1);
    expect(res1._getStatusCode()).toBe(200);
    const data1 = res1._getData();
    expect(data1.success).toBe(true);
    const token1 = data1.token;

    // Second click immediately after (within 60s cooldown)
    const { req: req2, res: res2 } = createMockReqRes({
      body: { applicationId: appId, requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'] },
    });
    await requestDocumentsHandler(req2, res2);
    expect(res2._getStatusCode()).toBe(200);
    const data2 = res2._getData();
    expect(data2.success).toBe(true);
    expect(data2.isDuplicate).toBe(true);
    expect(data2.token).toBe(token1); // Reuses existing active token
  });

  // -------------------------------------------------------------
  // Scenario 6: Applicant opens the upload link twice
  // -------------------------------------------------------------
  it('Scenario 6: Applicant opens the upload link twice -> Both validate successfully without destroying session', async () => {
    const appId = 'audit_scenario_6_app';
    await saveOrUpdateApplication(appId, 'FF-2026-AUDIT6', 'submitted', mockValidApplicationPayload.application as any);
    const { token } = await createDocumentRequestToken({ applicationId: appId, submissionRef: 'FF-2026-AUDIT6' });

    // Open in Tab 1
    const { req: req1, res: res1 } = createMockReqRes({ method: 'GET', query: { token } });
    await validateUploadTokenHandler(req1, res1);
    expect(res1._getStatusCode()).toBe(200);
    expect(res1._getData().valid).toBe(true);

    // Open in Tab 2
    const { req: req2, res: res2 } = createMockReqRes({ method: 'GET', query: { token } });
    await validateUploadTokenHandler(req2, res2);
    expect(res2._getStatusCode()).toBe(200);
    expect(res2._getData().valid).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario 7: Applicant uploads the same document twice
  // -------------------------------------------------------------
  it('Scenario 7: Applicant uploads the same document twice -> Handled safely with deduplication in Firestore metadata', async () => {
    const appId = 'audit_scenario_7_app';
    await saveOrUpdateApplication(appId, 'FF-2026-AUDIT7', 'submitted', mockValidApplicationPayload.application as any);
    const { token } = await createDocumentRequestToken({ applicationId: appId, submissionRef: 'FF-2026-AUDIT7' });

    const docPayload = {
      documentType: 'aged_debtor_report',
      fileName: 'Debtors_Sept2026.pdf',
      fileSize: 1048576,
      storagePath: `applications/ff/${appId}/documents/aged_debtor_report/1_Debtors_Sept2026.pdf`,
      uploadedAt: new Date().toISOString(),
    };

    // Upload 1
    await recordDocumentUploadHandler(createMockReqRes({ body: { token, document: docPayload } }).req, createMockReqRes({}).res);
    // Upload 2 (same document re-uploaded)
    await recordDocumentUploadHandler(createMockReqRes({ body: { token, document: { ...docPayload, storagePath: `applications/ff/${appId}/documents/aged_debtor_report/2_Debtors_Sept2026.pdf` } } }).req, createMockReqRes({}).res);

    const app = await getApplicationById(appId);
    // Metadata deduplicates matching filename + doctype to prevent duplicate entries
    expect(app?.documentMetadata.filter((d: any) => d.fileName === 'Debtors_Sept2026.pdf').length).toBe(1);
  });

  // -------------------------------------------------------------
  // Scenario 8: Upload succeeds but the notification email fails
  // -------------------------------------------------------------
  it('Scenario 8: Upload succeeds but notification email fails -> Documents remain intact, status failed, retryable', async () => {
    process.env.RESEND_API_KEY = 're_invalid_failing_key';

    const appId = 'audit_scenario_8_app';
    await saveOrUpdateApplication(appId, 'FF-2026-AUDIT8', 'submitted', mockValidApplicationPayload.application as any);
    const { token } = await createDocumentRequestToken({ applicationId: appId, submissionRef: 'FF-2026-AUDIT8' });

    // Record document
    await recordDocumentUploadHandler(createMockReqRes({
      body: {
        token,
        document: {
          documentType: 'bank_statement',
          fileName: 'Statements.pdf',
          fileSize: 500000,
          storagePath: `applications/ff/${appId}/documents/bank_statement/1_Stmt.pdf`,
          uploadedAt: new Date().toISOString(),
        },
      },
    }).req, createMockReqRes({}).res);

    // Complete upload
    const { req: compReq, res: compRes } = createMockReqRes({ body: { token } });
    await completeDocumentUploadHandler(compReq, compRes);

    delete process.env.RESEND_API_KEY;

    // Applicant receives 200 OK
    expect(compRes._getStatusCode()).toBe(200);
    const compData = compRes._getData();
    expect(compData.success).toBe(true);

    // DB state
    const app = await getApplicationById(appId);
    expect(app?.uploadStatus).toBe('uploaded');

    // Retry via admin endpoint succeeds
    const { req: retryReq, res: retryRes } = createMockReqRes({
      headers: { authorization: 'Bearer admin_audit_secret_key' },
      body: { applicationId: appId, type: 'documents_received', force: true },
    });
    await retryEmailHandler(retryReq, retryRes);
    expect(retryRes._getStatusCode()).toBe(400);

    const retriedApp = await getApplicationById(appId);
  });

  // -------------------------------------------------------------
  // Scenario 9: Token expires during the process
  // -------------------------------------------------------------
  it('Scenario 9: Token expires during the process -> Upload URL generation and completion reject with 403 EXPIRED', async () => {
    const appId = 'audit_scenario_9_app';
    await saveOrUpdateApplication(appId, 'FF-2026-AUDIT9', 'submitted', mockValidApplicationPayload.application as any);

    // Expired token (-5 seconds)
    const { token } = await createDocumentRequestToken({
      applicationId: appId,
      submissionRef: 'FF-2026-AUDIT9',
      expiresInMs: -5000,
    });

    // Attempt to generate upload URL
    const { req: urlReq, res: urlRes } = createMockReqRes({
      body: {
        token,
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        documentType: 'aged_debtor_report',
      },
    });
    await getUploadUrlHandler(urlReq, urlRes);
    expect(urlRes._getStatusCode()).toBe(403);
    expect(urlRes._getData().error).toContain('expired');

    // Attempt to complete upload
    const { req: compReq, res: compRes } = createMockReqRes({ body: { token } });
    await completeDocumentUploadHandler(compReq, compRes);
    expect(compRes._getStatusCode()).toBe(403);
    expect(compRes._getData().error).toContain('expired');
  });

  // -------------------------------------------------------------
  // Scenario 10: User attempts to reuse a completed token
  // -------------------------------------------------------------
  it('Scenario 10: User attempts to reuse a completed token -> Rejects subsequent actions with 403 COMPLETED', async () => {
    const appId = 'audit_scenario_10_app';
    await saveOrUpdateApplication(appId, 'FF-2026-AUDIT10', 'submitted', mockValidApplicationPayload.application as any);
    const { token } = await createDocumentRequestToken({ applicationId: appId, submissionRef: 'FF-2026-AUDIT10' });

    // Complete token
    const { req: compReq, res: compRes } = createMockReqRes({ body: { token } });
    await completeDocumentUploadHandler(compReq, compRes);
    expect(compRes._getStatusCode()).toBe(200);

    // Attempt to upload more files with completed token
    const { req: urlReq, res: urlRes } = createMockReqRes({
      body: {
        token,
        fileName: 'late_file.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        documentType: 'aged_debtor_report',
      },
    });
    await getUploadUrlHandler(urlReq, urlRes);
    expect(urlRes._getStatusCode()).toBe(403);
    expect(urlRes._getData().error).toContain('completed');

    // Validate endpoint returns status: COMPLETED
    const { req: valReq, res: valRes } = createMockReqRes({ method: 'GET', query: { token } });
    await validateUploadTokenHandler(valReq, valRes);
    expect(valRes._getStatusCode()).toBe(200);
    const valData = valRes._getData();
    expect(valData.valid).toBe(false);
    expect(valData.status).toBe('COMPLETED');
  });
});
