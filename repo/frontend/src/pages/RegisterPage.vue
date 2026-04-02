<template>
  <section class="card page narrow auth-card">
    <p class="eyebrow">Get started</p>
    <h2>Create Account</h2>
    <p class="meta">Create your local TrailForge profile and personalize your feed.</p>
    <form class="grid" @submit.prevent="submit">
      <label>
        Username
        <input v-model="form.username" type="text" required />
      </label>
      <label>
        Email
        <input v-model="form.email" type="email" />
      </label>
      <label>
        Password
        <input v-model="form.password" type="password" required />
      </label>
      <label>
        Display Name
        <input v-model="form.displayName" type="text" />
      </label>
      <button :disabled="loading" type="submit">{{ loading ? "Creating..." : "Register" }}</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p class="meta">Already have an account? <router-link to="/login">Sign in</router-link></p>
  </section>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { register } from "../api";

const router = useRouter();
const form = reactive({
  username: "",
  email: "",
  password: "",
  displayName: ""
});
const loading = ref(false);
const error = ref("");

async function submit() {
  loading.value = true;
  error.value = "";
  try {
    await register(form);
    router.push("/login");
  } catch (err) {
    error.value = err.message || "Registration failed";
  } finally {
    loading.value = false;
  }
}
</script>
