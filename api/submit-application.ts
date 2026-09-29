import { z } from 'zod';
import { fullApplicationSchema } from '../src/schemas/applicationSchemas.js';
import { sendApplicationNotificationEmail, sendPartialLeadAcknowledgementEmail } from './_lib/emailService.js';

import { saveOrUpdateApplication, updateCrmStatus, updateEmailStatus, updateDocumentMetadata, createUploadToken } from './_lib/applicationRepository.js';
import { generateApplicationPdf } from './_lib/pdfGenerator.js';
import { getAdminStorage } from './_lib/firebaseAdmin.js';


/**
 * Normalizes email for deduplication
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalizes phone number to E.164 format (simplified for UK + international)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Generates a standard canonical submission reference if one was not supplied.
 */
function generateFallbackReference(appId: string): string {
  const year = new Date().getFullYear();
  const cleanTail = appId.slice(-5).toUpperCase();
  return `FF-${year}-${cleanTail}`;
}

// Server-side specific validation extending the shared client schemas
const serverValidationSchema = z.object({
  application: fullApplicationSchema.extend({
    contact: fullApplicationSchema.shape.contact.extend({
      // Strict E.164 validation for server-side
      phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Phone number must be a valid E.164 format'),
    }),
    business: fullApplicationSchema.shape.business.extend({
      // Strict currency validation (ensure they are positive integers/numbers)
      annual_turnover: z.number().int().min(0, 'Turnover must be a positive number'),
      gross_debtor_book: z.number().int().min(0, 'Debtor book must be a positive number'),
    }),
    invoices: fullApplicationSchema.shape.invoices.extend({
      requested_facility: z.number().int().min(0, 'Requested facility must be a positive number'),
    })
  }),
  id: z.string().min(5),
  submittedAt: z.string().optional()
});

export default async function handler(req: any, res: any) {
  // CORS Headers
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
    const payload = req.body || {};

    if (!payload.application || !payload.id) {
      res.status(400).json({
        error: 'Invalid submission payload: application object and id are required.',
      });
      return;
    }

    // If this is a partial save, skip full schema validation
    const isPartial = payload.status === 'contact_captured';
    
    let validationResult;
    if (!isPartial) {
      // 1. Strict Server-Side Zod Validation for full submission
      validationResult = serverValidationSchema.safeParse(payload);

      if (!validationResult.success) {
        res.status(400).json({
          error: 'Server-side validation failed.',
          details: validationResult.error.format(),
        });
        return;
      }
    }

    let application, id;
    if (isPartial) {
      application = payload.application;
      id = payload.id;
    } else {
      application = validationResult!.data.application;
      id = validationResult!.data.id;
    }
    
    // Normalize data for deduplication
    const normEmail = normalizeEmail(application.contact.email);
    const normPhone = normalizePhone(application.contact.phone);
    const companyNum = application.business.company_number || 'UNKNOWN';
    
    // Create a stable deduplication key
    const dedupKey = `${normEmail}_${normPhone}_${companyNum}`;
    
    const submissionRef = generateFallbackReference(id);
    const submittedAt = payload.submittedAt || new Date().toISOString();
    const appStatus = isPartial ? 'draft' : 'submitted';

    // 2. Persist to Firestore and Idempotency Check
    let dbRecord;
    try {
      const result = await saveOrUpdateApplication(id, submissionRef, appStatus, application);
      dbRecord = result.record;

      if (result.isDuplicate) {
        // Idempotent immediate 200 OK return (preventing duplicate CRM entry and emails)
        const uploadToken = await createUploadToken(dbRecord.applicationId, 2 * 60 * 60 * 1000);
        res.status(200).json({
          success: true,
          message: 'Application already submitted (idempotent duplicate request)',
          applicationId: dbRecord.applicationId,
          submissionRef: dbRecord.submissionRef,
          submittedAt: dbRecord.submittedAt,
          crmStatus: dbRecord.crmStatus || 'delivered',
          uploadToken,
        });
        return;
      }
    } catch (dbError: any) {
      console.error('[SubmitAPI] Failed to persist application to Firestore:', dbError.message);
      // We could throw here, but we will allow the workflow to try and complete if CRM still needs to be hit
      // Usually you throw if persistence is strictly required. We'll throw to be safe for production.
      res.status(500).json({ error: 'Failed to persist application data' });
      return;
    }

const docToSave: any = {
      ...application,
      id,
      submissionRef,
      submittedAt,
      status: appStatus,
      crmStatus: 'pending',
    };

    // 2.5 PDF Generation and Storage (Full submissions only)
    if (!isPartial) {
      try {
        console.log('[SubmitAPI] Generating completed application PDF...');
        const pdfBytes = await generateApplicationPdf(id, submissionRef, submittedAt, application);
        
        const storage = getAdminStorage();
        if (storage) {
          const bucket = storage.bucket();
          const pdfPath = `applications/ff/${id}/generated/${submissionRef}-application.pdf`;
          const file = bucket.file(pdfPath);
          
          await file.save(pdfBytes, {
            metadata: { contentType: 'application/pdf' },
            resumable: false // optimization for small files in serverless
          });
          
          console.log('[SubmitAPI] Saved PDF to', pdfPath);
          
          await updateDocumentMetadata(id, {
            generatedPdfPath: pdfPath,
            generatedAt: new Date().toISOString()
          });
          
          docToSave.documentMetadata = { generatedPdfPath: pdfPath };
        }
      } catch (pdfError: any) {
        console.error('[SubmitAPI] Failed to generate or upload PDF:', pdfError.message);
        // We do not fail the entire submission if the PDF fails, but we log the error.
      }
    }

    // 3. CRM Routing to Monday.com
    let crmStatus = 'pending';
    const mondayWebhookUrl = process.env.MONDAY_WEBHOOK_URL;
    
    if (mondayWebhookUrl) {
      try {
        const mondayResponse = await fetch(mondayWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'new_factoring_enquiry',
            reference: submissionRef,
            data: docToSave
          })
        });

        if (!mondayResponse.ok) {
          throw new Error(`Monday.com API responded with status: ${mondayResponse.status}`);
        }
        
        crmStatus = 'delivered';
        await updateCrmStatus(id, { crmStatus });
      } catch (crmError: any) {
        console.error('[SubmitAPI] Monday.com routing failed. Queuing for retry.', crmError.message);
        crmStatus = 'queued_for_retry';
        await updateCrmStatus(id, { crmStatus, crmMessage: crmError.message });
      }
    } else {
      // Mocking successful CRM delivery if URL is not set (e.g., local dev)
      console.log('[SubmitAPI] MONDAY_WEBHOOK_URL not configured. Mocking successful CRM routing.');
      crmStatus = 'delivered';
    }

    

    // 4. Decoupled Secondary Task: Email Summary Dispatch
    if (!isPartial) {
      try {
        const emailRes = await sendApplicationNotificationEmail({
          application,
          applicationRef: submissionRef, generatedPdfPath: docToSave.documentMetadata?.generatedPdfPath, uploadedDocuments: application.documents,
        });
        if (emailRes.success) {
          await updateEmailStatus(id, { emailStatus: 'sent', emailMessageId: emailRes.messageId, emailSentAt: new Date().toISOString() });
        } else {
          await updateEmailStatus(id, { emailStatus: 'failed', emailError: emailRes.error });
        }
      } catch (emailErr: any) {
        console.error('[SubmitAPI] Downstream email notification failed (decoupled):', emailErr?.message || emailErr);
      }
    } else {
      // Partial lead - send welcome/acknowledgement email to the applicant
      if (application.contact?.email) {
        try {
          const emailRes = await sendPartialLeadAcknowledgementEmail({
            application,
            applicationRef: submissionRef, generatedPdfPath: docToSave.documentMetadata?.generatedPdfPath, uploadedDocuments: application.documents,
          });
          if (emailRes.success) {
            await updateEmailStatus(id, { emailStatus: 'sent', emailMessageId: emailRes.messageId, emailSentAt: new Date().toISOString() });
          } else {
            await updateEmailStatus(id, { emailStatus: 'failed', emailError: emailRes.error });
          }
        } catch (emailErr: any) {
          console.error('[SubmitAPI] Downstream partial acknowledgement email failed (decoupled):', emailErr?.message || emailErr);
        }
      }
    }

    // 5. Return 200 OK
    const uploadToken = await createUploadToken(id, 2 * 60 * 60 * 1000);
    
    // 5. Return 200 OK
    res.status(200).json({
      success: true,
      applicationId: id,
      submissionRef,
      submittedAt,
      crmStatus,
      uploadToken,
      queued: crmStatus === 'queued_for_retry'
    });
  } catch (error: any) {
    console.error('[SubmitAPI] Unexpected top-level handler error:', error?.message || error);
    res.status(500).json({
      error: 'An unexpected server error occurred while processing your application submission.',
    });
  }
}
