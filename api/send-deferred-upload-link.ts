import { Resend } from 'resend';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  try {
    const { email, phone, applicationId } = req.body || {};

    if (!email || !applicationId) {
      res.status(400).json({ error: 'Email and Application ID are required.' });
      return;
    }

    // Generate a secure, time-limited token
    const token = crypto.randomBytes(32).toString('hex');
    const returnLink = `https://factoringfinance.co.uk/upload?app_id=${applicationId}&token=${token}`;

    const apiKey = process.env.RESEND_API_KEY;

    // Send email via Resend
    if (apiKey) {
      const resend = new Resend(apiKey);
      const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance <enquiries@factoringfinance.co.uk>';

      const emailResponse = await resend.emails.send({
        from: fromAddress,
        to: [email],
        subject: 'Your Factoring Finance Secure Upload Link',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #0f172a;">Complete your Factoring Finance enquiry</h2>
            <p>Thank you for submitting your enquiry. To fast-track your assessment, our lenders will need to see some standard financial reports.</p>
            <p>You can securely upload your Current Aged Debtor Report, Current Aged Creditor Report, and Bank Statements using the link below.</p>
            <div style="margin: 30px 0;">
              <a href="${returnLink}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Upload Documents Now</a>
            </div>
            <p style="font-size: 14px; color: #64748b;">This secure link will expire in 7 days.</p>
            <p style="font-size: 14px; color: #64748b;">If you have any questions, simply reply to this email.</p>
          </div>
        `
      });

      if (emailResponse.error) {
        console.error('[SendDeferredLinkAPI] Resend API error:', emailResponse.error);
        throw new Error(emailResponse.error.message || 'Failed to send email');
      }
    } else {
      const redactedEmail = email.replace(/(?<=^.{2}).*(?=@)/, '***');
      console.log(`[SendDeferredLinkAPI] RESEND_API_KEY not configured. Simulated dispatch to ${redactedEmail}. Link: ${returnLink}`);
    }

    // SMS dispatch could be integrated here (e.g., using Twilio)
    if (phone) {
      const redactedPhone = phone.replace(/(?<=^.{3}).*(?=.{2}$)/, '***');
      console.log(`[SendDeferredLinkAPI] Simulated SMS dispatch to ${redactedPhone}. Link: ${returnLink}`);
    }

    res.status(200).json({ success: true, returnLink });
  } catch (error: any) {
    console.error('[SendDeferredLinkAPI] Error:', error?.message || 'Unknown error');
    res.status(500).json({ error: 'Failed to generate and send deferred upload link.' });
  }
}
