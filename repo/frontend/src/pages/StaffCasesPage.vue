<template>
  <section class="card page">
    <div class="page-header">
      <div>
        <h2>Coach/Support Case Handling</h2>
        <p class="meta">Review appeal queues and apply moderation outcomes.</p>
      </div>
      <button class="ghost" @click="load">Refresh</button>
    </div>

    <div class="toolbar">
      <button class="ghost" @click="filterStatus = ''">All</button>
      <button class="ghost" @click="filterStatus = 'submitted'">Submitted</button>
      <button class="ghost" @click="filterStatus = 'under_review'">Under Review</button>
      <button class="ghost" @click="filterStatus = 'upheld'">Upheld</button>
      <button class="ghost" @click="filterStatus = 'rejected'">Rejected</button>
    </div>

    <p v-if="loading" class="meta">Loading appeals...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!appeals.length" class="meta">No appeal cases found.</p>

    <ul v-else class="list">
      <li v-for="appeal in appeals" :key="appeal.id" class="card">
        <div class="row between">
          <strong>Appeal #{{ appeal.id }} · Review #{{ appeal.review_id }}</strong>
          <span class="status-pill" :class="appealStatusClass(appeal.appeal_status)">{{ readableAppealStatus(appeal.appeal_status) }}</span>
        </div>
        <p>{{ appeal.appeal_reason }}</p>
        <p class="meta">Review state: {{ readableReviewState(appeal.review_state) }}</p>

        <div class="row gap wrap">
          <button class="ghost" @click="setStatus(appeal.id, 'under_review')">Under Review</button>
          <button class="ghost" @click="setStatus(appeal.id, 'upheld')">Upheld</button>
          <button class="ghost" @click="setStatus(appeal.id, 'rejected')">Rejected</button>
          <button class="ghost" @click="setStatus(appeal.id, 'resolved')">Resolved</button>
          <button class="ghost" @click="reply(appeal.review_id)">Reply</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, watch } from "vue";
import { listStaffAppeals, updateAppealStatus, createStaffReply } from "../api";
import { useToast } from "../toast";

const appeals = ref([]);
const loading = ref(false);
const error = ref("");
const filterStatus = ref("");
const { pushToast } = useToast();

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const response = await listStaffAppeals(filterStatus.value || undefined);
    appeals.value = response.data || [];
  } catch (err) {
    error.value = err.message || "Failed to load appeals";
  } finally {
    loading.value = false;
  }
}

async function setStatus(appealId, status) {
  try {
    await updateAppealStatus(appealId, { appealStatus: status, note: `Updated to ${status} from staff UI` });
    pushToast("Appeal status updated", "success");
    await load();
  } catch (err) {
    pushToast(err.message || "Failed to update appeal", "error");
  }
}

async function reply(reviewId) {
  try {
    await createStaffReply({ reviewId, replyText: "Staff response from case view" });
    pushToast("Reply posted", "success");
  } catch (err) {
    pushToast(err.message || "Failed to post reply", "error");
  }
}

watch(filterStatus, () => {
  load();
});

load();

function appealStatusClass(status) {
  if (["resolved", "rejected"].includes(status)) {
    return "success";
  }
  if (["upheld"].includes(status)) {
    return "danger";
  }
  return "warning";
}

function readableAppealStatus(status) {
  const map = {
    submitted: "Submitted",
    under_review: "Under Review",
    upheld: "Upheld",
    rejected: "Rejected",
    resolved: "Resolved"
  };
  return map[status] || status;
}

function readableReviewState(state) {
  const map = {
    published: "Published",
    hidden: "Hidden",
    under_arbitration: "Under Arbitration",
    resolved: "Resolved"
  };
  return map[state] || state;
}
</script>
