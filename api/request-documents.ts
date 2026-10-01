import { getApplicationById, createDocumentRequestToken, validateUploadToken, updateApplicationDocumentRequest } from './_lib/applicationRepository.js';
import { sendDocumentRequestEmail } from './_lib/emailService.js';

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

  // 1. Authorization Verification
  const authHeader = req.headers.authorization;
  const adminKey = process.env.ADMIN_API_KEY;

  if (adminKey) {
    if (!authHeader || authHeader !== `Bearer ${adminKey}`) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid administrative credentials.' });
      return;
    }
  }

  try {
    const { applicationId, requestedDocumentTypes, expiresInDays = 7, force = false } = req.body || {};

    if (!applicationId || typeof applicationId !== 'string') {
      res.status(400).json({ error: 'applicationId is required.' });
      return;
    }

    // 2. Identify the application in Firestore
    const applicationRecord = await getApplicationById(applicationId);
    if (!applicationRecord) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }

    const originUrl = req.headers.origin || 'https://factoringfinance.co.uk';

    // 2.5 Idempotency: Prevent duplicate emails from rapid double-clicks
    const existingReq = applicationRecord.documentRequest;
    if (existingReq?.activeToken && existingReq.status === 'REQUESTED' && !force) {
      const tokenVal = await validateUploadToken(existingReq.activeToken);
      if (tokenVal.valid) {
        const requestedAtMs = existingReq.requestedAt ? new Date(existingReq.requestedAt).getTime() : 0;
        const isRecent = Date.now() - requestedAtMs < 60 * 1000; // 60-second cooldown
        if (isRecent) {
          return res.status(200).json({
            success: true,
            isDuplicate: true,
            message: 'Recent active document request reused (idempotent request)',
            applicationId,
            submissionRef: applicationRecord.submissionRef,
            token: existingReq.activeToken,
            uploadUrl: `${originUrl}/?token=${existingReq.activeToken}`,
            purpose: tokenVal.record?.purpose || 'DOCUMENT_UPLOAD',
            status: tokenVal.record?.status || 'ACTIVE',
            expiresAt: existingReq.expiresAt || tokenVal.record?.expiresAt,
            requestedDocumentTypes: existingReq.requestedDocumentTypes || tokenVal.record?.requestedDocumentTypes,
            emailStatus: (existingReq as any).emailStatus || 'sent',
          });
        }
      }
    }
    const expiresInMs = Number(expiresInDays) * 24 * 60 * 60 * 1000;

    const { token, record, uploadUrl } = await createDocumentRequestToken({
      applicationId,
      submissionRef: applicationRecord.submissionRef,
      requestedDocumentTypes: requestedDocumentTypes || [
        'aged_debtor_report',
        'aged_creditor_report',
        'bank_statement',
      ],
      expiresInMs,
      baseUrl: originUrl,
    });

    // 4. Dispatch the Document Request Email via Resend
    const applicantName = applicationRecord.application?.contact?.contact_full_name || 'Applicant';
    const applicantEmail = applicationRecord.application?.contact?.email || '';
    const companyName = applicationRecord.application?.business?.company_name || 'Your Business';

    let emailStatus = 'pending';
    let emailMessageId: string | undefined;
    let emailError: string | undefined;

    try {
      const emailResult = await sendDocumentRequestEmail({
        applicationId,
        submissionRef: applicationRecord.submissionRef,
        companyName,
        applicantName,
        applicantEmail,
        uploadUrl,
        requestedDocumentTypes: record.requestedDocumentTypes,
      });

      if (emailResult.success) {
        emailStatus = 'sent';
        emailMessageId = emailResult.messageId;
      } else {
        emailStatus = 'failed';
        emailError = emailResult.error;
      }
    } catch (err: any) {
      console.warn('[RequestDocumentsAPI] Email dispatch caught (non-fatal):', err.message);
      emailStatus = 'failed';
      emailError = err.message;
    }

    // 5. Record that the request was sent in Firestore via DAL
    const now = new Date().toISOString();
    await updateApplicationDocumentRequest(applicationId, {
      status: 'REQUESTED',
      requestedAt: now,
      activeToken: token,
      requestedDocumentTypes: record.requestedDocumentTypes,
      expiresAt: record.expiresAt,
      emailStatus,
      emailMessageId,
      emailError,
    });

    // 6. Return response
    res.status(200).json({
      success: true,
      applicationId,
      submissionRef: applicationRecord.submissionRef,
      token,
      uploadUrl,
      purpose: record.purpose,
      status: record.status,
      expiresAt: record.expiresAt,
      requestedDocumentTypes: record.requestedDocumentTypes,
      emailStatus,
      emailMessageId,
    });
  } catch (error: any) {
    console.error('[RequestDocumentsAPI] Unexpected error:', error?.message || error);
    res.status(500).json({
      error: 'Failed to generate and send document request.',
    });
  }
}
