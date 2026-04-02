<template>
  <section class="place-manager stack">
    <div class="page-header">
      <h3>Saved Places</h3>
    </div>

    <form class="toolbar" @submit.prevent="submitPlace">
      <input v-model="label" class="inline-input" type="text" placeholder="Label" required />
      <input v-model="locationText" type="text" placeholder="Location text" required />
      <button :disabled="loading" type="submit">{{ loading ? "Saving..." : "Add Place" }}</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loadingList" class="meta">Loading places...</p>
    <section v-else-if="!places.length" class="empty-state">
      <h3>No saved places</h3>
      <p class="meta">Add your frequent training locations for faster activity entry.</p>
    </section>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Location</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="place in places" :key="place.id">
            <td>{{ place.label }}</td>
            <td class="meta">{{ place.location_text }}</td>
            <td><button class="ghost" @click="$emit('delete-place', place.id)">Delete</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  places: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingList: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["create-place", "delete-place"]);

const label = ref("");
const locationText = ref("");

function submitPlace() {
  emit("create-place", { label: label.value, locationText: locationText.value, isDefault: false });
  label.value = "";
  locationText.value = "";
}
</script>
