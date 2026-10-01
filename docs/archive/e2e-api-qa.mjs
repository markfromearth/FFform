import fetch from 'node-fetch';
import fs from 'fs';

const BASE_URL = 'http://localhost:5174';
const testId = `FF-QA-${Date.now()}`;
let applicationId = testId; // Setting custom ID just to be safe, though the server expects `id` to be generated or provided by frontend

async function run() {
  console.log(`Starting QA Run: ${testId}`);

  // 1. Test Application Submission
  console.log("\n--- 1. Testing Application Submission ---");
  const payload = {
    id: applicationId,
    status: 'submitted',
    application: {
      business: {
        b2b_completed_supply: "yes",
        company_name: `${testId} Test Corp`,
        entity_type: "limited_company",
        industry: "manufacturing",
        annual_turnover: 1500000,
        gross_debtor_book: 250000
      },
      contact: {
        contact_full_name: `Jane Doe ${testId}`,
        contact_role: "director_owner",
        phone: "+447700900000", // valid E.164
        email: "qa-test@example.com",
        funding_timescale: "asap"
      },
      invoices: {
        desired_outcome: "all_invoices",
        requested_facility: 250000,
        payment_terms_days: "30_or_less",
        largest_debtor_concentration_pct: "under_20",
        debtor_geography: ["uk"],
        existing_invoice_finance: false,
        hmrc_status: "up_to_date",
        funding_purpose: ["Support growth"]
      },
      consents: {
        processing_notice_acknowledged: true
      }
    }
  };

  try {
    const res = await fetch(`${BASE_URL}/api/submit-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log(`Submit Status: ${res.status}`);
    const data = await res.json();
    console.log(`Submit Response:`, data);
    
    if (data.success || data.id) {
      applicationId = data.id || data.applicationId || applicationId;
      console.log(`Application ID: ${applicationId}`);
    } else {
      console.error("Submission failed");
      process.exit(1);
    }
  } catch(e) {
    console.error("Error submitting:", e);
    process.exit(1);
  }

  // 2. Test Invalid Files (get upload url)
  console.log("\n--- 2. Testing Invalid File Upload Request ---");
  try {
    const res = await fetch(`${BASE_URL}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: applicationId,
        fileName: "test.exe", 
        fileType: "application/x-msdownload", 
        fileSize: 50000
      })
    });
    console.log(`Invalid File Requested Status: ${res.status}`);
    const data = await res.json();
    console.log(`Invalid File Requested Response:`, data);
  } catch(e) {
    console.error("Error on invalid file:", e);
  }

  // 3. Test Valid File Upload URL Generation
  console.log("\n--- 3. Testing Valid File Upload Request ---");
  try {
    const res = await fetch(`${BASE_URL}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: applicationId,
        fileName: `valid_test_${testId}.pdf`, 
        fileType: "application/pdf", 
        fileSize: 50000
      })
    });
    console.log(`Valid File Requested Status: ${res.status}`);
    const data = await res.json();
    console.log(`Valid File Requested Response:`, data);
    
    // We could do an actual PUT to the signed URL here if needed.
    if (data.url) {
      console.log("Mocking a PUT to the signed URL...");
      // Not actually uploading since this is a real Firebase bucket, 
      // but if we were strictly testing upload, we'd do it here.
    }
  } catch(e) {
    console.error("Error on valid file:", e);
  }

  // 4. Test Request Documents
  console.log("\n--- 4. Testing Request Documents Endpoint ---");
  try {
    const reqDocsPayload = {
      applicationId: applicationId,
      requestedDocuments: [
        { id: "doc1", name: "Bank Statements", description: "Last 3 months", type: "financial" }
      ],
      customMessage: "Please provide these for QA."
    };
    const res = await fetch(`${BASE_URL}/api/request-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqDocsPayload)
    });
    console.log(`Request Docs Status: ${res.status}`);
    const data = await res.json();
    console.log(`Request Docs Response:`, data);
  } catch (e) {
    console.error("Error on request documents:", e);
  }
  
  // 5. Test complete document upload metadata insertion
  console.log("\n--- 5. Testing Record Document Upload ---");
  try {
    const recordPayload = {
      applicationId: applicationId,
      documentType: "financial",
      fileName: `valid_test_${testId}.pdf`,
      storagePath: `applications/${applicationId}/valid_test_${testId}.pdf`,
      fileSize: 50000
    };
    const res = await fetch(`${BASE_URL}/api/record-document-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordPayload)
    });
    console.log(`Record Docs Status: ${res.status}`);
    const data = await res.json();
    console.log(`Record Docs Response:`, data);
  } catch (e) {
    console.error("Error on record document upload:", e);
  }

  console.log("\nQA Run Finished");
  process.exit(0);
}

run();
