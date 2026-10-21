import { getApplicationById, updateDocumentInApplication, updateDocumentMetadata, logFailedWebhook } from './_lib/applicationRepository.js';
import { getAdminStorage, isFirebaseConfigured } from './_lib/firebaseAdmin.js';

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
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // 1. Authenticate Administrative / Operator Request
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    console.error('[RenewDocumentUrlAPI] ADMIN_API_KEY is not configured in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: administrative endpoint locked.' });
  }

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrative credentials.' });
  }

  try {
    const { applicationId, submissionRef, documentId, documentVersion, replayWebhook } = req.body || {};

    if (!applicationId || !submissionRef || !documentId) {
      return res.status(400).json({
        error: 'Missing required parameters: applicationId, submissionRef, and documentId are required.'
      });
    }

    // 2. Locate Application and Verify Case Association
    const app = await getApplicationById(applicationId);
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (app.submissionRef !== submissionRef) {
      return res.status(403).json({
        error: 'Forbidden: Case association mismatch. submissionRef does not match application record.'
      });
    }

    // 3. Locate Document in Trusted Application Metadata (Never accept client-supplied storagePath)
    let targetDoc: any = null;
    let isApplicationPdf = false;

    if (Array.isArray(app.documentMetadata)) {
      targetDoc = app.documentMetadata.find((d: any) => d.documentId === documentId);
      if (!targetDoc && (documentId === `doc_app_pdf_${applicationId}` || documentId === 'completed_application' || documentId === 'application_pdf')) {
        targetDoc = app.documentMetadata.find((d: any) => d.documentType === 'completed_application');
      }
      if (targetDoc && (targetDoc.documentType === 'completed_application' || targetDoc.documentId === `doc_app_pdf_${applicationId}`)) {
        isApplicationPdf = true;
      }
    } else if (app.documentMetadata && typeof app.documentMetadata === 'object') {
      const meta = app.documentMetadata;
      if (
        documentId === `doc_app_pdf_${applicationId}` ||
        documentId === meta.documentId ||
        documentId === 'completed_application' ||
        documentId === 'application_pdf' ||
        meta.documentType === 'completed_application'
      ) {
        targetDoc = {
          documentId: meta.documentId || `doc_app_pdf_${applicationId}`,
          documentVersion: meta.documentVersion || 'v1',
          documentType: 'completed_application',
          fileName: meta.fileName || `${submissionRef}-application.pdf`,
          fileSize: meta.fileSize,
          contentType: 'application/pdf',
          storagePath: meta.generatedPdfPath || meta.storagePath,
          uploadedAt: meta.generatedAt || app.submittedAt || new Date().toISOString(),
        };
        isApplicationPdf = true;
      }
    }

    if (!targetDoc) {
      return res.status(404).json({
        error: 'Document not found: documentId is not associated with this application.'
      });
    }

    // 4. Verify Document Version (if specified)
    if (documentVersion && targetDoc.documentVersion && targetDoc.documentVersion !== documentVersion) {
      return res.status(409).json({
        error: `Document version mismatch: requested version ${documentVersion} does not match stored version ${targetDoc.documentVersion}.`
      });
    }

    // 5. Generate Fresh Signed URL from Server-Controlled Storage Path
    const storagePath = targetDoc.storagePath;
    let newDownloadUrl: string;
    const expiresInMs = 7 * 24 * 60 * 60 * 1000; // 7 days validity
    const expiresAtDate = new Date(Date.now() + expiresInMs);
    const downloadUrlExpiresAt = expiresAtDate.toISOString();

    let verifiedGeneration = targetDoc.documentVersion || 'v1';
    let verifiedContentType = targetDoc.contentType || 'application/pdf';
    let verifiedSize = targetDoc.fileSize;

    if (isFirebaseConfigured()) {
      const storage = getAdminStorage();
      if (!storage) {
        return res.status(500).json({ error: 'Storage service unavailable.' });
      }

      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: 'Stored file object not found in storage bucket.' });
      }

      try {
        const [meta] = await file.getMetadata();
        if (meta.generation) verifiedGeneration = String(meta.generation);
        if (meta.contentType) verifiedContentType = meta.contentType;
        if (meta.size) verifiedSize = Number(meta.size);
      } catch (metaErr: any) {
        console.warn('[RenewDocumentUrlAPI] Non-fatal metadata read warning:', metaErr?.message);
      }

      // Check version again against live GCS object generation if specified
      if (documentVersion && verifiedGeneration !== 'v1' && verifiedGeneration !== documentVersion) {
        return res.status(409).json({
          error: `GCS object generation mismatch: live object generation ${verifiedGeneration} does not match requested ${documentVersion}.`
        });
      }

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAtDate.getTime(),
        queryParams: {
          generation: verifiedGeneration,
        },
      });
      newDownloadUrl = url;
    } else {
      // Local mock fallback for testing without GCS
      newDownloadUrl = `https://mock-local-storage.example.invalid/${storagePath}?renewed=true&expires=${expiresAtDate.getTime()}&generation=${verifiedGeneration}`;
    }

    // 6. Update Application Record with Renewed URL
    const updatedDocData = {
      ...targetDoc,
      documentVersion: verifiedGeneration,
      fileSize: verifiedSize,
      contentType: verifiedContentType,
      downloadUrl: newDownloadUrl,
      downloadUrlExpiresAt,
      renewedAt: new Date().toISOString(),
    };

    if (Array.isArray(app.documentMetadata)) {
      const updatedDocs = app.documentMetadata.map((d: any) => {
        if (d.documentId === targetDoc.documentId) {
          return {
            ...d,
            downloadUrl: newDownloadUrl,
            downloadUrlExpiresAt,
            documentVersion: verifiedGeneration,
            ...(isApplicationPdf ? { pdfDownloadUrl: newDownloadUrl } : {}),
            renewedAt: new Date().toISOString(),
          };
        }
        return d;
      });
      await updateDocumentMetadata(applicationId, updatedDocs);
    } else if (isApplicationPdf) {
      await updateDocumentMetadata(applicationId, {
        ...app.documentMetadata,
        pdfDownloadUrl: newDownloadUrl,
        downloadUrl: newDownloadUrl,
        downloadUrlExpiresAt,
        documentVersion: verifiedGeneration,
        renewedAt: new Date().toISOString(),
      });
    } else {
      await updateDocumentInApplication(applicationId, targetDoc.documentId, {
        downloadUrl: newDownloadUrl,
        downloadUrlExpiresAt,
        documentVersion: verifiedGeneration,
      });
    }

    // 7. Optional CRM Replay
    let replayed = false;
    const mondayWebhookUrl = process.env.MONDAY_WEBHOOK_URL;
    if (replayWebhook && mondayWebhookUrl) {
      try {
        const currentApp = await getApplicationById(applicationId);
        const resolvedEventId = currentApp?.crmEventId || app.crmEventId || `evt_renew_${applicationId}_${targetDoc.documentId}_${Date.now()}`;
        const allDocs = Array.isArray(currentApp?.documentMetadata)
          ? currentApp!.documentMetadata
          : [updatedDocData];

        const replayPayload = {
          event: isApplicationPdf ? 'new_factoring_enquiry' : 'documents_uploaded',
          eventId: resolvedEventId,
          reference: submissionRef,
          data: {
            eventId: resolvedEventId,
            applicationId,
            submissionRef,
            companyName: app.application?.business?.company_name || 'Business Applicant',
            status: isApplicationPdf ? 'submitted' : 'documents_received',
            uploadedAt: new Date().toISOString(),
            documents: allDocs,
            ...(isApplicationPdf ? { pdfDownloadUrl: newDownloadUrl, downloadUrlExpiresAt } : {})
          }
        };

        const mondayResponse = await fetch(mondayWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replayPayload),
        });
        replayed = mondayResponse.ok;
        if (!mondayResponse.ok) {
          const errMsg = `Monday webhook replay returned status: ${mondayResponse.status}`;
          console.warn('[RenewDocumentUrlAPI]', errMsg);
          await logFailedWebhook(applicationId, replayPayload, errMsg);
        }
      } catch (replayErr: any) {
        const errMsg = replayErr?.message || String(replayErr);
        console.warn('[RenewDocumentUrlAPI] Replay webhook error:', errMsg);
        await logFailedWebhook(applicationId, { applicationId, submissionRef, documentId }, errMsg);
      }
    }

    return res.status(200).json({
      success: true,
      applicationId,
      submissionRef,
      document: updatedDocData,
      replayed,
    });
  } catch (error: any) {
    console.error('[RenewDocumentUrlAPI] Unexpected error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to renew document download URL.' });
  }
}
