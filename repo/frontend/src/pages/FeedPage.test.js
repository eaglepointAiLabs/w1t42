import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import FeedPage from "./FeedPage.vue";

const { pushToast, mockApi } = vi.hoisted(() => ({
  pushToast: vi.fn(),
  mockApi: {
    getFeed: vi.fn(),
    getFeedPreferences: vi.fn(),
    updateFeedPreferences: vi.fn(),
    sendFeedAction: vi.fn(),
    listMyFollows: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn()
  }
}));

vi.mock("../api", () => mockApi);

vi.mock("../toast", () => ({
  useToast: () => ({ pushToast })
}));

vi.mock("../session", () => ({
  useSession: () => ({
    state: {
      user: { id: 1 }
    }
  })
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
  await nextTick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await nextTick();
}

const feedItem = {
  id: 99,
  type: "news",
  title: "Weekly Trail Bulletin",
  summary: "Summary",
  score: 0.94,
  similarityKey: "sim-99",
  author: "Morgan",
  authorUserId: 2,
  tags: ["running"]
};

describe("FeedPage critical flow", () => {
  beforeEach(() => {
    pushToast.mockReset();
    mockApi.getFeed.mockReset();
    mockApi.getFeedPreferences.mockReset();
    mockApi.updateFeedPreferences.mockReset();
    mockApi.sendFeedAction.mockReset();
    mockApi.listMyFollows.mockReset();
    mockApi.followUser.mockReset();
    mockApi.unfollowUser.mockReset();

    mockApi.getFeedPreferences.mockResolvedValue({ data: { preferredSports: ["running"] } });
    mockApi.listMyFollows.mockResolvedValue({ data: [] });
    mockApi.getFeed.mockResolvedValue({ data: [feedItem] });
  });

  it("optimistically removes items and rolls back with error toast on failure", async () => {
    const pending = deferred();
    mockApi.sendFeedAction.mockReturnValueOnce(pending.promise);
    const wrapper = mount(FeedPage);
    await flush();
    await flush();
    expect(wrapper.text()).toContain("Weekly Trail Bulletin");

    const notInterested = wrapper.findAll("button").find((button) => button.text().includes("Not Interested"));
    expect(notInterested).toBeTruthy();

    await notInterested.trigger("click");
    expect(wrapper.text()).not.toContain("Weekly Trail Bulletin");

    pending.reject(new Error("Action failed"));
    await flush();

    expect(wrapper.text()).toContain("Weekly Trail Bulletin");
    expect(pushToast).toHaveBeenCalledWith("Feed updated", "success");
    expect(pushToast).toHaveBeenCalledWith("Action failed", "error");
  });

  it("prevents duplicate-click submissions while an action is pending", async () => {
    const pending = deferred();
    mockApi.sendFeedAction.mockReturnValue(pending.promise);

    const wrapper = mount(FeedPage);
    await flush();
    await flush();
    expect(wrapper.text()).toContain("Weekly Trail Bulletin");

    const openButton = wrapper.findAll("button").find((button) => button.text().includes("Open"));
    expect(openButton).toBeTruthy();

    openButton.trigger("click");
    openButton.trigger("click");
    await flush();

    expect(mockApi.sendFeedAction).toHaveBeenCalledTimes(1);

    pending.resolve({ data: {} });
    await flush();
  });
});
