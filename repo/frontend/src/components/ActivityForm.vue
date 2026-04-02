<template>
  <form class="grid" @submit.prevent="submitForm">
    <h3>{{ mode === "create" ? "Create Activity" : "Edit Activity" }}</h3>
    <div class="grid-2">
      <label>
        Type
        <select v-model="form.activityType" required>
          <option value="running">Running</option>
          <option value="cycling">Cycling</option>
          <option value="walking">Walking</option>
        </select>
      </label>
      <label>
        Duration (seconds)
        <input v-model.number="form.durationSeconds" type="number" min="1" required />
      </label>
      <label>
        Distance (miles)
        <input v-model.number="form.distanceMiles" type="number" min="0.01" step="0.01" required />
      </label>
      <label>
        Calories
        <input v-model.number="form.calories" type="number" min="0" />
      </label>
      <label>
        Avg Heart Rate
        <input v-model.number="form.avgHeartRate" type="number" min="20" max="260" />
      </label>
      <label>
        Pace (sec/mile)
        <input v-model.number="form.paceSecondsPerMile" type="number" min="1" />
      </label>
      <label>
        Started At
        <input v-model="form.startedAt" type="datetime-local" />
      </label>
      <label>
        Completed At
        <input v-model="form.completedAt" type="datetime-local" />
      </label>
    </div>

    <label>
      Tags (comma separated)
      <input v-model="tagsInput" type="text" placeholder="tempo, evening" />
    </label>

    <div class="grid-2">
      <label>
        Saved Place
        <select v-model="form.savedPlaceId">
          <option value="">None</option>
          <option v-for="place in places" :key="place.id" :value="String(place.id)">
            {{ place.label }} - {{ place.location_text }}
          </option>
        </select>
      </label>
      <label>
        Free-text Location
        <input v-model="form.locationText" type="text" maxlength="255" placeholder="Optional custom location" />
      </label>
    </div>

    <label>
      Notes
      <textarea v-model="form.notes" rows="3" maxlength="5000" />
    </label>

    <div class="row gap">
      <button :disabled="loading" type="submit">{{ loading ? "Saving..." : "Save Activity" }}</button>
      <button type="button" class="ghost" @click="$emit('cancel')">Cancel</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";

const props = defineProps({
  mode: {
    type: String,
    default: "create"
  },
  initialActivity: {
    type: Object,
    default: null
  },
  places: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["submit", "cancel"]);

const form = reactive({
  activityType: "running",
  durationSeconds: 1800,
  distanceMiles: 3,
  calories: null,
  avgHeartRate: null,
  paceSecondsPerMile: null,
  notes: "",
  locationText: "",
  savedPlaceId: "",
  startedAt: "",
  completedAt: ""
});

const tagsInput = ref("");

function isoToLocalInput(isoString) {
  if (!isoString) {
    return "";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

watch(
  () => props.initialActivity,
  (activity) => {
    if (!activity) {
      return;
    }

    form.activityType = activity.activity_type || "running";
    form.durationSeconds = activity.duration_seconds ?? 1800;
    form.distanceMiles = Number(activity.distance_miles ?? 3);
    form.calories = activity.calories;
    form.avgHeartRate = activity.avg_heart_rate;
    form.paceSecondsPerMile = activity.pace_seconds_per_mile;
    form.notes = activity.notes || "";
    form.locationText = activity.location_text || "";
    form.savedPlaceId = activity.saved_place_id ? String(activity.saved_place_id) : "";
    form.startedAt = isoToLocalInput(activity.started_at);
    form.completedAt = isoToLocalInput(activity.completed_at);
    tagsInput.value = (activity.tags || []).join(", ");
  },
  { immediate: true }
);

const payload = computed(() => ({
  activityType: form.activityType,
  durationSeconds: Number(form.durationSeconds),
  distanceMiles: Number(form.distanceMiles),
  calories: form.calories === "" || form.calories === null ? null : Number(form.calories),
  avgHeartRate: form.avgHeartRate === "" || form.avgHeartRate === null ? null : Number(form.avgHeartRate),
  paceSecondsPerMile: form.paceSecondsPerMile === "" || form.paceSecondsPerMile === null ? null : Number(form.paceSecondsPerMile),
  tags: tagsInput.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  notes: form.notes || null,
  locationText: form.locationText || null,
  savedPlaceId: form.savedPlaceId ? Number(form.savedPlaceId) : null,
  startedAt: form.startedAt ? new Date(form.startedAt).toISOString() : null,
  completedAt: form.completedAt ? new Date(form.completedAt).toISOString() : null
}));

function submitForm() {
  emit("submit", payload.value);
}
</script>
