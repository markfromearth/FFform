import { validateUploadToken, addDocumentToApplication } from './_lib/applicationRepository.js';

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
    const { token, document } = req.body || {};

    if (!token || !document || !document.fileName || !document.documentType || !document.storagePath) {
      res.status(400).json({
        error: 'Missing required parameters: token and document details (fileName, documentType, storagePath) are required.'
      });
      return;
    }

    const tokenValidation = await validateUploadToken(token);
    if (!tokenValidation.valid || !tokenValidation.applicationId) {
      res.status(403).json({ error: tokenValidation.error || 'Invalid or expired upload token.' });
      return;
    }

    const sanitizedDoc = {
      documentType: String(document.documentType),
      fileName: String(document.fileName),
      fileSize: typeof document.fileSize === 'number' ? document.fileSize : undefined,
      storagePath: String(document.storagePath),
      uploadedAt: document.uploadedAt || new Date().toISOString()
    };

    const updatedDocuments = await addDocumentToApplication(tokenValidation.applicationId, sanitizedDoc);

    res.status(200).json({
      success: true,
      count: updatedDocuments.length,
      document: {
        documentType: sanitizedDoc.documentType,
        fileName: sanitizedDoc.fileName,
        fileSize: sanitizedDoc.fileSize,
        uploadedAt: sanitizedDoc.uploadedAt
      }
    });
  } catch (error: any) {
    console.error('[RecordDocumentUploadAPI] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to record document metadata.' });
  }
}
