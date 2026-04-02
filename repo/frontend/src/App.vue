<template>
  <main :class="['shell', session.state.user ? 'shell-auth' : 'shell-guest']">
    <template v-if="session.state.user">
      <aside class="sidebar card" aria-label="Sidebar Navigation">
        <div class="sidebar-brand">
          <span class="brand-mark" aria-hidden="true">TF</span>
          <div class="brand-copy">
            <h1>TrailForge</h1>
            <p class="meta">Sports Portal</p>
          </div>
        </div>

        <p class="meta user-meta">{{ session.state.user.username }} <span class="chip muted">{{ roleLabel }}</span></p>

        <nav class="sidebar-nav" aria-label="Primary">
          <router-link class="nav-link" to="/">Feed</router-link>
          <router-link class="nav-link" to="/catalog">Catalog</router-link>
          <router-link class="nav-link" to="/orders">Orders</router-link>
          <router-link class="nav-link" to="/reviews">Reviews</router-link>
          <router-link class="nav-link" to="/activities">Activities</router-link>
          <router-link class="nav-link" to="/settings">Settings</router-link>
          <router-link class="nav-link" v-if="canStaff" to="/staff/cases">Staff Cases</router-link>
          <router-link class="nav-link" v-if="canAnalytics" to="/admin/analytics">Analytics</router-link>
          <router-link class="nav-link" v-if="canAdmin" to="/admin/ops">Admin Ops</router-link>
        </nav>

        <button class="ghost sidebar-logout" @click="doLogout">Logout</button>
      </aside>

      <section class="content-pane app-grid">
        <section v-if="!online" class="card offline-banner">
          You are offline. Cached data stays visible and actions may fail until reconnection.
        </section>
        <section v-if="pendingOfflineIntents > 0" class="card offline-banner">
          {{ pendingOfflineIntents }} offline action{{ pendingOfflineIntents > 1 ? "s" : "" }} need retry.
          <button class="ghost" @click="clearPendingOfflineIntents">Dismiss</button>
        </section>

        <section v-if="session.state.loading && !session.state.initialized" class="card">
          <p class="meta">Loading session...</p>
        </section>

        <router-view v-else />
      </section>
    </template>

    <template v-else>
      <section class="content-pane app-grid">
        <header class="card app-header guest-brand-header">
          <div class="sidebar-brand">
            <span class="brand-mark" aria-hidden="true">TF</span>
            <div class="brand-copy">
              <h1>TrailForge</h1>
              <p class="meta">Offline-ready sports portal</p>
            </div>
          </div>
        </header>

        <section v-if="!online" class="card offline-banner">
          You are offline. Cached data stays visible and actions may fail until reconnection.
        </section>
        <section v-if="pendingOfflineIntents > 0" class="card offline-banner">
          {{ pendingOfflineIntents }} offline action{{ pendingOfflineIntents > 1 ? "s" : "" }} need retry.
          <button class="ghost" @click="clearPendingOfflineIntents">Dismiss</button>
        </section>

        <section v-if="session.state.loading && !session.state.initialized" class="card">
          <p class="meta">Loading session...</p>
        </section>

        <router-view v-else />
      </section>
    </template>

    <ToastList :toasts="toast.items" />
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useSession } from "./session";
import { logout } from "./api";
import { useToast } from "./toast";
import ToastList from "./components/ToastList.vue";
import { clearOfflineIntents, getOfflineIntentCount } from "./offline/mutation-intents";
import { clearPrivateClientState } from "./offline/private-data";

const router = useRouter();
const session = useSession();
const toast = useToast();
const online = ref(typeof navigator !== "undefined" ? navigator.onLine : true);
const pendingOfflineIntents = ref(0);

const canStaff = computed(() => session.hasRole(["coach", "support", "admin"]));
const canAnalytics = computed(() => session.hasRole(["support", "admin"]));
const canAdmin = computed(() => session.hasRole(["admin"]));
const roleLabel = computed(() => {
  const roles = session.state.user?.roles || [];
  if (!roles.length) {
    return "member";
  }
  return roles[0];
});

async function doLogout() {
  try {
    await logout();
  } catch {
  }
  clearPrivateClientState();
  session.clearSession();
  toast.pushToast("Logged out", "success");
  router.push("/login");
}

function refreshOfflineIntentCount() {
  pendingOfflineIntents.value = getOfflineIntentCount();
}

function clearPendingOfflineIntents() {
  clearOfflineIntents();
  refreshOfflineIntentCount();
}

onMounted(async () => {
  await session.bootstrapSession();
  refreshOfflineIntentCount();
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      online.value = true;
      refreshOfflineIntentCount();
      toast.pushToast("Back online", "success");
    });
    window.addEventListener("offline", () => {
      online.value = false;
      refreshOfflineIntentCount();
      toast.pushToast("You are offline", "error");
    });
  }
});

watch(
  () => session.state.user?.id || null,
  (nextUserId, prevUserId) => {
    if (prevUserId && nextUserId !== prevUserId) {
      clearPrivateClientState();
      refreshOfflineIntentCount();
    }
  }
);
</script>
