#!/usr/bin/env node

/**
 * BizLoans4U - Firebase Storage CORS Configuration Utility
 * 
 * Enables browser-to-bucket direct PUT uploads for bank statements via signed URLs.
 * Without this CORS policy, browser fetch(signedUrl, { method: 'PUT' }) requests
 * will be blocked by CORS preflight checks (OPTIONS).
 * 
 * Usage:
 *   node scripts/set-firebase-cors.js <path-to-service-account.json> [bucket-name]
 * 
 * Examples:
 *   node scripts/set-firebase-cors.js ./serviceAccountKey.json
 *   node scripts/set-firebase-cors.js ./serviceAccountKey.json my-project.firebasestorage.app
 *   node scripts/set-firebase-cors.js ~/Downloads/bizloans4u-firebase-adminsdk.json
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const CORS_CONFIGURATION = [
  {
    origin: ['*'],
    method: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE', 'OPTIONS'],
    responseHeader: [
      'Content-Type',
      'Access-Control-Allow-Origin',
      'x-goog-resumable',
      'ETag',
    ],
    maxAgeSeconds: 3600,
  },
];

async function main() {
  console.log('='.repeat(60));
  console.log(' BizLoans4U: Firebase Storage CORS Configuration Tool');
  console.log('='.repeat(60));

  let keyPath = process.argv[2];

  // If no path was passed, check common service account locations
  if (!keyPath) {
    const candidates = [
      './serviceAccountKey.json',
      './service-account.json',
      './firebase-key.json',
    ];
    try {
      const files = fs.readdirSync(process.cwd());
      const adminSdkFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
      if (adminSdkFile) {
        candidates.unshift(`./${adminSdkFile}`);
      }
    } catch {
      // ignore
    }

    keyPath = candidates.find(p => fs.existsSync(p));
  }

  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('\n❌ Error: Service Account JSON file not found.\n');
    console.log('Usage:');
    console.log('  node scripts/set-firebase-cors.js <path-to-service-account.json> [bucket-name]\n');
    console.log('Examples:');
    console.log('  node scripts/set-firebase-cors.js ./serviceAccountKey.json');
    console.log('  node scripts/set-firebase-cors.js ~/Downloads/serviceAccountKey.json');
    console.log('  node scripts/set-firebase-cors.js ./serviceAccountKey.json my-project.firebasestorage.app\n');
    process.exit(1);
  }

  const resolvedPath = path.resolve(keyPath);
  console.log(`\n📄 Loading Service Account Key: ${resolvedPath}`);

  let serviceAccount;
  try {
    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
  } catch (err) {
    console.error(`❌ Failed to read or parse JSON from ${resolvedPath}:`, err.message);
    process.exit(1);
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    console.error('❌ Invalid service account file: Missing project_id, client_email, or private_key.');
    process.exit(1);
  }

  console.log(`   Project ID:   ${serviceAccount.project_id}`);
  console.log(`   Client Email: ${serviceAccount.client_email}`);

  // Determine bucket name
  let bucketName = process.argv[3] || process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    // Newer Firebase default format is <project_id>.firebasestorage.app
    // Legacy Firebase default format is <project_id>.appspot.com
    bucketName = `${serviceAccount.project_id}.firebasestorage.app`;
    console.log(`\nℹ️  No bucket name specified. Using default: ${bucketName}`);
    console.log(`   (If your bucket is different, pass it as the 2nd argument)`);
  } else {
    // Strip gs:// or trailing slashes if user pasted full URI
    bucketName = bucketName.replace(/^gs:\/\//, '').replace(/\/+$/, '');
    console.log(`\n🪣 Target Bucket: ${bucketName}`);
  }

  try {
    const app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: bucketName,
    });

    const storage = getStorage(app);
    const bucket = storage.bucket(bucketName);

    console.log(`\n🔄 Applying CORS policy to bucket '${bucketName}'...`);
    await bucket.setCorsConfiguration(CORS_CONFIGURATION);

    console.log('✅ CORS configuration successfully applied!');
    console.log('\nConfigured Policy:');
    console.log(JSON.stringify(CORS_CONFIGURATION, null, 2));

    // Verify metadata
    try {
      const [metadata] = await bucket.getMetadata();
      console.log('\nBucket Metadata Verification:');
      console.log(`   Bucket Name: ${metadata.name}`);
      console.log(`   Location:    ${metadata.location}`);
      console.log(`   Active CORS: ${JSON.stringify(metadata.cors || 'None')}`);
    } catch {
      // Non-fatal if metadata read fails
      console.log('   (Note: Could not retrieve metadata confirmation, but set request succeeded)');
    }

    console.log('\n🎉 Storage bucket is now ready for direct browser PUT uploads!\n');
  } catch (error) {
    console.error('\n❌ Failed to set CORS policy:', error.message);
    if (error.code === 404 || error.message?.includes('Not Found')) {
      console.error(`\nBucket '${bucketName}' was not found.`);
      console.error(`If your bucket is an older project format, try running with:`);
      console.error(`  node scripts/set-firebase-cors.js "${keyPath}" "${serviceAccount.project_id}.appspot.com"\n`);
    } else if (error.code === 403 || error.message?.includes('Permission')) {
      console.error(`\nPermission Denied. Please ensure your Service Account has the "Storage Admin" role in Google Cloud Console.`);
    }
    process.exit(1);
  }
}

main();
