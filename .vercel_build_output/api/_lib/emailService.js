import { Resend } from 'resend';
import { getAdminStorage } from './firebaseAdmin.js';
import { formatLabel } from '../../src/utils/formatters.js';
/**
 * Dispatches operational application email notification containing the editable structured case summary.
 */
export async function sendApplicationNotificationEmail(options) {
    const { application, generatedPdfPath, uploadedDocuments = [] } = options;
    const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;
    const recipient = options.recipientEmail ||
        process.env.APPLICATION_NOTIFICATION_EMAIL;
    if (!recipient) {
        return { success: false, recipient: 'unknown', error: 'APPLICATION_NOTIFICATION_EMAIL is not configured in the environment.' };
    }
    const businessName = application.business?.company_name || 'Business Applicant';
    const subject = `New Factoring Finance Application – ${businessName} – ${appRef}`;
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
    let textBody = `
New Factoring Finance Application Received

Company Name: ${businessName}
Application Reference: ${appRef}
Submission Date: ${new Date().toISOString().split('T')[0]}
Contact Name: ${contactName}
Requested Facility: ${requestedFacility}

Enquiry Summary:
The applicant is seeking a facility of ${requestedFacility}. Their desired outcome is: ${outcome}.

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
</head>
<body style="margin:0;padding:0;font-family:sans-serif;color:#333;line-height:1.5;">
  <div style="max-width:700px;margin:20px auto;background:#fff;border:1px solid #ddd;padding:20px;">
    <h2>New Factoring Finance Application Received</h2>
    <p><strong>Company Name:</strong> ${businessName}</p>
    <p><strong>Application Reference:</strong> ${appRef}</p>
    <p><strong>Submission Date:</strong> ${new Date().toISOString().split('T')[0]}</p>
    <p><strong>Contact Name:</strong> ${contactName}</p>
    <p><strong>Requested Facility:</strong> ${requestedFacility}</p>
    
    <h3>Enquiry Summary</h3>
    <p>The applicant is seeking a facility of ${requestedFacility}. Their desired outcome is: ${outcome}.</p>
    
    <h3>Supporting Documents Supplied</h3>
    <pre style="font-family:inherit;">${docsSuppliedStr}</pre>
    
    <p style="color:#d32f2f; font-weight:bold;">
      IMPORTANT: The completed application document and all supplied supporting documents are securely attached to this email.
    </p>
  </div>
</body>
</html>
`;
    // Fetch Attachments using Firebase Admin Storage
    const attachments = [];
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
                }
                else {
                    attachmentsTruncated = true;
                }
            }
            // 2. Attach Uploaded Documents
            for (const doc of uploadedDocuments) {
                if (doc.storagePath) {
                    if (attachmentsTruncated)
                        continue;
                    console.log(`[EmailService] Downloading supporting doc for attachment: ${doc.storagePath}`);
                    const [docBuffer] = await bucket.file(doc.storagePath).download();
                    if (totalAttachmentBytes + docBuffer.length <= MAX_ATTACHMENT_BYTES) {
                        totalAttachmentBytes += docBuffer.length;
                        attachments.push({
                            filename: doc.fileName,
                            content: docBuffer,
                        });
                    }
                    else {
                        attachmentsTruncated = true;
                        console.warn(`[EmailService] Attachment size limit reached. Skipping ${doc.fileName}`);
                    }
                }
            }
        }
        else {
            console.warn('[EmailService] Firebase Storage is not configured. Cannot download attachments.');
        }
    }
    catch (err) {
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
        console.log(`[EmailService] RESEND_API_KEY not configured. Simulated dispatch for Application Ref: ${appRef}`, { mockMessageId, attachmentsAttached: attachments.length });
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
    }
    catch (err) {
        console.error(`[EmailService] Unexpected error sending email via Resend (Total attachment bytes: ${totalAttachmentBytes}):`, err.message);
        return { success: false, recipient, error: err.message };
    }
}
export default sendApplicationNotificationEmail;
/**
 * Dispatches an acknowledgement email to the applicant when a partial lead is captured.
 */
export async function sendPartialLeadAcknowledgementEmail(options) {
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
    }
    catch (err) {
        console.error('[EmailService] Unexpected error during Partial email dispatch:', err?.message || err);
        return { success: false, error: err?.message, recipient };
    }
}
