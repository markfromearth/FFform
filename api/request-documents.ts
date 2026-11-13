import { getApplicationById, getApplicationBySubmissionRef, createDocumentRequestToken, validateUploadToken, updateApplicationDocumentRequest } from './_lib/applicationRepository.js';
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
    const {
      applicationId: rawApplicationId,
      submissionRef: rawSubmissionRef,
      requestedDocumentTypes,
      expiresInDays = 7,
      force = false,
      sendEmail = true,
    } = req.body || {};

    const reqAppId = typeof rawApplicationId === 'string' && rawApplicationId.trim() ? rawApplicationId.trim() : undefined;
    const reqSubRef = typeof rawSubmissionRef === 'string' && rawSubmissionRef.trim() ? rawSubmissionRef.trim() : undefined;

    if (!reqAppId && !reqSubRef) {
      res.status(400).json({ error: 'applicationId is required (or provide submissionRef).' });
      return;
    }

    // 2. Identify the application in Firestore (by applicationId or submissionRef)
    let applicationRecord = null;
    if (reqAppId) {
      applicationRecord = await getApplicationById(reqAppId);
      if (!applicationRecord) {
        res.status(404).json({ error: 'Application not found.' });
        return;
      }
      if (reqSubRef && applicationRecord.submissionRef !== reqSubRef) {
        res.status(403).json({
          error: 'Forbidden: Case association mismatch. submissionRef does not match application record.',
        });
        return;
      }
    } else if (reqSubRef) {
      applicationRecord = await getApplicationBySubmissionRef(reqSubRef);
      if (!applicationRecord) {
        res.status(404).json({ error: 'Application not found.' });
        return;
      }
    }

    if (!applicationRecord) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }

    const applicationId = applicationRecord.applicationId;
    const effectiveLeadRef = applicationRecord.leadReference;
    const originUrl = req.headers.origin || 'https://factoringfinance.co.uk';

    // 2.5 Idempotency: Prevent duplicate emails from rapid double-clicks
    const existingReq = applicationRecord.documentRequest;
    if (existingReq?.activeToken && existingReq.status === 'REQUESTED' && !force) {
      const tokenVal = await validateUploadToken(existingReq.activeToken);
      if (tokenVal.valid) {
        const requestedAtMs = existingReq.requestedAt ? new Date(existingReq.requestedAt).getTime() : 0;
        const isRecent = Date.now() - requestedAtMs < 60 * 1000; // 60-second cooldown
        if (isRecent) {
          const reuseLeadParam = effectiveLeadRef
            ? `&leadReference=${encodeURIComponent(effectiveLeadRef)}`
            : '';
          return res.status(200).json({
            success: true,
            isDuplicate: true,
            message: 'Recent active document request reused (idempotent request)',
            applicationId,
            submissionRef: applicationRecord.submissionRef,
            ...(effectiveLeadRef ? { leadReference: effectiveLeadRef } : {}),
            token: existingReq.activeToken,
            uploadUrl: `${originUrl}/?token=${existingReq.activeToken}${reuseLeadParam}`,
            purpose: tokenVal.record?.purpose || 'DOCUMENT_UPLOAD',
            status: tokenVal.record?.status || 'ACTIVE',
            expiresAt: existingReq.expiresAt || tokenVal.record?.expiresAt,
            requestedDocumentTypes: existingReq.requestedDocumentTypes || tokenVal.record?.requestedDocumentTypes,
            emailStatus: (existingReq as any).emailStatus || (sendEmail === false ? 'suppressed' : 'sent'),
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
      metadata: {
        ...(effectiveLeadRef ? { leadReference: effectiveLeadRef } : {}),
      },
    });

    // 4. Dispatch the Document Request Email via Resend (unless suppressed via sendEmail: false)
    const applicantName = applicationRecord.application?.contact?.contact_full_name || 'Applicant';
    const applicantEmail = applicationRecord.application?.contact?.email || '';
    const companyName = applicationRecord.application?.business?.company_name || 'Your Business';

    let emailStatus = 'pending';
    let emailMessageId: string | undefined;
    let emailError: string | undefined;

    if (sendEmail === false) {
      emailStatus = 'suppressed';
    } else {
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
      ...(emailMessageId ? { emailMessageId } : {}),
      ...(emailError ? { emailError } : {}),
    });

    // 6. Return response
    res.status(200).json({
      success: true,
      applicationId,
      submissionRef: applicationRecord.submissionRef,
      ...(effectiveLeadRef ? { leadReference: effectiveLeadRef } : {}),
      token,
      uploadUrl,
      purpose: record.purpose,
      status: record.status,
      expiresAt: record.expiresAt,
      requestedDocumentTypes: record.requestedDocumentTypes,
      emailStatus,
      ...(emailMessageId ? { emailMessageId } : {}),
    });
  } catch (error: any) {
    console.error('[RequestDocumentsAPI] Unexpected error:', error?.message || error);
    res.status(500).json({
      error: 'Failed to generate and send document request.',
    });
  }
}
