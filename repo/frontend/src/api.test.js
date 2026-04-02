import { afterEach, describe, expect, it, vi } from "vitest";
import { listOrders, requestRefund } from "./api";

describe("api error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces API 401 errors with status and code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Authentication required", code: "UNAUTHORIZED" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(listOrders()).rejects.toMatchObject({
      message: "Authentication required",
      code: "UNAUTHORIZED",
      status: 401
    });
  });

  it("surfaces API 403 errors with status and code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Insufficient role permissions", code: "FORBIDDEN" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(requestRefund(10, { amountDollars: 0.01, reason: "x", idempotencyKey: "k" })).rejects.toMatchObject({
      message: "Insufficient role permissions",
      code: "FORBIDDEN",
      status: 403
    });
  });
});
