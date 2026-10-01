import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Step6Uploads } from './Step6Uploads';
import { ApplicationProvider } from '../../context/ApplicationContext';

describe('Step6Uploads Applicant Upload Interface Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('1. Renders loading state and then valid applicant portal with case details', async () => {
    window.history.pushState({}, '', '/?token=valid_test_token_123');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/validate-upload-token')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              valid: true,
              status: 'ACTIVE',
              submissionRef: 'FF-2026-ABC99',
              companyName: 'Acme Haulage Logistics Ltd',
              requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'],
              existingDocuments: [],
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(
      <ApplicationProvider>
        <Step6Uploads />
      </ApplicationProvider>
    );

    // Initial loading indicator
    expect(screen.getByText(/Verifying Secure Upload Link/i)).toBeInTheDocument();

    // Replaces with portal view once token is verified
    await waitFor(() => {
      expect(screen.getByText(/Ref: FF-2026-ABC99/i)).toBeInTheDocument();
      expect(screen.getByText(/Acme Haulage Logistics Ltd/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Aged Debtor Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Last 3 Months Business Bank Statements/i)).toBeInTheDocument();
      expect(screen.getByText(/No login required/i)).toBeInTheDocument();
      expect(screen.getByText(/256-bit encrypted/i)).toBeInTheDocument();
    });
  });

  it('2. Renders expired token error state with contact guidance', async () => {
    window.history.pushState({}, '', '/?token=expired_token_456');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/validate-upload-token')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              valid: false,
              status: 'EXPIRED',
              error: 'Upload link has expired',
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <ApplicationProvider>
        <Step6Uploads />
      </ApplicationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Upload Link Expired/i)).toBeInTheDocument();
      expect(screen.getByText(/Email Enquiries/i)).toBeInTheDocument();
      expect(screen.getByText(/Call 0161 524 5050/i)).toBeInTheDocument();
    });
  });

  it('3. Renders revoked token error state', async () => {
    window.history.pushState({}, '', '/?token=revoked_token_789');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/validate-upload-token')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              valid: false,
              status: 'REVOKED',
              error: 'Upload link has been revoked',
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <ApplicationProvider>
        <Step6Uploads />
      </ApplicationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Upload Link Revoked/i)).toBeInTheDocument();
    });
  });

  it('4. Re-hydrates existing documents on page refresh', async () => {
    window.history.pushState({}, '', '/?token=valid_token_with_docs');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/validate-upload-token')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              valid: true,
              status: 'ACTIVE',
              submissionRef: 'FF-2026-REFRESH',
              companyName: 'Northern Freight Ltd',
              requestedDocumentTypes: ['aged_debtor_report', 'bank_statement'],
              existingDocuments: [
                {
                  documentType: 'aged_debtor_report',
                  fileName: 'Aged_Debtors_Aug2026.pdf',
                  fileSize: 1048576,
                  uploadedAt: '2026-08-31T10:00:00Z',
                },
              ],
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <ApplicationProvider>
        <Step6Uploads />
      </ApplicationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Aged_Debtors_Aug2026.pdf')).toBeInTheDocument();
      expect(screen.getByText(/1.0 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/Uploaded/i)).toBeInTheDocument();
    });
  });

  it('5. Completes upload session and transitions to confirmation screen', async () => {
    window.history.pushState({}, '', '/?token=valid_token_complete');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/validate-upload-token')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              valid: true,
              status: 'ACTIVE',
              submissionRef: 'FF-2026-DONE',
              companyName: 'Summit Transport Ltd',
              requestedDocumentTypes: ['aged_debtor_report'],
              existingDocuments: [],
            }),
        });
      }
      if (url.includes('/api/complete-document-upload')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(
      <ApplicationProvider>
        <Step6Uploads />
      </ApplicationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Summit Transport Ltd/i)).toBeInTheDocument();
    });

    const completeBtn = screen.getByRole('button', { name: /Continue without documents|I've finished uploading/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Documents Received!/i)).toBeInTheDocument();
      expect(screen.getByText(/FF-2026-DONE/i)).toBeInTheDocument();
      expect(screen.getByText(/What happens next\?/i)).toBeInTheDocument();
    });
  });
});
