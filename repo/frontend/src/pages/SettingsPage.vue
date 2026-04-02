<template>
  <section class="card page settings-page">
    <div class="page-header">
      <div>
        <h2>Profile & Settings</h2>
        <p class="meta">Manage account details and personalized feed behavior.</p>
      </div>
    </div>

    <section v-if="user" class="section-surface compact-stack">
      <p><strong>Username:</strong> {{ user.username }}</p>
      <p><strong>Email:</strong> {{ user.email || "-" }}</p>
      <p><strong>Roles:</strong> {{ (user.roles || []).join(", ") }}</p>
      <p>
        <strong>Subscriber:</strong>
        <span class="status-pill" :class="user.subscriber?.isSubscriber ? 'success' : 'warning'">
          {{ user.subscriber?.isSubscriber ? "Active" : readableSubscriptionStatus(user.subscriber?.status || "none") }}
        </span>
      </p>
    </section>

    <section class="section-surface compact-stack">
      <h3>Content Preferences</h3>
      <p v-if="loading" class="meta">Loading preferences...</p>
      <p v-else-if="error" class="error">{{ error }}</p>

      <form v-else class="grid" @submit.prevent="save">
        <div class="stack">
          <p class="meta"><strong>Preferred Sports</strong></p>
          <div class="interests-chip-grid">
            <button
              v-for="sport in sportsOptions"
              :key="sport"
              type="button"
              class="interest-chip"
              :class="{ selected: selectedSports.includes(sport) }"
              :aria-pressed="selectedSports.includes(sport)"
              @click="toggleSport(sport)"
            >
              {{ sport }}
            </button>
          </div>
        </div>

        <label class="toggle-row">
          <input v-model="form.includeTrainingUpdates" type="checkbox" />
          Include training updates
        </label>
        <label class="toggle-row">
          <input v-model="form.includeCourseUpdates" type="checkbox" />
          Include course updates
        </label>
        <label class="toggle-row">
          <input v-model="form.includeNews" type="checkbox" />
          Include news
        </label>

        <button :disabled="saving" type="submit">{{ saving ? "Saving..." : "Save Preferences" }}</button>
      </form>
    </section>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { getCurrentUser, getFeedPreferences, updateFeedPreferences } from "../api";
import { useToast } from "../toast";

const user = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const selectedSports = ref([]);
const sportsOptions = ["running", "cycling", "walking", "strength", "swimming", "yoga", "football", "basketball"];
const form = reactive({
  includeTrainingUpdates: true,
  includeCourseUpdates: true,
  includeNews: true
});

const { pushToast } = useToast();

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [meResponse, prefsResponse] = await Promise.all([getCurrentUser(), getFeedPreferences()]);
    user.value = meResponse.data;
    const prefs = prefsResponse.data;
    selectedSports.value = prefs.preferredSports || [];
    form.includeTrainingUpdates = !!prefs.includeTrainingUpdates;
    form.includeCourseUpdates = !!prefs.includeCourseUpdates;
    form.includeNews = !!prefs.includeNews;
  } catch (err) {
    error.value = err.message || "Failed to load settings";
  } finally {
    loading.value = false;
  }
}

function toggleSport(sport) {
  if (selectedSports.value.includes(sport)) {
    selectedSports.value = selectedSports.value.filter((value) => value !== sport);
  } else {
    selectedSports.value = [...selectedSports.value, sport];
  }
}

async function save() {
  saving.value = true;
  try {
    await updateFeedPreferences({
      preferredSports: selectedSports.value,
      includeTrainingUpdates: form.includeTrainingUpdates,
      includeCourseUpdates: form.includeCourseUpdates,
      includeNews: form.includeNews
    });
    pushToast("Settings saved", "success");
  } catch (err) {
    pushToast(err.message || "Failed to save settings", "error");
  } finally {
    saving.value = false;
  }
}

function readableSubscriptionStatus(status) {
  const map = {
    none: "No Subscription",
    expired: "Expired",
    pending: "Pending",
    cancelled: "Cancelled",
    active: "Active"
  };
  return map[status] || status;
}

onMounted(load);
</script>

<style scoped>
.compact-stack {
  display: grid;
  gap: 0.38rem;
}

.interests-chip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.4rem;
  align-items: start;
}

.interest-chip {
  height: 1.8rem;
  min-height: 1.8rem;
  padding: 0.18rem 0.46rem;
  font-size: 0.78rem;
  justify-content: center;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted-foreground);
  align-self: start;
}

.interest-chip.selected {
  background: #1d1d23;
  color: var(--foreground);
  border-color: var(--border-strong);
}
</style>
