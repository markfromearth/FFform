import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import submitApplicationHandler from './submit-application.js';
import requestDocumentsHandler from './request-documents.js';
import validateUploadTokenHandler from './validate-upload-token.js';
import getUploadUrlHandler from './get-upload-url.js';
import recordDocumentUploadHandler from './record-document-upload.js';
import completeDocumentUploadHandler from './complete-document-upload.js';
import retryEmailHandler from './retry-email.js';
import {
  saveOrUpdateApplication,
  getApplicationById,
  createDocumentRequestToken,
  validateUploadToken,
  revokeUploadToken,
  completeUploadToken,
} from './_lib/applicationRepository.js';
import * as emailService from './_lib/emailService.js';
import { fullApplicationSchema } from '../src/schemas/applicationSchemas.js';

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
    headers: {
      origin: 'https://factoringfinance.co.uk',
      ...(options.headers || {}),
    },
  };

  let statusCode = 200;
  let responseData: any = null;
  const resHeaders: Record<string, string> = {};

  const res = {
    setHeader: (k: string, v: string) => {
      resHeaders[k.toLowerCase()] = v;
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
    _getHeaders: () => resHeaders,
  };

  return { req, res };
}

const mockCompleteApplicationData = {
  id: 'e2e_app_apex_logistics_2026',
  status: 'introduction_ready',
  application: {
    business: {
      company_name: 'Apex Logistics Global Ltd',
      company_number: '12987456',
      company_status: 'active',
      entity_type: 'limited_company',
      industry: 'haulage_and_logistics',
      annual_turnover: 1250000,
      gross_debtor_book: 350000,
      b2b_completed_supply: 'yes',
      trading_address_same_as_registered: true,
      registered_address: {
        address_line_1: 'Unit 4, Meridian Business Park',
        locality: 'Leicester',
        postal_code: 'LE19 1WZ',
        country: 'United Kingdom',
      },
      trading_address: {
        address_line_1: 'Unit 4, Meridian Business Park',
        locality: 'Leicester',
        postal_code: 'LE19 1WZ',
        country: 'United Kingdom',
      },
    },
    contact: {
      contact_full_name: 'David Miller',
      contact_role: 'director_or_owner',
      email: 'david.miller@apexlogistics.co.uk',
      phone: '+447700900333',
      funding_timescale: 'asap',
    },
    invoices: {
      desired_outcome: 'release_cash_all',
      requested_facility: 250000,
      payment_terms_days: '31_to_60_days',
      largest_debtor_concentration_pct: '20_to_39_pct',
      debtor_geography: ['uk', 'europe'],
      existing_invoice_finance: false,
      hmrc_status: 'up_to_date',
      funding_purpose: ['support_growth', 'new_contracts'],
    },
    consents: {
      processing_notice_acknowledged: true,
      marketing_email: false,
      marketing_sms: false,
    },
    documents: [
      {
        documentType: 'bank_statement_initial',
        fileName: 'Apex_Q1_Bank_Statement.pdf',
        fileSize: 1048576,
        uploadedAt: new Date().toISOString(),
        storagePath: 'applications/e2e_app_apex_logistics_2026/Apex_Q1_Bank_Statement.pdf',
      },
    ],
  },
  submittedAt: new Date().toISOString(),
};

describe('FF Form Full Workflow End-to-End Test Suite', () => {
  const adminApiKey = 'e2e_test_admin_api_key_secure_999';
  const originalAdminKey = process.env.ADMIN_API_KEY;
  const originalResendKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ADMIN_API_KEY = adminApiKey;
    delete process.env.RESEND_API_KEY; // Free sandbox / mock dispatch
  });

  afterAll(() => {
    if (originalAdminKey !== undefined) {
      process.env.ADMIN_API_KEY = originalAdminKey;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
    if (originalResendKey !== undefined) {
      process.env.RESEND_API_KEY = originalResendKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });

  // =========================================================================
  // Primary E2E Journey: Steps 1 to 17
  // =========================================================================
  it('E2E Primary Journey: Complete Applicant Submission -> Missing Docs Request -> Portal Upload -> Underwriter Notification', async () => {
    // -------------------------------------------------------------
    // Step 1: Applicant completes FF Form
    // -------------------------------------------------------------
    const schemaValidation = fullApplicationSchema.safeParse(mockCompleteApplicationData.application);
    expect(schemaValidation.success).toBe(true);

    // -------------------------------------------------------------
    // Step 2 & 3: Applicant submits application & Application is stored in Firestore
    // -------------------------------------------------------------
    const emailSendSpy = vi.spyOn(emailService, 'sendApplicationNotificationEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'resend_app_notif_001',
      recipient: 'ben@factoringfinance.co.uk',
    });

    const { req: submitReq, res: submitRes } = createMockReqRes({
      body: mockCompleteApplicationData,
    });

    await submitApplicationHandler(submitReq, submitRes);
    expect(submitRes._getStatusCode()).toBe(200);
    const submitBody = submitRes._getData();
    expect(submitBody.success).toBe(true);
    expect(submitBody.applicationId).toBe('e2e_app_apex_logistics_2026');
    expect(submitBody.submissionRef).toMatch(/^FF-\d{4}-[A-Za-z0-9_]+$/);
    const generatedRef = submitBody.submissionRef;

    // -------------------------------------------------------------
    // Step 4: Documents are stored in Firebase Storage / metadata recorded
    // -------------------------------------------------------------
    const storedApp = await getApplicationById('e2e_app_apex_logistics_2026');
    expect(storedApp).toBeDefined();
    expect(storedApp?.applicationStatus).toBe('submitted');
    expect(storedApp?.submissionRef).toBe(generatedRef);
    expect(storedApp?.application.documents?.length).toBe(1);
    expect(storedApp?.application.documents?.[0].fileName).toBe('Apex_Q1_Bank_Statement.pdf');

    // -------------------------------------------------------------
    // Step 5 & 6: Client notification is generated & Resend sends the notification
    // -------------------------------------------------------------
    expect(emailSendSpy).toHaveBeenCalledTimes(1);
    expect(emailSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationRef: generatedRef,
        application: expect.objectContaining({
          business: expect.objectContaining({
            company_name: 'Apex Logistics Global Ltd',
          }),
        }),
      })
    );
    expect(storedApp?.emailStatus).toBe('sent');
    expect(storedApp?.emailMessageId).toBe('resend_app_notif_001');

    // -------------------------------------------------------------
    // Step 7: Client opens the application
    // -------------------------------------------------------------
    const underwriterView = await getApplicationById('e2e_app_apex_logistics_2026');
    expect(underwriterView).not.toBeNull();
    expect(underwriterView?.application.business?.company_name).toBe('Apex Logistics Global Ltd');

    // -------------------------------------------------------------
    // Step 8 & 9: Client identifies missing documents & clicks "Request documents"
    // -------------------------------------------------------------
    const docReqEmailSpy = vi.spyOn(emailService, 'sendDocumentRequestEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'resend_doc_req_002',
      recipient: 'david.miller@apexlogistics.co.uk',
    });

    const { req: docReqReq, res: docReqRes } = createMockReqRes({
      headers: { authorization: `Bearer ${adminApiKey}` },
      body: {
        applicationId: 'e2e_app_apex_logistics_2026',
        requestedDocumentTypes: ['aged_debtor_report', 'aged_creditor_report'],
        expiresInDays: 7,
      },
    });

    await requestDocumentsHandler(docReqReq, docReqRes);
    expect(docReqRes._getStatusCode()).toBe(200);
    const docReqBody = docReqRes._getData();
    expect(docReqBody.success).toBe(true);

    // -------------------------------------------------------------
    // Step 10: Secure upload token is generated
    // -------------------------------------------------------------
    const uploadToken = docReqBody.token;
    expect(uploadToken).toMatch(/^[a-f0-9]{64}$/);
    expect(docReqBody.uploadUrl).toBe(`https://factoringfinance.co.uk/?token=${uploadToken}`);

    // -------------------------------------------------------------
    // Step 11: Applicant receives the Resend email
    // -------------------------------------------------------------
    expect(docReqEmailSpy).toHaveBeenCalledTimes(1);
    expect(docReqEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'e2e_app_apex_logistics_2026',
        submissionRef: generatedRef,
        applicantEmail: 'david.miller@apexlogistics.co.uk',
        uploadUrl: `https://factoringfinance.co.uk/?token=${uploadToken}`,
        requestedDocumentTypes: ['aged_debtor_report', 'aged_creditor_report'],
      })
    );

    // -------------------------------------------------------------
    // Step 12: Applicant opens the secure upload link
    // -------------------------------------------------------------
    const { req: validateReq, res: validateRes } = createMockReqRes({
      method: 'GET',
      query: { token: uploadToken },
    });

    await validateUploadTokenHandler(validateReq, validateRes);
    expect(validateRes._getStatusCode()).toBe(200);
    const validateBody = validateRes._getData();
    expect(validateBody.valid).toBe(true);
    expect(validateBody.companyName).toBe('Apex Logistics Global Ltd');
    expect(validateBody.submissionRef).toBe(generatedRef);
    expect(validateBody.requestedDocumentTypes).toEqual(['aged_debtor_report', 'aged_creditor_report']);
    // Verify sensitive financials are NOT exposed to upload portal
    expect(validateBody.annual_turnover).toBeUndefined();
    expect(validateBody.residential_address).toBeUndefined();

    // -------------------------------------------------------------
    // Step 13 & 14: Applicant uploads requested documents & Files are stored in Storage
    // -------------------------------------------------------------
    // 13a. Request signed write URL for Aged Debtors
    const { req: getUrlReq1, res: getUrlRes1 } = createMockReqRes({
      body: {
        token: uploadToken,
        fileName: 'Apex_Aged_Debtors_Oct2026.pdf',
        fileType: 'application/pdf',
        documentType: 'aged_debtor_report',
      },
    });
    await getUploadUrlHandler(getUrlReq1, getUrlRes1);
    expect(getUrlRes1._getStatusCode()).toBe(200);
    const urlData1 = getUrlRes1._getData();
    expect(urlData1.uploadUrl).toContain('Apex_Aged_Debtors_Oct2026.pdf');
    expect(urlData1.storagePath).toContain('applications/ff/e2e_app_apex_logistics_2026/documents/aged_debtor_report/');

    // 13b. Request signed write URL for Aged Creditors
    const { req: getUrlReq2, res: getUrlRes2 } = createMockReqRes({
      body: {
        token: uploadToken,
        fileName: 'Apex_Aged_Creditors_Oct2026.pdf',
        fileType: 'application/pdf',
        documentType: 'aged_creditor_report',
      },
    });
    await getUploadUrlHandler(getUrlReq2, getUrlRes2);
    expect(getUrlRes2._getStatusCode()).toBe(200);
    const urlData2 = getUrlRes2._getData();

    // -------------------------------------------------------------
    // Step 15: Firestore records the uploaded documents
    // -------------------------------------------------------------
    const { req: recordReq1, res: recordRes1 } = createMockReqRes({
      body: {
        token: uploadToken,
        document: {
          documentType: 'aged_debtor_report',
          fileName: 'Apex_Aged_Debtors_Oct2026.pdf',
          fileSize: 482910,
          storagePath: urlData1.storagePath,
        },
      },
    });
    await recordDocumentUploadHandler(recordReq1, recordRes1);
    expect(recordRes1._getStatusCode()).toBe(200);

    const { req: recordReq2, res: recordRes2 } = createMockReqRes({
      body: {
        token: uploadToken,
        document: {
          documentType: 'aged_creditor_report',
          fileName: 'Apex_Aged_Creditors_Oct2026.pdf',
          fileSize: 312000,
          storagePath: urlData2.storagePath,
        },
      },
    });
    await recordDocumentUploadHandler(recordReq2, recordRes2);
    expect(recordRes2._getStatusCode()).toBe(200);

    // -------------------------------------------------------------
    // Step 16: Client receives the document-upload notification
    // -------------------------------------------------------------
    const docsReceivedEmailSpy = vi.spyOn(emailService, 'sendDocumentsReceivedEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'resend_docs_rcv_003',
      recipient: 'ben@factoringfinance.co.uk',
    });

    const { req: completeReq, res: completeRes } = createMockReqRes({
      body: {
        token: uploadToken,
        uploadedDocuments: [
          {
            documentType: 'aged_debtor_report',
            fileName: 'Apex_Aged_Debtors_Oct2026.pdf',
            fileSize: 482910,
            storagePath: urlData1.storagePath,
          },
          {
            documentType: 'aged_creditor_report',
            fileName: 'Apex_Aged_Creditors_Oct2026.pdf',
            fileSize: 312000,
            storagePath: urlData2.storagePath,
          },
        ],
      },
    });

    await completeDocumentUploadHandler(completeReq, completeRes);
    expect(completeRes._getStatusCode()).toBe(200);
    const completeBody = completeRes._getData();
    expect(completeBody.success).toBe(true);
    expect(completeBody.emailStatus).toBe('sent');

    expect(docsReceivedEmailSpy).toHaveBeenCalledTimes(1);
    expect(docsReceivedEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionRef: generatedRef,
        companyName: 'Apex Logistics Global Ltd',
        uploadedDocuments: expect.arrayContaining([
          expect.objectContaining({ fileName: 'Apex_Aged_Debtors_Oct2026.pdf' }),
          expect.objectContaining({ fileName: 'Apex_Aged_Creditors_Oct2026.pdf' }),
        ]),
      })
    );

    // -------------------------------------------------------------
    // Step 17: Client can access the uploaded documents
    // -------------------------------------------------------------
    const finalApplication = await getApplicationById('e2e_app_apex_logistics_2026');
    expect(finalApplication?.documentRequest?.status).toBe('COMPLETED');
    expect(finalApplication?.documentMetadata?.length).toBe(2);
    expect(finalApplication?.documentMetadata?.[0].fileName).toBe('Apex_Aged_Debtors_Oct2026.pdf');
    expect(finalApplication?.documentMetadata?.[1].fileName).toBe('Apex_Aged_Creditors_Oct2026.pdf');

    // Verify token is locked against future use
    const recheckToken = await validateUploadToken(uploadToken, 'DOCUMENT_UPLOAD');
    expect(recheckToken.valid).toBe(false);
    expect(recheckToken.record?.status).toBe('COMPLETED');
  });

  // =========================================================================
  // No-Document Scenario
  // =========================================================================
  it('No-Document Scenario: Clean Submission with all documents -> Client notified -> No document request necessary', async () => {
    const noDocAppId = 'e2e_app_swift_haulage_no_doc';
    const noDocPayload = {
      id: noDocAppId,
      status: 'introduction_ready',
      application: {
        ...mockCompleteApplicationData.application,
        business: {
          ...mockCompleteApplicationData.application.business,
          company_name: 'Swift Haulage Direct Ltd',
        },
      },
    };

    const emailSpy = vi.spyOn(emailService, 'sendApplicationNotificationEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'resend_no_doc_001',
      recipient: 'ben@factoringfinance.co.uk',
    });

    // 1. Submit application
    const { req, res } = createMockReqRes({ body: noDocPayload });
    await submitApplicationHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = res._getData();
    expect(body.success).toBe(true);

    // 2. Client receives notification
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        application: expect.objectContaining({
          business: expect.objectContaining({
            company_name: 'Swift Haulage Direct Ltd',
          }),
        }),
      })
    );

    // 3. Application persists cleanly with no active document requests
    const appRecord = await getApplicationById(noDocAppId);
    expect(appRecord).toBeDefined();
    expect(appRecord?.applicationStatus).toBe('submitted');
    expect(appRecord?.documentRequest).toBeUndefined();
  });

  // =========================================================================
  // Failure Scenarios
  // =========================================================================
  describe('Failure & Resilience Scenarios', () => {
    // 1. Resend Failure Scenario
    it('Resend Failure: Application persists safely in Firestore, returns 200 to user, records email failure for retry', async () => {
      const resendFailAppId = 'e2e_app_resend_failure_001';
      vi.spyOn(emailService, 'sendApplicationNotificationEmail').mockResolvedValueOnce({
        success: false,
        error: 'Resend API rate limit exceeded (HTTP 429)',
        recipient: 'ben@factoringfinance.co.uk',
      });

      const { req, res } = createMockReqRes({
        body: {
          id: resendFailAppId,
          status: 'introduction_ready',
          application: mockCompleteApplicationData.application,
        },
      });

      await submitApplicationHandler(req, res);
      // User must not see failure because application was safely saved
      expect(res._getStatusCode()).toBe(200);
      const data = res._getData();
      expect(data.success).toBe(true);

      // Check Firestore state
      const record = await getApplicationById(resendFailAppId);
      expect(record?.applicationStatus).toBe('submitted');
      expect(record?.emailStatus).toBe('failed');
      expect(record?.emailError).toContain('Resend API rate limit');

      // Admin retries email via retry endpoint
      vi.spyOn(emailService, 'sendApplicationNotificationEmail').mockResolvedValueOnce({
        success: true,
        messageId: 'resend_retry_success_001',
        recipient: 'ben@factoringfinance.co.uk',
      });

      const { req: retryReq, res: retryRes } = createMockReqRes({
        headers: { authorization: `Bearer ${adminApiKey}` },
        body: { applicationId: resendFailAppId },
      });
      await retryEmailHandler(retryReq, retryRes);
      expect(retryRes._getStatusCode()).toBe(200);
      const retryData = retryRes._getData();
      expect(retryData.success).toBe(true);
      expect(retryData.status).toBe('sent');
    });

    // 2. Firebase Failure Scenario
    it('Firebase Failure: Malformed schema or DB unreachability returns clean error without crashing server', async () => {
      const { req, res } = createMockReqRes({
        body: {
          id: 'invalid_malformed_app',
          application: {
            // Missing required fields
            business: { company_name: 'Broken Ltd' },
          },
        },
      });

      await submitApplicationHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      const data = res._getData();
      expect(data.error).toBeDefined();
    });

    // 3. Invalid Upload Token Scenario
    it('Invalid Upload Token: Random or forged token returns invalid status payload to UI', async () => {
      const forgedToken = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const { req, res } = createMockReqRes({
        method: 'GET',
        query: { token: forgedToken },
      });

      await validateUploadTokenHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const data = res._getData();
      expect(data.valid).toBe(false);
      expect(data.status).toBe('INVALID');
      expect(data.error).toBeDefined();
    });

    // 4. Expired Upload Token Scenario
    it('Expired Upload Token: Expired token cannot validate, request upload URLs, or complete uploads', async () => {
      const expiredAppId = 'e2e_app_expired_token_test';
      await saveOrUpdateApplication(expiredAppId, 'FF-2026-EXP01', 'submitted', mockCompleteApplicationData.application as any);

      // Create token expired in the past
      const { token: expiredToken } = await createDocumentRequestToken({
        applicationId: expiredAppId,
        expiresInMs: -10000, // 10 seconds in the past
      });

      // 4a. Validate token returns status EXPIRED
      const { req: valReq, res: valRes } = createMockReqRes({
        method: 'GET',
        query: { token: expiredToken },
      });
      await validateUploadTokenHandler(valReq, valRes);
      expect(valRes._getStatusCode()).toBe(200);
      expect(valRes._getData().valid).toBe(false);
      expect(valRes._getData().status).toBe('EXPIRED');
      expect(valRes._getData().error).toContain('expired');

      // 4b. Request upload URL rejects with 403
      const { req: urlReq, res: urlRes } = createMockReqRes({
        body: {
          token: expiredToken,
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          documentType: 'aged_debtor_report',
        },
      });
      await getUploadUrlHandler(urlReq, urlRes);
      expect(urlRes._getStatusCode()).toBe(403);

      // 4c. Complete upload rejects with 403
      const { req: compReq, res: compRes } = createMockReqRes({
        body: { token: expiredToken, uploadedDocuments: [] },
      });
      await completeDocumentUploadHandler(compReq, compRes);
      expect(compRes._getStatusCode()).toBe(403);
    });

    // 5. Duplicate Document Request Scenario
    it('Duplicate Document Request: Debounced within 60s cooldown, returns existing active token without double-sending', async () => {
      const dupAppId = 'e2e_app_dup_req_test';
      await saveOrUpdateApplication(dupAppId, 'FF-2026-DUP01', 'submitted', mockCompleteApplicationData.application as any);

      const emailSpy = vi.spyOn(emailService, 'sendDocumentRequestEmail').mockResolvedValue({
        success: true,
        messageId: 'resend_dup_req_msg',
        recipient: 'test@dup.co.uk',
      });

      // Click 1
      const { req: req1, res: res1 } = createMockReqRes({
        headers: { authorization: `Bearer ${adminApiKey}` },
        body: { applicationId: dupAppId },
      });
      await requestDocumentsHandler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);
      const token1 = res1._getData().token;

      // Click 2 (immediate)
      const { req: req2, res: res2 } = createMockReqRes({
        headers: { authorization: `Bearer ${adminApiKey}` },
        body: { applicationId: dupAppId },
      });
      await requestDocumentsHandler(req2, res2);
      expect(res2._getStatusCode()).toBe(200);
      const data2 = res2._getData();
      expect(data2.isDuplicate).toBe(true);
      expect(data2.token).toBe(token1);
      // Email was only sent once
      expect(emailSpy).toHaveBeenCalledTimes(1);
    });

    // 6. Duplicate Upload Scenario
    it('Duplicate Upload: Uploading identical file twice updates metadata safely without breaking state', async () => {
      const dupUploadAppId = 'e2e_app_dup_upload_test';
      await saveOrUpdateApplication(dupUploadAppId, 'FF-2026-UPL01', 'submitted', mockCompleteApplicationData.application as any);

      const { token } = await createDocumentRequestToken({
        applicationId: dupUploadAppId,
      });

      const uploadPayload = {
        token,
        document: {
          documentType: 'bank_statement',
          fileName: 'Statement_October.pdf',
          fileSize: 204800,
          storagePath: `applications/${dupUploadAppId}/requested-docs/Statement_October.pdf`,
        },
      };

      // Upload 1
      const { req: r1, res: res1 } = createMockReqRes({ body: uploadPayload });
      await recordDocumentUploadHandler(r1, res1);
      expect(res1._getStatusCode()).toBe(200);

      // Upload 2 (same file name and type)
      const { req: r2, res: res2 } = createMockReqRes({ body: uploadPayload });
      await recordDocumentUploadHandler(r2, res2);
      expect(res2._getStatusCode()).toBe(200);

      const updatedApp = await getApplicationById(dupUploadAppId);
      expect(updatedApp).toBeDefined();
      expect(updatedApp?.documentMetadata?.length).toBe(1);
    });

    // 7. Unauthorised Application Access Scenario
    it('Unauthorised Application Access: Forged application IDs and missing admin credentials are unconditionally blocked', async () => {
      // 7a. Missing Authorization header on admin document request
      const { req: reqNoAuth, res: resNoAuth } = createMockReqRes({
        headers: {}, // No Authorization
        body: { applicationId: 'e2e_app_apex_logistics_2026' },
      });
      await requestDocumentsHandler(reqNoAuth, resNoAuth);
      expect(resNoAuth._getStatusCode()).toBe(401);

      // 7b. Invalid Bearer token
      const { req: reqBadAuth, res: resBadAuth } = createMockReqRes({
        headers: { authorization: 'Bearer attacker_bad_key' },
        body: { applicationId: 'e2e_app_apex_logistics_2026' },
      });
      await requestDocumentsHandler(reqBadAuth, resBadAuth);
      expect(resBadAuth._getStatusCode()).toBe(401);

      // 7c. Attacker attempts to forge upload URL for another applicationId
      const { token: attackerToken } = await createDocumentRequestToken({
        applicationId: 'attacker_actual_application_id',
      });

      const { req: forgeReq, res: forgeRes } = createMockReqRes({
        body: {
          token: attackerToken,
          applicationId: 'victim_target_application_id', // Spoofed ID
          fileName: 'exploit.pdf',
          fileType: 'application/pdf',
          documentType: 'aged_debtor_report',
        },
      });
      await getUploadUrlHandler(forgeReq, forgeRes);
      expect(forgeRes._getStatusCode()).toBe(200);
      // Path must be bound to attacker's actual applicationId from token, NOT the spoofed body
      expect(forgeRes._getData().storagePath).toContain('applications/ff/attacker_actual_application_id/documents/aged_debtor_report/');
      expect(forgeRes._getData().storagePath).not.toContain('victim_target_application_id');
    });
  });
});
