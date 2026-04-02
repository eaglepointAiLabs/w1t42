<template>
  <section class="page admin-grid">
    <section class="card">
      <div class="page-header">
        <div>
          <h2>Admin Operations</h2>
          <p class="meta">Governance dictionaries, blacklists, ingestion sources, and operational jobs.</p>
        </div>
        <button class="ghost" :disabled="loading" @click="bootstrap">Refresh</button>
      </div>
      <div class="toolbar">
        <button @click="triggerJobs">Run Queue Tick</button>
        <button @click="triggerIngestionScan">Queue Ingestion Scan</button>
      </div>
      <p v-if="loading" class="meta">Loading admin data...</p>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section class="card">
      <h3>Review Dimensions</h3>
      <form class="row gap wrap" @submit.prevent="addDimension">
        <input v-model="dimensionForm.keyName" placeholder="key" required />
        <input v-model="dimensionForm.label" placeholder="label" required />
        <input v-model.number="dimensionForm.weight" type="number" min="0.1" step="0.1" required />
        <button type="submit">Add/Update</button>
      </form>
      <ul class="list">
        <li v-for="d in dimensions" :key="d.id">{{ d.key_name }} - {{ d.label }} ({{ d.weight }})</li>
      </ul>
    </section>

    <section class="card">
      <h3>Sensitive Dictionary</h3>
      <form class="row gap wrap" @submit.prevent="addWord">
        <input v-model="wordInput" placeholder="word" required />
        <button type="submit">Add Word</button>
      </form>
      <ul class="list">
        <li v-for="w in words" :key="w.id">{{ w.word }} ({{ w.is_active ? "active" : "inactive" }})</li>
      </ul>
    </section>

    <section class="card">
      <h3>Hash Deny List</h3>
      <form class="row gap wrap" @submit.prevent="addHash">
        <input v-model="hashForm.sha256Hash" placeholder="sha256 hash" required />
        <input v-model="hashForm.reason" placeholder="reason" required />
        <button type="submit">Add Hash</button>
      </form>
      <ul class="list">
        <li v-for="h in hashes" :key="h.id">{{ h.sha256_hash }} - {{ h.reason }}</li>
      </ul>
    </section>

    <section class="card">
      <h3>Review Blacklist</h3>
      <form class="row gap wrap" @submit.prevent="addBlacklist">
        <input v-model.number="blacklistForm.userId" type="number" placeholder="user id" required />
        <input v-model="blacklistForm.reason" placeholder="reason" required />
        <button type="submit">Blacklist 30d</button>
      </form>
      <ul class="list">
        <li v-for="b in blacklist" :key="b.id">User {{ b.user_id }} until {{ b.ends_at }} ({{ b.is_active ? "active" : "inactive" }})</li>
      </ul>
    </section>

    <section class="card">
      <h3>Content Sources</h3>
      <form class="row gap wrap" @submit.prevent="addSource">
        <input v-model="sourceForm.sourceName" placeholder="name" required />
        <select v-model="sourceForm.sourceType">
          <option value="rss">rss</option>
          <option value="api_payload">api_payload</option>
          <option value="html_extract">html_extract</option>
        </select>
        <input v-model="sourceForm.ingestPath" placeholder="ingest path" required />
        <button type="submit">Add Source</button>
      </form>
      <ul class="list">
        <li v-for="s in sources" :key="s.id">{{ s.source_name }} - {{ s.source_type }} - {{ s.ingest_path }}</li>
      </ul>
    </section>

    <section class="card">
      <h3>Ingestion Logs</h3>
      <ul class="list">
        <li v-for="l in logs" :key="l.id">[{{ l.log_type }}] source {{ l.source_id }} - {{ l.log_message }}</li>
      </ul>
      <p v-if="!logs.length" class="meta">No logs yet.</p>
    </section>
  </section>
</template>

<script setup>
import { reactive, ref } from "vue";
import {
  listReviewDimensions,
  upsertReviewDimension,
  listSensitiveWords,
  addSensitiveWord,
  listDenylistHashes,
  addDenylistHash,
  listReviewBlacklist,
  addReviewBlacklist,
  listIngestionSources,
  createIngestionSource,
  listIngestionLogs,
  runIngestionScan,
  runJobsProcessOnce
} from "../api";
import { useToast } from "../toast";

const dimensions = ref([]);
const words = ref([]);
const hashes = ref([]);
const blacklist = ref([]);
const sources = ref([]);
const logs = ref([]);
const loading = ref(false);
const error = ref("");
const { pushToast } = useToast();

const dimensionForm = reactive({ keyName: "", label: "", weight: 1, isActive: true });
const wordInput = ref("");
const hashForm = reactive({ sha256Hash: "", reason: "" });
const blacklistForm = reactive({ userId: null, reason: "" });
const sourceForm = reactive({
  sourceName: "",
  sourceType: "rss",
  ingestPath: "/app/ingestion_drop/admin-source",
  allowlisted: true,
  blocklisted: false,
  rateLimitPerMinute: 60,
  sourceStatus: "active"
});

async function bootstrap() {
  loading.value = true;
  error.value = "";
  try {
    const [d, w, h, b, s, l] = await Promise.all([
      listReviewDimensions(),
      listSensitiveWords(),
      listDenylistHashes(),
      listReviewBlacklist(),
      listIngestionSources(),
      listIngestionLogs(100)
    ]);
    dimensions.value = d.data || [];
    words.value = w.data || [];
    hashes.value = h.data || [];
    blacklist.value = b.data || [];
    sources.value = s.data || [];
    logs.value = l.data || [];
  } catch (err) {
    error.value = err.message || "Failed to load admin data";
    pushToast(error.value, "error");
  } finally {
    loading.value = false;
  }
}

async function addDimension() {
  try {
    await upsertReviewDimension(dimensionForm);
    pushToast("Dimension saved", "success");
    await bootstrap();
  } catch (err) {
    pushToast(err.message || "Failed to save dimension", "error");
  }
}

async function addWord() {
  try {
    await addSensitiveWord(wordInput.value);
    wordInput.value = "";
    pushToast("Word added", "success");
    await bootstrap();
  } catch (err) {
    pushToast(err.message || "Failed to add word", "error");
  }
}

async function addHash() {
  try {
    await addDenylistHash(hashForm);
    hashForm.sha256Hash = "";
    hashForm.reason = "";
    pushToast("Hash added", "success");
    await bootstrap();
  } catch (err) {
    pushToast(err.message || "Failed to add hash", "error");
  }
}

async function addBlacklist() {
  try {
    await addReviewBlacklist({ userId: Number(blacklistForm.userId), reason: blacklistForm.reason, days: 30 });
    pushToast("User blacklisted", "success");
    await bootstrap();
  } catch (err) {
    pushToast(err.message || "Failed to blacklist", "error");
  }
}

async function addSource() {
  try {
    await createIngestionSource(sourceForm);
    pushToast("Source added", "success");
    await bootstrap();
  } catch (err) {
    pushToast(err.message || "Failed to add source", "error");
  }
}

async function triggerIngestionScan() {
  try {
    await runIngestionScan();
    pushToast("Ingestion scan queued", "success");
  } catch (err) {
    pushToast(err.message || "Failed to queue scan", "error");
  }
}

async function triggerJobs() {
  try {
    await runJobsProcessOnce();
    pushToast("Queue tick executed", "success");
    await bootstrap();
  } catch (err) {
    pushToast(err.message || "Failed queue tick", "error");
  }
}

bootstrap();
</script>
