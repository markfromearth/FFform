import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { EventEmitter } from 'events';

// Prevent Node PassThrough stream warning in warm serverless containers during GCS file writes
EventEmitter.defaultMaxListeners = 30;

/**
 * Server-only Firebase Admin initialization module.
 * Never import this file in client-side / React components.
 */

interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
}

/**
 * Reads server environment variables for Firebase service account.
 */
function getFirebaseCredentials(): FirebaseCredentials | null {
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
export function isFirebaseConfigured(): boolean {
  return getFirebaseCredentials() !== null;
}

let cachedApp: App | null = null;

/**
 * Returns the initialized Firebase Admin App instance.
 * Reuses existing instance in warm serverless containers.
 */
export function getFirebaseAdminApp(): App | null {
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
  } catch (error: any) {
    console.error('Failed to initialize Firebase Admin SDK:', error?.message || error);
    return null;
  }
}

let cachedFirestore: Firestore | null = null;

/**
 * Returns the Firestore instance if configured.
 */
export function getAdminFirestore(): Firestore | null {
  if (cachedFirestore) {
    return cachedFirestore;
  }
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // Settings can only be set once per Firestore instance
  }
  cachedFirestore = db;
  return cachedFirestore;
}

/**
 * Returns the Firebase Storage instance if configured.
 */
export function getAdminStorage(): Storage | null {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }
  return getStorage(app);
}
