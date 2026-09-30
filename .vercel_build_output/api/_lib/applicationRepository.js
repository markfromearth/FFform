import { getAdminFirestore } from './firebaseAdmin.js';
import crypto from 'crypto';
export async function createUploadToken(applicationId, expiresInMs) {
    const db = getAdminFirestore();
    if (!db)
        return 'mock_token_' + Date.now();
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const record = {
        token,
        applicationId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + expiresInMs).toISOString(),
        status: 'active'
    };
    await db.collection('ffUploadTokens').doc(token).set(record);
    return token;
}
export async function validateUploadToken(token) {
    const db = getAdminFirestore();
    if (!db) {
        if (token.startsWith('mock_token_'))
            return { valid: true, applicationId: 'mock_app_id' };
        return { valid: false, error: 'Database unavailable' };
    }
    const docRef = db.collection('ffUploadTokens').doc(token);
    const doc = await docRef.get();
    if (!doc.exists) {
        return { valid: false, error: 'Invalid token' };
    }
    const data = doc.data();
    if (data.status !== 'active') {
        return { valid: false, error: 'Token has already been used or revoked' };
    }
    if (new Date(data.expiresAt).getTime() < Date.now()) {
        return { valid: false, error: 'Token has expired' };
    }
    return { valid: true, applicationId: data.applicationId };
}
const COLLECTION_NAME = 'ffApplications';
export async function saveOrUpdateApplication(applicationId, submissionRef, applicationStatus, applicationData) {
    const db = getAdminFirestore();
    if (!db) {
        console.warn('[Firestore DAL] Firestore is not configured. Simulating DB save for local development.');
        return {
            isDuplicate: false,
            record: {
                applicationId,
                submissionRef,
                applicationStatus,
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
            const existingData = doc.data();
            // Idempotency: if it's already fully submitted, treat as duplicate
            if (applicationStatus === 'submitted' && existingData.applicationStatus === 'submitted') {
                return { isDuplicate: true, record: existingData };
            }
            const updatedRecord = {
                applicationStatus,
                updatedAt: new Date().toISOString(),
                application: applicationData,
                ...(applicationStatus === 'submitted' && !existingData.submittedAt ? { submittedAt: new Date().toISOString() } : {})
            };
            t.update(docRef, updatedRecord);
            return { isDuplicate: false, record: { ...existingData, ...updatedRecord } };
        }
        else {
            const now = new Date().toISOString();
            const newRecord = {
                applicationId,
                submissionRef,
                applicationStatus,
                createdAt: now,
                updatedAt: now,
                ...(applicationStatus === 'submitted' ? { submittedAt: now } : {}),
                application: applicationData,
                uploadStatus: 'pending',
                emailStatus: 'pending',
                crmStatus: 'pending'
            };
            t.set(docRef, newRecord);
            return { isDuplicate: false, record: newRecord };
        }
    });
}
export async function updateEmailStatus(applicationId, update) {
    const db = getAdminFirestore();
    if (!db)
        return;
    await db.collection(COLLECTION_NAME).doc(applicationId).update({
        ...update,
        updatedAt: new Date().toISOString()
    }).catch(e => console.error('[Firestore DAL] Failed to update email status', e.message));
}
export async function updateCrmStatus(applicationId, update) {
    const db = getAdminFirestore();
    if (!db)
        return;
    await db.collection(COLLECTION_NAME).doc(applicationId).update({
        ...update,
        updatedAt: new Date().toISOString()
    }).catch(e => console.error('[Firestore DAL] Failed to update crm status', e.message));
}
export async function updateDocumentMetadata(applicationId, documentMetadata) {
    const db = getAdminFirestore();
    if (!db)
        return;
    await db.collection(COLLECTION_NAME).doc(applicationId).update({
        documentMetadata,
        updatedAt: new Date().toISOString()
    }).catch(e => console.error('[Firestore DAL] Failed to update document metadata', e.message));
}
export async function getApplicationById(applicationId) {
    const db = getAdminFirestore();
    if (!db)
        return null;
    const doc = await db.collection(COLLECTION_NAME).doc(applicationId).get();
    if (!doc.exists)
        return null;
    return doc.data();
}
