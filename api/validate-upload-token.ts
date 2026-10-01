import { validateUploadToken, getApplicationById } from './_lib/applicationRepository.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
    return;
  }

  try {
    const token = req.method === 'GET' ? req.query?.token : req.body?.token;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        valid: false,
        status: 'INVALID',
        error: 'Upload token is required.'
      });
      return;
    }

    const validation = await validateUploadToken(token);

    if (!validation.valid) {
      const status = validation.record?.status || (validation.error?.toLowerCase().includes('expired') ? 'EXPIRED' : validation.error?.toLowerCase().includes('revoked') ? 'REVOKED' : 'INVALID');
      res.status(200).json({
        valid: false,
        status,
        error: validation.error || 'Upload link is invalid or expired.'
      });
      return;
    }

    const record = validation.record!;
    const app = await getApplicationById(record.applicationId);

    // Filter and sanitize existing document metadata (never expose internal paths or server-only credentials)
    const existingDocsRaw = Array.isArray(app?.documentMetadata)
      ? app.documentMetadata
      : Array.isArray(record.metadata?.uploadedDocuments)
      ? record.metadata.uploadedDocuments
      : [];

    const existingDocuments = existingDocsRaw.map((doc: any) => ({
      documentType: doc.documentType || 'other_supporting_document',
      fileName: doc.fileName || 'Document',
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt || new Date().toISOString()
    }));

    const businessName = app?.application?.business?.company_name || app?.application?.contact?.contact_full_name || 'Your Business';
    const submissionRef = record.submissionRef || app?.submissionRef || 'FF-Application';

    const defaultDocTypes = ['aged_debtor_report', 'aged_creditor_report', 'bank_statement'];
    if (app?.application?.business?.industry === 'construction') {
      defaultDocTypes.push('construction_sample');
    }
    const requestedDocumentTypes = record.requestedDocumentTypes && record.requestedDocumentTypes.length > 0
      ? record.requestedDocumentTypes
      : defaultDocTypes;

    res.status(200).json({
      valid: true,
      status: 'ACTIVE',
      applicationId: record.applicationId,
      submissionRef,
      companyName: businessName,
      requestedDocumentTypes,
      expiresAt: record.expiresAt,
      existingDocuments
    });
  } catch (error: any) {
    console.error('[ValidateTokenAPI] Error validating token:', error?.message || error);
    res.status(500).json({
      valid: false,
      status: 'ERROR',
      error: 'An internal error occurred while validating the upload link.'
    });
  }
}
