const { canAppeal, canCreateFollowup, shouldEscalateHighRisk } = require("../src/modules/reviews/review.rules");

describe("Review rules", () => {
  test("appeal window valid within 7 days", () => {
    const publishedAt = new Date("2026-03-01T00:00:00Z");
    const now = new Date("2026-03-07T23:00:00Z");
    expect(canAppeal(publishedAt, now)).toBe(true);
  });

  test("appeal window expires after 7 days", () => {
    const publishedAt = new Date("2026-03-01T00:00:00Z");
    const now = new Date("2026-03-09T00:00:01Z");
    expect(canAppeal(publishedAt, now)).toBe(false);
  });

  test("follow-up window valid within 30 days", () => {
    const publishedAt = new Date("2026-03-01T00:00:00Z");
    const now = new Date("2026-03-30T23:00:00Z");
    expect(canCreateFollowup(publishedAt, now)).toBe(true);
  });

  test("high-risk escalation after 3 upheld violations", () => {
    expect(shouldEscalateHighRisk(2)).toBe(false);
    expect(shouldEscalateHighRisk(3)).toBe(true);
  });
});
