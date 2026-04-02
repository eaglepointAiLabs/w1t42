const FEED_SNAPSHOT_KEY = "trailforge:feed:snapshot";
const FEED_PREFERENCES_KEY = "trailforge:feed:preferences";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson(key) {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

function snapshotPayload(data, userId) {
  return {
    data,
    userId: Number(userId || 0),
    savedAt: new Date().toISOString()
  };
}

export function saveFeedSnapshot(userId, items) {
  writeJson(FEED_SNAPSHOT_KEY, snapshotPayload(Array.isArray(items) ? items : [], userId));
}

export function loadFeedSnapshot(userId) {
  const payload = readJson(FEED_SNAPSHOT_KEY);
  if (!payload || Number(payload.userId || 0) !== Number(userId || 0)) {
    return null;
  }
  return payload;
}

export function saveFeedPreferencesSnapshot(userId, preferences) {
  if (!preferences || typeof preferences !== "object") {
    return;
  }
  writeJson(FEED_PREFERENCES_KEY, snapshotPayload(preferences, userId));
}

export function loadFeedPreferencesSnapshot(userId) {
  const payload = readJson(FEED_PREFERENCES_KEY);
  if (!payload || Number(payload.userId || 0) !== Number(userId || 0)) {
    return null;
  }
  return payload;
}

export function clearFeedPersistence() {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(FEED_SNAPSHOT_KEY);
    window.localStorage.removeItem(FEED_PREFERENCES_KEY);
  } catch {
  }
}
