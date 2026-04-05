# TrailForge Sports Training & Community Portal (Offline-Ready Web Platform)

You are working inside a monorepo for **TrailForge**, an offline-ready sports training + community portal running on a single on-prem host. The system must work without internet access.

This document is binding. All implementation decisions must comply with this file and the business prompt.

---

## 1. System Summary

TrailForge supports athletes, subscribers, coaches, and operations staff in one unified platform.

Core functional areas:
- Personalized Home Feed (training activity + course updates + local sports news ingestion)
- Activity Tracking (running/cycling/walking)
- Orders + Reviews + Appeals (service quality governance)
- Content Governance + Anti-Fraud Controls
- Offline Payment Ledger (WeChat Pay reconciliation imports)
- News Ingestion Jobs (RSS/API payload files + HTML crawl extracts)
- Operations & Analytics (offline back office dashboards + CSV export)

Roles:
- Regular User
- Coach
- Support Agent
- Admin

Role-based access control is mandatory and must be enforced server-side.

---

## 2. Frontend Requirements (Vue.js)

Frontend stack:
- Vue.js (primary interface)
- Must be usable offline on an on-prem host (local network access)

Primary UI modules:
- Login / logout
- Home feed
- Activity record CRUD
- Review creation and follow-up reviews
- Review threads and replies
- Appeal submission + arbitration timeline
- Admin configuration for review dimensions
- Back office analytics dashboards with filters and CSV export

Feed requirements:
- Blend training activity, course updates, and ingested sports news
- Each feed item supports:
  - "Not Interested"
  - "Block Author"
  - "Block Tag"
- Must provide immediate UI feedback and a confirmation toast
- Must de-duplicate similar items seen in last 7 days
- Cold-start recommendations based on selected sports + first-week browsing

Activity tracking requirements:
- Create/edit running/cycling/walking records
- Fields:
  - duration
  - distance (miles)
  - calories
  - heart rate
  - pace
  - tags
  - notes
  - optional location (free text OR choose from saved places)
- No maps
- GPX file import supported (from device)
- GPX should be parsed and stored as a simple coordinate list

Review UI requirements:
- 1–5 rating
- review text
- up to 5 images (PNG/JPEG only, max 5MB each)
- follow-up review allowed within 30 days
- threaded replies from Coaches or Support Agents
- anonymous vs real-name display (user-controlled)

Appeals:
- appeal button visible for 7 days after posting
- appeal creates arbitration timeline and status messages
- content under arbitration may be hidden based on server-side display rules

---

## 3. Backend Requirements

Backend stack:
- Node.js + Koa
- REST-style APIs consumed by Vue.js
- MySQL as system of record

Backend stores:
- users
- follow graph
- activities
- orders
- reviews
- appeals
- risk tags
- content sources
- analytics snapshots
- ingestion logs
- offline payment ledger
- queue/job tables

All key business rules must be enforced server-side.

---

## 4. Offline Constraints

The platform runs fully offline on a single on-prem host.

Rules:
- no external SaaS dependencies
- no external auth providers
- news ingestion comes from locally mirrored payload files dropped into monitored folders
- payment reconciliation is imported from cashier workstation files

If anything requires internet, it must be explicitly avoided or replaced with local file-based workflows.

---

## 5. Authentication & Security

Authentication:
- local username/password login
- passwords must be hashed using bcrypt

Sensitive profile fields:
- encrypted at rest

RBAC:
- enforce Admin / Coach / Support Agent / Regular User separation

Access control must be enforced at:
- route-level
- service-level for critical actions
- object-level where user ownership matters

---

## 6. Home Feed Logic Requirements

Feed sources:
- training activity items
- course updates
- sports news ingestion items

Feed features:
- de-duplicate similar items seen in last 7 days
- allow user actions:
  - Not Interested
  - Block Author
  - Block Tag
- cold-start recommendation based on selected sports + first-week browsing history

Blocking rules must be applied server-side to prevent bypass.

---

## 7. Activities Module Requirements

Activity types:
- running
- cycling
- walking

Required fields:
- duration
- distance (miles)
- calories
- heart rate
- pace
- tags
- notes
- location (free text OR saved place reference)

GPX handling:
- allow GPX file upload
- parse into coordinate list
- store coordinates as normalized list (lat, lon, elevation optional, timestamp optional)

No maps integration is allowed.

---

## 8. Reviews, Replies, and Appeals

Reviews:
- tied to a completed course or service order
- 1–5 rating + text + up to 5 images
- follow-up review allowed once within 30 days
- threaded replies by Coach or Support Agent
- user can choose anonymous vs real-name display

Review dimensions:
- configurable by Admin
- must support multiple dimensions (punctuality, coaching quality, cleanliness, etc.)
- dimension scores must be tracked separately

Appeals:
- appeal button visible for 7 days after posting
- appeal opens arbitration timeline
- review content display rules may hide review during arbitration

---

## 9. Content Governance and Anti-Fraud Rules

Sensitive word dictionary:
- locally maintained
- enforced server-side for reviews and replies

Image validation:
- format validation required (PNG/JPEG)
- hash-based deny list required

Anti-fake-review controls:
- one review per order
- max 2 reviews per day per user
- risk flag when multiple accounts share a device fingerprint

Risk tagging:
- high-risk user after 3 upheld violations
- blacklists restrict reviewing for 30 days

Content display rules:
- hide content under arbitration if required

---

## 10. Offline Payment Ledger Requirements (WeChat Pay)

Payment handling is offline and ledger-based.

Rules:
- WeChat Pay transactions are recorded via batch-imported reconciliation files
- imported payment results must be verified using locally stored signatures
- refunds supported, including partial refunds down to $0.01
- unpaid orders auto-cancel after 30 minutes

Consistency requirements:
- idempotency keys required for payment and refund operations
- retry/compensation jobs required
- jobs must be backed by a MySQL queue table

Ledger rules:
- immutable ledger entries
- corrections must be reversal entries, not edits

---

## 11. News Ingestion Jobs

Sports news ingestion uses scheduled jobs:
- process locally mirrored RSS/API payload files
- process HTML crawl-rule extracts dropped into monitored folders
- allow/block lists must be supported
- ingestion endpoints must be rate limited
- retry on failure: 3 retries
- ingestion logs must be immutable for audit

---

## 12. Operations & Analytics Module

Offline back office includes:
- enrollment funnel
- course popularity
- renewal/refund rates
- channel performance
- instructor utilization
- location revenue/cost reporting
- custom filters
- CSV export
- access logging for exports

Analytics snapshots should be stored in MySQL.

---

## 13. API Conventions

All APIs return JSON.

Success format:
{
  "success": true,
  "data": ...
}

Error format:
{
  "success": false,
  "error": {
    "code": "...",
    "message": "...",
    "details": {...}
  }
}

Use consistent status codes:
- 200/201 success
- 400 validation errors
- 401 unauthenticated
- 403 unauthorized
- 404 not found
- 409 conflict
- 429 rate limited
- 500 internal error

---

## 14. Engineering Standards

- Keep handlers thin
- Move business logic to services
- Use repositories for DB access
- Validate all inputs
- Avoid hardcoding business rules inside route handlers
- Log audit events for sensitive actions
- Never log sensitive personal fields

---

## 15. Folder Structure Expectations

Suggested structure:

- /server
  - /src
    - /api (koa routes/controllers)
    - /middleware (auth, rbac, rate limiting)
    - /services (business logic)
    - /repositories (mysql access)
    - /models (domain models)
    - /security (bcrypt, encryption, signature verification)
    - /jobs (queue + schedulers)
    - /ledger (payments/refunds)
    - /ingestion (news ingestion)
    - /analytics
    - /utils
- /web
  - /src (Vue app)
  - /components
  - /views
  - /services (API client)
  - /store
  - /assets
- /docs
- /migrations

---

## 16. Testing Expectations

Tests should cover:
- auth login
- RBAC enforcement
- review constraints (per order, daily max)
- follow-up review within 30 days
- appeal visibility window (7 days)
- arbitration hide rules
- sensitive word enforcement
- device fingerprint risk tagging
- ledger immutability and reversal logic
- refund partial down to $0.01
- unpaid auto-cancel after 30 minutes
- idempotency keys
- ingestion retry behavior and immutable logs
- CSV export access logging

---

## 17. Final Note

This is an offline enterprise system. Prioritize:
- correctness
- auditability
- deterministic enforcement
- RBAC security
- ledger integrity
- local file ingestion safety