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
