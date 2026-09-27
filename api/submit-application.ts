import { z } from 'zod';
import { fullApplicationSchema } from '../src/schemas/applicationSchemas';
import { sendApplicationNotificationEmail, sendPartialLeadAcknowledgementEmail } from './lib/emailService';

// In-memory mock storage for local testing and deduplication
// In a real environment, this would be a Redis cache or Database table
const mockSubmittedApplications = new Map<string, any>();
const mockRetryQueue: any[] = [];

import * as fsQueue from 'fs';
import * as path from 'path';

function saveToDurableQueue(payload) {
  try {
    const queueFile = path.resolve('/tmp', 'ff_retry_queue.json');
    let queue = [];
    if (fsQueue.existsSync(queueFile)) {
      queue = JSON.parse(fsQueue.readFileSync(queueFile, 'utf8'));
    }
    queue.push({ timestamp: new Date().toISOString(), payload });
    fsQueue.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    console.log('[SubmitAPI] Saved payload to durable local queue at /tmp/ff_retry_queue.json');
  } catch (e) {
    console.error('[SubmitAPI] Failed to write to durable queue', e);
  }
}


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

    const { application, id } = validationResult.data;
    
    // Normalize data for deduplication
    const normEmail = normalizeEmail(application.contact.email);
    const normPhone = normalizePhone(application.contact.phone);
    const companyNum = application.business.company_number || 'UNKNOWN';
    
    // Create a stable deduplication key
    const dedupKey = `${normEmail}_${normPhone}_${companyNum}`;
    
    const submissionRef = generateFallbackReference(id);
    const submittedAt = payload.submittedAt || new Date().toISOString();

    // 2. Idempotency & Deduplication Check
    if (mockSubmittedApplications.has(dedupKey)) {
      const existing = mockSubmittedApplications.get(dedupKey);
      
      // Idempotent immediate 200 OK return (preventing duplicate CRM entry)
      res.status(200).json({
        success: true,
        message: 'Application already submitted (idempotent duplicate request)',
        applicationId: existing.id,
        submissionRef: existing.submissionRef,
        submittedAt: existing.submittedAt,
        crmStatus: existing.crmStatus,
      });
      return;
    }

    const docToSave = {
      ...application,
      id,
      submissionRef,
      submittedAt,
      status: 'submitted',
      crmStatus: 'pending',
    };

    // Store in mock database for deduplication
    mockSubmittedApplications.set(dedupKey, docToSave);

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
      } catch (crmError: any) {
        console.error('[SubmitAPI] Monday.com routing failed. Queuing for retry.', crmError.message);
        crmStatus = 'queued_for_retry';
        saveToDurableQueue({ event: 'new_factoring_enquiry', reference: submissionRef, data: docToSave });
        
        // Push to retry queue for a background worker to pick up
        mockRetryQueue.push({
          dedupKey,
          payload: docToSave,
          failedAt: new Date().toISOString(),
          attempts: 1
        });
      }
    } else {
      // Mocking successful CRM delivery if URL is not set (e.g., local dev)
      console.log('[SubmitAPI] MONDAY_WEBHOOK_URL not configured. Mocking successful CRM routing.');
      crmStatus = 'mock_delivered';
    }

    // Update status in mock database
    mockSubmittedApplications.get(dedupKey).crmStatus = crmStatus;

    // 4. Decoupled Secondary Task: Email Summary Dispatch
    if (!isPartial) {
      try {
        await sendApplicationNotificationEmail({
          application,
          applicationRef: submissionRef,
        });
      } catch (emailErr: any) {
        console.error('[SubmitAPI] Downstream email notification failed (decoupled):', emailErr?.message || emailErr);
      }
    } else {
      // Partial lead - send welcome/acknowledgement email to the applicant
      if (application.contact?.email) {
        try {
          await sendPartialLeadAcknowledgementEmail({
            application,
            applicationRef: submissionRef,
          });
        } catch (emailErr: any) {
          console.error('[SubmitAPI] Downstream partial acknowledgement email failed (decoupled):', emailErr?.message || emailErr);
        }
      }
    }

    // 5. Return 200 OK
    res.status(200).json({
      success: true,
      applicationId: id,
      submissionRef,
      submittedAt,
      crmStatus,
      queued: crmStatus === 'queued_for_retry'
    });
  } catch (error: any) {
    console.error('[SubmitAPI] Unexpected top-level handler error:', error?.message || error);
    res.status(500).json({
      error: 'An unexpected server error occurred while processing your application submission.',
    });
  }
}
