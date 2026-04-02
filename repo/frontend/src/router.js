import { createRouter, createWebHistory } from "vue-router";
import { useSession } from "./session";
import { getFeedPreferences } from "./api";

import LoginPage from "./pages/LoginPage.vue";
import RegisterPage from "./pages/RegisterPage.vue";
import FeedPage from "./pages/FeedPage.vue";
import CatalogPage from "./pages/CatalogPage.vue";
import OrdersPage from "./pages/OrdersPage.vue";
import ReviewsPage from "./pages/ReviewsPage.vue";
import ReviewCreatePage from "./pages/ReviewCreatePage.vue";
import ActivitiesPage from "./pages/ActivitiesPage.vue";
import ActivityEditorPage from "./pages/ActivityEditorPage.vue";
import SettingsPage from "./pages/SettingsPage.vue";
import StaffCasesPage from "./pages/StaffCasesPage.vue";
import AdminOpsPage from "./pages/AdminOpsPage.vue";
import AnalyticsPage from "./pages/AnalyticsPage.vue";
import OnboardingInterestsPage from "./pages/OnboardingInterestsPage.vue";
import NotFoundPage from "./pages/NotFoundPage.vue";

const routes = [
  { path: "/login", name: "login", component: LoginPage, meta: { guestOnly: true } },
  { path: "/register", name: "register", component: RegisterPage, meta: { guestOnly: true } },
  { path: "/", name: "feed", component: FeedPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/catalog", name: "catalog", component: CatalogPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/orders", name: "orders", component: OrdersPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/reviews", name: "reviews", component: ReviewsPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/reviews/new", name: "reviews-new", component: ReviewCreatePage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/activities", name: "activities", component: ActivitiesPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/activities/new", name: "activities-new", component: ActivityEditorPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/activities/:activityId/edit", name: "activities-edit", component: ActivityEditorPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/onboarding/interests", name: "onboarding-interests", component: OnboardingInterestsPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/settings", name: "settings", component: SettingsPage, meta: { auth: true, roles: ["user", "coach", "support", "admin"] } },
  { path: "/staff/cases", name: "staff-cases", component: StaffCasesPage, meta: { auth: true, roles: ["coach", "support", "admin"] } },
  { path: "/admin/analytics", name: "admin-analytics", component: AnalyticsPage, meta: { auth: true, roles: ["support", "admin"] } },
  { path: "/admin/ops", name: "admin-ops", component: AdminOpsPage, meta: { auth: true, roles: ["admin"] } },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundPage }
];

export function registerRouteGuards(router, options = {}) {
  const resolveSession = options.resolveSession || useSession;
  const loadFeedPreferences = options.loadFeedPreferences || getFeedPreferences;

  router.beforeEach(async (to) => {
    const { state, bootstrapSession, hasRole } = resolveSession();
    if (!state.initialized) {
      await bootstrapSession();
    }

    if (to.meta.guestOnly && state.user) {
      return { name: "feed" };
    }

    if (to.meta.auth && !state.user) {
      return { name: "login" };
    }

    if (to.meta.roles && state.user && !hasRole(to.meta.roles)) {
      return { name: "feed" };
    }

    if (to.name === "feed" && state.user) {
      try {
        const prefs = await loadFeedPreferences();
        const sports = prefs.data?.preferredSports || [];
        if (!sports.length) {
          return { name: "onboarding-interests" };
        }
      } catch {
        return true;
      }
    }

    return true;
  });
}

export function createAppRouter(history = createWebHistory(), guardOptions) {
  const router = createRouter({
    history,
    routes
  });
  registerRouteGuards(router, guardOptions);
  return router;
}

const router = createAppRouter();

export default router;
