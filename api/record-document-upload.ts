import { validateUploadToken, addDocumentToApplication, getApplicationById, resolveUploadRecord } from './_lib/applicationRepository.js';
import { getAdminStorage, isFirebaseConfigured } from './_lib/firebaseAdmin.js';
import crypto from 'crypto';

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

    if (!token || !document || !document.fileName || !document.documentType) {
      res.status(400).json({
        error: 'Missing required parameters: token and document details (fileName, documentType) are required.'
      });
      return;
    }

    const tokenValidation = await validateUploadToken(token);
    if (!tokenValidation.valid || !tokenValidation.applicationId) {
      res.status(403).json({ error: tokenValidation.error || 'Invalid or expired upload token.' });
      return;
    }

    // Resolve server-stored upload record created by get-upload-url
    const uploadRecord = await resolveUploadRecord(
      tokenValidation.applicationId,
      document.storagePath,
      document.fileName,
      document.documentType
    );

    let storagePath: string;
    let documentId: string;

    if (uploadRecord) {
      // Both endpoints resolve the exact same server-stored upload record
      storagePath = uploadRecord.storagePath;
      documentId = uploadRecord.documentId;
    } else {
      // Validate client-supplied storagePath against application namespace to prevent spoofing
      const clientPath = typeof document.storagePath === 'string' ? document.storagePath : '';
      const expectedPrefix = `applications/ff/${tokenValidation.applicationId}/`;

      if (clientPath && clientPath.startsWith(expectedPrefix) && !clientPath.includes('..')) {
        storagePath = clientPath;
      } else {
        // Ignore spoofed or invalid client path and enforce server-side deterministic path
        storagePath = `applications/ff/${tokenValidation.applicationId}/documents/${document.documentType}/${document.fileName}`;
      }

      // Assign permanent server-side documentId (preserving existing documentId if this file is being re-uploaded)
      const app = await getApplicationById(tokenValidation.applicationId);
      if (app && Array.isArray(app.documentMetadata)) {
        const existing = app.documentMetadata.find((d: any) => d.storagePath === storagePath);
        if (existing?.documentId) {
          documentId = existing.documentId;
        } else {
          documentId = `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        }
      } else {
        documentId = `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      }
    }

    const sanitizedDoc = {
      documentType: String(document.documentType),
      fileName: String(document.fileName),
      fileSize: typeof document.fileSize === 'number' ? document.fileSize : undefined,
      storagePath,
      uploadedAt: document.uploadedAt || new Date().toISOString()
    };

    // If file payload was sent directly (e.g. CORS fallback), persist directly to Cloud Storage
    if (document.base64Data && isFirebaseConfigured()) {
      try {
        const storage = getAdminStorage();
        if (storage) {
          const bucket = storage.bucket();
          const file = bucket.file(sanitizedDoc.storagePath);
          const buffer = Buffer.from(document.base64Data, 'base64');
          await file.save(buffer, {
            metadata: { contentType: document.fileType || 'application/pdf' },
            resumable: false,
          });
        }
      } catch (storageErr: any) {
        console.error('[RecordDocumentUploadAPI] Direct storage fallback save error:', storageErr?.message || storageErr);
      }
    }

    // Verify stored object existence and generation metadata via GCS SDK
    let documentVersion = 'v1';
    let contentType = document.fileType || 'application/pdf';
    let verifiedSize = typeof document.fileSize === 'number' ? document.fileSize : undefined;
    let downloadUrl: string | undefined;
    let downloadUrlExpiresAt: string | undefined;

    if (isFirebaseConfigured()) {
      const storage = getAdminStorage();
      if (!storage) {
        res.status(500).json({ error: 'Storage service unavailable.' });
        return;
      }

      const bucket = storage.bucket();
      const file = bucket.file(sanitizedDoc.storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: 'Stored file object not found in storage bucket.' });
        return;
      }

      try {
        const [meta] = await file.getMetadata();
        if (meta.generation) documentVersion = String(meta.generation);
        if (meta.contentType) contentType = meta.contentType;
        if (meta.size) verifiedSize = Number(meta.size);
      } catch (metaErr: any) {
        documentVersion = `gen_${Date.now()}`;
      }

      const expiresInMs = 7 * 24 * 60 * 60 * 1000; // 7 days validity
      const expiresAtDate = new Date(Date.now() + expiresInMs);
      downloadUrlExpiresAt = expiresAtDate.toISOString();

      try {
        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: expiresAtDate.getTime(),
          queryParams: {
            generation: documentVersion,
          },
        });
        downloadUrl = url;
      } catch (signErr: any) {
        console.warn('[RecordDocumentUploadAPI] Non-fatal: Could not generate signed download URL:', signErr?.message || signErr);
      }
    }

    const docToPersist = {
      documentId,
      documentVersion,
      documentType: sanitizedDoc.documentType,
      fileName: sanitizedDoc.fileName,
      fileSize: verifiedSize,
      contentType,
      storagePath: sanitizedDoc.storagePath,
      downloadUrl,
      downloadUrlExpiresAt,
      uploadedAt: sanitizedDoc.uploadedAt,
    };

    const updatedDocuments = await addDocumentToApplication(tokenValidation.applicationId, docToPersist);

    res.status(200).json({
      success: true,
      count: updatedDocuments.length,
      document: docToPersist
    });
  } catch (error: any) {
    console.error('[RecordDocumentUploadAPI] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to record document metadata.' });
  }
}
