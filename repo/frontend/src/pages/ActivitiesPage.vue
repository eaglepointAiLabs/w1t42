<template>
  <section class="page activities-page">
    <section class="card page">
      <div class="page-header">
        <div>
          <h2>Activities</h2>
          <p class="meta">Review workouts, inspect GPX coordinates, and manage saved places.</p>
        </div>
        <div class="toolbar">
          <router-link class="nav-link" to="/activities/new">New Activity</router-link>
          <button class="ghost" @click="loadActivities">Refresh</button>
        </div>
      </div>

      <section v-if="!activitiesLoading && !activities.length" class="empty-state">
        <h3>No activity records yet</h3>
        <p class="meta">Create your first workout to unlock detail view and GPX history.</p>
        <div class="toolbar" style="justify-content: center">
          <router-link class="nav-link" to="/activities/new">Create Activity</router-link>
        </div>
      </section>

      <div v-else class="activity-workspace section-surface">
        <section class="activity-pane">
          <ActivityList
            :activities="activities"
            :selected-id="selectedActivityId"
            :loading="activitiesLoading"
            :error="activitiesError"
            @select="selectActivity"
          />
        </section>

        <section class="activity-pane">
          <ActivityDetail
            :activity="selectedActivity"
            :loading="activityDetailLoading"
            :error="activityDetailError"
            :coordinates="coordinates"
            :coords-loading="coordsLoading"
            :coords-error="coordsError"
            @edit="openEdit"
            @upload-gpx="handleUploadGpx"
          />
        </section>
      </div>
    </section>

    <section class="card page">
      <PlaceManager
        :places="places"
        :loading="placeMutationLoading"
        :loading-list="placesLoading"
        :error="placesError"
        @create-place="handleCreatePlace"
        @delete-place="handleDeletePlace"
      />
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ActivityList from "../components/ActivityList.vue";
import ActivityDetail from "../components/ActivityDetail.vue";
import PlaceManager from "../components/PlaceManager.vue";
import { listPlaces, createPlace, deletePlace, listActivities, getActivity, uploadActivityGpx, listActivityCoordinates } from "../api";
import { useToast } from "../toast";

const router = useRouter();
const places = ref([]);
const placesLoading = ref(false);
const placeMutationLoading = ref(false);
const placesError = ref("");

const activities = ref([]);
const activitiesLoading = ref(false);
const activitiesError = ref("");

const selectedActivityId = ref(null);
const selectedActivity = ref(null);
const activityDetailLoading = ref(false);
const activityDetailError = ref("");

const coordinates = ref([]);
const coordsLoading = ref(false);
const coordsError = ref("");

const { pushToast } = useToast();

async function loadPlaces() {
  placesLoading.value = true;
  placesError.value = "";
  try {
    const response = await listPlaces();
    places.value = response.data || [];
  } catch (error) {
    placesError.value = error.message || "Failed to load places";
  } finally {
    placesLoading.value = false;
  }
}

async function loadActivities() {
  activitiesLoading.value = true;
  activitiesError.value = "";
  try {
    const response = await listActivities();
    activities.value = response.data || [];
    if (!selectedActivityId.value && activities.value.length) {
      selectedActivityId.value = activities.value[0].id;
      await loadActivityDetail(selectedActivityId.value);
    }
  } catch (error) {
    activitiesError.value = error.message || "Failed to load activities";
  } finally {
    activitiesLoading.value = false;
  }
}

async function loadActivityDetail(activityId) {
  if (!activityId) {
    selectedActivity.value = null;
    coordinates.value = [];
    return;
  }

  activityDetailLoading.value = true;
  activityDetailError.value = "";
  coordsLoading.value = true;
  coordsError.value = "";
  try {
    const [detailResponse, coordsResponse] = await Promise.all([getActivity(activityId), listActivityCoordinates(activityId)]);
    selectedActivity.value = detailResponse.data;
    coordinates.value = coordsResponse.data || [];
  } catch (error) {
    activityDetailError.value = error.message || "Failed to load activity detail";
    coordsError.value = error.message || "Failed to load coordinates";
  } finally {
    activityDetailLoading.value = false;
    coordsLoading.value = false;
  }
}

function selectActivity(activityId) {
  selectedActivityId.value = activityId;
  loadActivityDetail(activityId);
}

function openEdit(activityId) {
  router.push(`/activities/${activityId}/edit`);
}

async function handleUploadGpx({ activityId, payload }) {
  try {
    await uploadActivityGpx(activityId, payload);
    pushToast("GPX uploaded", "success");
    await loadActivityDetail(activityId);
  } catch (error) {
    pushToast(error.message || "Failed GPX upload", "error");
    throw error;
  }
}

async function handleCreatePlace(payload) {
  placeMutationLoading.value = true;
  placesError.value = "";
  try {
    await createPlace(payload);
    pushToast("Place saved", "success");
    await loadPlaces();
  } catch (error) {
    placesError.value = error.message || "Failed to create place";
  } finally {
    placeMutationLoading.value = false;
  }
}

async function handleDeletePlace(placeId) {
  placeMutationLoading.value = true;
  placesError.value = "";
  try {
    await deletePlace(placeId);
    pushToast("Place removed", "success");
    await loadPlaces();
  } catch (error) {
    placesError.value = error.message || "Failed to delete place";
  } finally {
    placeMutationLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadPlaces(), loadActivities()]);
});
</script>
