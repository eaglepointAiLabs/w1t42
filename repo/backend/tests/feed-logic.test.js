const { scoreFeedCandidate, dedupeCandidates } = require("../src/modules/feed/feed.logic");

describe("Feed dedupe and ranking logic", () => {
  test("excludes previously shown item", () => {
    const items = [
      { id: 1, similarityKey: "k1" },
      { id: 2, similarityKey: "k2" },
      { id: 3, similarityKey: "k1" }
    ];

    const result = dedupeCandidates(items, { similarityKeys: new Set(["k1"]), contentItemIds: new Set() });
    expect(result.map((x) => x.id)).toEqual([2]);
  });

  test("excludes previously negatively acted item", () => {
    const items = [
      { id: 10, type: "news", similarityKey: "news:10" },
      { id: 11, type: "news", similarityKey: "news:11" }
    ];

    const result = dedupeCandidates(items, { similarityKeys: new Set(), contentItemIds: new Set([10]) });
    expect(result.map((x) => x.id)).toEqual([11]);
  });

  test("item outside 7-day window can reappear", () => {
    const items = [{ id: 1, similarityKey: "old" }, { id: 2, similarityKey: "new" }];
    const result = dedupeCandidates(items, { similarityKeys: new Set(), contentItemIds: new Set() });
    expect(result.map((x) => x.id)).toEqual([1, 2]);
  });

  test("mixed signal sources are all respected", () => {
    const items = [
      { id: 21, type: "news", similarityKey: "news:21" },
      { id: 22, type: "news", similarityKey: "news:22" },
      { id: 999, type: "activity", similarityKey: "activity:run:5.0:2026-01-01" }
    ];

    const result = dedupeCandidates(items, {
      similarityKeys: new Set(["activity:run:5.0:2026-01-01"]),
      contentItemIds: new Set([21])
    });

    expect(result.map((x) => x.id)).toEqual([22]);
  });

  test("scores preferred and cold-start candidates higher", () => {
    const now = new Date().toISOString();
    const preferred = {
      type: "news",
      tags: ["running"],
      publishedAt: now
    };
    const neutral = {
      type: "news",
      tags: ["other"],
      publishedAt: now
    };

    const preferredScore = scoreFeedCandidate(preferred, {
      preferredSports: ["running"],
      browsingSignals: ["running"],
      coldStart: true
    });
    const neutralScore = scoreFeedCandidate(neutral, {
      preferredSports: ["running"],
      browsingSignals: [],
      coldStart: true
    });

    expect(preferredScore).toBeGreaterThan(neutralScore);
  });

  test("boosts candidates from followed authors", () => {
    const now = new Date().toISOString();
    const followed = {
      type: "activity",
      tags: ["running"],
      publishedAt: now,
      authorUserId: 22
    };
    const notFollowed = {
      type: "activity",
      tags: ["running"],
      publishedAt: now,
      authorUserId: 23
    };

    const followedScore = scoreFeedCandidate(followed, {
      preferredSports: ["running"],
      browsingSignals: [],
      coldStart: false,
      followedAuthorIdsSet: new Set([22])
    });
    const otherScore = scoreFeedCandidate(notFollowed, {
      preferredSports: ["running"],
      browsingSignals: [],
      coldStart: false,
      followedAuthorIdsSet: new Set([22])
    });

    expect(followedScore).toBeGreaterThan(otherScore);
  });
});
