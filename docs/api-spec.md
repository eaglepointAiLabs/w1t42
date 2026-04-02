# TrailForge API Specification

## 1. Scope

This specification documents the currently implemented backend API in `backend` (Koa).  
Base URL (local): `http://localhost:3000`

## 2. Conventions

### 2.1 Response Envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": null,
    "requestId": "trace-id"
  }
}
```

### 2.2 Authentication

- Session cookie auth (`httpOnly` signed cookie).
- Login endpoint sets the session cookie.
- Protected routes require an authenticated session.

### 2.3 Roles

- `user` (regular user)
- `coach`
- `support`
- `admin`

## 3. Health and Utility

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/health` | No | Any | Service health status |
| `GET` | `/api` | No | Any | API online message |

## 4. Authentication and User Identity

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `POST` | `/api/v1/auth/register` | No | Any | Register local account |
| `POST` | `/api/v1/auth/login` | No | Any | Login, issues session cookie |
| `POST` | `/api/v1/auth/logout` | Yes | Any | Revoke current session |
| `GET` | `/api/v1/auth/me` | Yes | Any | Current user + profile + roles + subscriber status |
| `GET` | `/api/v1/users/me` | Yes | Any | Lightweight current user identity |

## 5. Catalog, Orders, and Payments

### 5.1 Catalog

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/catalog` | No | Any | List course/service catalog entries |

### 5.2 Orders

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `POST` | `/api/v1/orders` | Yes | Any | Create order |
| `GET` | `/api/v1/orders` | Yes | Any | List orders visible to current user |
| `GET` | `/api/v1/orders/:id` | Yes | Any | Get order detail with role-aware access |
| `GET` | `/api/v1/orders/:id/payment-status` | Yes | Any | Payment/refund status snapshot |
| `POST` | `/api/v1/orders/:id/complete` | Yes | `coach/support/admin` | Mark order completed |

### 5.3 Payments and Refunds

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `POST` | `/api/v1/payments/imports` | Yes | `admin/support` | Submit reconciliation import payload |
| `GET` | `/api/v1/payments/imports/:importId` | Yes | `admin/support` | Inspect import status/result |
| `POST` | `/api/v1/payments/orders/:id/refunds` | Yes | `admin/support` | Create refund request (idempotency-aware input) |

## 6. Feed and Follow Graph

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/feed` | Yes | Any | List personalized feed items |
| `POST` | `/api/v1/feed/actions` | Yes | Any | Submit feed action (`clicked`, `not_interested`, `block_author`, `block_tag`) |
| `GET` | `/api/v1/feed/preferences` | Yes | Any | Get feed preferences |
| `PUT` | `/api/v1/feed/preferences` | Yes | Any | Update preferred sports/content preferences |
| `GET` | `/api/v1/follows/mine` | Yes | Any | List followed users |
| `POST` | `/api/v1/follows/:userId` | Yes | Any | Follow user |
| `DELETE` | `/api/v1/follows/:userId` | Yes | Any | Unfollow user |

## 7. Activities, Places, and GPX

### 7.1 Places

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/places` | Yes | Any | List saved places |
| `POST` | `/api/v1/places` | Yes | Any | Create saved place |
| `PATCH` | `/api/v1/places/:placeId` | Yes | Any | Update place |
| `DELETE` | `/api/v1/places/:placeId` | Yes | Any | Delete place |

### 7.2 Activities

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/activities` | Yes | Any | List activities |
| `POST` | `/api/v1/activities` | Yes | Any | Create activity |
| `GET` | `/api/v1/activities/:activityId` | Yes | Any | Get activity detail |
| `PATCH` | `/api/v1/activities/:activityId` | Yes | Any | Update activity |
| `DELETE` | `/api/v1/activities/:activityId` | Yes | Any | Delete activity |
| `POST` | `/api/v1/activities/:activityId/gpx` | Yes | Any | Upload GPX payload |
| `GET` | `/api/v1/activities/:activityId/coordinates` | Yes | Any | Get parsed coordinate list |

## 8. Reviews, Appeals, and Moderation

### 8.1 User Review APIs

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/reviews/mine` | Yes | Any | List current user reviews |
| `POST` | `/api/v1/reviews` | Yes | Any | Create review (completed order only, policy checked) |
| `POST` | `/api/v1/reviews/:id/follow-up` | Yes | Any | Create follow-up review (window-limited) |
| `GET` | `/api/v1/reviews/:id` | Yes | Owner or `coach/support/admin` | Get review detail (state-aware visibility + object-level authorization) |
| `POST` | `/api/v1/reviews/:id/images` | Yes | Any | Upload review image (PNG/JPEG, size/hash constraints) |
| `GET` | `/api/v1/reviews/images/:imageId` | Yes | Any | Fetch review image if visible |
| `POST` | `/api/v1/reviews/:id/appeals` | Yes | Any | Submit appeal (window-limited) |

### 8.2 Staff Review APIs

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/staff/reviews/appeals` | Yes | `coach/support/admin` | List appeals by optional status |
| `POST` | `/api/v1/staff/reviews/replies` | Yes | `coach/support/admin` | Post staff reply to review thread |
| `PATCH` | `/api/v1/staff/reviews/appeals/:appealId` | Yes | `coach/support/admin` | Update appeal status |

### 8.3 Admin Review Governance APIs

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/admin/review-governance/dimensions` | Yes | `admin` | List review dimensions |
| `POST` | `/api/v1/admin/review-governance/dimensions` | Yes | `admin` | Create/upsert review dimension |
| `PATCH` | `/api/v1/admin/review-governance/dimensions/:id` | Yes | `admin` | Update review dimension |
| `GET` | `/api/v1/admin/review-governance/sensitive-words` | Yes | `admin` | List sensitive words |
| `POST` | `/api/v1/admin/review-governance/sensitive-words` | Yes | `admin` | Add/activate sensitive word |
| `DELETE` | `/api/v1/admin/review-governance/sensitive-words/:id` | Yes | `admin` | Deactivate sensitive word |
| `GET` | `/api/v1/admin/review-governance/denylist-hashes` | Yes | `admin` | List image hash denylist |
| `POST` | `/api/v1/admin/review-governance/denylist-hashes` | Yes | `admin` | Add hash denylist entry |
| `DELETE` | `/api/v1/admin/review-governance/denylist-hashes/:id` | Yes | `admin` | Remove hash denylist entry |
| `GET` | `/api/v1/admin/review-governance/blacklist` | Yes | `admin` | List review blacklist entries |
| `POST` | `/api/v1/admin/review-governance/blacklist` | Yes | `admin` | Add review blacklist entry |
| `DELETE` | `/api/v1/admin/review-governance/blacklist/:id` | Yes | `admin` | Deactivate blacklist entry |

## 9. Ingestion Operations (Admin)

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/admin/ingestion/sources` | Yes | `admin` | List configured ingestion sources |
| `POST` | `/api/v1/admin/ingestion/sources` | Yes | `admin` | Create ingestion source |
| `PATCH` | `/api/v1/admin/ingestion/sources/:id` | Yes | `admin` | Update ingestion source |
| `POST` | `/api/v1/admin/ingestion/scan` | Yes | `admin` | Queue ingestion scan job |
| `GET` | `/api/v1/admin/ingestion/logs` | Yes | `admin` | List ingestion logs |

## 10. Analytics and Exports

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/admin/analytics/dashboard` | Yes | `admin/support` | Aggregated analytics dashboard |
| `GET` | `/api/v1/admin/analytics/report` | Yes | `admin/support` | Single report payload by report type |
| `POST` | `/api/v1/admin/analytics/export` | Yes | `admin/support` | CSV export (returns `text/csv`) |
| `GET` | `/api/v1/admin/analytics/export-logs` | Yes | `admin/support` | Export access logs |

Supported report families include: `enrollment_funnel`, `course_popularity`, `renewal_rates`, `refund_rates`, `channel_performance`, `instructor_utilization`, `location_revenue_cost`.

## 11. Admin Operational Helper

| Method | Path | Auth | Roles | Description |
| :---- | :---- | :---- | :---- | :---- |
| `GET` | `/api/v1/admin/test` | Yes | `admin` | Simple admin access verification endpoint |
| `POST` | `/api/v1/admin/jobs/process-once` | Yes | `admin` | Trigger one queue processing cycle |

## 12. Representative Request Examples

### Login

`POST /api/v1/auth/login`

```json
{
  "username": "admin",
  "password": "admin12345"
}
```

### Create Activity

`POST /api/v1/activities`

```json
{
  "activityType": "running",
  "durationSeconds": 2700,
  "distanceMiles": 5.2,
  "calories": 420,
  "avgHeartRate": 148,
  "paceSecondsPerMile": 519,
  "tags": ["tempo", "outdoor"],
  "notes": "Evening run",
  "locationText": "Riverside Trail"
}
```

### Submit Review Appeal

`POST /api/v1/reviews/12/appeals`

```json
{
  "reason": "This review needs reconsideration due to context."
}
```

### Export Analytics CSV

`POST /api/v1/admin/analytics/export`

```json
{
  "report": "enrollment_funnel",
  "filters": {
    "fromDate": "2026-01-01",
    "toDate": "2026-03-01"
  }
}
```

## 13. Notes

- Validation errors return `VALIDATION_ERROR` with schema details.
- Unauthorized/forbidden access returns `401`/`403` depending on auth vs role.
- Some operations include additional business-policy checks (review caps/windows, blacklist, arbitration visibility, refund authorization).
