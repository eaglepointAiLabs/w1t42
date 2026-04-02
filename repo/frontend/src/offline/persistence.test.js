import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFeedPersistence,
  loadFeedPreferencesSnapshot,
  loadFeedSnapshot,
  saveFeedPreferencesSnapshot,
  saveFeedSnapshot
} from "./persistence";

describe("offline persistence isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("scopes feed snapshots by user id", () => {
    saveFeedSnapshot(100, [{ id: 1, title: "user-100-item" }]);

    expect(loadFeedSnapshot(100)?.data).toEqual([{ id: 1, title: "user-100-item" }]);
    expect(loadFeedSnapshot(200)).toBeNull();
  });

  it("clears persisted feed/private snapshot state", () => {
    saveFeedSnapshot(100, [{ id: 1 }]);
    saveFeedPreferencesSnapshot(100, { preferredSports: ["running"] });

    clearFeedPersistence();

    expect(loadFeedSnapshot(100)).toBeNull();
    expect(loadFeedPreferencesSnapshot(100)).toBeNull();
  });
});
