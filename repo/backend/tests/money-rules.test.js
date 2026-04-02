const { dollarsToCents, ensureRefundWithinBounds } = require("../src/modules/payments/money");

describe("Money rules", () => {
  test("converts dollars to cents", () => {
    expect(dollarsToCents(12.34)).toBe(1234);
  });

  test("supports minimum refund 0.01", () => {
    expect(() =>
      ensureRefundWithinBounds({
        requestedRefundCents: 1,
        paidCents: 100,
        alreadyRefundedCents: 0
      })
    ).not.toThrow();
  });

  test("rejects refund above remaining amount", () => {
    expect(() =>
      ensureRefundWithinBounds({
        requestedRefundCents: 101,
        paidCents: 100,
        alreadyRefundedCents: 0
      })
    ).toThrow();
  });
});
