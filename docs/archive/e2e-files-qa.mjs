import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5174';
const applicationId = process.argv[2];
const uploadToken = process.argv[3];
const testId = `FF-QA-${Date.now()}`;

async function run() {
  let storagePath = "";
  const res = await fetch(`${BASE_URL}/api/get-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: uploadToken,
      fileName: `valid_test_${testId}.pdf`, 
      fileType: "application/pdf", 
      documentType: "bank_statement"
    })
  });
  const data = await res.json();
  if (data.uploadUrl) {
    storagePath = data.storagePath;
  }

  // 3. Test complete document upload metadata insertion
  if (storagePath) {
    console.log("\n--- 3. Testing Record Document Upload ---");
    try {
      const recordPayload = {
        token: uploadToken,
        document: {
          documentType: "bank_statement",
          fileName: `valid_test_${testId}.pdf`,
          storagePath: storagePath,
          fileSize: 50000
        }
      };
      const res = await fetch(`${BASE_URL}/api/record-document-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordPayload)
      });
      console.log(`Record Docs Status: ${res.status}`);
      const responseData = await res.json();
      console.log(`Record Docs Response:`, responseData);
    } catch (e) {
      console.error("Error on record document upload:", e);
    }
  }

  console.log("\nFile QA Run Finished");
  process.exit(0);
}

run();
