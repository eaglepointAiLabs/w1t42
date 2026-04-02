const { ORDER_STATES, canTransition } = require("../src/modules/orders/order.state-machine");

describe("Order state machine", () => {
  test("allows pending payment to paid", () => {
    expect(canTransition(ORDER_STATES.PENDING_PAYMENT, ORDER_STATES.PAID)).toBe(true);
  });

  test("blocks cancelled to paid", () => {
    expect(canTransition(ORDER_STATES.CANCELLED, ORDER_STATES.PAID)).toBe(false);
  });

  test("allows partial refund to full refund", () => {
    expect(canTransition(ORDER_STATES.REFUND_PARTIAL, ORDER_STATES.REFUND_FULL)).toBe(true);
  });
});
