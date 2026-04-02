<template>
  <section class="card page narrow auth-card">
    <p class="eyebrow">Welcome back</p>
    <h2>Sign In</h2>
    <p class="meta">Access training, orders, reviews, and operations in one place.</p>
    <form class="grid" @submit.prevent="submit">
      <label>
        Username
        <input v-model="form.username" type="text" required />
      </label>
      <label>
        Password
        <input v-model="form.password" type="password" required />
      </label>
      <button :disabled="loading" type="submit">{{ loading ? "Signing in..." : "Sign In" }}</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p class="meta">Need an account? <router-link to="/register">Register</router-link></p>
  </section>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useSession } from "../session";

const router = useRouter();
const { login } = useSession();

const form = reactive({
  username: "",
  password: ""
});

const loading = ref(false);
const error = ref("");

async function submit() {
  loading.value = true;
  error.value = "";
  try {
    await login({
      username: form.username,
      password: form.password,
      deviceFingerprint: getOrCreateDeviceId()
    });
    router.push("/");
  } catch (err) {
    error.value = err.message || "Login failed";
  } finally {
    loading.value = false;
  }
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return "server-render-device";
  }

  const key = "trailforge.device_id";
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated =
    typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, generated);
  return generated;
}
</script>
