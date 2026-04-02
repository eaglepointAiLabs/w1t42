import { clearOfflineIntents } from "./mutation-intents";
import { clearFeedPersistence } from "./persistence";

export const CLEAR_PRIVATE_CACHES_MESSAGE = "TRAILFORGE_CLEAR_PRIVATE_CACHES";

export function notifyServiceWorkerToClearPrivateCaches() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
    return;
  }

  try {
    navigator.serviceWorker.controller.postMessage({
      type: CLEAR_PRIVATE_CACHES_MESSAGE
    });
  } catch {
  }
}

export function clearPrivateClientState() {
  clearFeedPersistence();
  clearOfflineIntents();
  notifyServiceWorkerToClearPrivateCaches();
}
