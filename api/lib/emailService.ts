import { Resend } from 'resend';
import { generateCaseSummary } from './caseSummaryGenerator.js';
import type { ApplicationData } from '../../src/schemas/applicationSchemas';

export interface SendApplicationEmailOptions {
  application: ApplicationData;
  recipientEmail?: string;
  applicationRef?: string;
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
  const { application } = options;

  const appRef = options.applicationRef || `FF-${new Date().getFullYear()}-${crypto.randomUUID().slice(-5).toUpperCase()}`;

  const recipient =
    options.recipientEmail ||
    process.env.APPLICATION_NOTIFICATION_EMAIL ||
    'ben@factoringfinance.co.uk';

  const businessName = application.business.company_name || 'Business Applicant';
  const subject = `New Factoring Enquiry: ${businessName} (Ref: ${appRef})`;
  
  // Generate the structured, editable Markdown text for the broker
  const textBody = generateCaseSummary(application, {
    submissionRef: appRef,
    submittedAt: new Date().toISOString()
  });

  // Convert simple markdown to HTML for the email
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:sans-serif;color:#333;line-height:1.5;">
  <div style="max-width:700px;margin:20px auto;background:#fff;border:1px solid #ddd;padding:20px;">
    <pre style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px;">${textBody}</pre>
  </div>
</body>
</html>
`;

  // Check environment credentials
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const mockMessageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(
      `[EmailService] RESEND_API_KEY not configured. Bypassing network request. Simulated dispatch for Application Ref: ${appRef}`,
      { mockMessageId }
    );

    return {
      success: true,
      messageId: mockMessageId,
      isMock: true,
      recipient
    };
  }

  // Dispatch via Resend SDK
  try {
    const resend = new Resend(apiKey);
    const fromAddress =
      process.env.RESEND_FROM_EMAIL || 'Factoring Finance <enquiries@factoringfinance.co.uk>';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.error('[EmailService] Resend API error response:', error);
      return {
        success: false,
        error: error.message || 'Resend failed to deliver email',
        recipient,
      };
    }

    return {
      success: true,
      messageId: data?.id,
      recipient,
    };
  } catch (err: any) {
    console.error('[EmailService] Unexpected error during Resend email dispatch:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Unexpected error during email dispatch',
      recipient,
    };
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

  const applicantName = application.contact?.full_name?.split(' ')[0] || 'there';
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
