import { reactive, readonly } from "vue";
import { getCurrentUser, login as apiLogin } from "./api";

const state = reactive({
  initialized: false,
  loading: false,
  user: null,
  error: ""
});

function hasRole(requiredRoles) {
  if (!state.user) {
    return false;
  }
  const roles = state.user.roles || [];
  return requiredRoles.some((role) => roles.includes(role));
}

async function bootstrapSession() {
  state.loading = true;
  state.error = "";
  try {
    const response = await getCurrentUser();
    state.user = response.data;
  } catch {
    state.user = null;
  } finally {
    state.loading = false;
    state.initialized = true;
  }
}

async function login(credentials) {
  state.loading = true;
  state.error = "";
  try {
    await apiLogin(credentials);
    const me = await getCurrentUser();
    state.user = me.data;
    return state.user;
  } catch (error) {
    state.error = error.message || "Login failed";
    throw error;
  } finally {
    state.loading = false;
  }
}

async function refreshUser() {
  try {
    const me = await getCurrentUser();
    state.user = me.data;
  } catch {
    state.user = null;
  }
}

function clearSession() {
  state.user = null;
}

export function useSession() {
  return {
    state: readonly(state),
    hasRole,
    bootstrapSession,
    login,
    refreshUser,
    clearSession
  };
}
