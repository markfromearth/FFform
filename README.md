# FF Form - Development Guide

Welcome to the FF Form repository. This project is a modern web application built with a Vite-powered React frontend and a Vercel-based serverless backend.

## Local Development Workflow

This project is explicitly centred around the Vercel CLI (`vercel dev`) to perfectly replicate the production environment during local development.

### Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory. You must configure the following keys (do not commit secret values!):
   
   - `VITE_COMPANIES_HOUSE_API_KEY`: API key for Companies House integration.
   - `COMPANIES_HOUSE_API_KEY`: API key for Companies House (server-side).
   - `FIREBASE_PROJECT_ID`: Firebase project identifier.
   - `FIREBASE_CLIENT_EMAIL`: Service account email for Firebase admin.
   - `FIREBASE_PRIVATE_KEY`: Service account private key for Firebase admin (must be quoted and contain `\n` characters).
   - `FIREBASE_STORAGE_BUCKET`: The URL of your Firebase storage bucket.
   - `RESEND_API_KEY`: Resend API key for outbound emails.
   - `RESEND_FROM_EMAIL`: Sender email address (e.g. `onboarding@yourdomain.com`).
   - `APPLICATION_NOTIFICATION_EMAIL`: Internal destination for application notifications.
   - `ADMIN_API_KEY`: Secret string used for internal/admin tasks.

3. **Link to Vercel (One-Time Setup):**
   If you have access to the Vercel project, run:
   ```bash
   npx vercel link
   ```
   This will securely synchronize cloud settings into the `.vercel` directory.

4. **Start the Local Environment:**
   Start the application by running:
   ```bash
   npm run start
   ```
   *(This invokes `vercel dev` behind the scenes).*

### Architecture Overview

- **Frontend:** Built with React and Vite. It is automatically started and proxied by the Vercel CLI.
- **Backend (API):** Vercel Serverless Functions. All API routes live in the `api/` directory at the project root as `.ts` files (e.g. `api/submit-application.ts`).
- **Expected Local URL:** The application runs on `http://localhost:3000`. 
  - Vercel automatically proxies `http://localhost:3000/api/*` to the Node.js serverless functions in the `api/` directory.
  - All other traffic is proxied directly to the Vite development server.

### Important: Testing API Routes
All API routes **must** be executed and tested through the Vercel runtime (`http://localhost:3000/api/...`). 

Do not attempt to test API functions directly against the Vite dev server (port `5173`) or recreate Vite-based API mocks. The Vercel runtime is specifically required to correctly parse `req.body`, `req.query`, and inject the production-grade `res.json()` helper methods. The frontend is already configured to use relative `/api/...` paths to ensure smooth compatibility between development and production.
