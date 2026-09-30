import fs from 'fs';
import path from 'path';

const outDir = './.vercel_build_output/api';
const endpoints = [
  'companies-house.js',
  'get-upload-url.js',
  'google-places.js',
  'retry-email.js',
  'send-deferred-upload-link.js',
  'submit-application.js'
];

async function run() {
  console.log('| Endpoint | Import Status | Error (if any) |');
  console.log('|---|---|---|');
  
  for (const ep of endpoints) {
    try {
      const p = path.resolve(outDir, ep);
      await import(`file://${p}`);
      console.log(`| \`${ep}\` | ✅ PASS | - |`);
    } catch (e) {
      console.log(`| \`${ep}\` | ❌ FAIL | ${e.message} |`);
      console.error(`\nRaw error for ${ep}:`);
      console.error(e);
    }
  }
}
run();
