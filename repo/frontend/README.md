# Frontend (TrailForge)

This frontend is a Vue 3 + Vite app with route-level auth/RBAC, business flows (feed, reviews, orders, activities), and offline-friendly behavior.

## Commands

```bash
npm install
npm run dev
npm run test
npm run build
npm run preview
npm run e2e
```

## Test Strategy

- Unit/API tests validate shared request behavior (including 401/403 error propagation).
- Route guard tests validate auth/guest/RBAC navigation policy in `src/router.js`.
- Page integration tests cover critical success and failure paths:
  - feed optimistic action + rollback + duplicate-click protection,
  - review create + image validation edges + follow-up/appeal flow protections,
  - orders refund/complete success and error handling.
- Existing app-shell test remains as a baseline smoke check.
- Playwright E2E covers auth route-guard and a core feed action journey.

## Offline Strategy

Offline behavior is intentionally simple and bounded:

1. **Service Worker (`public/sw.js`)**
   - App shell cache for offline reload (`/`, `/index.html`).
   - Runtime cache for same-origin static assets.
   - Authenticated/private API responses are not cached in the service worker.

2. **Client persistence (`src/offline/persistence.js`)**
   - Stores last feed snapshot and feed preferences in `localStorage`.
   - Feed page falls back to cached data when network requests fail.
   - Cached-mode indicator is shown in the feed UI.

3. **Offline mutation UX (`src/offline/mutation-intents.js`)**
   - Failed offline mutation attempts create local retry intents.
   - UI shows pending retry count and clear action.
   - User gets explicit retry messaging (no silent failure).

4. **Account-switch isolation (`src/offline/private-data.js`)**
   - Logout and user/session transitions clear persisted private offline state.
   - Service worker receives a private-cache clear message to purge legacy private API cache buckets.

## Verification Boundaries

- Backend authorization/business rules are still backend-owned and must be verified against a running backend.
- Offline mutation intents are not auto-replayed; users retry manually after reconnecting.
- Binary upload durability for offline review image uploads is not persisted across full browser restarts.
- E2E tests mock API responses at browser level; backend data integrity remains backend-suite responsibility.

Use the commands above for reproducible local unit, build, and E2E checks.
