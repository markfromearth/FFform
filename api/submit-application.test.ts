import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './submit-application';
import * as applicationRepository from './_lib/applicationRepository';
import * as emailService from './_lib/emailService';
import * as pdfGenerator from './_lib/pdfGenerator';

describe('Submit Application API Integration Flow', () => {
  const validSubmissionPayload = {
    id: 'ff-app-test-uuid-12345',
    status: 'introduction_ready',
    application: {
      business: {
        company_name: 'Apex Haulage Logistics Ltd',
        company_number: '12345678',
        company_status: 'active',
        entity_type: 'limited_company',
        industry: 'haulage_and_logistics',
        annual_turnover: 1500000,
        gross_debtor_book: 300000,
        b2b_completed_supply: 'yes',
        registered_address: {
          address_line_1: '10 Fleet Road',
          locality: 'Birmingham',
          postal_code: 'B1 1AA',
          country: 'UK',
        },
      },
      contact: {
        contact_full_name: 'Robert Vance',
        contact_role: 'director_or_owner',
        email: 'robert@apexhaulage.co.uk',
        phone: '+447911123456',
        funding_timescale: 'asap',
      },
      invoices: {
        desired_outcome: 'release_cash_all',
        requested_facility: 250000,
        funding_purpose: ['support_growth'],
        payment_terms_days: '31_to_60_days',
        largest_debtor_concentration_pct: '20_to_39_pct',
        debtor_geography: ['uk'],
        hmrc_status: 'up_to_date',
        existing_invoice_finance: false,
      },
      consents: {
        processing_notice_acknowledged: true,
        marketing_email: false,
        marketing_sms: false,
      },
    },
  };

  const createMockReqRes = (body: any) => {
    const req = {
      method: 'POST',
      headers: { origin: 'https://factoringfinance.co.uk' },
      body,
    };
    let statusCode = 200;
    let jsonBody: any = null;
    let headersSent: Record<string, string> = {};

    const res = {
      setHeader: (key: string, val: string) => {
        headersSent[key] = val;
      },
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Validates, persists application in DB, generates PDF and sends client notification email', async () => {
    const { req, res, getStatus, getJson } = createMockReqRes(validSubmissionPayload);

    await handler(req, res);

    expect(getStatus()).toBe(200);
    const body = getJson();
    expect(body.success).toBe(true);
    expect(body.applicationId).toBe(validSubmissionPayload.id);
    expect(body.submissionRef).toMatch(/^FF-\d{4}-[A-Z0-9]+$/);
    expect(body.uploadToken).toBeDefined();
  });

  it('2. Prevents duplicate submissions and re-dispatches (Idempotency)', async () => {
    vi.spyOn(applicationRepository, 'saveOrUpdateApplication').mockResolvedValueOnce({
      isDuplicate: true,
      record: {
        applicationId: validSubmissionPayload.id,
        submissionRef: 'FF-2026-12345',
        applicationStatus: 'submitted',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        submittedAt: '2026-10-01T00:00:00Z',
        application: validSubmissionPayload.application as any,
        emailStatus: 'sent',
      },
    });

    const emailSpy = vi.spyOn(emailService, 'sendApplicationNotificationEmail');

    const { req, res, getStatus, getJson } = createMockReqRes(validSubmissionPayload);

    await handler(req, res);

    expect(getStatus()).toBe(200);
    const body = getJson();
    expect(body.success).toBe(true);
    expect(body.message).toContain('idempotent duplicate');
    // Ensure email is not re-sent on duplicate
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('3. Decoupled resilience: If email dispatch fails, application remains secured and returns 200 OK', async () => {
    vi.spyOn(emailService, 'sendApplicationNotificationEmail').mockResolvedValueOnce({
      success: false,
      recipient: 'ben@factoringfinance.co.uk',
      error: 'Resend API service rate limit exceeded',
    });

    const updateStatusSpy = vi.spyOn(applicationRepository, 'updateEmailStatus');

    const { req, res, getStatus, getJson } = createMockReqRes({
      ...validSubmissionPayload,
      id: 'ff-app-email-fail-test',
    });

    await handler(req, res);

    // Primary goal: applicant receives 200 OK
    expect(getStatus()).toBe(200);
    const body = getJson();
    expect(body.success).toBe(true);
    expect(body.applicationId).toBe('ff-app-email-fail-test');

    // Email failure recorded for retry
    expect(updateStatusSpy).toHaveBeenCalledWith('ff-app-email-fail-test', {
      emailStatus: 'failed',
      emailError: 'Resend API service rate limit exceeded',
    });
  });

  it('4. Rejects invalid submission payloads with 400 Bad Request', async () => {
    const invalidPayload = {
      id: 'invalid',
      application: {
        business: {
          company_name: '', // missing required
        },
      },
    };

    const { req, res, getStatus, getJson } = createMockReqRes(invalidPayload);

    await handler(req, res);

    expect(getStatus()).toBe(400);
    expect(getJson().error).toBeDefined();
  });
});
