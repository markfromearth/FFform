import { Resend } from 'resend';
import { getAdminStorage } from './firebaseAdmin.js';
import { formatLabel } from '../../src/utils/formatters.js';
import type { ApplicationData } from '../../src/schemas/applicationSchemas.js';

export interface SendApplicationEmailOptions {
  application: ApplicationData;
  recipientEmail?: string;
  applicationRef?: string;
  generatedPdfPath?: string;
  uploadedDocuments?: any[];
}

export interface SendApplicationEmailResult {
  success: boolean;
  messageId?: string;
  isMock?: boolean;
  recipient: string;
  error?: string;
}

/**
 * Dispatches operational application email notification containing the editable structured case summary.
 */
export async function sendApplicationNotificationEmail(
  options: SendApplicationEmailOptions
): Promise<SendApplicationEmailResult> {
  const { application, generatedPdfPath, uploadedDocuments = [] } = options;
  const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;
  
  const recipient =
    options.recipientEmail ||
    process.env.APPLICATION_NOTIFICATION_EMAIL;

  if (!recipient) {
    return { success: false, recipient: 'unknown', error: 'APPLICATION_NOTIFICATION_EMAIL is not configured in the environment.' };
  }

  const businessName = application.business?.company_name || 'Business Applicant';
  const subject = `New Factoring Finance Application – ${businessName} – ${appRef}`;
  
  const formatAddress = (addr: any) => {
    if (!addr) return 'Not provided';
    return [addr.address_line_1, addr.locality, addr.postal_code, addr.country].filter(Boolean).join(', ');
  };

  const contactName = application.contact?.contact_full_name || 'Not provided';
  const requestedFacility = application.invoices?.requested_facility 
    ? `£${application.invoices.requested_facility.toLocaleString()}` 
    : 'Not provided';
  const outcome = application.invoices?.desired_outcome ? formatLabel(application.invoices.desired_outcome) : 'Not provided';

  let docsSuppliedStr = 'None';
  if (uploadedDocuments.length > 0) {
    docsSuppliedStr = uploadedDocuments.map(d => formatLabel(d.documentType) + ` (${d.fileName})`).join('\n- ');
    docsSuppliedStr = '\n- ' + docsSuppliedStr;
  }

  const b = application.business || {};
  const c = application.contact || {};
  const i = application.invoices || {};
  const cons = application.consents || {};

  let textBody = `
New Factoring Finance Application Received

====================
BUSINESS DETAILS
====================
Company Name: ${b.company_name || 'Not provided'}
Company Number: ${b.company_number || 'Not provided'}
Company Status: ${b.company_status || 'Not provided'}
Entity Type: ${b.entity_type || 'Not provided'}
Incorporation Date: ${b.incorporation_date || 'Not provided'}
Registered Address: ${formatAddress(b.registered_address)}
Trading Address (Same as Reg?): ${b.trading_address_same_as_registered ? 'Yes' : 'No'}
Trading Address: ${b.trading_address_same_as_registered ? formatAddress(b.registered_address) : formatAddress(b.trading_address)}
Industry: ${b.industry || 'Not provided'}
Annual Turnover: ${b.annual_turnover !== undefined ? '£' + b.annual_turnover.toLocaleString() : 'Not provided'}
Gross Debtor Book: ${b.gross_debtor_book !== undefined ? '£' + b.gross_debtor_book.toLocaleString() : 'Not provided'}
B2B Completed Supply: ${b.b2b_completed_supply || 'Not provided'}
SIC Codes: ${b.sic_codes?.join(', ') || 'Not provided'}
Selected Officer: ${b.selected_officer_name || 'Not provided'}
Applicant Relationship: ${b.applicant_relationship || 'Not provided'}

====================
CONTACT DETAILS
====================
Contact Name: ${c.contact_full_name || 'Not provided'}
Contact Role: ${c.contact_role || 'Not provided'}
Email: ${c.email || 'Not provided'}
Phone: ${c.phone || 'Not provided'}
Funding Timescale: ${c.funding_timescale || 'Not provided'}

====================
INVOICES & FUNDING
====================
Desired Outcome: ${outcome}
Requested Facility: ${requestedFacility}
Funding Purpose: ${i.funding_purpose?.join(', ') || 'Not provided'}
Payment Terms (Days): ${i.payment_terms_days || 'Not provided'}
Largest Debtor Concentration: ${i.largest_debtor_concentration_pct || 'Not provided'}
Debtor Geography: ${i.debtor_geography?.join(', ') || 'Not provided'}
Export Sales: ${i.export_sales_pct || 'Not provided'}
Invoice Currency: ${i.invoice_currency || 'Not provided'}
HMRC Status: ${i.hmrc_status || 'Not provided'}
HMRC Arrears Amount: ${i.hmrc_arrears_amount !== undefined ? '£' + i.hmrc_arrears_amount.toLocaleString() : 'Not provided'}
Additional Context: ${i.additional_context || 'Not provided'}

Existing Invoice Finance: ${i.existing_invoice_finance ? 'Yes' : 'No'}
Current Provider: ${i.current_provider || 'Not provided'}
Current Facility Limit: ${i.current_facility_limit !== undefined ? '£' + i.current_facility_limit.toLocaleString() : 'Not provided'}
Reason for Switch: ${i.reason_for_switch?.join(', ') || 'Not provided'}
Notice or Exit Date: ${i.notice_or_exit_date || 'Not provided'}

-- Sector Specifics --
Construction Invoicing Type: ${i.construction_invoicing_type || 'N/A'}
Construction Main Contractor: ${i.construction_main_contract_or || 'N/A'}
Construction Retention: ${i.construction_retention || 'N/A'}
Recruitment Type: ${i.recruitment_type || 'N/A'}
Payroll Support Required: ${i.payroll_support_required || 'N/A'}

====================
CONSENTS
====================
Processing Notice Acknowledged: ${cons.processing_notice_acknowledged ? 'Yes' : 'No'}
Marketing Email: ${cons.marketing_email ? 'Yes' : 'No'}
Marketing SMS: ${cons.marketing_sms ? 'Yes' : 'No'}
Consent Version: ${cons.consent_version || 'Not provided'}
Consent Source: ${cons.consent_source || 'Not provided'}

====================
DOCUMENTS
====================
Supporting Documents Supplied: ${docsSuppliedStr}

IMPORTANT: The completed application document and all supplied supporting documents are securely attached to this email.
`.trim();

  let htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 0; }
    .container { max-width: 700px; margin: 20px auto; background: #fff; border: 1px solid #ddd; padding: 20px; }
    h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h3 { color: #334155; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { width: 40%; color: #475569; font-weight: 600; }
    .warning { color: #d32f2f; font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>New Factoring Finance Application Received</h2>
    <p><strong>Application Reference:</strong> ${appRef}</p>
    <p><strong>Submission Date:</strong> ${new Date().toISOString().split('T')[0]}</p>

    <h3>Business Details</h3>
    <table>
      <tr><th>Company Name</th><td>${b.company_name || 'Not provided'}</td></tr>
      <tr><th>Company Number</th><td>${b.company_number || 'Not provided'}</td></tr>
      <tr><th>Company Status</th><td>${b.company_status || 'Not provided'}</td></tr>
      <tr><th>Entity Type</th><td>${b.entity_type || 'Not provided'}</td></tr>
      <tr><th>Incorporation Date</th><td>${b.incorporation_date || 'Not provided'}</td></tr>
      <tr><th>Registered Address</th><td>${formatAddress(b.registered_address)}</td></tr>
      <tr><th>Trading Address</th><td>${b.trading_address_same_as_registered ? formatAddress(b.registered_address) : formatAddress(b.trading_address)}</td></tr>
      <tr><th>Industry</th><td>${b.industry || 'Not provided'}</td></tr>
      <tr><th>Annual Turnover</th><td>${b.annual_turnover !== undefined ? '£' + b.annual_turnover.toLocaleString() : 'Not provided'}</td></tr>
      <tr><th>Gross Debtor Book</th><td>${b.gross_debtor_book !== undefined ? '£' + b.gross_debtor_book.toLocaleString() : 'Not provided'}</td></tr>
      <tr><th>B2B Completed Supply</th><td>${b.b2b_completed_supply || 'Not provided'}</td></tr>
      <tr><th>SIC Codes</th><td>${b.sic_codes?.join(', ') || 'Not provided'}</td></tr>
      <tr><th>Selected Officer</th><td>${b.selected_officer_name || 'Not provided'}</td></tr>
      <tr><th>Applicant Relationship</th><td>${b.applicant_relationship || 'Not provided'}</td></tr>
    </table>

    <h3>Contact Details</h3>
    <table>
      <tr><th>Contact Name</th><td>${c.contact_full_name || 'Not provided'}</td></tr>
      <tr><th>Contact Role</th><td>${c.contact_role || 'Not provided'}</td></tr>
      <tr><th>Email</th><td>${c.email || 'Not provided'}</td></tr>
      <tr><th>Phone</th><td>${c.phone || 'Not provided'}</td></tr>
      <tr><th>Funding Timescale</th><td>${c.funding_timescale || 'Not provided'}</td></tr>
    </table>

    <h3>Invoices & Funding</h3>
    <table>
      <tr><th>Desired Outcome</th><td>${outcome}</td></tr>
      <tr><th>Requested Facility</th><td>${requestedFacility}</td></tr>
      <tr><th>Funding Purpose</th><td>${i.funding_purpose?.join(', ') || 'Not provided'}</td></tr>
      <tr><th>Payment Terms (Days)</th><td>${i.payment_terms_days || 'Not provided'}</td></tr>
      <tr><th>Largest Debtor Concentration</th><td>${i.largest_debtor_concentration_pct || 'Not provided'}</td></tr>
      <tr><th>Debtor Geography</th><td>${i.debtor_geography?.join(', ') || 'Not provided'}</td></tr>
      <tr><th>Export Sales</th><td>${i.export_sales_pct || 'Not provided'}</td></tr>
      <tr><th>Invoice Currency</th><td>${i.invoice_currency || 'Not provided'}</td></tr>
      <tr><th>HMRC Status</th><td>${i.hmrc_status || 'Not provided'}</td></tr>
      <tr><th>HMRC Arrears Amount</th><td>${i.hmrc_arrears_amount !== undefined ? '£' + i.hmrc_arrears_amount.toLocaleString() : 'Not provided'}</td></tr>
      <tr><th>Additional Context</th><td>${i.additional_context || 'Not provided'}</td></tr>
      <tr><th>Existing Invoice Finance</th><td>${i.existing_invoice_finance ? 'Yes' : 'No'}</td></tr>
      <tr><th>Current Provider</th><td>${i.current_provider || 'Not provided'}</td></tr>
      <tr><th>Current Facility Limit</th><td>${i.current_facility_limit !== undefined ? '£' + i.current_facility_limit.toLocaleString() : 'Not provided'}</td></tr>
      <tr><th>Reason for Switch</th><td>${i.reason_for_switch?.join(', ') || 'Not provided'}</td></tr>
      <tr><th>Notice or Exit Date</th><td>${i.notice_or_exit_date || 'Not provided'}</td></tr>
      <tr><th>Construction Invoicing Type</th><td>${i.construction_invoicing_type || 'N/A'}</td></tr>
      <tr><th>Construction Main Contractor</th><td>${i.construction_main_contract_or || 'N/A'}</td></tr>
      <tr><th>Construction Retention</th><td>${i.construction_retention || 'N/A'}</td></tr>
      <tr><th>Recruitment Type</th><td>${i.recruitment_type || 'N/A'}</td></tr>
      <tr><th>Payroll Support Required</th><td>${i.payroll_support_required || 'N/A'}</td></tr>
    </table>

    <h3>Consents</h3>
    <table>
      <tr><th>Processing Notice Acknowledged</th><td>${cons.processing_notice_acknowledged ? 'Yes' : 'No'}</td></tr>
      <tr><th>Marketing Email</th><td>${cons.marketing_email ? 'Yes' : 'No'}</td></tr>
      <tr><th>Marketing SMS</th><td>${cons.marketing_sms ? 'Yes' : 'No'}</td></tr>
      <tr><th>Consent Version</th><td>${cons.consent_version || 'Not provided'}</td></tr>
      <tr><th>Consent Source</th><td>${cons.consent_source || 'Not provided'}</td></tr>
    </table>
    
    <h3>Supporting Documents Supplied</h3>
    <pre style="font-family:inherit; background:#f8fafc; padding:10px; border-radius:4px;">${docsSuppliedStr}</pre>
    
    <p class="warning">
      IMPORTANT: The completed application document and all supplied supporting documents are securely attached to this email.
    </p>
  </div>
</body>
</html>
`;

  // Fetch Attachments using Firebase Admin Storage
  const attachments: any[] = [];
  let totalAttachmentBytes = 0;
  const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;
  let attachmentsTruncated = false;

  try {
    const storage = getAdminStorage();
    if (storage) {
      const bucket = storage.bucket();
      
      // 1. Attach Generated PDF
      if (generatedPdfPath) {
        console.log(`[EmailService] Downloading generated PDF for attachment: ${generatedPdfPath}`);
        const [pdfBuffer] = await bucket.file(generatedPdfPath).download();
        
        if (totalAttachmentBytes + pdfBuffer.length <= MAX_ATTACHMENT_BYTES) {
          totalAttachmentBytes += pdfBuffer.length;
          attachments.push({
            filename: `${appRef}-application.pdf`,
            content: pdfBuffer,
          });
        } else {
          attachmentsTruncated = true;
        }
      }

      // 2. Attach Uploaded Documents
      for (const doc of uploadedDocuments) {
        if (doc.storagePath) {
          if (attachmentsTruncated) continue;
          console.log(`[EmailService] Downloading supporting doc for attachment: ${doc.storagePath}`);
          const [docBuffer] = await bucket.file(doc.storagePath).download();
          
          if (totalAttachmentBytes + docBuffer.length <= MAX_ATTACHMENT_BYTES) {
            totalAttachmentBytes += docBuffer.length;
            attachments.push({
              filename: doc.fileName,
              content: docBuffer,
            });
          } else {
            attachmentsTruncated = true;
            console.warn(`[EmailService] Attachment size limit reached. Skipping ${doc.fileName}`);
          }
        }
      }
    } else {
      console.warn('[EmailService] Firebase Storage is not configured. Cannot download attachments.');
    }
  } catch (err: any) {
    console.error('[EmailService] Error retrieving attachments from Firebase Storage:', err.message);
    // Continue with email dispatch even if attachments fail
  }

  if (attachmentsTruncated) {
    const warning = "\n\nNote: Some supporting documents were too large to attach to this email. Please log in to the admin dashboard to view all submitted files.";
    textBody += warning;
    htmlBody = htmlBody.replace('</div>\n</body>', `  <p style="color:#d32f2f; font-weight:bold; padding:10px; border:2px dashed #d32f2f;">Note: Some supporting documents were too large to attach to this email. Please log in to the admin dashboard to view all submitted files.</p>\n  </div>\n</body>`);
  }

  // Check environment credentials
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const mockMessageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(
      `[EmailService] RESEND_API_KEY not configured. Simulated dispatch for Application Ref: ${appRef}`,
      { mockMessageId, attachmentsAttached: attachments.length }
    );
    return { success: true, messageId: mockMessageId, isMock: true, recipient };
  }

  // Dispatch via Resend SDK
  try {
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL;
    
    if (!fromAddress) {
       return { success: false, recipient, error: 'RESEND_FROM_EMAIL is not configured.' };
    }

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    if (error) {
      console.error(`[EmailService] Resend API rejected the payload. Total attachment bytes: ${totalAttachmentBytes}. Error:`, error);
      return { success: false, recipient, error: error.message };
    }

    return {
      success: true,
      messageId: data?.id,
      recipient,
    };
  } catch (err: any) {
    console.error(`[EmailService] Unexpected error sending email via Resend (Total attachment bytes: ${totalAttachmentBytes}):`, err.message);
    return { success: false, recipient, error: err.message };
  }
}

export default sendApplicationNotificationEmail;


/**
 * Dispatches an acknowledgement email to the applicant when a partial lead is captured.
 */
export async function sendPartialLeadAcknowledgementEmail(
  options: SendApplicationEmailOptions
): Promise<SendApplicationEmailResult> {
  const { application } = options;
  const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;
  
  const recipient = application.contact?.email;
  if (!recipient) {
    return { success: false, recipient: 'unknown', error: 'No email provided in partial lead' };
  }

  const applicantName = application.contact?.contact_full_name?.split(' ')[0] || 'there';
  const subject = `Your Factoring Finance Enquiry (Ref: ${appRef})`;
  
  const textBody = `Hi ${applicantName},\n\nThank you for starting your enquiry with Factoring Finance.\n\nWe have received your initial details. If you didn't get a chance to finish the form, don't worry—one of our invoice finance specialists will review the information you provided and will be in touch shortly to discuss your options.\n\nYour reference number is: ${appRef}\n\nBest regards,\nThe Factoring Finance Team`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;font-family:sans-serif;color:#333;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <p>Hi ${applicantName},</p>
    <p>Thank you for starting your enquiry with Factoring Finance.</p>
    <p>We have received your initial details. If you didn't get a chance to finish the form, don't worry—one of our invoice finance specialists will review the information you provided and will be in touch shortly to discuss your options.</p>
    <p>Your reference number is: <strong>${appRef}</strong></p>
    <br/>
    <p>Best regards,<br/><strong>The Factoring Finance Team</strong></p>
  </div>
</body>
</html>
`;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const mockMessageId = `mock_msg_${Date.now()}_mock`;
    console.log(`[EmailService] RESEND_API_KEY not configured. Mocking Partial Acknowledgement Email to: ${recipient}`);
    return { success: true, messageId: mockMessageId, isMock: true, recipient };
  }

  try {
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance <enquiries@factoringfinance.co.uk>';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.error('[EmailService] Resend API error response (Partial):', error);
      return { success: false, error: error.message, recipient };
    }
    return { success: true, messageId: data?.id, recipient };
  } catch (err: any) {
    console.error('[EmailService] Unexpected error during Partial email dispatch:', err?.message || err);
    return { success: false, error: err?.message, recipient };
  }
}
