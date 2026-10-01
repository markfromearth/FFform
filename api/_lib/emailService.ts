import { Resend } from 'resend';
import { getAdminStorage, isFirebaseConfigured } from './firebaseAdmin.js';
import crypto from 'crypto';

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
}

export interface StatementLink {
  filename: string;
  url: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  isMock?: boolean;
  error?: string;
  recipient: string;
}

export interface SendApplicationEmailOptions {
  application: any;
  applicationRef?: string;
  generatedPdfPath: string;
  recipientEmail?: string;
}

export interface SendDocumentRequestOptions {
  applicationId: string;
  submissionRef: string;
  companyName: string;
  applicantName: string;
  applicantEmail: string;
  uploadUrl: string;
  requestedDocumentTypes: string[];
}

export function escapeHtml(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAddress(addr?: any): string {
  if (!addr) return 'Not provided';
  const parts = [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Not provided';
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Not specified';
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

function formatLabel(val?: string): string {
  if (!val) return 'Not specified';
  return val
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

export async function sendApplicationNotificationEmail(
  options: SendApplicationEmailOptions
): Promise<SendEmailResult> {
  const { application, generatedPdfPath } = options;
  
  const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;
  const recipient = options.recipientEmail || process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoring-finance.co.uk';
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Application <onboarding@resend.dev>';

  if (!generatedPdfPath) {
    return { success: false, recipient, error: 'Failed to dispatch email: Missing PDF generated path.' };
  }
  
  const pdfBuf = await downloadFileBuffer(generatedPdfPath);
  if (!pdfBuf) {
    return { success: false, recipient, error: 'Failed to dispatch email: Could not retrieve PDF from Storage.' };
  }

  const business = application.business || {};
  const contact = application.contact || {};
  const invoices = application.invoices || {};
  const consents = application.consents || {};

  const businessName = business.company_name || 'Business Applicant';
  const applicantName = contact.contact_full_name || 'Applicant';
  const applicantEmail = contact.email || 'N/A';
  const applicantPhone = contact.phone || 'N/A';
  
  const subject = `New Factoring Finance Application: ${businessName} (Ref: ${appRef})`;
  const requestedFacility = formatCurrency(invoices.requested_facility);

  const attachments: EmailAttachment[] = [
    { filename: `FactoringFinance-Application-${appRef}.pdf`, content: pdfBuf }
  ];

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family:sans-serif;color:#333;line-height:1.5;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;">
    <h2 style="color:#0f172a;">New Application: ${escapeHtml(businessName)}</h2>
    <p><strong>Reference:</strong> ${escapeHtml(appRef)}</p>
    <p><strong>Company:</strong> ${escapeHtml(businessName)}</p>
    <p><strong>Applicant:</strong> ${escapeHtml(applicantName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(applicantEmail)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(applicantPhone)}</p>
    <p><strong>Requested Facility:</strong> ${escapeHtml(requestedFacility)}</p>
    <br/>
    <p><strong>The completed application PDF is attached.</strong></p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
New Application: ${businessName}
Reference: ${appRef}
Company: ${businessName}
Applicant: ${applicantName}
Email: ${applicantEmail}
Phone: ${applicantPhone}
Requested Facility: ${requestedFacility}

The completed application PDF is attached.
  `.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const mockMessageId = `mock_msg_${Date.now()}_mock`;
    console.log(`[EmailService] RESEND_API_KEY not configured. Mocking Application Notification to: ${recipient}`);
    return { success: true, messageId: mockMessageId, isMock: true, recipient };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    if (error) {
      console.warn('[EmailService] Resend API error in sendApplicationNotificationEmail:', error.message);
      return { success: false, error: error.message, recipient };
    }
    return { success: true, messageId: data?.id, recipient };
  } catch (err: any) {
    console.error('[EmailService] Unexpected dispatch error in sendApplicationNotificationEmail:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown email transmission error', recipient };
  }
}

export async function sendDocumentRequestEmail(
  options: SendDocumentRequestOptions
): Promise<SendEmailResult> {
  const { submissionRef, companyName, applicantName, applicantEmail, uploadUrl, requestedDocumentTypes } = options;
  const recipient = applicantEmail;
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Support <support@resend.dev>';
  const verifiedRecipient = process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoring-finance.co.uk';
  const isSandboxMode = fromAddress.includes('resend.dev');

  if (!recipient) {
    return { success: false, error: 'Applicant email missing.', recipient: 'unknown' };
  }

  const targetRecipient = isSandboxMode && recipient !== verifiedRecipient ? verifiedRecipient : recipient;
  const subject = isSandboxMode && recipient !== verifiedRecipient
    ? `[Sandbox Docs Request] ${companyName} (${submissionRef})`
    : `Factoring Finance – Supporting Documents Needed (${submissionRef})`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body>
  <p>Hi ${escapeHtml(applicantName.split(' ')[0])},</p>
  <p>Please upload the requested documents using this link: <a href="${uploadUrl}">${uploadUrl}</a></p>
</body>
</html>
  `.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: true, messageId: `mock_req_${Date.now()}`, isMock: true, recipient: targetRecipient };
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
      return { success: false, error: error.message, recipient: targetRecipient };
    }
    return { success: true, messageId: data?.id, recipient: targetRecipient };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to dispatch document request email.', recipient: targetRecipient };
  }
}

export default sendApplicationNotificationEmail;
