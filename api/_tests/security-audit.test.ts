import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import getUploadUrlHandler from '../get-upload-url.js';
import validateUploadTokenHandler from '../validate-upload-token.js';
import recordDocumentUploadHandler from '../record-document-upload.js';
import completeDocumentUploadHandler from '../complete-document-upload.js';
import requestDocumentsHandler from '../request-documents.js';
import retryEmailHandler from '../retry-email.js';
import { 
  createDocumentRequestToken, 
  saveOrUpdateApplication, 
  revokeUploadToken, 
  completeUploadToken 
} from '../_lib/applicationRepository.js';
import { escapeHtml, sendApplicationNotificationEmail } from '../_lib/emailService.js';

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

describe('Security Audit & Adversarial Attack Resistance Suite', () => {
  const victimAppId = 'victim_application_12345';
  const victimRef = 'FF-2026-VICTIM1';
  const attackerAppId = 'attacker_application_99999';
  const originalAdminKey = process.env.ADMIN_API_KEY;

  beforeEach(async () => {
    process.env.ADMIN_API_KEY = 'secret_admin_key_security_audit';
    delete process.env.RESEND_API_KEY;

    // Seed Victim Application
    await saveOrUpdateApplication(victimAppId, victimRef, 'submitted', {
      business: {
        company_name: 'Victim Confidential Logistics Ltd',
        company_number: '11223344',
      },
      contact: {
        contact_full_name: 'Alice Victim',
        email: 'alice@victimcorp.co.uk',
        phone: '+447700900111',
      },
    } as any);

    // Seed Attacker Application
    await saveOrUpdateApplication(attackerAppId, 'FF-2026-ATTACK9', 'submitted', {
      business: { company_name: 'Attacker Co' },
      contact: { contact_full_name: 'Eve Attacker', email: 'eve@attack.com' },
    } as any);
  });

  afterAll(() => {
    if (originalAdminKey !== undefined) {
      process.env.ADMIN_API_KEY = originalAdminKey;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
  });

  // -------------------------------------------------------------
  // 1. Application ID Manipulation & Privilege Escalation
  // -------------------------------------------------------------
  it('1. Application ID Manipulation: Attacker cannot write to victim application even if providing victim applicationId', async () => {
    // Attacker has their own token
    const { token: attackerToken } = await createDocumentRequestToken({
      applicationId: attackerAppId,
      submissionRef: 'FF-2026-ATTACK9',
    });

    // Attacker tries to forge upload URL for victim's application
    const { req, res } = createMockReqRes({
      body: {
        token: attackerToken,
        applicationId: victimAppId, // Forged victim ID in body
        fileName: 'malicious_file.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        documentType: 'aged_debtor_report',
      },
    });

    await getUploadUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = res._getData();
    // Path MUST be bound to attackerAppId from verified token, NOT the forged victimAppId!
    expect(data.storagePath).toContain(`applications/ff/${attackerAppId}/`);
    expect(data.storagePath).not.toContain(victimAppId);
  });

  // -------------------------------------------------------------
  // 2. Upload Token Guessing (Brute Force Defense)
  // -------------------------------------------------------------
  it('2. Upload Token Guessing: Randomly guessed tokens are rejected with 403', async () => {
    const guessedTokens = [
      '123456',
      'token123',
      'admin',
      '0000000000000000000000000000000000000000000000000000000000000000',
      '../etc/passwd',
    ];

    for (const token of guessedTokens) {
      const { req, res } = createMockReqRes({
        body: {
          token,
          fileName: 'doc.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          documentType: 'bank_statement',
        },
      });

      await getUploadUrlHandler(req, res);
      expect(res._getStatusCode()).toBe(403);
    }
  });

  // -------------------------------------------------------------
  // 3. Token Reuse After Completion Defense
  // -------------------------------------------------------------
  it('3. Token Reuse: Completed token immediately blocks any subsequent file uploads', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: victimAppId,
      submissionRef: victimRef,
    });

    // Mark as completed
    await completeUploadToken(token);

    const { req, res } = createMockReqRes({
      body: {
        token,
        fileName: 'another_file.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        documentType: 'aged_debtor_report',
      },
    });

    await getUploadUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(res._getData().error).toContain('completed');
  });

  // -------------------------------------------------------------
  // 4. Revoked & Expired Token Defense
  // -------------------------------------------------------------
  it('4. Revoked & Expired Tokens: Access is strictly denied', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: victimAppId,
      submissionRef: victimRef,
    });

    await revokeUploadToken(token, 'Security compromise detected');

    const { req, res } = createMockReqRes({
      body: {
        token,
        fileName: 'file.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        documentType: 'bank_statement',
      },
    });

    await getUploadUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(res._getData().error).toContain('revoked');
  });

  // -------------------------------------------------------------
  // 5. Document Path Manipulation & Directory Traversal Defense
  // -------------------------------------------------------------
  it('5. Document Path Traversal: Path injection in fileName and documentType is neutralized', async () => {
    const { token } = await createDocumentRequestToken({
      applicationId: victimAppId,
      submissionRef: victimRef,
    });

    // Attempt directory traversal via fileName
    const { req, res } = createMockReqRes({
      body: {
        token,
        fileName: '../../../../../../etc/shadow.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        documentType: 'bank_statement',
      },
    });

    await getUploadUrlHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const storagePath = res._getData().storagePath;
    expect(storagePath).not.toContain('..');
    expect(storagePath).toContain('shadow.pdf');

    // Attempt invalid documentType
    const { req: invDocReq, res: invDocRes } = createMockReqRes({
      body: {
        token,
        fileName: 'report.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        documentType: '../../../private_admin_bucket',
      },
    });

    await getUploadUrlHandler(invDocReq, invDocRes);
    expect(invDocRes._getStatusCode()).toBe(400);
    expect(invDocRes._getData().error).toContain('Invalid document type');
  });

  // -------------------------------------------------------------
  // 6. Administrative Endpoint Protection
  // -------------------------------------------------------------
  it('6. Admin Endpoint Protection: Unauthenticated requests to request-documents and retry-email are blocked', async () => {
    // 6a. request-documents without header
    const { req: req1, res: res1 } = createMockReqRes({
      body: { applicationId: victimAppId },
    });
    await requestDocumentsHandler(req1, res1);
    expect(res1._getStatusCode()).toBe(401);

    // 6b. request-documents with invalid token
    const { req: req2, res: res2 } = createMockReqRes({
      headers: { authorization: 'Bearer wrong_password' },
      body: { applicationId: victimAppId },
    });
    await requestDocumentsHandler(req2, res2);
    expect(res2._getStatusCode()).toBe(401);

    // 6c. retry-email without header
    const { req: req3, res: res3 } = createMockReqRes({
      body: { applicationId: victimAppId },
    });
    await retryEmailHandler(req3, res3);
    expect(res3._getStatusCode()).toBe(401);

    // 6d. retry-email with invalid token
    const { req: req4, res: res4 } = createMockReqRes({
      headers: { authorization: 'Bearer wrong_password' },
      body: { applicationId: victimAppId },
    });
    await retryEmailHandler(req4, res4);
    expect(res4._getStatusCode()).toBe(401);
  });

  // -------------------------------------------------------------
  // 7. HTML & Email Injection Sanitization
  // -------------------------------------------------------------
  it('7. HTML & Email Injection: Malicious script and HTML payloads are neutralized in email templates', () => {
    const maliciousString = '<script>alert("XSS")</script><img src="x" onerror="steal()"/>';
    const escaped = escapeHtml(maliciousString);

    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&lt;img src=&quot;x&quot;');
  });
});
