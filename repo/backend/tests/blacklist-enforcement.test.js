const { pool } = require("../src/db/pool");
const { ensureUserNotBlacklisted } = require("../src/modules/reviews/moderation.service");

describe("Blacklist enforcement", () => {
  beforeEach(() => {
    pool.query = vi.fn();
  });

  test("allows user when no active blacklist", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(ensureUserNotBlacklisted(1)).resolves.toBeUndefined();
  });

  test("blocks user when active blacklist exists", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10 }]]);
    await expect(ensureUserNotBlacklisted(1)).rejects.toThrow(/temporarily blocked/i);
  });
});
