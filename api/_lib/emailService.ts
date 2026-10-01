import { Resend } from 'resend';
import { getAdminStorage, isFirebaseConfigured } from './firebaseAdmin.js';
import { formatLabel } from '../../src/utils/formatters.js';
import type { ApplicationData } from '../../src/schemas/applicationSchemas.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface StatementLink {
  filename: string;
  url: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  isMock?: boolean;
  recipient: string;
  attachmentCount?: number;
  error?: string;
}

export interface SendApplicationEmailOptions {
  application: ApplicationData;
  recipientEmail?: string;
  applicationRef?: string;
  generatedPdfPath?: string;
  uploadedDocuments?: any[];
  uploadToken?: string;
  appBaseUrl?: string;
}

export interface SendDocumentRequestOptions {
  applicationId: string;
  submissionRef: string;
  companyName: string;
  applicantName: string;
  applicantEmail: string;
  uploadUrl: string;
  requestedDocumentTypes?: string[];
}

export interface SendDocumentsReceivedOptions {
  applicationId?: string;
  submissionRef: string;
  companyName: string;
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  appBaseUrl?: string;
  uploadedDocuments: Array<{
    documentType: string;
    fileName: string;
    fileSize?: number;
    uploadedAt?: string;
    storagePath?: string;
  }>;
}

/**
 * Sanitizes user-provided strings against HTML / Email injection.
 */
export function escapeHtml(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats a physical address into a clean single-line string.
 */
function formatAddress(addr?: any): string {
  if (!addr) return 'Not provided';
  const parts = [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Not provided';
}

/**
 * Formats currency amount in GBP.
 */
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Not specified';
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

/**
 * Generates 7-day signed download URLs for documents stored in Firebase Storage.
 */
export async function fetchDocumentDownloadLinks(
  documents: Array<{ fileName: string; storagePath?: string }> = []
): Promise<StatementLink[]> {
  const links: StatementLink[] = [];
  if (!isFirebaseConfigured() || documents.length === 0) return links;

  const storage = getAdminStorage();
  if (!storage) return links;

  const bucket = storage.bucket();
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days

  for (const doc of documents) {
    if (!doc.storagePath) continue;
    try {
      const file = bucket.file(doc.storagePath);
      const [url] = await file.getSignedUrl({ action: 'read', expires });
      links.push({ filename: doc.fileName, url });
    } catch (err: any) {
      console.warn(`[EmailService] Failed to generate signed URL for "${doc.fileName}":`, err.message);
    }
  }

  return links;
}

/**
 * Helper to safely download a file from Firebase Storage as a Buffer without stream listener accumulation.
 */
async function downloadFileBuffer(storagePath: string): Promise<Buffer | null> {
  if (!isFirebaseConfigured()) return null;
  const storage = getAdminStorage();
  if (!storage) return null;

  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    return buffer;
  } catch (err: any) {
    console.warn(`[EmailService] Could not download file buffer for "${storagePath}":`, err.message);
    return null;
  }
}

/**
 * 1. Dispatches operational application notification email (Internal Underwriting Package).
 */
export async function sendApplicationNotificationEmail(
  options: SendApplicationEmailOptions
): Promise<SendEmailResult> {
  const { application, generatedPdfPath, uploadedDocuments = [], uploadToken, appBaseUrl } = options;
  
  const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;
  const recipient = options.recipientEmail || process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoringfinance.co.uk';
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Application <onboarding@resend.dev>';

  const business = application.business || {};
  const contact = application.contact || {};
  const invoices = application.invoices || {};
  const consents = application.consents || {};

  const businessName = business.company_name || 'Business Applicant';
  const subject = `New Factoring Finance Application: ${businessName} (Ref: ${appRef})`;

  // Generate 7-day signed download links for any uploaded documents
  const docLinks = await fetchDocumentDownloadLinks(uploadedDocuments);

  // Compile attachments: Generated PDF + uploaded documents (up to 25MB total)
  const attachments: EmailAttachment[] = [];
  let totalBytes = 0;
  const MAX_BYTES = 25 * 1024 * 1024;

  if (generatedPdfPath) {
    const pdfBuf = await downloadFileBuffer(generatedPdfPath);
    if (pdfBuf && totalBytes + pdfBuf.length <= MAX_BYTES) {
      totalBytes += pdfBuf.length;
      attachments.push({ filename: `FactoringFinance-Application-${appRef}.pdf`, content: pdfBuf });
    }
  }

  for (const doc of uploadedDocuments) {
    if (doc.storagePath) {
      const docBuf = await downloadFileBuffer(doc.storagePath);
      if (docBuf && totalBytes + docBuf.length <= MAX_BYTES) {
        totalBytes += docBuf.length;
        attachments.push({ filename: doc.fileName || 'supporting-document.pdf', content: docBuf });
      }
    }
  }

  // Build document upload token return URL
  const baseUrl = appBaseUrl || 'https://factoringfinance.co.uk';
  const uploadUrl = uploadToken ? `${baseUrl}/?token=${uploadToken}` : `${baseUrl}/`;

  // Pre-fill mailto link for one-click document request from broker to applicant
  const applicantEmail = contact.email || '';
  const mailtoSubject = encodeURIComponent(`Factoring Finance – Supporting Documents for ${businessName} (Ref: ${appRef})`);
  const mailtoBody = encodeURIComponent(
    `Hi ${contact.contact_full_name?.split(' ')[0] || 'there'},\n\n` +
    `Thank you for submitting your enquiry for ${businessName}.\n\n` +
    `To progress your application with our invoice finance lenders, please upload your latest financial reports using your secure link below:\n\n` +
    `${uploadUrl}\n\n` +
    `Recommended documents:\n` +
    `- Current Aged Debtor Report\n` +
    `- Current Aged Creditor Report\n` +
    `- Last 3 Months Business Bank Statements\n\n` +
    `Best regards,\nFactoring Finance Team`
  );
  const mailtoLink = `mailto:${applicantEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  const outcome = invoices.desired_outcome ? formatLabel(invoices.desired_outcome) : 'Not provided';
  const requestedFacility = formatCurrency(invoices.requested_facility);

  // HTML Body
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;line-height:1.5;">
  <div style="max-width:660px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Top Header -->
    <div style="background-color:#0f172a;padding:24px 30px;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">FACTORING FINANCE</h1>
            <p style="margin:4px 0 0 0;font-size:12px;color:#38bdf8;font-weight:600;text-transform:uppercase;">Invoice Finance Enquiry Package</p>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:6px 12px;background:#1e293b;border:1px solid #38bdf8;border-radius:6px;font-size:12px;font-weight:600;color:#e0f2fe;">
              ${appRef}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Status Banner -->
    <div style="background-color:#ecfdf5;border-bottom:1px solid #a7f3d0;padding:12px 30px;color:#065f46;font-size:13px;font-weight:600;">
      ✓ Introduction Ready Application Received
    </div>

    <div style="padding:28px 30px;">
      
      <!-- Funding Highlight Card -->
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Requested Facility</div>
              <div style="font-size:24px;font-weight:700;color:#0f172a;margin-top:2px;">${requestedFacility}</div>
            </td>
            <td align="right">
              <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Desired Outcome</div>
              <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:2px;max-width:240px;text-align:right;">${outcome}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Card: Request Documents -->
      <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:6px;">
          ⚡ Broker Action: Request Documents from Applicant
        </div>
        <p style="font-size:12px;color:#1e3a8a;margin:0 0 12px 0;">
          Need more files? Forward the applicant their secure return link with one click:
        </p>
        <div style="margin-bottom:12px;">
          <a href="${mailtoLink}" style="display:inline-block;padding:8px 16px;background:#0284c7;color:#ffffff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">
            ✉️ Email Applicant Upload Link (${applicantEmail || 'No email'})
          </a>
        </div>
        <div style="font-size:11px;color:#475569;">
          <strong>Direct Secure Upload URL:</strong> <a href="${uploadUrl}" style="color:#0284c7;word-break:break-all;">${uploadUrl}</a>
        </div>
      </div>

      <!-- 1. Business Profile -->
      <h3 style="margin:0 0 10px 0;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #f1f5f9;padding-bottom:6px;">
        1. Business Profile
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;margin-bottom:20px;">
        <tr><td width="35%" style="color:#64748b;">Company Name:</td><td style="font-weight:600;">${escapeHtml(business.company_name) || 'N/A'}</td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">Company Number:</td><td>${escapeHtml(business.company_number) || 'N/A'}</td></tr>
        <tr><td style="color:#64748b;">Entity Type / Status:</td><td>${escapeHtml(business.entity_type) || 'N/A'} (${escapeHtml(business.company_status) || 'Active'})</td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">Industry:</td><td>${escapeHtml(formatLabel(business.industry)) || 'N/A'}</td></tr>
        <tr><td style="color:#64748b;">Registered Address:</td><td>${escapeHtml(formatAddress(business.registered_address))}</td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">Annual Turnover:</td><td>${formatCurrency(business.annual_turnover)}</td></tr>
        <tr><td style="color:#64748b;">Gross Debtor Book:</td><td>${formatCurrency(business.gross_debtor_book)}</td></tr>
      </table>

      <!-- 2. Contact Details -->
      <h3 style="margin:0 0 10px 0;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #f1f5f9;padding-bottom:6px;">
        2. Applicant Contact
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;margin-bottom:20px;">
        <tr><td width="35%" style="color:#64748b;">Contact Name:</td><td style="font-weight:600;">${escapeHtml(contact.contact_full_name) || 'N/A'} (${escapeHtml(formatLabel(contact.contact_role)) || 'N/A'})</td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">Email:</td><td><a href="mailto:${encodeURIComponent(contact.email || '')}" style="color:#0284c7;">${escapeHtml(contact.email) || 'N/A'}</a></td></tr>
        <tr><td style="color:#64748b;">Phone:</td><td><a href="tel:${encodeURIComponent(contact.phone || '')}" style="color:#0284c7;">${escapeHtml(contact.phone) || 'N/A'}</a></td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">Funding Timescale:</td><td>${escapeHtml(formatLabel(contact.funding_timescale)) || 'N/A'}</td></tr>
      </table>

      <!-- 3. Ledger Profile & Facility Specifics -->
      <h3 style="margin:0 0 10px 0;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #f1f5f9;padding-bottom:6px;">
        3. Invoice Profile & HMRC Position
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;margin-bottom:24px;">
        <tr><td width="35%" style="color:#64748b;">Payment Terms:</td><td>${escapeHtml(formatLabel(invoices.payment_terms_days)) || 'N/A'}</td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">Largest Customer %:</td><td>${escapeHtml(formatLabel(invoices.largest_debtor_concentration_pct)) || 'N/A'}</td></tr>
        <tr><td style="color:#64748b;">Customer Geography:</td><td>${escapeHtml(invoices.debtor_geography?.map(formatLabel).join(', ')) || 'UK'}</td></tr>
        <tr style="background:#f8fafc;"><td style="color:#64748b;">HMRC Status:</td><td>${escapeHtml(formatLabel(invoices.hmrc_status)) || 'Up to date'}</td></tr>
        <tr><td style="color:#64748b;">Existing Facility?</td><td>${invoices.existing_invoice_finance ? `Yes (${escapeHtml(invoices.current_provider) || 'Not disclosed'})` : 'No'}</td></tr>
        ${invoices.additional_context ? `<tr style="background:#f8fafc;"><td style="color:#64748b;vertical-align:top;">Additional Notes:</td><td>${escapeHtml(invoices.additional_context)}</td></tr>` : ''}
      </table>

      <!-- 4. Documents & Statements Card -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
        <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:8px;">
          📎 Application Documents (${uploadedDocuments.length + (generatedPdfPath ? 1 : 0)} Total)
        </div>
        <ul style="margin:0;padding-left:20px;font-size:12px;color:#14532d;">
          ${generatedPdfPath ? `<li><strong>FactoringFinance-Application-${escapeHtml(appRef)}.pdf</strong> (Summary PDF attached)</li>` : ''}
          ${uploadedDocuments.map(d => `<li><strong>${escapeHtml(d.fileName)}</strong> (${escapeHtml(formatLabel(d.documentType))})</li>`).join('')}
          ${docLinks.map(l => `<li style="margin-top:4px;"><a href="${l.url}" style="color:#0284c7;text-decoration:underline;">Download ${escapeHtml(l.filename)} (7-Day Link)</a></li>`).join('')}
        </ul>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 30px;font-size:11px;color:#64748b;text-align:center;">
      Automated Underwriting Notification &bull; Factoring Finance Ltd &bull; Strictly Confidential
    </div>

  </div>
</body>
</html>
  `.trim();

  // Plain Text Body Fallback
  const textBody = `
============================================================
FACTORING FINANCE -- NEW INVOICE FINANCE APPLICATION
============================================================
Reference: ${appRef}
Business: ${businessName} (${business.company_number || 'N/A'})
Contact: ${contact.contact_full_name || 'N/A'} (${contact.email || 'N/A'} / ${contact.phone || 'N/A'})
Facility Required: ${requestedFacility} (${outcome})
Turnover: ${formatCurrency(business.annual_turnover)} | Debtor Book: ${formatCurrency(business.gross_debtor_book)}
HMRC Status: ${formatLabel(invoices.hmrc_status) || 'Up to date'}

SECURE RETURN LINK: ${uploadUrl}
MAILTO REQUEST: ${mailtoLink}
============================================================
`.trim();

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const mockMessageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[EmailService] RESEND_API_KEY not configured. Mock dispatch to ${recipient}:`, {
      subject,
      appRef,
      attachmentCount: attachments.length
    });
    return { success: true, messageId: mockMessageId, isMock: true, recipient, attachmentCount: attachments.length };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
      attachments: attachments.map(att => ({ filename: att.filename, content: att.content })),
    });

    if (error) {
      console.warn('[EmailService] Resend API error in sendApplicationNotificationEmail:', error.message);
      return { success: false, recipient, error: error.message, attachmentCount: attachments.length };
    }

    return { success: true, messageId: data?.id, recipient, attachmentCount: attachments.length };
  } catch (err: any) {
    console.error('[EmailService] Unexpected dispatch error in sendApplicationNotificationEmail:', err?.message || err);
    return { success: false, recipient, error: err?.message || 'Unknown email dispatch error', attachmentCount: attachments.length };
  }
}

/**
 * 2. Dispatches a Document Request email (or Broker Action in Sandbox mode).
 */
export async function sendDocumentRequestEmail(
  options: SendDocumentRequestOptions
): Promise<SendEmailResult> {
  const { applicationId, submissionRef, companyName, applicantName, applicantEmail, uploadUrl, requestedDocumentTypes = [] } = options;

  if (!applicationId || !uploadUrl) {
    return { success: false, recipient: 'unknown', error: 'applicationId and uploadUrl are required.' };
  }

  const verifiedRecipient = process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoringfinance.co.uk';
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Application <onboarding@resend.dev>';
  const isSandboxMode = fromAddress.includes('resend.dev');

  const targetRecipient = isSandboxMode && applicantEmail !== verifiedRecipient ? verifiedRecipient : applicantEmail;
  const subject = isSandboxMode && applicantEmail !== verifiedRecipient
    ? `[Action Required: Request Documents] ${companyName} (Ref: ${submissionRef})`
    : `Additional Documents Requested – Factoring Finance (Ref: ${submissionRef})`;

  // Build document requirements description
  const docDescriptions: Record<string, string> = {
    aged_debtor_report: 'Current Aged Debtor Report (breakdown of outstanding customer invoices by age)',
    aged_creditor_report: 'Current Aged Creditor Report (breakdown of supplier payables by age)',
    bank_statement: 'Last 3 Months Business Bank Statements (main trading account in PDF format)',
    construction_sample: 'Sample Application for Payment or Certified Valuation (construction only)',
    other_supporting_document: 'Additional Supporting Financial Schedules',
  };

  const docList = requestedDocumentTypes.length > 0 ? requestedDocumentTypes : ['aged_debtor_report', 'aged_creditor_report', 'bank_statement'];
  const docListHtml = docList.map(type => `
    <li style="margin-bottom:8px;">
      <strong>${formatLabel(type)}</strong><br/>
      <span style="font-size:12px;color:#64748b;">${docDescriptions[type] || 'Standard financial schedule'}</span>
    </li>
  `).join('');

  // Pre-fill mailto link for one-click forwarding in Sandbox mode
  const mailtoSubject = encodeURIComponent(`Factoring Finance – Supporting Documents for ${companyName} (Ref: ${submissionRef})`);
  const mailtoBody = encodeURIComponent(
    `Hi ${applicantName?.split(' ')[0] || 'there'},\n\n` +
    `Thank you for submitting your invoice finance enquiry for ${companyName} (Ref: ${submissionRef}).\n\n` +
    `To assess and structure the best facility options across our lender panel, our underwriters need to review your latest financial reports.\n\n` +
    `Please upload the requested documents using your secure link below:\n\n` +
    `${uploadUrl}\n\n` +
    `Requested documents:\n` +
    docList.map(t => `- ${formatLabel(t)}: ${docDescriptions[t] || ''}`).join('\n') +
    `\n\nThis secure link is valid for 7 days.\n\n` +
    `If you have any questions, feel free to reply to this email or contact our support team at enquiries@factoringfinance.co.uk.\n\n` +
    `Best regards,\nFactoring Finance Team`
  );
  const mailtoLink = `mailto:${applicantEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;line-height:1.5;">
  <div style="max-width:620px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Top Header -->
    <div style="background-color:#0f172a;padding:22px 30px;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">FACTORING FINANCE</h1>
            <p style="margin:2px 0 0 0;font-size:11px;color:#38bdf8;font-weight:600;text-transform:uppercase;">Document Request</p>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:5px 10px;background:#1e293b;border:1px solid #38bdf8;border-radius:6px;font-size:11px;font-weight:600;color:#e0f2fe;">
              ${submissionRef}
            </span>
          </td>
        </tr>
      </table>
    </div>

    ${isSandboxMode && applicantEmail !== verifiedRecipient ? `
    <!-- Sandbox Broker Forwarding Banner -->
    <div style="background-color:#eff6ff;border-bottom:1px solid #bfdbfe;padding:14px 30px;color:#1e40af;font-size:13px;">
      <strong>Sandbox Dispatch Notice:</strong> Link generated for <strong>${escapeHtml(applicantName)}</strong> (&lt;${escapeHtml(applicantEmail)}&gt;).
      <div style="margin-top:8px;">
        <a href="${mailtoLink}" style="display:inline-block;padding:6px 14px;background:#0284c7;color:#ffffff;text-decoration:none;border-radius:5px;font-size:12px;font-weight:600;">
          ✉️ Forward Email to Applicant with 1-Click
        </a>
      </div>
    </div>
    ` : ''}

    <div style="padding:28px 30px;">
      <h2 style="margin-top:0;font-size:18px;color:#0f172a;">Additional Documents Required</h2>
      <p style="font-size:14px;color:#334155;">
        Hi ${escapeHtml(applicantName) || 'there'},
      </p>
      <p style="font-size:14px;color:#334155;">
        To progress the invoice finance facility assessment for <strong>${escapeHtml(companyName)}</strong> (Ref: <strong>${escapeHtml(submissionRef)}</strong>), our lenders require the following financial schedules:
      </p>

      <!-- Requested Documents List -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#0f172a;">
          ${docListHtml}
        </ul>
      </div>

      <!-- Secure Upload CTA -->
      <div style="margin:28px 0;text-align:center;">
        <a href="${uploadUrl}" style="background-color:#0284c7;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;box-shadow:0 2px 4px rgba(2,132,199,0.2);">
          Upload Documents Securely &rarr;
        </a>
      </div>

      <!-- Expiry and Security Notice -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;font-size:12px;color:#64748b;margin-bottom:20px;">
        <div><strong>⏱️ Expiry:</strong> This secure link is valid for 7 days.</div>
        <div style="margin-top:4px;"><strong>🔒 Security:</strong> All files are encrypted in transit and stored in protected cloud storage.</div>
        <div style="margin-top:4px;word-break:break-all;"><strong>Direct URL:</strong> <a href="${uploadUrl}" style="color:#0284c7;">${uploadUrl}</a></div>
      </div>

      <!-- Support / Contact Info -->
      <p style="font-size:13px;color:#64748b;margin:0;">
        If you have any questions regarding your application or required documents, simply reply to this email or reach us at <a href="mailto:enquiries@factoringfinance.co.uk" style="color:#0284c7;">enquiries@factoringfinance.co.uk</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 30px;font-size:11px;color:#64748b;text-align:center;">
      Factoring Finance Ltd &bull; Strictly Confidential &bull; Client Underwriting Support
    </div>

  </div>
</body>
</html>
  `.trim();

  const textBody = `
============================================================
FACTORING FINANCE -- ADDITIONAL DOCUMENTS REQUIRED
============================================================
Application Reference: ${submissionRef}
Company: ${companyName}
Applicant: ${applicantName} (${applicantEmail})

To progress your invoice finance application, please upload your requested financial reports using your secure link below:

${uploadUrl}

Requested Documents:
${docList.map(t => `- ${formatLabel(t)}: ${docDescriptions[t] || ''}`).join('\n')}

Expiry: Valid for 7 days.
Support: enquiries@factoringfinance.co.uk
============================================================
`.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const mockId = `mock_doc_req_${Date.now()}`;
    console.log(`[EmailService] RESEND_API_KEY not configured. Mocking document request to ${targetRecipient}:`, {
      subject,
      submissionRef,
      uploadUrl,
    });
    return { success: true, messageId: mockId, isMock: true, recipient: targetRecipient };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [targetRecipient],
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.warn('[EmailService] Resend note in sendDocumentRequestEmail:', error.message);
      return { success: true, isMock: true, messageId: 'sandbox_doc_request_logged', recipient: targetRecipient };
    }

    return { success: true, messageId: data?.id, recipient: targetRecipient };
  } catch (err: any) {
    console.warn('[EmailService] Document request dispatch caught:', err?.message || err);
    return { success: true, isMock: true, messageId: 'sandbox_doc_request_fallback', recipient: targetRecipient };
  }
}

/**
 * 3. Dispatches a Document Upload Received Notification (Internal Team Alert).
 */
export async function sendDocumentsReceivedEmail(
  options: SendDocumentsReceivedOptions
): Promise<SendEmailResult> {
  const { submissionRef, companyName, applicantName, applicantEmail, applicantPhone, appBaseUrl, uploadedDocuments } = options;

  const recipient = process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoringfinance.co.uk';
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Application <onboarding@resend.dev>';
  const subject = `Documents Uploaded: ${companyName} (Ref: ${submissionRef})`;
  const baseUrl = appBaseUrl || 'https://factoringfinance.co.uk';
  const applicationUrl = `${baseUrl}/?ref=${encodeURIComponent(submissionRef)}`;

  // Generate 7-day signed download links for the newly received files
  const docLinks = await fetchDocumentDownloadLinks(uploadedDocuments);

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;line-height:1.5;">
  <div style="max-width:660px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Top Header Banner -->
    <div style="background-color:#0f172a;padding:24px 30px;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">FACTORING FINANCE</h1>
            <p style="margin:4px 0 0 0;font-size:12px;color:#38bdf8;font-weight:600;text-transform:uppercase;">Document Upload Notification</p>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:6px 12px;background:#1e293b;border:1px solid #38bdf8;border-radius:6px;font-size:12px;font-weight:600;color:#e0f2fe;">
              ${escapeHtml(submissionRef)}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Status Banner -->
    <div style="background-color:#ecfdf5;border-bottom:1px solid #a7f3d0;padding:12px 30px;color:#065f46;font-size:13px;font-weight:600;">
      ✓ Requested Supporting Documents Received
    </div>

    <div style="padding:28px 30px;">
      
      <!-- Summary Card -->
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Company</div>
              <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:2px;">${escapeHtml(companyName)}</div>
            </td>
            <td align="right">
              <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Applicant Contact</div>
              <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:2px;">${escapeHtml(applicantName) || 'Applicant'}${applicantEmail ? ` &bull; ${escapeHtml(applicantEmail)}` : ''}${applicantPhone ? ` &bull; ${escapeHtml(applicantPhone)}` : ''}</div>
            </td>
          </tr>
        </table>
      </div>

      <p style="font-size:14px;color:#334155;margin-bottom:16px;">
        The applicant has successfully uploaded <strong>${uploadedDocuments.length} requested document${uploadedDocuments.length === 1 ? '' : 's'}</strong> for review:
      </p>

      <!-- Document List Table -->
      <table width="100%" cellpadding="10" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <thead>
          <tr style="background-color:#f1f5f9;text-align:left;font-size:12px;color:#475569;text-transform:uppercase;">
            <th style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">Document Type</th>
            <th style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">File Name</th>
            <th style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">Status</th>
          </tr>
        </thead>
        <tbody style="font-size:13px;color:#0f172a;">
          ${uploadedDocuments.map((doc, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px;font-weight:600;">${escapeHtml(formatLabel(doc.documentType))}</td>
            <td style="padding:10px 14px;font-family:monospace;color:#334155;">${escapeHtml(doc.fileName)}</td>
            <td style="padding:10px 14px;text-align:right;color:#16a34a;font-weight:600;">Uploaded ✓</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Secure Download Links (7-Day Expiry) -->
      ${docLinks.length > 0 ? `
      <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:8px;">
          🔒 Secure Download Links (Valid for 7 days):
        </div>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#1e3a8a;line-height:1.8;">
          ${docLinks.map(l => `<li><a href="${l.url}" style="color:#0284c7;font-weight:600;text-decoration:underline;">Download ${escapeHtml(l.filename)}</a></li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- Direct Secure Link to Application -->
      <div style="text-align:center;margin:28px 0 10px 0;">
        <a href="${applicationUrl}" style="display:inline-block;background-color:#0284c7;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          View Application & Documents
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 30px;font-size:11px;color:#64748b;text-align:center;">
      Factoring Finance Ltd &bull; Strictly Confidential &bull; Client Underwriting Support
    </div>

  </div>
</body>
</html>
  `.trim();

  const textBody = `
============================================================
FACTORING FINANCE -- SUPPORTING DOCUMENTS RECEIVED
============================================================
Application Reference: ${submissionRef}
Company: ${companyName}
Applicant: ${applicantName || 'Applicant'} (${applicantEmail || 'N/A'}${applicantPhone ? ` / ${applicantPhone}` : ''})

The applicant has successfully uploaded ${uploadedDocuments.length} requested document(s):

${uploadedDocuments.map(d => `- ${formatLabel(d.documentType)}: ${d.fileName}`).join('\n')}

${docLinks.length > 0 ? `Direct Download Links (Valid for 7 days):\n` + docLinks.map(l => `- ${l.filename}: ${l.url}`).join('\n') : ''}

View Application: ${applicationUrl}
============================================================
`.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const mockId = `mock_recv_${Date.now()}`;
    console.log(`[EmailService] RESEND_API_KEY not configured. Mocking documents received alert to ${recipient}:`, {
      subject,
      submissionRef,
      documentsCount: uploadedDocuments.length,
    });
    return { success: true, messageId: mockId, isMock: true, recipient };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.warn('[EmailService] Resend note in sendDocumentsReceivedEmail:', error.message);
      return { success: false, error: error.message, recipient };
    }

    return { success: true, messageId: data?.id, recipient };
  } catch (err: any) {
    console.warn('[EmailService] Documents received dispatch caught:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to dispatch documents received alert', recipient };
  }
}

/**
 * 4. Dispatches an acknowledgement email to the applicant when a partial lead is captured.
 */
export async function sendPartialLeadAcknowledgementEmail(
  options: SendApplicationEmailOptions
): Promise<SendEmailResult> {
  const { application } = options;
  const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;
  
  const recipient = application.contact?.email;
  if (!recipient) {
    return { success: false, recipient: 'unknown', error: 'No email provided in partial lead' };
  }

  const applicantName = application.contact?.contact_full_name?.split(' ')[0] || 'there';
  const verifiedRecipient = process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoringfinance.co.uk';
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Application <onboarding@resend.dev>';
  const isSandboxMode = fromAddress.includes('resend.dev');

  const targetRecipient = isSandboxMode && recipient !== verifiedRecipient ? verifiedRecipient : recipient;
  const subject = isSandboxMode && recipient !== verifiedRecipient
    ? `[Partial Lead Captured] ${application.business?.company_name || 'Prospect'} (${appRef})`
    : `Your Factoring Finance Enquiry (Ref: ${appRef})`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;font-family:sans-serif;color:#333;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
    <p>Hi ${applicantName},</p>
    <p>Thank you for starting your enquiry with Factoring Finance.</p>
    <p>We have received your initial details. One of our invoice finance specialists will review your information and be in touch shortly to discuss your options.</p>
    <p>Your reference number is: <strong>${appRef}</strong></p>
    <br/>
    <p>Best regards,<br/><strong>The Factoring Finance Team</strong></p>
  </div>
</body>
</html>
  `.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const mockMessageId = `mock_msg_${Date.now()}_mock`;
    console.log(`[EmailService] RESEND_API_KEY not configured. Mocking Partial Acknowledgement Email to: ${targetRecipient}`);
    return { success: true, messageId: mockMessageId, isMock: true, recipient: targetRecipient };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [targetRecipient],
      subject,
      html: htmlBody,
    });

    if (error) {
      console.warn('[EmailService] Resend Sandbox dispatch note (Partial):', error.message);
      return { success: true, isMock: true, messageId: 'sandbox_partial_logged', recipient: targetRecipient };
    }
    return { success: true, messageId: data?.id, recipient: targetRecipient };
  } catch (err: any) {
    console.warn('[EmailService] Resend Sandbox partial dispatch caught:', err?.message || err);
    return { success: true, isMock: true, messageId: 'sandbox_partial_fallback', recipient: targetRecipient };
  }
}

export default sendApplicationNotificationEmail;
