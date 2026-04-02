<template>
  <section class="activity-list">
    <div class="page-header">
      <h3>Activity Records</h3>
      <router-link class="nav-link" to="/activities/new">New Activity</router-link>
    </div>

    <p v-if="loading" class="meta">Loading activities...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <section v-else-if="!activities.length" class="empty-state">
      <h3>No activity records yet</h3>
      <p class="meta">Create a workout to start building your training history.</p>
      <router-link class="nav-link" to="/activities/new">New Activity</router-link>
    </section>

    <ul v-else class="list">
      <li v-for="item in activities" :key="item.id">
        <button
          class="list-item"
          :class="{ selected: selectedId === item.id }"
          @click="$emit('select', item.id)"
        >
          <strong>{{ item.activity_type }}</strong>
          <span>{{ item.distance_miles }} mi · {{ item.duration_seconds }} sec</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  activities: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: Number,
    default: null
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

defineEmits(["select"]);
</script>

<style scoped>
.activity-list {
  display: grid;
  gap: 0.55rem;
}
</style>
