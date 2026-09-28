import { getAdminStorage, isFirebaseConfigured } from './lib/firebaseAdmin.js';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.csv'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
];

const ALLOWED_DOCUMENT_TYPES = [
  'aged_debtor_report',
  'aged_creditor_report',
  'bank_statement',
  'construction_sample',
  'other_supporting_document',
  'completed_application'
];

/**
 * Sanitizes an application ID to prevent directory traversal and injection.
 */
function sanitizeApplicationId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Sanitizes a file name, removing path segments and unsafe characters while preserving the extension.
 */
function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\/\\]/).pop() || 'document';
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean;
}

export default async function handler(req: any, res: any) {
  // CORS configuration
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
    const { applicationId, fileName, fileType, fileSize, documentType } = req.body || {};

    if (!applicationId || !fileName || !fileType || !documentType) {
      res.status(400).json({
        error: 'Missing required parameters: applicationId, fileName, fileType, and documentType are required.',
      });
      return;
    }

    const cleanAppId = sanitizeApplicationId(applicationId);
    if (!cleanAppId) {
      res.status(400).json({ error: 'Invalid applicationId format.' });
      return;
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      res.status(400).json({ error: 'Invalid document type requested.' });
      return;
    }

    const cleanFileName = sanitizeFileName(fileName);
    const ext = '.' + cleanFileName.split('.').pop()?.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(fileType.toLowerCase())) {
      res.status(400).json({
        error: `Unsupported file type. Only PDF, JPG, JPEG, PNG, and CSV files are permitted.`,
      });
      return;
    }

    if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE_BYTES) {
      res.status(400).json({
        error: `File size exceeds the 20 MB limit.`,
      });
      return;
    }

    // Target private storage path for FFform namespace (distinct from BizLoans4U)
    // We add a timestamp to the file name to allow multiple uploads of the same type without overwriting
    const timestamp = Date.now();
    const storagePath = `applications/ff/${cleanAppId}/documents/${documentType}/${timestamp}_${cleanFileName}`;
    const expiresInSeconds = 15 * 60; // 15 minutes

    const storage = getAdminStorage();

    if (storage && isFirebaseConfigured()) {
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInSeconds * 1000,
        contentType: fileType,
        extensionHeaders: {
          // Strictly enforce content length limit on the cloud storage side
          'x-goog-content-length-range': `0,${MAX_FILE_SIZE_BYTES}`
        }
      });

      res.status(200).json({
        success: true,
        uploadUrl,
        storagePath,
        expiresInSeconds,
      });
      return;
    }

    // Mock fallback for local development
    // Using a domain that will unequivocally fail if accidentally queried by a production client
    const mockUploadUrl = `https://mock-local-storage.example.invalid/${storagePath}?mock=true_do_not_use_in_prod`;
    res.status(200).json({
      success: true,
      uploadUrl: mockUploadUrl,
      storagePath,
      expiresInSeconds,
      isMock: true,
      warning: 'WARNING: Firebase Storage is not configured. This is a local mock URL.'
    });
  } catch (error: any) {
    console.error('Error generating direct upload URL:', error?.message || error);
    res.status(500).json({
      error: 'An error occurred while generating the document upload session.',
    });
  }
}
