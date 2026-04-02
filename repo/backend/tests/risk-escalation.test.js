const { pool } = require("../src/db/pool");
const { handleUpheldViolation } = require("../src/modules/reviews/risk.service");

describe("Risk escalation", () => {
  beforeEach(() => {
    pool.query = vi.fn();
  });

  test("does not escalate before threshold", async () => {
    pool.query.mockResolvedValueOnce([[{ total: 2 }]]);
    const result = await handleUpheldViolation(1);
    expect(result.escalated).toBe(false);
  });

  test("escalates at threshold", async () => {
    pool.query.mockResolvedValueOnce([[{ total: 3 }]]);
    pool.query.mockResolvedValueOnce([{}]);
    pool.query.mockResolvedValueOnce([{}]);
    const result = await handleUpheldViolation(1);
    expect(result.escalated).toBe(true);
  });
});
