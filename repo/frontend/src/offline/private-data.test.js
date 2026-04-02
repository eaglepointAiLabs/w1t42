import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPrivateClientState, CLEAR_PRIVATE_CACHES_MESSAGE } from "./private-data";

describe("private data cleanup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("clears local private persistence and notifies service worker", () => {
    window.localStorage.setItem("trailforge:feed:snapshot", JSON.stringify({ data: [{ id: 1 }], userId: 1 }));
    window.localStorage.setItem("trailforge:feed:preferences", JSON.stringify({ data: { preferredSports: ["cycling"] }, userId: 1 }));
    window.localStorage.setItem("trailforge:offline:intents", JSON.stringify([{ id: "intent-1" }]));

    const postMessage = vi.fn();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          controller: {
            postMessage
          }
        }
      }
    });

    clearPrivateClientState();

    expect(window.localStorage.getItem("trailforge:feed:snapshot")).toBeNull();
    expect(window.localStorage.getItem("trailforge:feed:preferences")).toBeNull();
    expect(window.localStorage.getItem("trailforge:offline:intents")).toBe("[]");
    expect(postMessage).toHaveBeenCalledWith({ type: CLEAR_PRIVATE_CACHES_MESSAGE });
  });
});
