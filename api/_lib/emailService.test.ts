import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendApplicationNotificationEmail,
  sendDocumentRequestEmail,
  sendDocumentsReceivedEmail,
  sendPartialLeadAcknowledgementEmail
} from './emailService';
import type { ApplicationData } from '../../src/schemas/applicationSchemas';

describe('FF Form Reusable Email Service', () => {
  const sampleApplication: ApplicationData = {
    business: {
      company_name: 'Acme Logistics Ltd',
      company_number: '12345678',
      company_status: 'active',
      entity_type: 'limited_company',
      industry: 'haulage_and_logistics',
      annual_turnover: 750000,
      gross_debtor_book: 150000,
      b2b_completed_supply: 'yes',
      registered_address: {
        address_line_1: '123 High Street',
        locality: 'London',
        postal_code: 'EC1A 1BB',
        country: 'UK',
      },
    },
    contact: {
      contact_full_name: 'Jane Doe',
      contact_role: 'director_or_owner',
      email: 'jane@acmelogistics.co.uk',
      phone: '+447700900123',
      funding_timescale: 'within_2_weeks',
    },
    invoices: {
      desired_outcome: 'release_cash_all',
      requested_facility: 100000,
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
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendApplicationNotificationEmail', () => {
    it('dispatches email with formatted structured data and returns successful result', async () => {
      const result = await sendApplicationNotificationEmail({
        application: sampleApplication,
        applicationRef: 'FF-2026-TEST1',
        uploadToken: 'test-token-12345',
        appBaseUrl: 'https://factoringfinance.co.uk',
      });

      expect(result.success).toBe(true);
      expect(result.recipient).toContain('factoringfinance.co.uk');
      expect(result.messageId).toBeDefined();
    });

    it('gracefully handles missing PDF and documents without failing', async () => {
      const result = await sendApplicationNotificationEmail({
        application: sampleApplication,
        applicationRef: 'FF-2026-TEST2',
        uploadedDocuments: [],
      });

      expect(result.success).toBe(true);
      expect(result.attachmentCount).toBe(0);
    });
  });

  describe('sendDocumentRequestEmail', () => {
    it('validates required parameters and returns error if applicationId or uploadUrl is missing', async () => {
      const result = await sendDocumentRequestEmail({
        applicationId: '',
        submissionRef: 'FF-2026-TEST',
        companyName: 'Acme Ltd',
        applicantName: 'Jane',
        applicantEmail: 'jane@example.com',
        uploadUrl: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('dispatches document request successfully with valid parameters', async () => {
      const result = await sendDocumentRequestEmail({
        applicationId: 'app-123',
        submissionRef: 'FF-2026-TEST3',
        companyName: 'Acme Logistics Ltd',
        applicantName: 'Jane Doe',
        applicantEmail: 'jane@acmelogistics.co.uk',
        uploadUrl: 'https://factoringfinance.co.uk/?token=test-token-999',
        requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'],
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('sendDocumentsReceivedEmail', () => {
    it('dispatches documents received alert to the underwriting team', async () => {
      const result = await sendDocumentsReceivedEmail({
        applicationId: 'app-123',
        submissionRef: 'FF-2026-TEST4',
        companyName: 'Acme Logistics Ltd',
        applicantName: 'Jane Doe',
        applicantEmail: 'jane@acmelogistics.co.uk',
        uploadedDocuments: [
          {
            documentType: 'aged_debtor_report',
            fileName: 'debtors-sep2026.pdf',
            uploadedAt: new Date().toISOString(),
          },
          {
            documentType: 'bank_statement',
            fileName: 'barclays-aug2026.pdf',
            uploadedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('sendPartialLeadAcknowledgementEmail', () => {
    it('handles partial lead capture safely in sandbox mode', async () => {
      const result = await sendPartialLeadAcknowledgementEmail({
        application: sampleApplication,
        applicationRef: 'FF-2026-PARTIAL',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('returns error if no contact email is present', async () => {
      const appWithoutEmail = {
        ...sampleApplication,
        contact: { ...sampleApplication.contact, email: undefined },
      };

      const result = await sendPartialLeadAcknowledgementEmail({
        application: appWithoutEmail as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No email provided');
    });
  });
});
