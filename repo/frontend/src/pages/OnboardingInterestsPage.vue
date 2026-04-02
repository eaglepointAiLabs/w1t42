<template>
  <section class="card page narrow onboarding-card">
    <p class="eyebrow">Step 1 of 1</p>
    <h2>Choose Your Sports</h2>
    <p class="meta">Pick one or more interests to personalize your first-week feed recommendations.</p>

    <p v-if="loading" class="meta">Loading preferences...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <form v-else class="grid" @submit.prevent="save">
      <div class="interest-grid" role="group" aria-label="Sports interests">
        <button
          v-for="sport in sportsOptions"
          :key="sport"
          type="button"
          class="interest-tile"
          :class="{ selected: selected.includes(sport) }"
          :aria-pressed="selected.includes(sport)"
          @click="toggleSport(sport)"
        >
          <span>{{ sport }}</span>
        </button>
      </div>
      <p class="meta">Selected: {{ selected.length }} sport{{ selected.length === 1 ? "" : "s" }}</p>
      <button type="submit" :disabled="saving || !selected.length">{{ saving ? "Saving..." : "Continue to Feed" }}</button>
    </form>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getFeedPreferences, updateFeedPreferences } from "../api";
import { useToast } from "../toast";

const router = useRouter();
const { pushToast } = useToast();
const selected = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");

const sportsOptions = ["running", "cycling", "walking", "strength", "swimming", "yoga", "football", "basketball"];

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const response = await getFeedPreferences();
    selected.value = response.data?.preferredSports || [];
    if (selected.value.length) {
      router.replace({ name: "feed" });
    }
  } catch (err) {
    error.value = err.message || "Failed to load onboarding preferences";
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await updateFeedPreferences({
      preferredSports: selected.value,
      includeTrainingUpdates: true,
      includeCourseUpdates: true,
      includeNews: true
    });
    pushToast("Interests saved", "success");
    router.replace({ name: "feed" });
  } catch (err) {
    pushToast(err.message || "Failed to save interests", "error");
  } finally {
    saving.value = false;
  }
}

function toggleSport(sport) {
  if (selected.value.includes(sport)) {
    selected.value = selected.value.filter((value) => value !== sport);
  } else {
    selected.value = [...selected.value, sport];
  }
}

onMounted(load);
</script>
