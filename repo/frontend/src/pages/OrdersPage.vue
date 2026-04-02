<template>
  <section class="card page">
    <div class="page-header">
      <div>
        <h2>Order History</h2>
        <p class="meta">Structured order ledger with payment, refund, and completion actions.</p>
      </div>
      <button class="ghost" @click="loadOrders">Refresh</button>
    </div>

    <p v-if="loading" class="meta">Loading orders...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <section v-else-if="!orders.length" class="empty-state">
      <h3>No orders yet</h3>
      <p class="meta">Place an order from the catalog to start tracking payments and refunds.</p>
    </section>

    <div v-else class="table-wrap section-surface">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Status</th>
            <th>Type</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Refunded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>#{{ order.id }} · {{ order.course_service_title }}</td>
            <td><span class="status-pill" :class="statusClass(order.order_status)">{{ readableStatus(order.order_status) }}</span></td>
            <td>{{ readableType(order.order_type) }}</td>
            <td>${{ (order.total_amount_cents / 100).toFixed(2) }}</td>
            <td>${{ (order.paid_amount_cents / 100).toFixed(2) }}</td>
            <td>${{ (order.refunded_amount_cents / 100).toFixed(2) }}</td>
            <td>
              <div class="table-actions">
                <button @click="refreshPaymentStatus(order.id)">Check</button>
                <button class="ghost" :disabled="refundLoadingId === order.id" @click="submitRefund(order.id)">Refund</button>
                <button class="ghost" :disabled="completeLoadingId === order.id || order.order_status === 'completed'" @click="complete(order.id)">Complete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { listOrders, getOrderPaymentStatus, requestRefund, completeOrder } from "../api";
import { useToast } from "../toast";
import { isLikelyOfflineError, recordOfflineIntent, buildOfflineRetryMessage } from "../offline/mutation-intents";

const orders = ref([]);
const loading = ref(false);
const error = ref("");
const refundLoadingId = ref(null);
const completeLoadingId = ref(null);
const { pushToast } = useToast();

async function loadOrders() {
  loading.value = true;
  error.value = "";
  try {
    const response = await listOrders();
    orders.value = response.data || [];
  } catch (err) {
    error.value = err.message || "Failed to load orders";
  } finally {
    loading.value = false;
  }
}

async function refreshPaymentStatus(orderId) {
  try {
    const response = await getOrderPaymentStatus(orderId);
    pushToast(`Order ${orderId}: ${response.data.orderStatus}`, "success");
    await loadOrders();
  } catch (err) {
    pushToast(err.message || "Failed to fetch payment status", "error");
  }
}

async function submitRefund(orderId) {
  if (refundLoadingId.value === orderId) {
    return;
  }
  refundLoadingId.value = orderId;
  try {
    await requestRefund(orderId, {
      amountDollars: 0.01,
      reason: "User requested partial refund",
      idempotencyKey: `frontend-refund-${orderId}-${Date.now()}`
    });
    pushToast("Refund submitted", "success");
    await loadOrders();
  } catch (err) {
    if (isLikelyOfflineError(err)) {
      recordOfflineIntent("order_refund", { orderId });
      pushToast(buildOfflineRetryMessage("Refund request"), "error");
    } else {
      pushToast(err.message || "Refund failed", "error");
    }
  } finally {
    refundLoadingId.value = null;
  }
}

async function complete(orderId) {
  if (completeLoadingId.value === orderId) {
    return;
  }
  completeLoadingId.value = orderId;
  try {
    await completeOrder(orderId);
    pushToast("Order marked completed", "success");
    await loadOrders();
  } catch (err) {
    if (isLikelyOfflineError(err)) {
      recordOfflineIntent("order_complete", { orderId });
      pushToast(buildOfflineRetryMessage("Order completion"), "error");
    } else {
      pushToast(err.message || "Failed to complete order", "error");
    }
  } finally {
    completeLoadingId.value = null;
  }
}

function statusClass(status) {
  if (["paid", "completed"].includes(status)) {
    return "success";
  }
  if (["refund_partial", "refund_full", "cancelled"].includes(status)) {
    return "danger";
  }
  return "warning";
}

function readableStatus(status) {
  const map = {
    created: "Created",
    pending_payment: "Pending Payment",
    paid: "Paid",
    completed: "Completed",
    cancelled: "Cancelled",
    refund_partial: "Partially Refunded",
    refund_full: "Fully Refunded"
  };
  return map[status] || status;
}

function readableType(type) {
  if (type === "course") {
    return "Course";
  }
  if (type === "service") {
    return "Service";
  }
  return type;
}

onMounted(loadOrders);
</script>
