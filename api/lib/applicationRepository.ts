import { getAdminFirestore } from './firebaseAdmin';
import type { ApplicationData } from '../../src/schemas/applicationSchemas';

const COLLECTION_NAME = 'ffApplications';

export interface FFApplicationRecord {
  applicationId: string;
  submissionRef: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  application: Partial<ApplicationData>;
  emailStatus?: string;
  emailMessageId?: string;
  emailSentAt?: string;
  emailError?: string;
  crmStatus?: string;
  crmMessage?: string;
  documentMetadata?: any;
  uploadStatus?: string;
}

export async function saveOrUpdateApplication(
  applicationId: string,
  submissionRef: string,
  status: string,
  applicationData: Partial<ApplicationData>
): Promise<{ isDuplicate: boolean; record: FFApplicationRecord }> {
  const db = getAdminFirestore();
  if (!db) {
    console.warn('[Firestore DAL] Firestore is not configured. Simulating DB save for local development.');
    return {
      isDuplicate: false,
      record: {
        applicationId,
        submissionRef,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        application: applicationData
      }
    };
  }

  const docRef = db.collection(COLLECTION_NAME).doc(applicationId);
  
  return await db.runTransaction(async (t) => {
    const doc = await t.get(docRef);
    
    if (doc.exists) {
      const existingData = doc.data() as FFApplicationRecord;
      
      // Idempotency: if it's already fully submitted, treat as duplicate
      if (status === 'introduction_ready' && existingData.status === 'introduction_ready') {
        return { isDuplicate: true, record: existingData };
      }
      
      const updatedRecord: Partial<FFApplicationRecord> = {
        status,
        updatedAt: new Date().toISOString(),
        application: applicationData,
        ...(status === 'introduction_ready' && !existingData.submittedAt ? { submittedAt: new Date().toISOString() } : {})
      };
      
      t.update(docRef, updatedRecord as any);
      return { isDuplicate: false, record: { ...existingData, ...updatedRecord } as FFApplicationRecord };
    } else {
      const now = new Date().toISOString();
      const newRecord: FFApplicationRecord = {
        applicationId,
        submissionRef,
        status,
        createdAt: now,
        updatedAt: now,
        ...(status === 'introduction_ready' ? { submittedAt: now } : {}),
        application: applicationData,
        uploadStatus: 'pending'
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
  if (!db) return;
  await db.collection(COLLECTION_NAME).doc(applicationId).update({
    ...update,
    updatedAt: new Date().toISOString()
  }).catch(e => console.error('[Firestore DAL] Failed to update email status', e.message));
}

export async function updateCrmStatus(
  applicationId: string,
  update: { crmStatus: string; crmMessage?: string }
) {
  const db = getAdminFirestore();
  if (!db) return;
  await db.collection(COLLECTION_NAME).doc(applicationId).update({
    ...update,
    updatedAt: new Date().toISOString()
  }).catch(e => console.error('[Firestore DAL] Failed to update crm status', e.message));
}


export async function updateDocumentMetadata(
  applicationId: string,
  documentMetadata: any
) {
  const db = getAdminFirestore();
  if (!db) return;
  await db.collection(COLLECTION_NAME).doc(applicationId).update({
    documentMetadata,
    updatedAt: new Date().toISOString()
  }).catch(e => console.error('[Firestore DAL] Failed to update document metadata', e.message));
}
