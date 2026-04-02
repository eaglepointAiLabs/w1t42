const { pool } = require("../src/db/pool");

const moderationServicePath = require.resolve("../src/modules/reviews/moderation.service");
const mockedEnsureUserNotBlacklisted = vi.fn();
const mockedCheckSensitiveWords = vi.fn();
const mockedEnforceDailyPublishCap = vi.fn();

require.cache[moderationServicePath] = {
  id: moderationServicePath,
  filename: moderationServicePath,
  loaded: true,
  exports: {
    ensureUserNotBlacklisted: mockedEnsureUserNotBlacklisted,
    checkSensitiveWords: mockedCheckSensitiveWords,
    enforceDailyPublishCap: mockedEnforceDailyPublishCap
  }
};

const { addFollowup } = require("../src/modules/reviews/reviews.followup.service");
const { addReply } = require("../src/modules/reviews/reviews.replies.service");

describe("review write edge cases", () => {
  beforeEach(() => {
    mockedEnsureUserNotBlacklisted.mockReset();
    mockedCheckSensitiveWords.mockReset();
    mockedEnforceDailyPublishCap.mockReset();
    mockedEnsureUserNotBlacklisted.mockResolvedValue(undefined);
    mockedCheckSensitiveWords.mockResolvedValue(undefined);
    mockedEnforceDailyPublishCap.mockResolvedValue(undefined);

    pool.query = vi.fn();
    pool.getConnection = vi.fn();
  });

  afterAll(() => {
    delete require.cache[moderationServicePath];
    delete require.cache[require.resolve("../src/modules/reviews/reviews.followup.service")];
    delete require.cache[require.resolve("../src/modules/reviews/reviews.replies.service")];
  });

  test("follow-up rejects expired window", async () => {
    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
      query: vi.fn()
    };
    pool.getConnection.mockResolvedValue(connection);

    connection.query.mockResolvedValueOnce([[{ id: 4, user_id: 5, published_at: "2000-01-01T00:00:00.000Z" }]]);

    await expect(addFollowup({ userId: 5, reviewId: 4, followupText: "late follow-up", requestId: "req-x" })).rejects.toMatchObject({
      status: 400,
      code: "FOLLOWUP_WINDOW_EXPIRED"
    });
  });

  test("follow-up rejects duplicate follow-up", async () => {
    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
      query: vi.fn()
    };
    pool.getConnection.mockResolvedValue(connection);

    connection.query.mockResolvedValueOnce([[{ id: 10, user_id: 5, published_at: new Date().toISOString() }]]).mockResolvedValueOnce([[{ id: 11 }]]);

    await expect(addFollowup({ userId: 5, reviewId: 10, followupText: "duplicate", requestId: "req-y" })).rejects.toMatchObject({
      status: 409,
      code: "FOLLOWUP_ALREADY_EXISTS"
    });
  });

  test("reply rejects invalid parent reply", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 12 }]]).mockResolvedValueOnce([[]]);

    await expect(
      addReply({
        actorUser: { id: 50, roles: ["user"] },
        reviewId: 12,
        parentReplyId: 777,
        replyText: "invalid parent",
        requestId: "req-z"
      })
    ).rejects.toMatchObject({ status: 400, code: "INVALID_PARENT_REPLY" });
  });

  test("reply resolves author role deterministically", async () => {
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("SELECT id FROM reviews")) {
        return [[{ id: 90 }]];
      }
      if (sql.includes("INSERT INTO review_replies")) {
        return [{ insertId: 500 }];
      }
      if (sql.includes("INSERT INTO audit_events")) {
        return [{}];
      }
      if (sql.includes("SELECT * FROM review_replies WHERE id = ? LIMIT 1")) {
        return [[{ id: 500, author_role: "coach" }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await addReply({
      actorUser: { id: 10, roles: ["admin", "coach"] },
      reviewId: 90,
      parentReplyId: null,
      replyText: "response",
      requestId: "req-role"
    });

    const insertCall = pool.query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO review_replies"));
    expect(insertCall[1][3]).toBe("coach");
    expect(result.author_role).toBe("coach");
  });
});
