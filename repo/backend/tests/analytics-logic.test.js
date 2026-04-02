const { pct, enrollmentFunnelMetrics, renewalRateMetrics, refundRateMetrics, toCsv } = require("../src/modules/analytics/analytics.logic");

describe("Analytics calculations", () => {
  test("computes enrollment funnel rates", () => {
    const rows = [
      { order_status: "pending_payment" },
      { order_status: "paid" },
      { order_status: "completed" },
      { order_status: "cancelled" }
    ];
    const metrics = enrollmentFunnelMetrics(rows);
    expect(metrics.counts.completed).toBe(1);
    expect(metrics.rates.paymentConversionRate).toBe(50);
  });

  test("handles zero denominator percentages safely", () => {
    expect(pct(4, 0)).toBe(0);
  });

  test("computes renewal rate", () => {
    const rows = [{ user_id: 1 }, { user_id: 1 }, { user_id: 2 }];
    const metrics = renewalRateMetrics(rows);
    expect(metrics.totalUsers).toBe(2);
    expect(metrics.renewedUsers).toBe(1);
    expect(metrics.renewalRate).toBe(50);
  });

  test("computes renewal rate with empty dataset", () => {
    const metrics = renewalRateMetrics([]);
    expect(metrics.totalUsers).toBe(0);
    expect(metrics.renewalRate).toBe(0);
  });

  test("computes refund rate", () => {
    const rows = [
      { order_status: "paid", refunded_amount_cents: 0 },
      { order_status: "completed", refunded_amount_cents: 100 },
      { order_status: "cancelled", refunded_amount_cents: 0 }
    ];
    const metrics = refundRateMetrics(rows);
    expect(metrics.refundableBase).toBe(2);
    expect(metrics.refunded).toBe(1);
    expect(metrics.refundRate).toBe(50);
  });

  test("does not count refunded cancelled orders in refund numerator", () => {
    const rows = [
      { order_status: "cancelled", refunded_amount_cents: 100 },
      { order_status: "paid", refunded_amount_cents: 0 }
    ];

    const metrics = refundRateMetrics(rows);
    expect(metrics.refundableBase).toBe(1);
    expect(metrics.refunded).toBe(0);
    expect(metrics.refundRate).toBe(0);
  });

  test("formats csv", () => {
    const csv = toCsv([{ a: 1, b: "x" }]);
    expect(csv).toContain("a,b");
    expect(csv).toContain('"1","x"');
  });

  test("escapes csv quotes and nulls", () => {
    const csv = toCsv([{ a: 'x"y', b: null }]);
    expect(csv).toContain('"x""y"');
    expect(csv).toContain('""');
  });
});
