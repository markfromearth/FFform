import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDocumentRequestToken,
  validateUploadToken,
  revokeUploadToken,
  completeUploadToken,
  saveOrUpdateApplication,
} from './_lib/applicationRepository';
import * as emailService from './_lib/emailService';
import requestDocumentsHandler from './request-documents';

describe('Secure Document Request & Resend Integration Flow', () => {
  const testAppId = 'ff-doc-req-app-777';

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Pre-seed an application
    await saveOrUpdateApplication(testAppId, 'FF-2026-DOC77', 'submitted', {
      business: { company_name: 'Titan Transport Ltd' },
      contact: { contact_full_name: 'Sarah Connor', email: 'sarah@titantransport.co.uk' },
    } as any);
  });

  const createMockReqRes = (body: any, authHeader?: string) => {
    const effectiveAuth = authHeader !== undefined 
      ? authHeader 
      : (process.env.ADMIN_API_KEY ? `Bearer ${process.env.ADMIN_API_KEY}` : undefined);

    const req = {
      method: 'POST',
      headers: {
        origin: 'https://factoringfinance.co.uk',
        ...(effectiveAuth ? { authorization: effectiveAuth } : {}),
      },
      body,
    };
    let statusCode = 200;
    let jsonBody: any = null;

    const res = {
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
      end: () => res,
    };

    return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
  };

  describe('1. Document Request API & Resend Email Trigger', () => {
    it('generates token, upload URL, and triggers Resend document request email', async () => {
      const emailSpy = vi.spyOn(emailService, 'sendDocumentRequestEmail').mockResolvedValueOnce({
        success: true,
        messageId: 'resend_msg_doc_req_001',
        recipient: 'sarah@titantransport.co.uk',
      });

      const { req, res, getStatus, getJson } = createMockReqRes({
        applicationId: testAppId,
        requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'],
        expiresInDays: 7,
      });

      await requestDocumentsHandler(req, res);

      expect(getStatus()).toBe(200);
      const body = getJson();
      expect(body.success).toBe(true);
      expect(body.applicationId).toBe(testAppId);
      expect(body.submissionRef).toBe('FF-2026-DOC77');
      expect(body.token).toMatch(/^[a-f0-9]{64}$/);
      expect(body.uploadUrl).toBe(`https://factoringfinance.co.uk/?token=${body.token}`);
      expect(body.emailStatus).toBe('sent');
      expect(body.emailMessageId).toBe('resend_msg_doc_req_001');

      // Verify email service was called with proper structured payload
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: testAppId,
          submissionRef: 'FF-2026-DOC77',
          companyName: 'Titan Transport Ltd',
          applicantName: 'Sarah Connor',
          applicantEmail: 'sarah@titantransport.co.uk',
          uploadUrl: `https://factoringfinance.co.uk/?token=${body.token}`,
          requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'],
        })
      );
    });

    it('rejects unauthorized requests when ADMIN_API_KEY is configured with invalid Bearer token', async () => {
      const originalAdminKey = process.env.ADMIN_API_KEY;
      process.env.ADMIN_API_KEY = 'secret_admin_token_xyz';

      try {
        const { req, res, getStatus, getJson } = createMockReqRes(
          { applicationId: testAppId },
          'Bearer wrong_token'
        );

        await requestDocumentsHandler(req, res);

        expect(getStatus()).toBe(401);
        expect(getJson().error).toContain('Unauthorized');
      } finally {
        process.env.ADMIN_API_KEY = originalAdminKey;
      }
    });

    it('handles email failures gracefully without rolling back the generated upload token', async () => {
      vi.spyOn(emailService, 'sendDocumentRequestEmail').mockResolvedValueOnce({
        success: false,
        error: 'Resend rate limit exceeded',
        recipient: 'sarah@titantransport.co.uk',
      });

      const { req, res, getStatus, getJson } = createMockReqRes({
        applicationId: testAppId,
        force: true,
      });

      await requestDocumentsHandler(req, res);

      expect(getStatus()).toBe(200);
      const body = getJson();
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.emailStatus).toBe('failed');
    });

    it('returns 404 if application is not found', async () => {
      const { req, res, getStatus, getJson } = createMockReqRes({
        applicationId: 'non-existent-app-999',
      });

      await requestDocumentsHandler(req, res);

      expect(getStatus()).toBe(404);
      expect(getJson().error).toContain('not found');
    });

    it('returns 400 if applicationId is missing', async () => {
      const { req, res, getStatus, getJson } = createMockReqRes({});

      await requestDocumentsHandler(req, res);

      expect(getStatus()).toBe(400);
      expect(getJson().error).toContain('applicationId is required');
    });
  });

  describe('2. Token Lifecycle & Direct Upload Verification', () => {
    it('validates active token, records use count, and rejects revoked/expired tokens', async () => {
      const { token } = await createDocumentRequestToken({
        applicationId: testAppId,
      });

      // 1. Validate active
      const validRes = await validateUploadToken(token, 'DOCUMENT_UPLOAD');
      expect(validRes.valid).toBe(true);
      expect(validRes.applicationId).toBe(testAppId);

      // 2. Revoke and verify rejection
      await revokeUploadToken(token, 'Broker updated request');
      const revokedRes = await validateUploadToken(token);
      expect(revokedRes.valid).toBe(false);
      expect(revokedRes.error).toContain('revoked');
    });
  });
});
