import { getAdminFirestore } from './firebaseAdmin.js';
import crypto from 'crypto';
import type { ApplicationData } from '../../src/schemas/applicationSchemas.js';

export type TokenPurpose = 'DOCUMENT_UPLOAD';
export type TokenStatus = 'REQUESTED' | 'ACTIVE' | 'USED' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';

export interface UploadTokenRecord {
  token: string;
  applicationId: string;
  submissionRef?: string;
  purpose: TokenPurpose;
  status: TokenStatus;
  createdAt: string;
  expiresAt: string;
  activatedAt?: string;
  lastUsedAt?: string;
  useCount: number;
  completedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  requestedDocumentTypes?: string[];
  metadata?: Record<string, any>;
}

export interface CreateTokenOptions {
  applicationId: string;
  submissionRef?: string;
  requestedDocumentTypes?: string[];
  expiresInMs?: number;
  baseUrl?: string;
  metadata?: Record<string, any>;
}

const TOKEN_COLLECTION = 'ffUploadTokens';
const APPLICATION_COLLECTION = 'ffApplications';

// In-memory token store for local dev / tests when Firestore credentials are not configured
const inMemoryTokenStore = new Map<string, UploadTokenRecord>();

/**
 * Creates a cryptographically strong, application-specific upload token with full lifecycle support.
 */
export async function createDocumentRequestToken(options: CreateTokenOptions): Promise<{
  token: string;
  record: UploadTokenRecord;
  uploadUrl: string;
}> {
  const {
    applicationId,
    submissionRef,
    requestedDocumentTypes = [
      'aged_debtor_report',
      'aged_creditor_report',
      'bank_statement',
    ],
    expiresInMs = 7 * 24 * 60 * 60 * 1000, // 7 days default
    baseUrl = 'https://factoringfinance.co.uk',
    metadata = {},
  } = options;

  // 32-byte cryptographically secure random token (256-bit entropy)
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  const record: UploadTokenRecord = {
    token,
    applicationId,
    ...(submissionRef ? { submissionRef } : {}),
    purpose: 'DOCUMENT_UPLOAD',
    status: 'ACTIVE',
    createdAt: now,
    expiresAt,
    useCount: 0,
    requestedDocumentTypes,
    metadata,
  };

  const db = getAdminFirestore();
  if (db) {
    await db.collection(TOKEN_COLLECTION).doc(token).set(record);
    // Link active document request metadata to the application document
    await db.collection(APPLICATION_COLLECTION).doc(applicationId).set(
      {
        documentRequest: {
          status: 'REQUESTED',
          requestedAt: now,
          activeToken: token,
          requestedDocumentTypes,
          expiresAt,
        },
        updatedAt: now,
      },
      { merge: true }
    ).catch(e => console.warn('[ApplicationRepository] Failed to update documentRequest on application:', e.message));
  } else {
    inMemoryTokenStore.set(token, record);
  }

  const uploadUrl = `${baseUrl}/?token=${token}`;
  return { token, record, uploadUrl };
}

/**
 * Standard upload token creator helper for submission journeys.
 */
export async function createUploadToken(
  applicationId: string,
  expiresInMs: number = 7 * 24 * 60 * 60 * 1000,
  submissionRef?: string
): Promise<string> {
  const result = await createDocumentRequestToken({
    applicationId,
    submissionRef,
    expiresInMs,
  });
  return result.token;
}

/**
 * Verifies that a token exists, is active, has not expired, has not been revoked,
 * and matches the required security purpose.
 */
export async function validateUploadToken(
  token: string,
  expectedPurpose: TokenPurpose = 'DOCUMENT_UPLOAD'
): Promise<{ valid: boolean; record?: UploadTokenRecord; applicationId?: string; error?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or invalid' };
  }

  const db = getAdminFirestore();
  let record: UploadTokenRecord | undefined;

  if (db) {
    const docRef = db.collection(TOKEN_COLLECTION).doc(token);
    const doc = await docRef.get();
    if (!doc.exists) {
      return { valid: false, error: 'Upload token not found' };
    }
    record = doc.data() as UploadTokenRecord;
  } else {
    // Check mock / in-memory store
    record = inMemoryTokenStore.get(token);
    if (!record && token.startsWith('mock_token_')) {
      return {
        valid: true,
        applicationId: 'mock_app_id',
        record: {
          token,
          applicationId: 'mock_app_id',
          purpose: 'DOCUMENT_UPLOAD',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          useCount: 1,
        },
      };
    }
    if (!record) {
      return { valid: false, error: 'Upload token not found' };
    }
  }

  // Check Purpose
  if (record.purpose !== expectedPurpose) {
    return { valid: false, record, error: `Invalid token purpose. Expected ${expectedPurpose}.` };
  }

  // Check Revocation
  if (record.status === 'REVOKED') {
    return { valid: false, record, error: `Upload link has been revoked: ${record.revocationReason || 'No reason specified'}` };
  }

  // Check Completion
  if (record.status === 'COMPLETED') {
    return { valid: false, record, error: 'Upload link has already been used and completed' };
  }

  // Check Expiration
  const isExpired = new Date(record.expiresAt).getTime() < Date.now();
  if (isExpired || record.status === 'EXPIRED') {
    if (db && record.status !== 'EXPIRED') {
      await db.collection(TOKEN_COLLECTION).doc(token).update({ status: 'EXPIRED' }).catch(() => {});
    }
    return { valid: false, record: { ...record, status: 'EXPIRED' }, error: 'Upload link has expired' };
  }

  // Track activation & usage
  const now = new Date().toISOString();
  const updates: Partial<UploadTokenRecord> = {
    lastUsedAt: now,
    useCount: (record.useCount || 0) + 1,
    ...(!record.activatedAt ? { activatedAt: now } : {}),
  };

  if (db) {
    await db.collection(TOKEN_COLLECTION).doc(token).update(updates).catch(() => {});
  } else {
    Object.assign(record, updates);
  }

  return {
    valid: true,
    record: { ...record, ...updates },
    applicationId: record.applicationId,
  };
}

/**
 * Revokes an upload token immediately, rendering it invalid for all future upload attempts.
 */
export async function revokeUploadToken(token: string, reason: string = 'Revoked by administrator'): Promise<boolean> {
  const now = new Date().toISOString();
  const db = getAdminFirestore();

  if (db) {
    const docRef = db.collection(TOKEN_COLLECTION).doc(token);
    const doc = await docRef.get();
    if (!doc.exists) return false;

    await docRef.update({
      status: 'REVOKED',
      revokedAt: now,
      revocationReason: reason,
    });
    return true;
  } else {
    const record = inMemoryTokenStore.get(token);
    if (!record) return false;
    record.status = 'REVOKED';
    record.revokedAt = now;
    record.revocationReason = reason;
    return true;
  }
}

/**
 * Marks an upload token as completed after the applicant finishes their document upload session.
 */
export async function completeUploadToken(token: string): Promise<boolean> {
  const now = new Date().toISOString();
  const db = getAdminFirestore();

  if (db) {
    const docRef = db.collection(TOKEN_COLLECTION).doc(token);
    const doc = await docRef.get();
    if (!doc.exists) return false;

    await docRef.update({
      status: 'COMPLETED',
      completedAt: now,
    });
    return true;
  } else {
    const record = inMemoryTokenStore.get(token);
    if (!record) return false;
    record.status = 'COMPLETED';
    record.completedAt = now;
    return true;
  }
}

// -------------------------------------------------------------
// Application Lifecycle & Persistence Functions
// -------------------------------------------------------------

export interface FFApplicationRecord {
  applicationId: string;
  submissionRef: string;
  applicationStatus: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  application: Partial<ApplicationData>;
  emailStatus?: string;
  emailMessageId?: string;
  emailSentAt?: string;
  emailError?: string;
  docsReceivedEmailStatus?: string;
  docsReceivedEmailMessageId?: string;
  docsReceivedEmailSentAt?: string;
  docsReceivedEmailError?: string;
  crmStatus?: string;
  crmMessage?: string;
  documentMetadata?: any;
  documentRequest?: {
    status: string;
    requestedAt: string;
    activeToken?: string;
    requestedDocumentTypes?: string[];
    expiresAt?: string;
  };
  uploadStatus?: string;
}

const inMemoryApplicationStore = new Map<string, FFApplicationRecord>();

export async function saveOrUpdateApplication(
  applicationId: string,
  submissionRef: string,
  applicationStatus: string,
  applicationData: Partial<ApplicationData>
): Promise<{ isDuplicate: boolean; record: FFApplicationRecord }> {
  const db = getAdminFirestore();
  if (!db) {
    console.warn('[Firestore DAL] Firestore is not configured. Simulating DB save for local development.');
    const now = new Date().toISOString();
    const existing = inMemoryApplicationStore.get(applicationId);
    if (existing && applicationStatus === 'submitted' && existing.applicationStatus === 'submitted') {
      return { isDuplicate: true, record: existing };
    }
    const record: FFApplicationRecord = {
      applicationId,
      submissionRef,
      applicationStatus,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      submittedAt: applicationStatus === 'submitted' ? (existing?.submittedAt || now) : undefined,
      application: applicationData,
    };
    inMemoryApplicationStore.set(applicationId, record);
    return {
      isDuplicate: false,
      record,
    };
  }

  const docRef = db.collection(APPLICATION_COLLECTION).doc(applicationId);

  return await db.runTransaction(async (t) => {
    const doc = await t.get(docRef);

    if (doc.exists) {
      const existingData = doc.data() as FFApplicationRecord;

      // Idempotency: if it's already fully submitted, treat as duplicate
      if (applicationStatus === 'submitted' && existingData.applicationStatus === 'submitted') {
        return { isDuplicate: true, record: existingData };
      }

      const updatedRecord: Partial<FFApplicationRecord> = {
        applicationStatus,
        updatedAt: new Date().toISOString(),
        application: applicationData,
        ...(applicationStatus === 'submitted' && !existingData.submittedAt ? { submittedAt: new Date().toISOString() } : {}),
      };

      t.update(docRef, updatedRecord as any);
      return { isDuplicate: false, record: { ...existingData, ...updatedRecord } as FFApplicationRecord };
    } else {
      const now = new Date().toISOString();
      const newRecord: FFApplicationRecord = {
        applicationId,
        submissionRef,
        applicationStatus,
        createdAt: now,
        updatedAt: now,
        ...(applicationStatus === 'submitted' ? { submittedAt: now } : {}),
        application: applicationData,
        uploadStatus: 'pending',
        emailStatus: 'pending',
        crmStatus: 'pending',
      };
      t.set(docRef, newRecord);
      return { isDuplicate: false, record: newRecord };
    }
  });
}

export async function updateEmailStatus(
  applicationId: string,
  update: { emailStatus: string; emailMessageId?: string; emailSentAt?: string; emailError?: string }
) {
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) Object.assign(record, update);
    return;
  }
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).update({
    ...update,
    updatedAt: new Date().toISOString(),
  }).catch(e => console.error('[Firestore DAL] Failed to update email status', e.message));
}

export async function updateDocsReceivedEmailStatus(
  applicationId: string,
  update: { docsReceivedEmailStatus: string; docsReceivedEmailMessageId?: string; docsReceivedEmailSentAt?: string; docsReceivedEmailError?: string }
) {
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) Object.assign(record, update);
    return;
  }
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).update({
    ...update,
    updatedAt: new Date().toISOString(),
  }).catch(e => console.error('[Firestore DAL] Failed to update docsReceivedEmail status', e.message));
}

export async function updateCrmStatus(
  applicationId: string,
  update: { crmStatus: string; crmMessage?: string }
) {
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) Object.assign(record, update);
    return;
  }
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).update({
    ...update,
    updatedAt: new Date().toISOString(),
  }).catch(e => console.error('[Firestore DAL] Failed to update crm status', e.message));
}

export async function updateDocumentMetadata(
  applicationId: string,
  documentMetadata: any
) {
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) record.documentMetadata = documentMetadata;
    return;
  }
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).update({
    documentMetadata,
    updatedAt: new Date().toISOString(),
  }).catch(e => console.error('[Firestore DAL] Failed to update document metadata', e.message));
}

export async function addDocumentToApplication(
  applicationId: string,
  doc: { documentType: string; fileName: string; fileSize?: number; storagePath: string; uploadedAt: string }
): Promise<any[]> {
  const now = new Date().toISOString();
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) {
      const existingDocs = Array.isArray(record.documentMetadata) ? record.documentMetadata : [];
      const updatedDocs = [...existingDocs.filter(d => d.fileName !== doc.fileName || d.documentType !== doc.documentType), doc];
      record.documentMetadata = updatedDocs;
      record.uploadStatus = 'partial';
      record.updatedAt = now;
      return updatedDocs;
    }
    return [doc];
  }

  const docRef = db.collection(APPLICATION_COLLECTION).doc(applicationId);
  return await db.runTransaction(async (t) => {
    const snap = await t.get(docRef);
    if (!snap.exists) return [doc];
    const data = snap.data() as FFApplicationRecord;
    const existingDocs = Array.isArray(data.documentMetadata) ? data.documentMetadata : [];
    const updatedDocs = [...existingDocs.filter(d => d.fileName !== doc.fileName || d.documentType !== doc.documentType), doc];
    t.update(docRef, {
      documentMetadata: updatedDocs,
      uploadStatus: 'partial',
      updatedAt: now
    });
    return updatedDocs;
  });
}

export async function updateApplicationDocumentRequest(
  applicationId: string,
  documentRequest: any
): Promise<void> {
  const now = new Date().toISOString();
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) {
      record.documentRequest = {
        ...(record.documentRequest || {}),
        ...documentRequest,
      };
      record.updatedAt = now;
    }
    return;
  }
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).set(
    {
      documentRequest,
      updatedAt: now,
    },
    { merge: true }
  ).catch((e: any) => console.warn('[Firestore DAL] Failed to update documentRequest:', e.message));
}

export async function updateApplicationUploadStatus(
  applicationId: string,
  uploadStatus: string
): Promise<void> {
  const now = new Date().toISOString();
  const db = getAdminFirestore();
  if (!db) {
    const record = inMemoryApplicationStore.get(applicationId);
    if (record) {
      record.uploadStatus = uploadStatus;
      record.updatedAt = now;
      if (uploadStatus === 'uploaded') {
        if (!record.documentRequest) {
          record.documentRequest = { status: 'COMPLETED', requestedAt: now };
        } else {
          record.documentRequest.status = 'COMPLETED';
        }
      }
    }
    return;
  }
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).set(
    {
      uploadStatus,
      documentsUploadedAt: now,
      'documentRequest.status': uploadStatus === 'uploaded' ? 'COMPLETED' : uploadStatus,
      updatedAt: now,
    },
    { merge: true }
  ).catch((e: any) => console.warn('[Firestore DAL] Failed to update upload status:', e.message));
}

export async function getApplicationById(applicationId: string): Promise<FFApplicationRecord | null> {
  const db = getAdminFirestore();
  if (!db) {
    return inMemoryApplicationStore.get(applicationId) || null;
  }
  const doc = await db.collection(APPLICATION_COLLECTION).doc(applicationId).get();
  if (!doc.exists) return null;
  return doc.data() as FFApplicationRecord;
}


