const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.code = payload?.error?.code || "REQUEST_ERROR";
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function login({ username, password, deviceFingerprint }) {
  return apiRequest("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, deviceFingerprint })
  });
}

export function register(payload) {
  return apiRequest("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function logout() {
  return apiRequest("/api/v1/auth/logout", { method: "POST" });
}

export function getCurrentUser() {
  return apiRequest("/api/v1/auth/me");
}

export function listPlaces() {
  return apiRequest("/api/v1/places");
}

export function createPlace(payload) {
  return apiRequest("/api/v1/places", { method: "POST", body: JSON.stringify(payload) });
}

export function updatePlace(placeId, payload) {
  return apiRequest(`/api/v1/places/${placeId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deletePlace(placeId) {
  return apiRequest(`/api/v1/places/${placeId}`, { method: "DELETE" });
}

export function listActivities() {
  return apiRequest("/api/v1/activities");
}

export function getActivity(activityId) {
  return apiRequest(`/api/v1/activities/${activityId}`);
}

export function createActivity(payload) {
  return apiRequest("/api/v1/activities", { method: "POST", body: JSON.stringify(payload) });
}

export function updateActivity(activityId, payload) {
  return apiRequest(`/api/v1/activities/${activityId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function uploadActivityGpx(activityId, payload) {
  return apiRequest(`/api/v1/activities/${activityId}/gpx`, { method: "POST", body: JSON.stringify(payload) });
}

export function listActivityCoordinates(activityId) {
  return apiRequest(`/api/v1/activities/${activityId}/coordinates`);
}

export function listCatalog() {
  return apiRequest("/api/v1/catalog");
}

export function createOrder(payload) {
  return apiRequest("/api/v1/orders", { method: "POST", body: JSON.stringify(payload) });
}

export function listOrders() {
  return apiRequest("/api/v1/orders");
}

export function getOrderPaymentStatus(orderId) {
  return apiRequest(`/api/v1/orders/${orderId}/payment-status`);
}

export function requestRefund(orderId, payload) {
  return apiRequest(`/api/v1/payments/orders/${orderId}/refunds`, { method: "POST", body: JSON.stringify(payload) });
}

export function completeOrder(orderId) {
  return apiRequest(`/api/v1/orders/${orderId}/complete`, { method: "POST" });
}

export function listMyReviews() {
  return apiRequest("/api/v1/reviews/mine");
}

export function createReview(payload) {
  return apiRequest("/api/v1/reviews", { method: "POST", body: JSON.stringify(payload) });
}

export function addReviewFollowup(reviewId, payload) {
  return apiRequest(`/api/v1/reviews/${reviewId}/follow-up`, { method: "POST", body: JSON.stringify(payload) });
}

export function getReviewDetail(reviewId) {
  return apiRequest(`/api/v1/reviews/${reviewId}`);
}

export function createAppeal(reviewId, payload) {
  return apiRequest(`/api/v1/reviews/${reviewId}/appeals`, { method: "POST", body: JSON.stringify(payload) });
}

export function uploadReviewImage(reviewId, payload) {
  return apiRequest(`/api/v1/reviews/${reviewId}/images`, { method: "POST", body: JSON.stringify(payload) });
}

export function listStaffAppeals(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/api/v1/staff/reviews/appeals${query}`);
}

export function createStaffReply(payload) {
  return apiRequest("/api/v1/staff/reviews/replies", { method: "POST", body: JSON.stringify(payload) });
}

export function updateAppealStatus(appealId, payload) {
  return apiRequest(`/api/v1/staff/reviews/appeals/${appealId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function listReviewDimensions() {
  return apiRequest("/api/v1/admin/review-governance/dimensions");
}

export function upsertReviewDimension(payload) {
  return apiRequest("/api/v1/admin/review-governance/dimensions", { method: "POST", body: JSON.stringify(payload) });
}

export function listSensitiveWords() {
  return apiRequest("/api/v1/admin/review-governance/sensitive-words");
}

export function addSensitiveWord(word) {
  return apiRequest("/api/v1/admin/review-governance/sensitive-words", {
    method: "POST",
    body: JSON.stringify({ word })
  });
}

export function listDenylistHashes() {
  return apiRequest("/api/v1/admin/review-governance/denylist-hashes");
}

export function addDenylistHash(payload) {
  return apiRequest("/api/v1/admin/review-governance/denylist-hashes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listReviewBlacklist() {
  return apiRequest("/api/v1/admin/review-governance/blacklist");
}

export function addReviewBlacklist(payload) {
  return apiRequest("/api/v1/admin/review-governance/blacklist", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listIngestionSources() {
  return apiRequest("/api/v1/admin/ingestion/sources");
}

export function createIngestionSource(payload) {
  return apiRequest("/api/v1/admin/ingestion/sources", { method: "POST", body: JSON.stringify(payload) });
}

export function runIngestionScan() {
  return apiRequest("/api/v1/admin/ingestion/scan", { method: "POST" });
}

export function listIngestionLogs(limit = 100) {
  return apiRequest(`/api/v1/admin/ingestion/logs?limit=${limit}`);
}

export function runJobsProcessOnce() {
  return apiRequest("/api/v1/admin/jobs/process-once", { method: "POST" });
}

export function getAnalyticsDashboard(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/api/v1/admin/analytics/dashboard${suffix}`);
}

export function getAnalyticsReport(report, filters = {}) {
  const query = new URLSearchParams({ report });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  return apiRequest(`/api/v1/admin/analytics/report?${query.toString()}`);
}

export async function exportAnalyticsCsv(report, filters = {}) {
  const response = await fetch(`${API_BASE}/api/v1/admin/analytics/export`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ report, filters })
  });

  const text = await response.text();
  if (!response.ok) {
    try {
      const payload = JSON.parse(text);
      const error = new Error(payload?.error?.message || `HTTP ${response.status}`);
      error.code = payload?.error?.code || "REQUEST_ERROR";
      throw error;
    } catch {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  return text;
}

export function listAnalyticsExportLogs(limit = 200) {
  return apiRequest(`/api/v1/admin/analytics/export-logs?limit=${limit}`);
}

export function getFeed(limit = 20) {
  return apiRequest(`/api/v1/feed?limit=${limit}`);
}

export function getFeedPreferences() {
  return apiRequest("/api/v1/feed/preferences");
}

export function updateFeedPreferences(payload) {
  return apiRequest("/api/v1/feed/preferences", { method: "PUT", body: JSON.stringify(payload) });
}

export function sendFeedAction(payload) {
  return apiRequest("/api/v1/feed/actions", { method: "POST", body: JSON.stringify(payload) });
}

export function listMyFollows() {
  return apiRequest("/api/v1/follows/mine");
}

export function followUser(userId) {
  return apiRequest(`/api/v1/follows/${userId}`, { method: "POST" });
}

export function unfollowUser(userId) {
  return apiRequest(`/api/v1/follows/${userId}`, { method: "DELETE" });
}

export { API_BASE };
