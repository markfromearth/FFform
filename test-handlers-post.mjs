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
    method: 'POST',
    headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
    query: {},
    body: { mock: "data" }
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
      
      const req = createMockReq();
      const res = createMockRes();
      
      // We wrap the call in a try/catch. The handler itself might return a 500 or 400 response via res.json, 
      // but we are checking if the Node process itself throws an unhandled exception before/during body.
      await mod.default(req, res);
      
      console.log(`[PASS] ${ep} executed without unhandled throw (Returned Status: ${res.statusCode}).`);
    } catch (e) {
      console.log(`[FAIL] ${ep} threw an unhandled exception:`);
      console.error(e);
    }
  }
}
run();
