# Developer Document Reliability Handoff

**Date:** 21 October 2026  
**Branch:** `feat/crm-document-reliability-and-renewal`  
**Commit SHA:** `d7126d455e02c37667fb5577ddc8094a07285126` (Short: `d7126d4`)  
**Base:** `origin/main` (commit `8d689b1`)  
**Status:** Tests Passing (14 test suites, 121 tests), Production untouched, Live email journey fully preserved.

---

## 1. Summary of Changes

In response to the requirements for document reliability, immutable identity pinning, and expired-link recovery:
1. **Permanent Server-Side Document Identity:** Every document (both the generated application PDF and all supporting uploads) now carries a stable, permanent server-side `documentId` (e.g. `doc_app_pdf_<appId>` or `doc_<randomId>`).
2. **Immutable Version Pinning:** `documentVersion` pins the actual immutable Google Cloud Storage object generation (`metadata.generation`), obtained server-side upon storage. Re-uploading or changing the file updates this generation, while re-signing the same object retains the exact same version.
3. **Explicit Expiry Timestamps:** All pre-signed Google Cloud Storage V4 URLs (`downloadUrl`) now include explicit ISO 8601 expiry timestamps (`downloadUrlExpiresAt`).
4. **Stable Attachment Deduplication Key:** The deduplication key in Make/Monday CRM is:
   $$\text{Attachment Key} = \text{applicationId} + \text{"\_"} + \text{documentId} + \text{"\_"} + \text{documentVersion}$$
   * Re-signing an expired link yields the **same** key.
   * Two different documents sharing the same display filename yield **different** keys.
5. **Event Identity:** Every logical webhook dispatch carries a persistent `eventId` (`evt_sub_<id>` for applications, `evt_docs_<appId>_<timestamp>` for upload batches).
6. **Backend-Controlled Link Renewal Endpoint (`POST /api/renew-document-url`):** Secure recovery endpoint for authorised operators or automated retry jobs to reissue fresh 7-day signed URLs for any document on a case.
7. **Production Safeguards Maintained:**
   * Production `MONDAY_WEBHOOK_URL` remains unconfigured (dormant).
   * Live email dispatch runs strictly before CRM logic and is decoupled.
   * Full backward compatibility is preserved for existing Make fields (`pdfDownloadUrl`, `documentMetadata`).

---

## 2. Backend Contract Specification

### Webhook Event: `new_factoring_enquiry` (Initial Application)

Dispatched to `MONDAY_WEBHOOK_URL` when an application is submitted:

```json
{
  "event": "new_factoring_enquiry",
  "eventId": "evt_sub_ff_app_uuid_12345",
  "reference": "FF-2026-ABC12",
  "data": {
    "id": "ff_app_uuid_12345",
    "submissionRef": "FF-2026-ABC12",
    "submittedAt": "2026-10-21T00:00:00.000Z",
    "status": "submitted",
    "eventId": "evt_sub_ff_app_uuid_12345",
    "pdfDownloadUrl": "https://storage.googleapis.com/...signed-url...",
    "downloadUrlExpiresAt": "2026-10-28T00:00:00.000Z",
    "documentMetadata": {
      "documentId": "doc_app_pdf_ff_app_uuid_12345",
      "documentVersion": "1792259563027623",
      "documentType": "completed_application",
      "fileName": "FF-2026-ABC12-application.pdf",
      "fileSize": 45120,
      "contentType": "application/pdf",
      "storagePath": "applications/ff/ff_app_uuid_12345/generated/FF-2026-ABC12-application.pdf",
      "generatedPdfPath": "applications/ff/ff_app_uuid_12345/generated/FF-2026-ABC12-application.pdf",
      "downloadUrl": "https://storage.googleapis.com/...signed-url...",
      "pdfDownloadUrl": "https://storage.googleapis.com/...signed-url...",
      "downloadUrlExpiresAt": "2026-10-28T00:00:00.000Z",
      "generatedAt": "2026-10-21T00:00:00.000Z"
    },
    "documents": [
      {
        "documentId": "doc_app_pdf_ff_app_uuid_12345",
        "documentVersion": "1792259563027623",
        "documentType": "completed_application",
        "fileName": "FF-2026-ABC12-application.pdf",
        "fileSize": 45120,
        "contentType": "application/pdf",
        "storagePath": "applications/ff/ff_app_uuid_12345/generated/FF-2026-ABC12-application.pdf",
        "downloadUrl": "https://storage.googleapis.com/...signed-url...",
        "downloadUrlExpiresAt": "2026-10-28T00:00:00.000Z",
        "uploadedAt": "2026-10-21T00:00:00.000Z"
      }
    ],
    "business": { ... },
    "contact": { ... },
    "invoices": { ... },
    "consents": { ... }
  }
}
```

---

### Webhook Event: `documents_uploaded` (Post-Submission Uploads)

Dispatched to `MONDAY_WEBHOOK_URL` when an applicant completes their upload session in `/upload` or Step 6:

```json
{
  "event": "documents_uploaded",
  "eventId": "evt_docs_ff_app_uuid_12345_1792259800000",
  "reference": "FF-2026-ABC12",
  "data": {
    "eventId": "evt_docs_ff_app_uuid_12345_1792259800000",
    "applicationId": "ff_app_uuid_12345",
    "submissionRef": "FF-2026-ABC12",
    "companyName": "Apex Logistics Ltd",
    "applicantName": "Robert Vance",
    "applicantEmail": "robert@apexlogistics.co.uk",
    "status": "documents_received",
    "uploadedAt": "2026-10-21T00:05:00.000Z",
    "documents": [
      {
        "documentId": "doc_8f1b2c3d4e5f6a7b",
        "documentVersion": "1792259589793971",
        "documentType": "bank_statement",
        "fileName": "Bank_Statements_Oct2026.pdf",
        "fileSize": 1048576,
        "contentType": "application/pdf",
        "storagePath": "applications/ff/ff_app_uuid_12345/documents/bank_statement/1792259800_Bank_Statements.pdf",
        "downloadUrl": "https://storage.googleapis.com/...signed-url...",
        "downloadUrlExpiresAt": "2026-10-28T00:05:00.000Z",
        "uploadedAt": "2026-10-21T00:05:00.000Z"
      }
    ]
  }
}
```

---

## 3. Expired-Link Recovery Endpoint

### `POST /api/renew-document-url`

Renews an expired download link by generating a fresh Google Cloud Storage signed URL to the pinned object.

#### Authentication
* Header: `Authorization: Bearer <ADMIN_API_KEY>`

#### Request Body
```json
{
  "applicationId": "ff_app_uuid_12345",
  "submissionRef": "FF-2026-ABC12",
  "documentId": "doc_8f1b2c3d4e5f6a7b",
  "documentVersion": "1792259589793971",
  "replayWebhook": false
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `applicationId` | `string` | **Yes** | Application UUID. |
| `submissionRef` | `string` | **Yes** | Case reference. Validated against the database record (prevents cross-case leakage). |
| `documentId` | `string` | **Yes** | Target document ID. Resolved from trusted server metadata (no arbitrary client paths). |
| `documentVersion`| `string` | No | If provided, verified against stored GCS object generation (`409 Conflict` if mismatched). |
| `replayWebhook` | `boolean`| No | If `true` and `MONDAY_WEBHOOK_URL` is set, automatically replays the webhook event to Make with the renewed URL. |

#### Security Controls Enforced
1. **Bearer Authentication:** Unauthenticated requests fail with `401 Unauthorized`.
2. **Case Association Guard:** If `submissionRef` does not match `applicationId`, rejects with `403 Forbidden`.
3. **Internal Path Resolution:** Storage paths are **never** accepted from client input; they are retrieved strictly from server-side verified database records.
4. **Version Pinning Guard:** If `documentVersion` is supplied and does not match the stored object, rejects with `409 Conflict`.
5. **No Credential Exposure:** Service account keys and bucket permissions remain 100% private. Only time-bounded V4 signed URLs are generated.

#### Response (`200 OK`)
```json
{
  "success": true,
  "applicationId": "ff_app_uuid_12345",
  "submissionRef": "FF-2026-ABC12",
  "document": {
    "documentId": "doc_8f1b2c3d4e5f6a7b",
    "documentVersion": "1792259589793971",
    "fileName": "Bank_Statements_Oct2026.pdf",
    "documentType": "bank_statement",
    "fileSize": 1048576,
    "contentType": "application/pdf",
    "storagePath": "applications/ff/ff_app_uuid_12345/documents/bank_statement/1792259800_Bank_Statements.pdf",
    "downloadUrl": "https://storage.googleapis.com/...fresh-signed-url...",
    "downloadUrlExpiresAt": "2026-10-28T00:05:00.000Z",
    "uploadedAt": "2026-10-21T00:05:00.000Z",
    "renewedAt": "2026-10-21T00:10:00.000Z"
  },
  "replayed": false
}
```

---

## 4. Verification & Automated Test Coverage

The test suite covers:
* `api/_tests/renew-document-url.test.ts`:
  * `401 Unauthorized` without valid `ADMIN_API_KEY`.
  * `400 Bad Request` on missing parameters.
  * `403 Forbidden` on case reference mismatch.
  * `404 Not Found` on unknown `documentId`.
  * `409 Conflict` on `documentVersion` mismatch.
  * Successful renewal of supporting document with fresh 7-day expiry and stable deduplication key.
  * Successful renewal of generated application PDF with optional webhook replay.
* `api/_tests/document-upload-portal.test.ts`:
  * Dispatch of `documents_uploaded` on upload completion.
  * Correct attachment and deduplication of re-uploaded files.

All 14 test suites and 121 tests pass with 0 failures (`npm test`). Build passes (`npm run build`).
