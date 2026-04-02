import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";

const { mockGetFeedPreferences, sessionState, mockBootstrapSession, mockHasRole } = vi.hoisted(() => {
  const state = {
    initialized: true,
    user: null
  };
  return {
    mockGetFeedPreferences: vi.fn(),
    sessionState: state,
    mockBootstrapSession: vi.fn(async () => {
      state.initialized = true;
    }),
    mockHasRole: vi.fn((requiredRoles) => {
      const userRoles = state.user?.roles || [];
      return requiredRoles.some((role) => userRoles.includes(role));
    })
  };
});

vi.mock("./api", () => ({
  getFeedPreferences: mockGetFeedPreferences
}));

vi.mock("./session", () => ({
  useSession: () => ({
    state: sessionState,
    bootstrapSession: mockBootstrapSession,
    hasRole: mockHasRole
  })
}));

async function createTestRouter() {
  const { createAppRouter } = await import("./router");
  return createAppRouter(createMemoryHistory());
}

describe("router auth and RBAC guards", () => {
  beforeEach(() => {
    sessionState.initialized = true;
    sessionState.user = null;
    mockBootstrapSession.mockClear();
    mockHasRole.mockClear();
    mockGetFeedPreferences.mockReset();
    mockGetFeedPreferences.mockResolvedValue({ data: { preferredSports: ["running"] } });
  });

  it("redirects guest users from protected routes to /login", async () => {
    const router = await createTestRouter();
    await router.push("/orders");
    expect(router.currentRoute.value.name).toBe("login");
  });

  it("blocks authenticated users from guest-only pages", async () => {
    sessionState.user = { id: 1, roles: ["user"] };
    const router = await createTestRouter();
    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("feed");
  });

  it("enforces route role restrictions for staff/admin pages", async () => {
    sessionState.user = { id: 2, roles: ["user"] };
    const router = await createTestRouter();

    await router.push("/staff/cases");
    expect(router.currentRoute.value.name).toBe("feed");

    await router.push("/admin/analytics");
    expect(router.currentRoute.value.name).toBe("feed");

    await router.push("/admin/ops");
    expect(router.currentRoute.value.name).toBe("feed");
  });

  it("allows support role pages but still blocks admin-only routes", async () => {
    sessionState.user = { id: 3, roles: ["support"] };
    const router = await createTestRouter();

    await router.push("/staff/cases");
    expect(router.currentRoute.value.name).toBe("staff-cases");

    await router.push("/admin/analytics");
    expect(router.currentRoute.value.name).toBe("admin-analytics");

    await router.push("/admin/ops");
    expect(router.currentRoute.value.name).toBe("feed");
  });
});
