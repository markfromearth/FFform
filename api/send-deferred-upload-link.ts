import { Resend } from 'resend';
import crypto from 'crypto';
import { createUploadToken } from './_lib/applicationRepository.js';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://factoringfinance.co.uk',
    'https://www.factoringfinance.co.uk',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  let safeOrigin = 'https://factoringfinance.co.uk';
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    safeOrigin = origin;
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', safeOrigin);
  }
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
    const payload = req.body || {};
    const { email, phone, applicationId } = payload;
    
    // Anti-spam Turnstile Verification
    const turnstileToken = payload.turnstileToken;
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    
    if (turnstileSecret) {
      if (!turnstileToken) {
        res.status(403).json({ error: 'Missing anti-spam token.' });
        return;
      }
      
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `secret=${encodeURIComponent(turnstileSecret)}&response=${encodeURIComponent(turnstileToken)}`,
          signal: AbortSignal.timeout(5000)
        });
        
        if (verifyRes.ok) {
          const outcome = await verifyRes.json();
          if (!outcome.success) {
            console.warn('[DeferredLinkAPI] Invalid Turnstile token:', outcome['error-codes']);
            res.status(403).json({ error: 'Invalid anti-spam token.' });
            return;
          }
        } else {
          console.error('[DeferredLinkAPI] Turnstile verify endpoint failed. Failing OPEN.', verifyRes.status);
        }
      } catch (err) {
        console.error('[DeferredLinkAPI] Turnstile verify network error. Failing OPEN.', err);
      }
    } else {
      console.warn('[DeferredLinkAPI] TURNSTILE_SECRET_KEY not set. Skipping verification.');
    }

    if (!email || !applicationId) {
      res.status(400).json({ error: 'Email and Application ID are required.' });
      return;
    }

    const token = await createUploadToken(applicationId, 7 * 24 * 60 * 60 * 1000);
    const returnLink = `${safeOrigin}/?token=${token}`;

    const apiKey = process.env.RESEND_API_KEY;

    // Send notification via Resend
    if (apiKey) {
      try {
        const resend = new Resend(apiKey);
        const fromAddress = process.env.RESEND_FROM_EMAIL || 'Factoring Finance Application <onboarding@resend.dev>';
        const verifiedRecipient = process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoringfinance.co.uk';

        const isSandboxMode = fromAddress.includes('resend.dev');
        const targetRecipient = isSandboxMode && email !== verifiedRecipient ? verifiedRecipient : email;
        const emailSubject = isSandboxMode && email !== verifiedRecipient
          ? `[Deferred Upload Link Requested] Prospect: ${email}`
          : 'Your Factoring Finance Secure Upload Link';

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #0f172a;">Factoring Finance Secure Document Upload Link</h2>
            ${isSandboxMode && email !== verifiedRecipient ? `<p><strong>Note (Sandbox Mode):</strong> The applicant <strong>${email}</strong> requested a deferred document upload link.</p>` : ''}
            <p>To fast-track your assessment, financial reports can be securely uploaded using the link below:</p>
            <div style="margin: 30px 0;">
              <a href="${returnLink}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Upload Documents Now</a>
            </div>
            <p style="font-size: 13px; color: #64748b;">Direct Link URL: <a href="${returnLink}" style="color: #0284c7;">${returnLink}</a></p>
            <p style="font-size: 13px; color: #64748b;">This secure link will expire in 7 days.</p>
          </div>
        `;

        const emailResponse = await resend.emails.send({
          from: fromAddress,
          to: [targetRecipient],
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailResponse.error) {
          console.warn('[SendDeferredLinkAPI] Resend API note:', emailResponse.error.message);
        }
      } catch (emailErr: any) {
        console.warn('[SendDeferredLinkAPI] Resend dispatch caught:', emailErr?.message || emailErr);
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
    console.error('[SendDeferredLinkAPI] Top-level handler error:', error?.message || 'Unknown error');
    res.status(500).json({ error: 'Failed to generate deferred upload link.' });
  }
}
