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
  const base = fileName.split(/[/\\]/).pop() || 'document';
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
    const { applicationId, fileName, fileType, fileSize, uploadType } = req.body || {};

    if (!applicationId || !fileName || !fileType) {
      res.status(400).json({
        error: 'Missing required parameters: applicationId, fileName, and fileType are required.',
      });
      return;
    }

    const cleanAppId = sanitizeApplicationId(applicationId);
    if (!cleanAppId) {
      res.status(400).json({ error: 'Invalid applicationId format.' });
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

    const isManagementAccounts = uploadType === 'management_accounts';
    const limitBytes = isManagementAccounts ? 5 * 1024 * 1024 : MAX_FILE_SIZE_BYTES;

    if (typeof fileSize === 'number' && fileSize > limitBytes) {
      res.status(400).json({
        error: `File size exceeds the ${isManagementAccounts ? '5 MB' : '20 MB'} limit.`,
      });
      return;
    }

    // Target private storage path
    const folder = isManagementAccounts ? 'management-accounts' : 'bank-statements';
    const storagePath = `applications/${cleanAppId}/${folder}/${cleanFileName}`;
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
      });

      res.status(200).json({
        success: true,
        uploadUrl,
        storagePath,
        expiresInSeconds,
      });
      return;
    }

    // Graceful development / mock fallback when Firebase credentials are not yet provisioned
    const mockUploadUrl = `https://storage.googleapis.com/mock-bucket/${storagePath}?mock=true`;
    res.status(200).json({
      success: true,
      uploadUrl: mockUploadUrl,
      storagePath,
      expiresInSeconds,
      isMock: true,
    });
  } catch (error: any) {
    console.error('Error generating direct upload URL:', error?.message || error);
    res.status(500).json({
      error: 'An error occurred while generating the document upload session.',
    });
  }
}
