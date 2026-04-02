<template>
  <section class="page analytics-page">
    <section class="card">
      <div class="page-header">
        <div>
          <h2>Analytics Dashboard</h2>
          <p class="meta">Enrollment, revenue, utilization, and retention metrics for support/admin operations.</p>
        </div>
        <button class="ghost" :disabled="loading" @click="loadDashboard">Refresh</button>
      </div>

      <form class="grid analytics-filters" @submit.prevent="applyFilters">
        <div class="grid-2">
          <label>
            From Date
            <input v-model="filters.fromDate" type="date" />
          </label>
          <label>
            To Date
            <input v-model="filters.toDate" type="date" />
          </label>
          <label>
            Course/Service ID
            <input v-model="filters.courseServiceId" type="number" min="1" placeholder="optional" />
          </label>
          <label>
            Kind
            <select v-model="filters.kind">
              <option value="">all</option>
              <option value="course">course</option>
              <option value="service">service</option>
            </select>
          </label>
          <label>
            Channel
            <input v-model="filters.channel" placeholder="direct" />
          </label>
          <label>
            Instructor User ID
            <input v-model="filters.instructorUserId" type="number" min="1" placeholder="optional" />
          </label>
          <label class="grid-span-2">
            Location Code
            <input v-model="filters.locationCode" placeholder="global" />
          </label>
        </div>

        <div class="row gap wrap">
          <button type="submit" :disabled="loading">Apply Filters</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetFilters">Clear Filters</button>
        </div>
      </form>
    </section>

    <section v-if="loading" class="card">
      <p class="meta">Loading analytics dashboard...</p>
    </section>

    <section v-else-if="error" class="card">
      <p class="error">{{ error }}</p>
    </section>

    <template v-else>
      <section class="card">
        <div class="row between wrap gap">
          <h3>Enrollment Funnel</h3>
          <button class="ghost" :disabled="exporting.enrollment_funnel" @click="exportReport('enrollment_funnel')">
            {{ exporting.enrollment_funnel ? "Exporting..." : "Export CSV" }}
          </button>
        </div>
        <div class="grid-2">
          <p><strong>Created:</strong> {{ funnelCounts.created }}</p>
          <p><strong>Pending Payment:</strong> {{ funnelCounts.pending_payment }}</p>
          <p><strong>Paid:</strong> {{ funnelCounts.paid }}</p>
          <p><strong>Completed:</strong> {{ funnelCounts.completed }}</p>
          <p><strong>Cancelled:</strong> {{ funnelCounts.cancelled }}</p>
          <p><strong>Refunded:</strong> {{ funnelCounts.refund_partial + funnelCounts.refund_full }}</p>
        </div>
        <p class="meta">
          Payment conversion {{ formatPct(dashboard.enrollmentFunnel?.rates?.paymentConversionRate) }} · Completion
          {{ formatPct(dashboard.enrollmentFunnel?.rates?.completionRate) }} · Cancellation
          {{ formatPct(dashboard.enrollmentFunnel?.rates?.cancellationRate) }}
        </p>
      </section>

      <section class="card">
        <div class="row between wrap gap">
          <h3>Course Popularity</h3>
          <button class="ghost" :disabled="exporting.course_popularity" @click="exportReport('course_popularity')">
            {{ exporting.course_popularity ? "Exporting..." : "Export CSV" }}
          </button>
        </div>
        <div class="table-wrap" v-if="dashboard.coursePopularity?.length">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Kind</th>
                <th>Enrollments</th>
                <th>Gross Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dashboard.coursePopularity" :key="row.course_service_id">
                <td>{{ row.title }}</td>
                <td>{{ row.kind }}</td>
                <td>{{ row.enrollments }}</td>
                <td>{{ formatCents(row.gross_revenue_cents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="meta">No course popularity data for selected filters.</p>
      </section>

      <section class="card">
        <div class="row between wrap gap">
          <h3>Renewal and Refund Rates</h3>
          <div class="row gap wrap">
            <button class="ghost" :disabled="exporting.renewal_rates" @click="exportReport('renewal_rates')">
              {{ exporting.renewal_rates ? "Exporting..." : "Export Renewal CSV" }}
            </button>
            <button class="ghost" :disabled="exporting.refund_rates" @click="exportReport('refund_rates')">
              {{ exporting.refund_rates ? "Exporting..." : "Export Refund CSV" }}
            </button>
          </div>
        </div>
        <div class="grid-2">
          <p><strong>Renewed Users:</strong> {{ dashboard.renewalRates?.renewedUsers || 0 }}</p>
          <p><strong>Total Subscription Users:</strong> {{ dashboard.renewalRates?.totalUsers || 0 }}</p>
          <p><strong>Renewal Rate:</strong> {{ formatPct(dashboard.renewalRates?.renewalRate) }}</p>
          <p><strong>Refund Rate:</strong> {{ formatPct(dashboard.refundRates?.refundRate) }}</p>
        </div>
      </section>

      <section class="card">
        <div class="row between wrap gap">
          <h3>Channel Performance</h3>
          <button class="ghost" :disabled="exporting.channel_performance" @click="exportReport('channel_performance')">
            {{ exporting.channel_performance ? "Exporting..." : "Export CSV" }}
          </button>
        </div>
        <div class="table-wrap" v-if="dashboard.channelPerformance?.length">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Orders</th>
                <th>Gross Revenue</th>
                <th>Refunded</th>
                <th>Net Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dashboard.channelPerformance" :key="row.sales_channel">
                <td>{{ row.sales_channel || "(none)" }}</td>
                <td>{{ row.total_orders }}</td>
                <td>{{ formatCents(row.gross_revenue_cents) }}</td>
                <td>{{ formatCents(row.refunded_cents) }}</td>
                <td>{{ formatCents(row.net_revenue_cents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="meta">No channel performance data for selected filters.</p>
      </section>

      <section class="card">
        <div class="row between wrap gap">
          <h3>Instructor Utilization</h3>
          <button class="ghost" :disabled="exporting.instructor_utilization" @click="exportReport('instructor_utilization')">
            {{ exporting.instructor_utilization ? "Exporting..." : "Export CSV" }}
          </button>
        </div>
        <div class="table-wrap" v-if="dashboard.instructorUtilization?.length">
          <table>
            <thead>
              <tr>
                <th>Instructor</th>
                <th>Assigned Orders</th>
                <th>Completed Orders</th>
                <th>Gross Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dashboard.instructorUtilization" :key="row.instructor_user_id || row.instructor_name">
                <td>{{ row.instructor_name || `User ${row.instructor_user_id || "-"}` }}</td>
                <td>{{ row.assigned_orders }}</td>
                <td>{{ row.completed_orders }}</td>
                <td>{{ formatCents(row.gross_revenue_cents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="meta">No instructor utilization data for selected filters.</p>
      </section>

      <section class="card">
        <div class="row between wrap gap">
          <h3>Location Revenue and Cost</h3>
          <button class="ghost" :disabled="exporting.location_revenue_cost" @click="exportReport('location_revenue_cost')">
            {{ exporting.location_revenue_cost ? "Exporting..." : "Export CSV" }}
          </button>
        </div>
        <div class="table-wrap" v-if="dashboard.locationRevenueCost?.length">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Gross Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dashboard.locationRevenueCost" :key="row.location_code">
                <td>{{ row.location_code || "(none)" }}</td>
                <td>{{ row.total_orders }}</td>
                <td>{{ formatCents(row.revenue_cents) }}</td>
                <td>{{ formatCents(row.cost_cents) }}</td>
                <td>{{ formatCents(row.gross_margin_cents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="meta">No location revenue/cost data for selected filters.</p>
      </section>

      <section class="card">
        <div class="row between wrap gap">
          <h3>CSV Export Access Logs</h3>
          <button class="ghost" :disabled="logsLoading" @click="loadLogs">Refresh Logs</button>
        </div>
        <p v-if="logsLoading" class="meta">Loading export logs...</p>
        <p v-else-if="!exportLogs.length" class="meta">No export logs yet.</p>
        <div class="table-wrap" v-else>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Report</th>
                <th>Rows</th>
                <th>Filters</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in exportLogs" :key="row.id">
                <td>{{ row.created_at }}</td>
                <td>{{ row.requested_by_username }}</td>
                <td>{{ row.export_type }}</td>
                <td>{{ row.row_count }}</td>
                <td class="small">{{ row.filters_json }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { exportAnalyticsCsv, getAnalyticsDashboard, listAnalyticsExportLogs } from "../api";
import { useToast } from "../toast";

const loading = ref(false);
const logsLoading = ref(false);
const error = ref("");
const exportLogs = ref([]);
const dashboard = ref({});
const { pushToast } = useToast();

const filters = reactive({
  fromDate: "",
  toDate: "",
  courseServiceId: "",
  kind: "",
  channel: "",
  instructorUserId: "",
  locationCode: ""
});

const exporting = reactive({
  enrollment_funnel: false,
  course_popularity: false,
  renewal_rates: false,
  refund_rates: false,
  channel_performance: false,
  instructor_utilization: false,
  location_revenue_cost: false
});

const funnelCounts = computed(() => ({
  created: Number(dashboard.value.enrollmentFunnel?.counts?.created || 0),
  pending_payment: Number(dashboard.value.enrollmentFunnel?.counts?.pending_payment || 0),
  paid: Number(dashboard.value.enrollmentFunnel?.counts?.paid || 0),
  completed: Number(dashboard.value.enrollmentFunnel?.counts?.completed || 0),
  cancelled: Number(dashboard.value.enrollmentFunnel?.counts?.cancelled || 0),
  refund_partial: Number(dashboard.value.enrollmentFunnel?.counts?.refund_partial || 0),
  refund_full: Number(dashboard.value.enrollmentFunnel?.counts?.refund_full || 0)
}));

function activeFilters() {
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function formatCents(value) {
  const cents = Number(value || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPct(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(2)}%`;
}

async function loadDashboard() {
  loading.value = true;
  error.value = "";
  try {
    const response = await getAnalyticsDashboard(activeFilters());
    dashboard.value = response.data || {};
  } catch (err) {
    error.value = err.message || "Failed to load analytics dashboard";
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  logsLoading.value = true;
  try {
    const response = await listAnalyticsExportLogs(100);
    exportLogs.value = response.data || [];
  } catch (err) {
    pushToast(err.message || "Failed to load export logs", "error");
  } finally {
    logsLoading.value = false;
  }
}

async function applyFilters() {
  await Promise.all([loadDashboard(), loadLogs()]);
}

async function resetFilters() {
  filters.fromDate = "";
  filters.toDate = "";
  filters.courseServiceId = "";
  filters.kind = "";
  filters.channel = "";
  filters.instructorUserId = "";
  filters.locationCode = "";
  await applyFilters();
}

async function exportReport(report) {
  exporting[report] = true;
  try {
    const csv = await exportAnalyticsCsv(report, activeFilters());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const fileName = `${report}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

    if (typeof window !== "undefined") {
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }

    pushToast(`Exported ${report} CSV`, "success");
    await loadLogs();
  } catch (err) {
    pushToast(err.message || `Failed to export ${report}`, "error");
  } finally {
    exporting[report] = false;
  }
}

applyFilters();
</script>

<style scoped>
.analytics-filters {
  margin-top: 0.8rem;
}

.analytics-page table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.analytics-page th,
.analytics-page td {
  border-bottom: 1px solid var(--line);
  text-align: left;
  padding: 0.45rem;
  vertical-align: top;
}

.analytics-page thead th {
  background: var(--bg-soft);
}

.table-wrap {
  overflow-x: auto;
}

.small {
  font-size: 0.82rem;
  color: var(--text-muted);
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
