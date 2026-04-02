import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import OrdersPage from "./OrdersPage.vue";

const { pushToast, api } = vi.hoisted(() => ({
  pushToast: vi.fn(),
  api: {
    listOrders: vi.fn(),
    getOrderPaymentStatus: vi.fn(),
    requestRefund: vi.fn(),
    completeOrder: vi.fn()
  }
}));

vi.mock("../api", () => api);

vi.mock("../toast", () => ({
  useToast: () => ({ pushToast })
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

const orderFixture = {
  id: 501,
  course_service_title: "Endurance Pack",
  order_status: "paid",
  order_type: "course",
  total_amount_cents: 2000,
  paid_amount_cents: 2000,
  refunded_amount_cents: 0
};

describe("OrdersPage critical flow", () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.listOrders.mockReset();
    api.getOrderPaymentStatus.mockReset();
    api.requestRefund.mockReset();
    api.completeOrder.mockReset();

    api.listOrders.mockResolvedValue({ data: [orderFixture] });
    api.getOrderPaymentStatus.mockResolvedValue({ data: { orderStatus: "paid" } });
    api.completeOrder.mockResolvedValue({ data: {} });
  });

  it("shows refund error messaging and handles complete success", async () => {
    const forbidden = new Error("Insufficient role permissions");
    forbidden.status = 403;
    api.requestRefund.mockRejectedValueOnce(forbidden);

    const wrapper = mount(OrdersPage);
    await flush();

    const refundButton = wrapper.findAll("button").find((button) => button.text() === "Refund");
    const completeButton = wrapper.findAll("button").find((button) => button.text() === "Complete");
    expect(refundButton).toBeTruthy();
    expect(completeButton).toBeTruthy();

    await refundButton.trigger("click");
    await flush();
    expect(pushToast).toHaveBeenCalledWith("Insufficient role permissions", "error");

    await completeButton.trigger("click");
    await flush();
    expect(api.completeOrder).toHaveBeenCalledWith(501);
    expect(pushToast).toHaveBeenCalledWith("Order marked completed", "success");
  });

  it("prevents duplicate-click refund submissions while pending", async () => {
    const pendingRefund = deferred();
    api.requestRefund.mockReturnValue(pendingRefund.promise);

    const wrapper = mount(OrdersPage);
    await flush();

    const refundButton = wrapper.findAll("button").find((button) => button.text() === "Refund");
    expect(refundButton).toBeTruthy();

    refundButton.trigger("click");
    refundButton.trigger("click");
    await flush();

    expect(api.requestRefund).toHaveBeenCalledTimes(1);

    pendingRefund.resolve({ data: {} });
    await flush();
  });
});
