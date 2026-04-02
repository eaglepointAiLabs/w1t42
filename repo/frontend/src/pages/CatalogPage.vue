<template>
  <section class="card page catalog-page">
    <div class="page-header">
      <div>
        <h2>Courses & Services</h2>
        <p class="meta">Browse active offerings and place orders with custom amounts.</p>
      </div>
      <button class="ghost" @click="loadCatalog">Refresh</button>
    </div>

    <p v-if="loading" class="meta">Loading catalog...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <section v-else-if="!items.length" class="empty-state">
      <h3>No active offerings</h3>
      <p class="meta">Catalog entries will appear here once courses or services are available.</p>
    </section>

    <div v-else class="table-wrap section-surface">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ item.title }}</td>
            <td><span class="status-pill">{{ displayKind(item.kind) }}</span></td>
            <td class="meta">{{ item.description || "No description" }}</td>
            <td>
              <input
                v-model.number="priceInputs[item.id]"
                class="inline-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="19.99"
                required
              />
            </td>
            <td>
              <button :disabled="orderingId === item.id" @click="placeOrder(item)">
                {{ orderingId === item.id ? "Placing..." : "Place" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { listCatalog, createOrder } from "../api";
import { useToast } from "../toast";

const items = ref([]);
const loading = ref(false);
const error = ref("");
const orderingId = ref(null);
const priceInputs = reactive({});
const { pushToast } = useToast();

async function loadCatalog() {
  loading.value = true;
  error.value = "";
  try {
    const response = await listCatalog();
    items.value = response.data || [];
    for (const item of items.value) {
      if (!priceInputs[item.id]) {
        priceInputs[item.id] = 19.99;
      }
    }
  } catch (err) {
    error.value = err.message || "Failed to load catalog";
  } finally {
    loading.value = false;
  }
}

async function placeOrder(item) {
  orderingId.value = item.id;
  try {
    const amount = Number(priceInputs[item.id] || 0);
    await createOrder({
      courseServiceId: item.id,
      orderType: item.kind,
      totalAmountDollars: amount,
      idempotencyKey: `frontend-order-${item.id}-${Date.now()}`
    });
    pushToast("Order placed", "success");
  } catch (err) {
    pushToast(err.message || "Failed to place order", "error");
  } finally {
    orderingId.value = null;
  }
}

function displayKind(kind) {
  if (kind === "course") {
    return "Course";
  }
  if (kind === "service") {
    return "Service";
  }
  return kind;
}

onMounted(loadCatalog);
</script>
