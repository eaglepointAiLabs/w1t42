const OFFLINE_INTENTS_KEY = "trailforge:offline:intents";
const MAX_INTENTS = 30;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readIntents() {
  if (!canUseStorage()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(OFFLINE_INTENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIntents(intents) {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(OFFLINE_INTENTS_KEY, JSON.stringify(intents.slice(-MAX_INTENTS)));
  } catch {
  }
}

export function isLikelyOfflineError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return message.includes("failed to fetch") || message.includes("networkerror") || message.includes("network error");
}

export function recordOfflineIntent(action, context = {}) {
  const intents = readIntents();
  intents.push({
    id: `${Date.now()}-${Math.random()}`,
    action,
    context,
    createdAt: new Date().toISOString()
  });
  writeIntents(intents);
  return intents.length;
}

export function getOfflineIntentCount() {
  return readIntents().length;
}

export function clearOfflineIntents() {
  writeIntents([]);
}

export function buildOfflineRetryMessage(actionLabel) {
  return `${actionLabel} was not sent while offline. Reconnect and retry.`;
}
