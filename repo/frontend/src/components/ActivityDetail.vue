<template>
  <section class="activity-detail">
    <div class="page-header">
      <h3>Activity Detail</h3>
      <button v-if="activity" class="ghost" @click="$emit('edit', activity.id)">Edit</button>
    </div>

    <p v-if="loading" class="meta">Loading activity detail...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <section v-else-if="!activity" class="empty-state">
      <h3>Select an activity</h3>
      <p class="meta">Choose an item from the list to inspect details and GPX data.</p>
    </section>

    <div v-else>
      <div class="grid-2">
        <p><strong>Type:</strong> {{ activity.activity_type }}</p>
        <p><strong>Distance:</strong> {{ activity.distance_miles }} miles</p>
        <p><strong>Duration:</strong> {{ activity.duration_seconds }} seconds</p>
        <p><strong>Avg Speed:</strong> {{ activity.derived?.avgSpeedMph ?? "-" }} mph</p>
        <p><strong>Calories:</strong> {{ activity.calories ?? "-" }}</p>
        <p><strong>Heart Rate:</strong> {{ activity.avg_heart_rate ?? "-" }}</p>
        <p><strong>Pace:</strong> {{ activity.pace_seconds_per_mile ?? "-" }}</p>
        <p><strong>Location:</strong> {{ activity.location_text || activity.saved_place_location || "-" }}</p>
      </div>

      <p><strong>Tags:</strong> {{ (activity.tags || []).join(", ") || "-" }}</p>
      <p><strong>Notes:</strong> {{ activity.notes || "-" }}</p>

      <div class="divider" />

      <div class="row between">
        <h4>GPX Coordinate List</h4>
        <label class="file-btn">
          <input type="file" accept=".gpx" @change="onFileChange" />
          Upload GPX
        </label>
      </div>

      <p v-if="uploading" class="meta">Uploading GPX...</p>
      <p v-if="uploadError" class="error">{{ uploadError }}</p>

      <p v-if="coordsLoading" class="meta">Loading coordinates...</p>
      <p v-else-if="coordsError" class="error">{{ coordsError }}</p>
      <section v-else-if="!coordinates.length" class="empty-state">
        <h3>No GPX coordinates yet</h3>
        <p class="meta">Upload a GPX file to render coordinate history for this activity.</p>
      </section>

      <ul v-else class="coords-list">
        <li v-for="point in coordinates" :key="point.seq_no">
          #{{ point.seq_no }} - lat {{ point.latitude }}, lon {{ point.longitude }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  activity: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ""
  },
  coordinates: {
    type: Array,
    default: () => []
  },
  coordsLoading: {
    type: Boolean,
    default: false
  },
  coordsError: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["edit", "upload-gpx"]);

const uploading = ref(false);
const uploadError = ref("");

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function onFileChange(event) {
  uploadError.value = "";
  const file = event.target.files?.[0];
  if (!file || !props.activity) {
    return;
  }

  try {
    uploading.value = true;
    const base64Data = await fileToBase64(file);
    await emit("upload-gpx", {
      activityId: props.activity.id,
      payload: {
        fileName: file.name,
        mimeType: file.type || "application/gpx+xml",
        sizeBytes: file.size,
        base64Data
      }
    });
  } catch (error) {
    uploadError.value = error.message || "Failed to upload GPX";
  } finally {
    uploading.value = false;
    event.target.value = "";
  }
}
</script>

<style scoped>
.activity-detail {
  display: grid;
  gap: 0.55rem;
}
</style>
