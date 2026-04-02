const { pool } = require("../src/db/pool");

const riskServicePath = require.resolve("../src/modules/reviews/risk.service");
const mockedHandleUpheldViolation = vi.fn();
const mockedRefreshGovernanceAnalyticsSnapshot = vi.fn();

require.cache[riskServicePath] = {
  id: riskServicePath,
  filename: riskServicePath,
  loaded: true,
  exports: {
    handleUpheldViolation: mockedHandleUpheldViolation,
    refreshGovernanceAnalyticsSnapshot: mockedRefreshGovernanceAnalyticsSnapshot
  }
};

const { updateAppealStatus, reviewStateFromAppealStatus } = require("../src/modules/reviews/reviews.appeals.service");

describe("reviews.appeals.service", () => {
  beforeEach(() => {
    mockedHandleUpheldViolation.mockReset();
    mockedHandleUpheldViolation.mockResolvedValue({ escalated: true });
    mockedRefreshGovernanceAnalyticsSnapshot.mockReset();
    mockedRefreshGovernanceAnalyticsSnapshot.mockResolvedValue(undefined);

    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
      query: vi.fn()
    };

    pool.getConnection = vi.fn().mockResolvedValue(connection);
    pool.query = vi.fn();
  });

  afterAll(() => {
    delete require.cache[riskServicePath];
    delete require.cache[require.resolve("../src/modules/reviews/reviews.appeals.service")];
  });

  test("transitions appeal to under_review and keeps review under arbitration", async () => {
    const connection = await pool.getConnection();
    connection.query.mockImplementation(async (sql) => {
      if (sql.includes("SELECT * FROM appeals WHERE id = ? LIMIT 1 FOR UPDATE")) {
        return [[{ id: 8, review_id: 44 }]];
      }
      return [{}];
    });

    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("SELECT * FROM appeals WHERE id = ? LIMIT 1")) {
        return [[{ id: 8, appeal_status: "under_review" }]];
      }
      if (sql.includes("INSERT INTO audit_events")) {
        return [{}];
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    });

    const result = await updateAppealStatus({ actorUserId: 2, appealId: 8, appealStatus: "under_review", note: null, requestId: "req-1" });

    expect(result.appeal_status).toBe("under_review");
    expect(connection.query).toHaveBeenCalledWith("UPDATE reviews SET review_state = ? WHERE id = ?", ["under_arbitration", 44]);
    expect(mockedHandleUpheldViolation).not.toHaveBeenCalled();
  });

  test("transitions appeal to upheld and triggers risk escalation hook", async () => {
    const connection = await pool.getConnection();
    connection.query.mockImplementation(async (sql) => {
      if (sql.includes("SELECT * FROM appeals WHERE id = ? LIMIT 1 FOR UPDATE")) {
        return [[{ id: 9, review_id: 77 }]];
      }
      return [{}];
    });

    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("SELECT user_id FROM reviews WHERE id = ? LIMIT 1")) {
        return [[{ user_id: 99 }]];
      }
      if (sql.includes("SELECT * FROM appeals WHERE id = ? LIMIT 1")) {
        return [[{ id: 9, appeal_status: "upheld" }]];
      }
      if (sql.includes("INSERT INTO audit_events")) {
        return [{}];
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    });

    const result = await updateAppealStatus({ actorUserId: 2, appealId: 9, appealStatus: "upheld", note: "confirmed", requestId: "req-2" });

    expect(result.appeal_status).toBe("upheld");
    expect(connection.query).toHaveBeenCalledWith("UPDATE reviews SET review_state = ? WHERE id = ?", ["hidden", 77]);
    expect(mockedHandleUpheldViolation).toHaveBeenCalledWith(99);
  });

  test("maps appeal statuses to review states", () => {
    expect(reviewStateFromAppealStatus("under_review")).toBe("under_arbitration");
    expect(reviewStateFromAppealStatus("upheld")).toBe("hidden");
    expect(reviewStateFromAppealStatus("rejected")).toBe("published");
  });
});
