import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ReviewCreatePage from "./ReviewCreatePage.vue";

const { pushToast, pushRoute, api } = vi.hoisted(() => ({
  pushToast: vi.fn(),
  pushRoute: vi.fn(),
  api: {
    createReview: vi.fn(),
    listOrders: vi.fn(),
    listReviewDimensions: vi.fn(),
    uploadReviewImage: vi.fn()
  }
}));

vi.mock("../api", () => api);

vi.mock("../toast", () => ({
  useToast: () => ({ pushToast })
}));

vi.mock("vue-router", async () => {
  const actual = await vi.importActual("vue-router");
  return {
    ...actual,
    useRouter: () => ({
      push: pushRoute
    })
  };
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("ReviewCreatePage critical flow", () => {
  beforeEach(() => {
    pushToast.mockReset();
    pushRoute.mockReset();
    api.createReview.mockReset();
    api.listOrders.mockReset();
    api.listReviewDimensions.mockReset();
    api.uploadReviewImage.mockReset();

    api.listOrders.mockResolvedValue({
      data: [
        { id: 77, order_status: "completed", course_service_title: "Trail Coaching" },
        { id: 88, order_status: "paid", course_service_title: "Ignored" }
      ]
    });
    api.createReview.mockResolvedValue({ data: { id: 501 } });
    api.listReviewDimensions.mockResolvedValue({
      data: [
        { id: 11, label: "Coaching", is_active: 1 },
        { id: 12, label: "Communication", is_active: 1 },
        { id: 13, label: "Inactive", is_active: 0 }
      ]
    });
    api.uploadReviewImage.mockResolvedValue({ data: {} });
  });

  it("loads dimensions and includes dimension scores in review payload", async () => {
    const wrapper = mount(ReviewCreatePage, {
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" }
        }
      }
    });
    await flush();
    await flush();

    const fileInput = wrapper.find('input[type="file"]');
    const tooManyFiles = Array.from({ length: 6 }, (_, index) => new File(["x"], `proof-${index}.png`, { type: "image/png" }));
    Object.defineProperty(fileInput.element, "files", { value: tooManyFiles, configurable: true });
    await fileInput.trigger("change");
    expect(wrapper.text()).toContain("Select up to 5 images.");

    const invalidFile = new File(["bad"], "invalid.gif", { type: "image/gif" });
    Object.defineProperty(fileInput.element, "files", { value: [invalidFile], configurable: true });
    await fileInput.trigger("change");
    expect(wrapper.text()).toContain("Only PNG/JPEG up to 5 MB are allowed.");

    await wrapper.find("select").setValue("77");
    await wrapper.find('[data-testid="dimension-score-11"]').setValue("4");
    await wrapper.find('[data-testid="dimension-score-12"]').setValue("5");
    await wrapper.find("textarea").setValue("Great course and clear coaching cues.");
    await wrapper.find("form").trigger("submit.prevent");
    await flush();

    expect(api.createReview).toHaveBeenCalledWith({
      orderId: 77,
      rating: 5,
      reviewText: "Great course and clear coaching cues.",
      anonymousDisplay: false,
      dimensionScores: [
        { dimensionConfigId: 11, score: 4 },
        { dimensionConfigId: 12, score: 5 }
      ]
    });
    expect(pushToast).toHaveBeenCalledWith("Review published", "success");
    expect(pushRoute).toHaveBeenCalledWith("/reviews");
  });

  it("validates dimension scores before submit", async () => {
    const wrapper = mount(ReviewCreatePage, {
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" }
        }
      }
    });
    await flush();
    await flush();

    await wrapper.find("select").setValue("77");
    await wrapper.find('[data-testid="dimension-score-11"]').setValue("3");
    await wrapper.find("textarea").setValue("Review text");
    await wrapper.find("form").trigger("submit.prevent");

    expect(api.createReview).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith("Provide a score from 1 to 5 for each review dimension", "error");
  });
});
