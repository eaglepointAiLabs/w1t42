# rules.md — Audit-Proof Development Rules
Project: TrailForge Sports Training & Community Portal

This file exists to ensure the project passes static-only Delivery Acceptance and Architecture Audit review.
All development must follow these rules.

---

# 1) Delivery Requirements (Hard Gates)

## 1.1 Required files (Blocker if missing)
Repository MUST include:
- `README.md` with:
  - setup/run instructions
  - test instructions
  - required dependencies
  - environment variables documentation
  - MySQL setup + migration process
  - offline ingestion folder setup instructions
  - reconciliation file import workflow
- `.env.example`
- `docs/` folder containing:
  - API route list
  - RBAC matrix
  - schema overview
  - job schedule list
- `migrations/` or schema.sql

If something is implemented but undocumented, it is considered incomplete.

---

## 1.2 Offline-only constraints (Blocker if violated)
The project must NOT depend on:
- external auth providers
- external APIs
- cloud storage
- external payment gateways
- internet-only libraries for core logic

All ingestion must work from local files/folders.

---

# 2) Architecture Rules

## 2.1 Mandatory layering (Blocker if violated)
Backend MUST enforce separation:
- routes/controllers (Koa layer)
- middleware (auth, RBAC, validation, rate limiting)
- services (business logic)
- repositories (MySQL persistence)
- jobs (queue and scheduled workers)
- ledger module (payment/refund ledger)
- ingestion module (news ingestion + logs)

No direct DB calls from controllers.

---

## 2.2 Centralized business rules
All deterministic constraints must be centralized:
- review constraints (1 per order, max 2/day)
- follow-up review within 30 days
- appeal window 7 days
- arbitration display rules
- device fingerprint risk tagging rules
- blacklist enforcement rules
- unpaid auto-cancel after 30 minutes
- partial refund min $0.01
- ingestion retry rules (3 retries)
- dedupe feed last 7 days

No duplicated inconsistent rule logic is allowed.

---

# 3) Security Rules (Highest Priority)

## 3.1 Authentication rules (Blocker if missing)
- local username/password login only
- bcrypt hashing required
- password policy must be enforced (minimum length recommended 12)
- session/token must be securely stored

Evidence required:
- bcrypt usage in code
- password validation logic

---

## 3.2 Sensitive profile encryption at rest (Blocker if missing)
Sensitive fields must be encrypted in DB:
- e.g., phone, email, address, identity fields

Rules:
- encryption key stored locally via config/env
- encryption must be deterministic only when required for querying
- never store raw key in repo

---

## 3.3 RBAC enforcement (Blocker if missing)
Roles:
- Admin
- Coach
- Support Agent
- Regular User

Rules:
- all routes must require authentication except login/register if allowed
- admin-only routes must be enforced in middleware
- object-level access required:
  - users cannot edit other users’ activities
  - users cannot view others’ private profile data
  - reviews can only be replied to by authorized staff roles

RBAC matrix must be documented in `docs/rbac.md`.

---

## 3.4 Audit logging (High if missing)
Must log:
- admin changes to review dimensions
- export actions
- payment reconciliation imports
- refunds
- blacklist enforcement events
- appeal/arbitration status changes

Logs must include:
- actor
- timestamp
- action type
- target entity id

---

## 3.5 Rate limiting rules (High if missing)
Rate limiting must exist for:
- ingestion endpoints
- file upload endpoints
- authentication endpoints

Rate limits must be configurable.

---

# 4) Core Business Rules (Prompt Requirements)

## 4.1 Home feed rules (Blocker if missing)
Feed must:
- combine training activity + course updates + ingested news
- dedupe similar items seen in last 7 days
- support "Not Interested", "Block Author", "Block Tag"
- apply blocks server-side and persist them
- provide cold-start recommendations based on selected sports and first-week browsing

UI must show immediate feedback + toast confirmation.

---

## 4.2 Activity tracking rules (Blocker if missing)
Activities must support:
- type: running/cycling/walking
- duration, distance (miles), calories, heart rate, pace
- tags, notes
- location (free text OR saved places)
- saved places list management
- GPX import (store coordinate list)

No maps allowed.

---

## 4.3 Review system rules (Blocker if missing)
Reviews must:
- be tied to a completed course/order
- allow rating 1–5 + text
- allow up to 5 images (PNG/JPEG only, max 5MB each)
- allow one follow-up review within 30 days
- support threaded replies by Coach/Support Agent
- allow anonymous vs real-name display
- have configurable dimensions controlled by Admin

---

## 4.4 Appeals and arbitration rules (Blocker if missing)
Appeal button must:
- be visible for 7 days after review posted
- create arbitration timeline + status messages
- enforce display rules hiding content under arbitration when required

---

## 4.5 Governance rules (Blocker if missing)
Server-side enforcement must include:
- sensitive-word dictionary filtering
- image validation (format + size)
- hash-based deny list for images

Anti-fake-review rules:
- one review per order
- max 2 reviews per day per user
- device fingerprint risk flagging for shared devices

High-risk user tagging:
- after 3 upheld violations
Blacklist:
- restrict reviewing for 30 days

---

# 5) Payment Ledger Rules (WeChat Pay Offline)

## 5.1 Offline reconciliation import (Blocker if missing)
Payments must be recorded only via:
- batch-imported reconciliation files

Imported payment results must:
- verify locally stored signatures

---

## 5.2 Ledger integrity rules (Blocker if violated)
Ledger must be immutable:
- never update/delete ledger entries
- corrections must be reversal entries

Refunds:
- full refunds and partial refunds supported
- minimum refund amount: $0.01

Unpaid orders:
- auto-cancel after 30 minutes

---

## 5.3 Consistency rules (Blocker if missing)
Payment and refund endpoints must enforce:
- idempotency keys
- retry/compensation jobs
- MySQL queue table backing jobs

Queue table must be documented.

---

# 6) News Ingestion Rules

## 6.1 File-based ingestion only (Blocker if violated)
News ingestion must:
- process locally mirrored RSS/API payload files
- process HTML crawl-rule extracts dropped into monitored folders

Allow/block lists must exist.

---

## 6.2 Ingestion safety rules (High if missing)
- rate limit ingestion endpoints
- retry failed ingestion jobs 3 times
- immutable ingestion logs for auditing

Ingestion logs must never be edited, only appended.

---

# 7) Analytics and Back Office Rules

## 7.1 Required analytics features (High if missing)
Offline back office must include:
- enrollment funnel
- course popularity
- renewal/refund rates
- channel performance
- instructor utilization
- location revenue/cost reporting
- filters
- CSV export

CSV export must:
- enforce RBAC
- log access

---

# 8) API Design Rules

## 8.1 REST + consistent response format
All APIs must be REST-style.
All responses must follow:

Success:
{
  "success": true,
  "data": ...
}

Error:
{
  "success": false,
  "error": {
    "code": "...",
    "message": "...",
    "details": {...}
  }
}

---

## 8.2 Validation rules (High if missing)
All request bodies must be validated.
All IDs must be validated.
Pagination/filter inputs must be validated.

File uploads must validate:
- count limits
- type limits
- size limits

---

# 9) Database and Schema Rules

## 9.1 Schema must be statically verifiable (Blocker if missing)
Must include:
- migrations or schema.sql
- models matching schema

Minimum required tables (or equivalent):
- users
- roles
- sessions/tokens
- follow_graph
- activities
- saved_places
- orders
- reviews
- review_images
- review_replies
- review_dimensions
- appeals
- arbitration_timeline
- sensitive_words
- image_hash_denylist
- device_fingerprints
- risk_tags
- blacklists
- payment_ledger
- reconciliation_imports
- refund_records
- ingestion_sources
- ingestion_jobs
- ingestion_logs
- analytics_snapshots
- queue_jobs
- export_logs
- audit_logs

---

# 10) Testing Rules (Static Review Must See Evidence)

## 10.1 Mandatory tests (Blocker if missing)
At minimum, tests must cover:
- login and bcrypt password verification
- RBAC enforcement (401/403 cases)
- review creation constraints (1 per order, max 2/day)
- follow-up review within 30 days
- appeal window 7 days
- arbitration hide rules
- sensitive-word filtering
- image upload validation
- device fingerprint risk tagging
- 3 violations => high-risk tag
- blacklist restriction for 30 days
- payment import signature verification logic
- idempotency behavior
- partial refund minimum $0.01
- unpaid auto-cancel after 30 minutes
- ingestion retry logic (3 retries)
- immutable ingestion logs

---

# 11) Logging Rules

## 11.1 Log categories required
Logging must exist for:
- auth attempts
- review creation and disputes
- blacklist events
- payment import and refund processing
- ingestion job results
- export events

---

## 11.2 Sensitive logging policy (Blocker if violated)
Never log:
- passwords
- session tokens
- encryption keys
- raw reconciliation files
- personal sensitive fields (unless masked)

---

# 12) Final Developer Checklist Before Submission

Before delivery, confirm:
- README is complete
- migrations exist
- RBAC is implemented and documented
- sensitive fields encrypted at rest
- review governance rules enforced server-side
- payment ledger is immutable
- idempotency keys implemented
- queue jobs exist for retries/compensation
- ingestion is file-based with retries and immutable logs
- analytics dashboards + CSV export exist with access logging
- tests exist for core security + business constraints

If any are missing, document explicitly under "Manual Verification Required".