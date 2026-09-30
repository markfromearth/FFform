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

function createMockReq() {
  return {
    method: 'OPTIONS', // Start with OPTIONS to test CORS blocks
    headers: { origin: 'http://localhost:5173' },
    query: {},
    body: {}
  };
}

function createMockRes() {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader: (k, v) => { res.headers[k] = v; return res; },
    status: (code) => { res.statusCode = code; return res; },
    json: (data) => { res.body = data; return res; },
    end: () => { return res; }
  };
  return res;
}

async function run() {
  for (const ep of endpoints) {
    try {
      const p = path.resolve(outDir, ep);
      const mod = await import(`file://${p}`);
      if (typeof mod.default !== 'function') {
        console.log(`[SKIP] ${ep} - no default exported handler`);
        continue;
      }
      
      const req = createMockReq();
      const res = createMockRes();
      
      await mod.default(req, res);
      
      console.log(`[PASS] ${ep} executed without throwing.`);
    } catch (e) {
      console.log(`[FAIL] ${ep} threw an error:`);
      console.error(e);
    }
  }
}
run();
