const { requestRefund } = require("../src/modules/payments/refunds.service");

describe("refunds.service authorization", () => {
  test("rejects non-privileged roles before refund processing", async () => {
    await expect(
      requestRefund({
        orderId: 10,
        actorUserId: 99,
        actorRoles: ["user"],
        amountDollars: 1,
        reason: "not allowed",
        idempotencyKey: "refund-test-1"
      })
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
