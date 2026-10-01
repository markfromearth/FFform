import { validateUploadToken, getApplicationById, completeUploadToken, updateApplicationUploadStatus, updateDocsReceivedEmailStatus } from './_lib/applicationRepository.js';
import { sendDocumentsReceivedEmail } from './_lib/emailService.js';

export default async function handler(req: any, res: any) {
  // CORS configuration
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

  try {
    const { token } = req.body || {};

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Upload token is required.' });
      return;
    }

    const tokenValidation = await validateUploadToken(token);
    if (!tokenValidation.valid || !tokenValidation.applicationId) {
      res.status(403).json({ error: tokenValidation.error || 'Invalid or expired upload token.' });
      return;
    }

    const applicationId = tokenValidation.applicationId;
    const app = await getApplicationById(applicationId);

    const submissionRef = tokenValidation.record?.submissionRef || app?.submissionRef || 'FF-Application';
    const companyName = app?.application?.business?.company_name || 'Your Business';
    const applicantName = app?.application?.contact?.contact_full_name || 'Applicant';
    const applicantEmail = app?.application?.contact?.email || 'enquiries@factoringfinance.co.uk';

    const uploadedDocuments = Array.isArray(app?.documentMetadata)
      ? app.documentMetadata
      : Array.isArray(tokenValidation.record?.metadata?.uploadedDocuments)
      ? tokenValidation.record.metadata.uploadedDocuments
      : [];

    // Mark upload status in Firestore via DAL
    await updateApplicationUploadStatus(applicationId, 'uploaded');

    // Mark token as completed
    await completeUploadToken(token);

    // Send underwriter notification email (zero failure impact if email service has downstream issues)
    let emailStatus = 'skipped_no_docs';
    let emailMessageId: string | undefined;
    let emailError: string | undefined;

    if (uploadedDocuments.length > 0) {
      const emailResult = await sendDocumentsReceivedEmail({
        applicationId,
        submissionRef,
        companyName,
        applicantName,
        applicantEmail,
        applicantPhone: app?.application?.contact?.phone,
        uploadedDocuments
      });

      if (emailResult.success) {
        emailStatus = 'sent';
        emailMessageId = emailResult.messageId;
        await updateDocsReceivedEmailStatus(applicationId, {
          docsReceivedEmailStatus: 'sent',
          docsReceivedEmailMessageId: emailResult.messageId,
          docsReceivedEmailSentAt: new Date().toISOString(),
          docsReceivedEmailError: '',
        });
      } else {
        emailStatus = 'failed';
        emailError = emailResult.error || 'Failed to dispatch documents received alert';
        await updateDocsReceivedEmailStatus(applicationId, {
          docsReceivedEmailStatus: 'failed',
          docsReceivedEmailError: emailError,
        });
        console.warn(`[CompleteUploadAPI] Documents received alert email failed for ${submissionRef}. Recorded for retry:`, emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Uploads successfully recorded and underwriter team notified.',
      documentsCount: uploadedDocuments.length,
      emailStatus,
      emailMessageId,
      emailError,
    });
  } catch (error: any) {
    console.error('[CompleteUploadAPI] Error completing uploads:', error?.message || error);
    res.status(500).json({ error: 'Failed to complete document upload session.' });
  }
}
