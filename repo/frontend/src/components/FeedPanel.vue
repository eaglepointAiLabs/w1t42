<template>
  <section class="card feed-panel page">
    <div class="page-header">
      <div>
        <h2>Personalized Home Feed</h2>
        <p class="meta">Training activity, course updates, and local sports news tuned to your interests.</p>
      </div>
      <button class="ghost" @click="$emit('refresh')">Refresh Feed</button>
    </div>

    <section class="section-surface stack">
      <div class="row between wrap gap">
        <p class="meta"><strong>Sports Interests</strong></p>
        <button :disabled="prefsSaving" @click="savePreferences">{{ prefsSaving ? "Saving..." : "Save Interests" }}</button>
      </div>
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
    </section>

    <p v-if="showingCachedFeed || showingCachedPreferences" class="meta warning-text">
      Showing cached data while offline or after a network error.
    </p>

    <p v-if="loading" class="meta">Loading feed...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <section v-else-if="!items.length" class="empty-state">
      <h3>Your feed is ready for signals</h3>
      <p class="meta">Select interests and refresh after local ingestion jobs run to populate content.</p>
      <div class="toolbar" style="justify-content: center">
        <button class="ghost" @click="$emit('refresh')">Refresh</button>
      </div>
    </section>

    <ul v-else class="list feed-list">
      <li v-for="item in items" :key="item.type + ':' + item.id" class="feed-item card">
        <div class="row between gap wrap">
          <div>
            <strong>{{ item.title }}</strong>
            <p class="meta">
              <span class="chip muted">{{ displayItemType(item.type) }}</span>
              <span>by {{ item.author || "unknown" }}</span>
            </p>
          </div>
          <span class="meta score-pill">score {{ item.score }}</span>
        </div>

        <p>{{ item.summary }}</p>
        <p class="meta" v-if="item.tags?.length">Tags: {{ item.tags.join(", ") }}</p>

        <div class="table-actions action-row">
          <button class="ghost" :disabled="isActionLoading(item)" @click="action('clicked', item)">Open</button>
          <button class="ghost" :disabled="isActionLoading(item)" @click="action('not_interested', item)">Not Interested</button>
          <button class="ghost" :disabled="!canFollow(item) || followLoadingIds.includes(item.authorUserId)" @click="toggleFollow(item)">
            {{ isFollowed(item.authorUserId) ? "Unfollow Author" : "Follow Author" }}
          </button>
          <button class="ghost" :disabled="isActionLoading(item) || !item.author" @click="action('block_author', item)">Block Author</button>
          <button class="ghost" :disabled="isActionLoading(item) || !item.tags?.length" @click="action('block_tag', item)">Block Tag</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  items: {
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
  },
  preferences: {
    type: Object,
    default: null
  },
  currentUserId: {
    type: Number,
    default: null
  },
  followedAuthorIds: {
    type: Array,
    default: () => []
  },
  followLoadingIds: {
    type: Array,
    default: () => []
  },
  actionLoadingKeys: {
    type: Array,
    default: () => []
  },
  prefsSaving: {
    type: Boolean,
    default: false
  },
  showingCachedFeed: {
    type: Boolean,
    default: false
  },
  showingCachedPreferences: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["refresh", "action", "save-preferences", "toggle-follow"]);

const sportsOptions = ["running", "cycling", "walking", "strength", "swimming", "yoga", "football", "basketball"];
const selectedSports = ref([]);

watch(
  () => props.preferences,
  (value) => {
    selectedSports.value = value?.preferredSports ? [...value.preferredSports] : [];
  },
  { immediate: true }
);

function action(kind, item) {
  emit("action", {
    action: kind,
    itemType: item.type,
    similarityKey: item.similarityKey,
    contentItemId: item.type === "news" ? item.id : null,
    author: item.author || null,
    tag: item.tags?.[0] || null,
    localItemKey: item.type + ":" + item.id
  });
}

function canFollow(item) {
  return Boolean(item?.authorUserId) && Number(item.authorUserId) !== Number(props.currentUserId || 0);
}

function isFollowed(authorUserId) {
  return props.followedAuthorIds.includes(Number(authorUserId));
}

function toggleFollow(item) {
  if (!canFollow(item)) {
    return;
  }
  emit("toggle-follow", {
    authorUserId: Number(item.authorUserId),
    authorName: item.author || "unknown",
    currentlyFollowed: isFollowed(item.authorUserId)
  });
}

function toggleSport(sport) {
  if (selectedSports.value.includes(sport)) {
    selectedSports.value = selectedSports.value.filter((value) => value !== sport);
  } else {
    selectedSports.value = [...selectedSports.value, sport];
  }
}

function isActionLoading(item) {
  return props.actionLoadingKeys.includes(`${item.type}:${item.id}`);
}

function savePreferences() {
  emit("save-preferences", {
    preferredSports: selectedSports.value,
    includeTrainingUpdates: true,
    includeCourseUpdates: true,
    includeNews: true
  });
}

function displayItemType(type) {
  if (type === "course_update") {
    return "course update";
  }
  return type;
}
</script>

<style scoped>
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

.warning-text {
  color: var(--warning-foreground, #f2b36f);
}
</style>
