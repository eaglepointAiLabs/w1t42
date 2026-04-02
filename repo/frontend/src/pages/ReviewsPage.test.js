import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ReviewsPage from "./ReviewsPage.vue";

const { pushToast, api } = vi.hoisted(() => ({
  pushToast: vi.fn(),
  api: {
    API_BASE: "http://localhost:3000",
    listMyReviews: vi.fn(),
    addReviewFollowup: vi.fn(),
    createAppeal: vi.fn(),
    getReviewDetail: vi.fn()
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
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("ReviewsPage follow-up and appeal flows", () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.listMyReviews.mockReset();
    api.addReviewFollowup.mockReset();
    api.createAppeal.mockReset();
    api.getReviewDetail.mockReset();

    api.listMyReviews.mockResolvedValue({
      data: [
        {
          id: 45,
          order_id: 200,
          review_state: "published",
          rating: 5,
          review_text: "Very helpful",
          created_at: "2026-01-01T00:00:00.000Z"
        }
      ]
    });

    api.addReviewFollowup.mockResolvedValue({
      data: {
        id: 81,
        followup_text: "Adding extra context",
        created_at: "2026-01-01T00:00:00.000Z"
      }
    });

    api.getReviewDetail.mockResolvedValue({
      data: {
        displayName: "member",
        canAppeal: true,
        replies: [],
        appeal: { timeline: [] }
      }
    });

    api.createAppeal.mockResolvedValue({ data: { id: 901 } });
  });

  it("enforces follow-up text requirement and submits follow-up", async () => {
    const wrapper = mount(ReviewsPage, {
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" }
        }
      }
    });
    await flush();
    await flush();

    const addFollowup = wrapper.findAll("button").find((button) => button.text() === "Add Follow-up");
    expect(addFollowup).toBeTruthy();
    await addFollowup.trigger("click");

    const submitFollowup = wrapper.findAll("button").find((button) => button.text() === "Submit Follow-up");
    expect(submitFollowup).toBeTruthy();
    await submitFollowup.trigger("click");
    expect(pushToast).toHaveBeenCalledWith("Enter follow-up text before submitting", "error");

    await wrapper.find("textarea").setValue("I have more details now.");
    await submitFollowup.trigger("click");
    await flush();

    expect(api.addReviewFollowup).toHaveBeenCalledWith(45, { followupText: "I have more details now." });
    expect(pushToast).toHaveBeenCalledWith("Follow-up added", "success");
  });

  it("prevents duplicate appeal submissions while pending", async () => {
    const pendingAppeal = deferred();
    api.createAppeal.mockReturnValue(pendingAppeal.promise);
    const wrapper = mount(ReviewsPage, {
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" }
        }
      }
    });
    await flush();
    await flush();

    const appealButton = wrapper.findAll("button").find((button) => button.text() === "Appeal");
    expect(appealButton).toBeTruthy();
    expect(appealButton.attributes("disabled")).toBeUndefined();

    appealButton.trigger("click");
    appealButton.trigger("click");
    await flush();

    expect(api.createAppeal).toHaveBeenCalledTimes(1);

    pendingAppeal.resolve({ data: { id: 902 } });
    await flush();
  });

  it("disables appeal button when backend detail says appeal is ineligible", async () => {
    api.getReviewDetail.mockResolvedValueOnce({
      data: {
        displayName: "member",
        canAppeal: false,
        replies: [],
        appeal: { timeline: [] }
      }
    });

    const wrapper = mount(ReviewsPage, {
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" }
        }
      }
    });
    await flush();
    await flush();

    const appealButton = wrapper.findAll("button").find((button) => button.text() === "Appeal");
    expect(appealButton).toBeTruthy();
    expect(appealButton.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Appeal is not available for this review");
  });

  it("uses safe 7-day fallback when detail is unavailable", async () => {
    api.listMyReviews.mockResolvedValueOnce({
      data: [
        {
          id: 99,
          order_id: 201,
          review_state: "published",
          rating: 5,
          review_text: "Old review",
          created_at: "2024-01-01T00:00:00.000Z"
        }
      ]
    });
    api.getReviewDetail.mockRejectedValueOnce(new Error("detail unavailable"));

    const wrapper = mount(ReviewsPage, {
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" }
        }
      }
    });
    await flush();
    await flush();

    const appealButton = wrapper.findAll("button").find((button) => button.text() === "Appeal");
    expect(appealButton).toBeTruthy();
    expect(appealButton.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Appeal window has expired (7 days)");
  });
});
