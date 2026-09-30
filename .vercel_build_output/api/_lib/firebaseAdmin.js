import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
/**
 * Reads server environment variables for Firebase service account.
 */
function getFirebaseCredentials() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : undefined);
    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }
    // Handle escaped newlines from environment variable formatting
    if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return {
        projectId,
        clientEmail,
        privateKey,
        storageBucket,
    };
}
/**
 * Checks whether Firebase Admin credentials are configured in the environment.
 */
export function isFirebaseConfigured() {
    return getFirebaseCredentials() !== null;
}
let cachedApp = null;
/**
 * Returns the initialized Firebase Admin App instance.
 * Reuses existing instance in warm serverless containers.
 */
export function getFirebaseAdminApp() {
    if (cachedApp) {
        return cachedApp;
    }
    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0]) {
        cachedApp = existingApps[0];
        return cachedApp;
    }
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        return null;
    }
    try {
        cachedApp = initializeApp({
            credential: cert({
                projectId: credentials.projectId,
                clientEmail: credentials.clientEmail,
                privateKey: credentials.privateKey,
            }),
            storageBucket: credentials.storageBucket,
        });
        return cachedApp;
    }
    catch (error) {
        console.error('Failed to initialize Firebase Admin SDK:', error?.message || error);
        return null;
    }
}
/**
 * Returns the Firestore instance if configured.
 */
export function getAdminFirestore() {
    const app = getFirebaseAdminApp();
    if (!app) {
        return null;
    }
    return getFirestore(app);
}
/**
 * Returns the Firebase Storage instance if configured.
 */
export function getAdminStorage() {
    const app = getFirebaseAdminApp();
    if (!app) {
        return null;
    }
    return getStorage(app);
}
