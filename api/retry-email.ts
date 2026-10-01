import { getApplicationById, updateEmailStatus, updateDocsReceivedEmailStatus } from './_lib/applicationRepository.js';
import { sendApplicationNotificationEmail, sendDocumentsReceivedEmail } from './_lib/emailService.js';

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
  
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://factoringfinance.co.uk');
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

  // 1. Authenticate Administrative Request
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (!expectedKey) {
    console.error('[RetryEmailAPI] ADMIN_API_KEY is not configured in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: administrative endpoint locked.' });
  }
  
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrative credentials.' });
  }

  try {
    const { applicationId, force, type = 'application_submission' } = req.body || {};

    if (!applicationId) {
      return res.status(400).json({ error: 'applicationId is required.' });
    }

    // 2. Locate the existing application
    const record = await getApplicationById(applicationId);
    if (!record) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (type === 'documents_received') {
      // Check idempotency
      if (record.docsReceivedEmailStatus === 'sent' && !force) {
        return res.status(409).json({
          error: 'Conflict: Documents received email has already been successfully sent for this application. Use force=true to override.',
        });
      }

      console.log(`[RetryEmailAPI] Initiating documents received email resend for Application ID: ${applicationId}`);
      const uploadedDocs = Array.isArray(record.documentMetadata)
        ? record.documentMetadata
        : Array.isArray(record.application?.documents)
        ? record.application.documents
        : [];

      const emailRes = await sendDocumentsReceivedEmail({
        applicationId,
        submissionRef: record.submissionRef,
        companyName: record.application?.business?.company_name || 'Your Business',
        applicantName: record.application?.contact?.contact_full_name,
        applicantEmail: record.application?.contact?.email,
        applicantPhone: record.application?.contact?.phone,
        uploadedDocuments: uploadedDocs,
      });

      if (emailRes.success) {
        await updateDocsReceivedEmailStatus(applicationId, {
          docsReceivedEmailStatus: 'sent',
          docsReceivedEmailMessageId: emailRes.messageId,
          docsReceivedEmailSentAt: new Date().toISOString(),
          docsReceivedEmailError: '',
        });
        return res.status(200).json({ success: true, messageId: emailRes.messageId, status: 'sent', type: 'documents_received' });
      } else {
        await updateDocsReceivedEmailStatus(applicationId, {
          docsReceivedEmailStatus: 'failed',
          docsReceivedEmailError: emailRes.error || 'Failed to dispatch documents received alert',
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to send documents received email during retry phase.',
          details: emailRes.error,
        });
      }
    }

    // Default: application_submission email retry
    // 3. Check idempotency for sent emails
    if (record.emailStatus === 'sent' && !force) {
      return res.status(409).json({ 
        error: 'Conflict: Email has already been successfully sent for this application. Use force=true to override.' 
      });
    }

    // 4. Dispatch Email Payload
    console.log(`[RetryEmailAPI] Initiating email resend for Application ID: ${applicationId}`);
    
    // Pass the existing documents payload properly, allowing generated PDFs and metadata to be reused safely.
    const emailRes = await sendApplicationNotificationEmail({
      application: record.application as any,
      applicationRef: record.submissionRef,
      generatedPdfPath: record.documentMetadata?.generatedPdfPath,
      uploadedDocuments: record.application.documents || []
    });

    // 5. Update Status based on Dispatch Result
    if (emailRes.success) {
      await updateEmailStatus(applicationId, {
        emailStatus: 'sent',
        emailMessageId: emailRes.messageId,
        emailSentAt: new Date().toISOString(),
        emailError: '' // clear any previous error
      });
      return res.status(200).json({ success: true, messageId: emailRes.messageId, status: 'sent', type: 'application_submission' });
    } else {
      await updateEmailStatus(applicationId, {
        emailStatus: 'failed',
        emailError: emailRes.error || 'Unknown email transmission error during retry.'
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send email during retry phase.', 
        details: emailRes.error || "Internal API Error" 
      });
    }

  } catch (error: any) {
    console.error('[RetryEmailAPI] Unexpected top-level handler error:', error?.message || error);
    return res.status(500).json({
      error: 'An unexpected internal error occurred during email retry.',
    });
  }
}
