const { pool } = require("../src/db/pool");

const followsServicePath = require.resolve("../src/modules/follows/follows.service");
const mockedListFollowedAuthorIds = vi.fn();

require.cache[followsServicePath] = {
  id: followsServicePath,
  filename: followsServicePath,
  loaded: true,
  exports: { listFollowedAuthorIds: mockedListFollowedAuthorIds }
};

const { getPersonalizedFeed } = require("../src/modules/feed/feed.service");

describe("Feed service dedupe behavior", () => {
  beforeEach(() => {
    mockedListFollowedAuthorIds.mockReset();
    mockedListFollowedAuthorIds.mockResolvedValue([]);

    pool.query = vi.fn(async (sql) => {
      if (sql.includes("FROM user_feed_preferences")) {
        return [[{
          user_id: 40,
          preferred_sports: "[]",
          blocked_tags: "[]",
          blocked_authors: "[]",
          include_training_updates: 1,
          include_course_updates: 0,
          include_news: 0
        }]];
      }
      if (sql.includes("SELECT created_at FROM users")) {
        return [[{ created_at: "2026-03-20T00:00:00.000Z" }]];
      }
      if (sql.includes("COUNT(*) AS total FROM feed_impression_history")) {
        return [[{ total: 0 }]];
      }
      if (sql.includes("AND h.action_taken = 'clicked'")) {
        return [[]];
      }
      if (sql.includes("SELECT similarity_key, content_item_id")) {
        return [[{ similarity_key: "activity:run:5.0:2026-03-30", content_item_id: null }]];
      }
      if (sql.includes("FROM activities a")) {
        return [[{
          id: 11,
          user_id: 222,
          activity_type: "run",
          distance_miles: 5,
          duration_seconds: 1234,
          notes: "sample",
          created_at: "2026-03-30T08:00:00.000Z",
          username: "runner"
        }]];
      }
      if (sql.includes("INSERT INTO feed_impression_history")) {
        return [{}];
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    });
  });

  afterAll(() => {
    delete require.cache[followsServicePath];
    delete require.cache[require.resolve("../src/modules/feed/feed.service")];
  });

  test("shown signal from the last 7 days excludes item", async () => {
    const items = await getPersonalizedFeed({ userId: 40, limit: 10 });
    expect(items).toEqual([]);

    const exclusionQueryCall = pool.query.mock.calls.find((call) => String(call[0]).includes("SELECT similarity_key, content_item_id"));
    expect(exclusionQueryCall).toBeTruthy();
    expect(String(exclusionQueryCall[0])).not.toContain("action_taken IN");
  });
});
