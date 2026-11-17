# VINORA Platform — Backend & Database Architecture Design

## 1. Executive Summary

This document details the production-ready backend and database foundation designed and provisioned for the **VINORA** platform.

The architecture is implemented using **Node.js**, **Firebase Firestore**, **Firebase Authentication**, **Firebase/Cloud Storage**, and a modular **REST API layer** embedded directly within the server runtime. It maintains strict zero-trust data segregation, field validation, rate-limiting, and auditable activity logging.

---

## 2. Infrastructure & Firebase Configuration

The application is provisioned with Google Cloud / Firebase resources:

- **Project ID**: `phonic-synthesizer-k9brs`
- **Firestore Database ID**: `ai-studio-vinoraideatoimpa-22ec51f7-975d-4d87-acb1-efec23ca058a`
- **Cloud Storage Bucket**: `phonic-synthesizer-k9brs.firebasestorage.app`
- **Authentication Domain**: `phonic-synthesizer-k9brs.firebaseapp.com`

Client configuration is maintained in `firebase-applet-config.json` and consumed by `src/lib/firebase.ts`. Server-side admin credentials use Application Default Credentials (ADC) or the `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` environment variables.

---

## 3. Firestore Collections Architecture

The database model is mapped across 20 specialized collections:

| Collection          | Schema Entity      | Access Policy                                   | Description                                                            |
| :------------------ | :----------------- | :---------------------------------------------- | :--------------------------------------------------------------------- |
| `users`             | `User`             | Owner Read/Update, Admin Full                   | Authenticated profile and system role (`client`, `admin`, etc.).       |
| `clients`           | `Client`           | Owner Read/Update, Admin Full                   | Client business profile, billing address, and account status.          |
| `admins`            | `Admin`            | Admin Only                                      | Internal administrative accounts and granular role permissions.        |
| `projectRequests`   | `ProjectRequest`   | Public Create (Strict Fields), Admin/Owner Read | Inbound "Start Project" inquiries submitted by prospective clients.    |
| `contactEnquiries`  | `ContactEnquiry`   | Public Create, Admin Read                       | General contact form submissions.                                      |
| `projects`          | `Project`          | Client Read (Own), Admin Full                   | Active or past client projects, phase progress, and timelines.         |
| `milestones`        | `Milestone`        | Project Client Read, Admin Full                 | Deliverable stages, progress percentages, and deadlines.               |
| `projectUpdates`    | `ProjectUpdate`    | Targeted/Public Read, Admin Full                | Agency broadcasts and client-specific progress announcements.          |
| `messages`          | `Message`          | Project Participants Read/Create                | Threaded client-admin communication within a project workspace.        |
| `meetings`          | `Meeting`          | Client Read (Own), Admin Full                   | Scheduled discovery, review, or status calls with video links.         |
| `requests`          | `ClientRequest`    | Client Manage (Own), Admin Full                 | Change requests and support tickets filed by clients.                  |
| `documents`         | `Document`         | Client Read (Own/Public), Admin Full            | Project briefs, wireframes, contracts, and deliverable metadata.       |
| `proposals`         | `Proposal`         | Client Read (Own), Admin Full                   | Formal project scopes, pricing breakdowns, and acceptance status.      |
| `invoices`          | `Invoice`          | Client Read (Own), Admin Full                   | Billing records, milestones amounts, and payment due dates.            |
| `payments`          | `Payment`          | Client Read (Own), Admin/Server Write           | Gateway transaction records and reconciliation states.                 |
| `referrals`         | `Referral`         | Referrer Client Manage (Own), Admin Full        | Client referral tracking, unique codes, and reward eligibility.        |
| `showcaseApprovals` | `ShowcaseApproval` | Client Manage (Own), Admin Full                 | Client permission/consent to feature projects in the public portfolio. |
| `otpRequests`       | `OtpRequest`       | Server Only (Direct client access denied)       | Temporary OTP codes for client phone/email login.                      |
| `notifications`     | `Notification`     | User Read/Mark Read, Admin Full                 | In-app alerts, milestones notifications, and invoice alerts.           |
| `activityLogs`      | `ActivityLog`      | Admin Read, Server Write Only                   | Immutable audit trails of system and administrative events.            |

---

## 4. Security Model & Zero-Trust Rules

The Firestore security rules in `firestore.rules` adhere to Zero-Trust principles:

1. **Default Deny**: `match /{document=**} { allow read, write: if false; }`.
2. **Identity & Role Enforcement**:
   - `isSignedIn()`: Verifies valid Firebase Auth JWT.
   - `isOwner(userId)`: Ensures `request.auth.uid == userId`.
   - `isAdmin()`: Validates admin status against the `/admins` collection and initial bootstrapper identity.
3. **No Client Self-Promotion**: A user creating or updating their profile cannot alter their `role` field.
4. **Data Isolation**: Clients can only query their own documents (`resource.data.clientId == request.auth.uid`).
5. **Strict Input Sanitization**: Public form submissions (`projectRequests`, `contactEnquiries`) validate field types and character length caps directly in security rules.
6. **Server-Side Ledgers**: `payments`, `otpRequests`, and `activityLogs` cannot be written to or manipulated by client-side SDK calls.

---

## 5. Storage Architecture

Cloud Storage paths are organized by domain, preventing collisions and enabling fine-grained security:

- `projects/{projectId}/images/...` — Design assets, brand collateral (JPG, PNG, WebP, SVG; Max 10MB)
- `projects/{projectId}/videos/...` — Video reviews, screen recordings (MP4, WebM; Max 200MB)
- `clients/{clientId}/documents/...` — Contracts, NDAs, briefs (PDF, DOCX; Max 25MB)
- `projects/{projectId}/deliverables/...` — Final project deliverables (ZIP, PDF, MP4; Max 500MB)
- `projects/{projectId}/agreements/...` — Signed proposals and legal agreements (PDF; Max 20MB)
- `invoices/{invoiceId}/files/...` — Generated PDF invoices (PDF; Max 15MB)
- `chats/{projectId}/attachments/...` — Chat files and screenshots (Max 20MB)

`server/services/storage.ts` provides path builders, MIME validation, and presigned expiring URL generation.

---

## 6. Server & API Architecture

The server foundation resides in `/server` and is mounted via `src/server.ts` to intercept `/api/*`:

- **Environment & Secrets**: `server/config/env.ts` (Zod validation)
- **Firebase Admin SDK**: `server/config/firebase-admin.ts` (Lazy initialization, credential checks)
- **CORS Middleware**: `server/middleware/cors.ts` (Configurable origins, preflight handling)
- **Rate Limiting**: `server/middleware/rate-limiter.ts` (Sliding window token bucket: 100 req/min default, 10 req/min for forms, 5 req/min for auth)
- **Auth Middleware**: `server/middleware/auth.ts` (Token verification, role retrieval)
- **Validation**: `server/middleware/validate.ts` (Zod schema runner)
- **Activity Logger**: `server/services/activity-log.ts` (Persists audit events to `activityLogs`)

### Prepared Endpoints

| Route                   | Target Phase                                | Status           |
| :---------------------- | :------------------------------------------ | :--------------- |
| `/api/health`           | System monitoring                           | Live             |
| `/api/auth`             | Client & admin OTP/Email authentication     | Foundation Ready |
| `/api/clients`          | Client profile and dashboard operations     | Foundation Ready |
| `/api/admin`            | Agency administrative controls              | Foundation Ready |
| `/api/projects`         | Project lifecycle and tracking              | Foundation Ready |
| `/api/project-requests` | Project inquiry submission pipeline         | Foundation Ready |
| `/api/contact`          | Website enquiry intake                      | Foundation Ready |
| `/api/messages`         | Project workspace chat                      | Foundation Ready |
| `/api/meetings`         | Meeting scheduling and video integration    | Foundation Ready |
| `/api/requests`         | Client change and revision requests         | Foundation Ready |
| `/api/documents`        | Document management and secure downloads    | Foundation Ready |
| `/api/proposals`        | Proposal dispatch and digital approvals     | Foundation Ready |
| `/api/invoices`         | Milestone invoicing and statement queries   | Foundation Ready |
| `/api/payments`         | Payment gateway webhooks and verification   | Foundation Ready |
| `/api/showcase`         | Showcase approval workflow                  | Foundation Ready |
| `/api/referrals`        | Referral tracking and reward redemption     | Foundation Ready |
| `/api/ai`               | AI assistance and automated project scoping | Foundation Ready |
| `/api/notifications`    | User alerts and badge indicators            | Foundation Ready |

---

## 7. Required Environment Secrets

Before launching production payment gateways and email triggers in later steps, populate these in the deployment settings:

- `FIREBASE_CLIENT_EMAIL`: Service account email (if not using GCP Cloud Run ADC).
- `FIREBASE_PRIVATE_KEY`: Service account private key (if not using GCP Cloud Run ADC).
- `RAZORPAY_KEY_ID`: Razorpay gateway API ID (for Step 4/5 payment integration).
- `RAZORPAY_KEY_SECRET`: Razorpay gateway API secret.
- `GEMINI_API_KEY`: Server-side Gemini key for AI assistant features.

---

## 8. Extension Guide for Future Steps

- **Step 2 (Authentication & Client Portal)**:
  - Wire Firebase Auth UI components into `/api/auth` and client context.
  - Populate `/users` and `/clients` on registration.
- **Step 3 (Project Hub & Messaging)**:
  - Connect real-time Firestore listeners for `/messages` and `/milestones`.
  - Utilize `buildStoragePath("chat_attachment", ...)` for message uploads.
- **Step 4 (Invoicing & Payments)**:
  - Implement Razorpay order creation on `/api/payments/create-order` and signature verification webhook.
- **Step 5 (Admin Dashboard & Analytics)**:
  - Consume `/api/admin/*` routes to manage incoming `projectRequests`, issue proposals, and track agency KPIs.
