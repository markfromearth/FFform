import { validateUploadToken, getApplicationById, completeUploadToken, updateApplicationUploadStatus, logFailedWebhook, updateUploadTokenMetadata } from './_lib/applicationRepository.js';
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
    const { token } = req.body || {};

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Upload token is required.' });
      return;
    }

    let tokenValidation = await validateUploadToken(token);
    if (!tokenValidation.valid && tokenValidation.record?.status === 'COMPLETED') {
      tokenValidation = {
        valid: true,
        record: tokenValidation.record,
        applicationId: tokenValidation.record.applicationId,
      };
    } else if (!tokenValidation.valid || !tokenValidation.applicationId) {
      res.status(403).json({ error: tokenValidation.error || 'Invalid or expired upload token.' });
      return;
    }

    const applicationId = tokenValidation.applicationId;

    // Mark upload status in Firestore via DAL
    await updateApplicationUploadStatus(applicationId, 'uploaded');

    // Mark token as completed
    await completeUploadToken(token);

    // Retrieve application details and documents for CRM webhook update event
    try {
      const app = await getApplicationById(applicationId);
      const submissionRef = app?.submissionRef || tokenValidation.record?.submissionRef || applicationId;
      const businessName = app?.application?.business?.company_name || 'Business Applicant';
      const contactName = app?.application?.contact?.contact_full_name || 'Applicant';
      const contactEmail = app?.application?.contact?.email || '';

      const rawDocs = Array.isArray(app?.documentMetadata)
        ? app!.documentMetadata
        : Array.isArray(tokenValidation.record?.metadata?.uploadedDocuments)
        ? tokenValidation.record!.metadata!.uploadedDocuments
        : [];

      let bucket: any = null;
      if (isFirebaseConfigured()) {
        const storage = getAdminStorage();
        if (storage) {
          bucket = storage.bucket();
        }
      }

      const documentsWithUrls = await Promise.all(
        rawDocs.map(async (doc: any) => {
          const documentId = doc.documentId || `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
          let documentVersion = doc.documentVersion || 'v1';
          let contentType = doc.contentType || 'application/pdf';
          let fileSize = doc.fileSize;
          let downloadUrl = doc.downloadUrl;
          let downloadUrlExpiresAt = doc.downloadUrlExpiresAt;

          if (bucket && doc.storagePath) {
            try {
              const file = bucket.file(doc.storagePath);
              if (!doc.documentVersion || doc.documentVersion === 'v1') {
                try {
                  const [meta] = await file.getMetadata();
                  if (meta.generation) documentVersion = String(meta.generation);
                  if (meta.contentType) contentType = meta.contentType;
                  if (meta.size) fileSize = Number(meta.size);
                } catch (metaErr: any) {
                  // Fallback
                }
              }

              if (!downloadUrl) {
                const expiresInMs = 7 * 24 * 60 * 60 * 1000;
                const expiresAtDate = new Date(Date.now() + expiresInMs);
                downloadUrlExpiresAt = expiresAtDate.toISOString();

                const [url] = await file.getSignedUrl({
                  version: 'v4',
                  action: 'read',
                  expires: expiresAtDate.getTime(),
                  queryParams: {
                    generation: documentVersion,
                  },
                });
                downloadUrl = url;
              }
            } catch (signErr: any) {
              console.warn('[CompleteUploadAPI] Failed to generate signed download URL for doc:', doc.fileName, signErr?.message);
            }
          }

          if (!downloadUrlExpiresAt && downloadUrl) {
            downloadUrlExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          }

          return {
            documentId,
            documentVersion,
            documentType: doc.documentType || 'other_supporting_document',
            fileName: doc.fileName,
            fileSize,
            contentType,
            storagePath: doc.storagePath,
            downloadUrl: downloadUrl || null,
            downloadUrlExpiresAt: downloadUrlExpiresAt || null,
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          };
        })
      );

      const mondayWebhookUrl = process.env.MONDAY_WEBHOOK_URL;
      if (mondayWebhookUrl && documentsWithUrls.length > 0) {
        // Each new upload batch gets its own persistent event ID; retries retain that batch's ID
        let batchEventId = tokenValidation.record?.metadata?.uploadBatchEventId || (app as any)?.lastUploadBatchEventId;
        if (!batchEventId) {
          batchEventId = `evt_docs_${applicationId}_${Date.now()}`;
          await updateUploadTokenMetadata(token, { uploadBatchEventId: batchEventId });
          await updateApplicationUploadStatus(applicationId, 'uploaded', batchEventId);
        }

        const updatePayload = {
          event: 'documents_uploaded',
          eventId: batchEventId,
          reference: submissionRef,
          data: {
            eventId: batchEventId,
            applicationId,
            submissionRef,
            companyName: businessName,
            applicantName: contactName,
            applicantEmail: contactEmail,
            status: 'documents_received',
            uploadedAt: new Date().toISOString(),
            documents: documentsWithUrls,
          },
        };

        try {
          const mondayResponse = await fetch(mondayWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });

          if (!mondayResponse.ok) {
            const errMsg = `Monday webhook returned status: ${mondayResponse.status}`;
            console.error('[CompleteUploadAPI]', errMsg);
            await logFailedWebhook(applicationId, updatePayload, errMsg);
          } else {
            console.log('[CompleteUploadAPI] Successfully notified CRM of uploaded documents for ref:', submissionRef);
          }
        } catch (fetchErr: any) {
          const errMsg = fetchErr?.message || String(fetchErr);
          console.error('[CompleteUploadAPI] Monday webhook network error:', errMsg);
          await logFailedWebhook(applicationId, updatePayload, errMsg);
        }
      }
    } catch (crmErr: any) {
      console.warn('[CompleteUploadAPI] Non-fatal CRM document update notification error:', crmErr?.message || crmErr);
    }

    res.status(200).json({
      success: true,
      message: 'Uploads successfully recorded.',
    });
  } catch (error: any) {
    console.error('[CompleteUploadAPI] Error completing uploads:', error?.message || error);
    res.status(500).json({ error: 'Failed to complete document upload session.' });
  }
}
