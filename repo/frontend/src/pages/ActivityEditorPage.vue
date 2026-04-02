<template>
  <section class="card page">
    <div class="page-header">
      <div>
        <h2>{{ mode === 'create' ? 'New Activity' : 'Edit Activity' }}</h2>
        <p class="meta">Capture workout metrics and optional place/time details.</p>
      </div>
      <router-link class="nav-link" to="/activities">Back to Activities</router-link>
    </div>

    <p v-if="loading" class="meta">Loading activity editor...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <ActivityForm
      v-else
      :mode="mode"
      :initial-activity="activity"
      :places="places"
      :loading="saving"
      :error="saveError"
      @submit="submit"
      @cancel="goBack"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ActivityForm from "../components/ActivityForm.vue";
import { createActivity, getActivity, listPlaces, updateActivity } from "../api";
import { useToast } from "../toast";

const route = useRoute();
const router = useRouter();
const { pushToast } = useToast();

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const saveError = ref("");
const places = ref([]);
const activity = ref(null);

const mode = computed(() => (route.name === "activities-edit" ? "edit" : "create"));

function goBack() {
  router.push("/activities");
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const placesResponse = await listPlaces();
    places.value = placesResponse.data || [];

    if (mode.value === "edit") {
      const id = Number(route.params.activityId);
      if (!id) {
        throw new Error("Invalid activity id");
      }
      const activityResponse = await getActivity(id);
      activity.value = activityResponse.data;
    }
  } catch (err) {
    error.value = err.message || "Failed to load activity editor";
  } finally {
    loading.value = false;
  }
}

async function submit(payload) {
  saving.value = true;
  saveError.value = "";
  try {
    if (mode.value === "create") {
      await createActivity(payload);
      pushToast("Activity created", "success");
    } else {
      await updateActivity(Number(route.params.activityId), payload);
      pushToast("Activity updated", "success");
    }
    router.push("/activities");
  } catch (err) {
    saveError.value = err.message || "Failed to save activity";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
