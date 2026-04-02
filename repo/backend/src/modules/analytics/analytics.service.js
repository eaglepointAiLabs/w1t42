const fs = require("fs");
const path = require("path");
const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { writeAuditEvent } = require("../../services/audit-log");
const { enrollmentFunnelMetrics, renewalRateMetrics, refundRateMetrics, toCsv } = require("./analytics.logic");

const EXPORT_DIR = path.resolve(process.cwd(), "exports");

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function buildFiltersWhere(filters = {}) {
  const where = [];
  const values = [];

  if (filters.fromDate) {
    where.push("o.created_at >= ?");
    values.push(new Date(filters.fromDate));
  }
  if (filters.toDate) {
    where.push("o.created_at <= ?");
    values.push(new Date(filters.toDate));
  }
  if (filters.courseServiceId) {
    where.push("o.course_service_id = ?");
    values.push(filters.courseServiceId);
  }
  if (filters.kind) {
    where.push("o.order_type = ?");
    values.push(filters.kind);
  }
  if (filters.channel) {
    where.push("o.sales_channel = ?");
    values.push(filters.channel);
  }
  if (filters.instructorUserId) {
    where.push("o.assigned_instructor_user_id = ?");
    values.push(filters.instructorUserId);
  }
  if (filters.locationCode) {
    where.push("o.location_code = ?");
    values.push(filters.locationCode);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values
  };
}

async function loadOrdersByFilters(filters = {}) {
  const { clause, values } = buildFiltersWhere(filters);
  const [rows] = await pool.query(
    `
      SELECT o.*
      FROM orders o
      ${clause}
      ORDER BY o.id DESC
      LIMIT 5000
    `,
    values
  );
  return rows;
}

async function reportEnrollmentFunnel(filters) {
  const orders = await loadOrdersByFilters(filters);
  return enrollmentFunnelMetrics(orders);
}

async function reportCoursePopularity(filters) {
  const { clause, values } = buildFiltersWhere(filters);
  const [rows] = await pool.query(
    `
      SELECT o.course_service_id, c.title, c.kind, COUNT(*) AS enrollments,
             SUM(o.total_amount_cents) AS gross_revenue_cents
      FROM orders o
      JOIN courses_services c ON c.id = o.course_service_id
      ${clause}
      GROUP BY o.course_service_id, c.title, c.kind
      ORDER BY enrollments DESC, gross_revenue_cents DESC
      LIMIT 200
    `,
    values
  );
  return rows;
}

async function reportRenewalRates() {
  const [rows] = await pool.query(
    `
      SELECT user_id, entitlement_type, starts_at, ends_at
      FROM entitlements
      WHERE entitlement_type = 'subscription'
      ORDER BY user_id, starts_at ASC
    `
  );
  return renewalRateMetrics(rows);
}

async function reportRefundRates(filters) {
  const orders = await loadOrdersByFilters(filters);
  return refundRateMetrics(orders);
}

async function reportChannelPerformance(filters) {
  const { clause, values } = buildFiltersWhere(filters);
  const [rows] = await pool.query(
    `
      SELECT o.sales_channel,
             COUNT(*) AS total_orders,
             SUM(o.total_amount_cents) AS gross_revenue_cents,
             SUM(o.refunded_amount_cents) AS refunded_cents,
             SUM(o.total_amount_cents - o.refunded_amount_cents) AS net_revenue_cents
      FROM orders o
      ${clause}
      GROUP BY o.sales_channel
      ORDER BY net_revenue_cents DESC
    `,
    values
  );
  return rows;
}

async function reportInstructorUtilization(filters) {
  const { clause, values } = buildFiltersWhere(filters);
  const [rows] = await pool.query(
    `
      SELECT COALESCE(o.assigned_instructor_user_id, c.provider_user_id) AS instructor_user_id,
             u.username AS instructor_name,
             COUNT(*) AS assigned_orders,
             SUM(o.total_amount_cents) AS gross_revenue_cents,
             SUM(CASE WHEN o.order_status IN ('completed','refund_partial','refund_full') THEN 1 ELSE 0 END) AS completed_orders
      FROM orders o
      JOIN courses_services c ON c.id = o.course_service_id
      LEFT JOIN users u ON u.id = COALESCE(o.assigned_instructor_user_id, c.provider_user_id)
      ${clause}
      GROUP BY instructor_user_id, instructor_name
      ORDER BY assigned_orders DESC
    `,
    values
  );
  return rows;
}

async function reportLocationRevenueCost(filters) {
  const { clause, values } = buildFiltersWhere(filters);
  const [rows] = await pool.query(
    `
      SELECT o.location_code,
             COUNT(*) AS total_orders,
             SUM(o.total_amount_cents) AS revenue_cents,
             SUM(o.estimated_cost_cents) AS cost_cents,
             SUM(o.total_amount_cents - o.estimated_cost_cents) AS gross_margin_cents
      FROM orders o
      ${clause}
      GROUP BY o.location_code
      ORDER BY gross_margin_cents DESC
    `,
    values
  );
  return rows;
}

async function runReport(report, filters = {}) {
  if (report === "enrollment_funnel") {
    return reportEnrollmentFunnel(filters);
  }
  if (report === "course_popularity") {
    return reportCoursePopularity(filters);
  }
  if (report === "renewal_rates") {
    return reportRenewalRates();
  }
  if (report === "refund_rates") {
    return reportRefundRates(filters);
  }
  if (report === "channel_performance") {
    return reportChannelPerformance(filters);
  }
  if (report === "instructor_utilization") {
    return reportInstructorUtilization(filters);
  }
  if (report === "location_revenue_cost") {
    return reportLocationRevenueCost(filters);
  }

  throw new ApiError(400, "UNKNOWN_REPORT", `Unsupported report: ${report}`);
}

async function runDashboard(filters = {}) {
  const [enrollmentFunnel, coursePopularity, renewalRates, refundRates, channelPerformance, instructorUtilization, locationRevenueCost] =
    await Promise.all([
      reportEnrollmentFunnel(filters),
      reportCoursePopularity(filters),
      reportRenewalRates(),
      reportRefundRates(filters),
      reportChannelPerformance(filters),
      reportInstructorUtilization(filters),
      reportLocationRevenueCost(filters)
    ]);

  return {
    enrollmentFunnel,
    coursePopularity,
    renewalRates,
    refundRates,
    channelPerformance,
    instructorUtilization,
    locationRevenueCost
  };
}

async function exportReportCsv({ requestedByUserId, report, filters }) {
  const data = await runReport(report, filters);
  const rows = Array.isArray(data) ? data : [data];
  const csv = toCsv(rows);

  ensureExportDir();
  const fileName = `${report}-${Date.now()}.csv`;
  const fullPath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(fullPath, csv, "utf8");

  const [exportLogInsert] = await pool.query(
    `
      INSERT INTO analytics_export_logs (export_type, requested_by_user_id, export_status, output_path, requested_at, completed_at)
      VALUES (?, ?, 'completed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [report, requestedByUserId, fullPath]
  );

  await pool.query(
    `
      INSERT INTO analytics_export_access_logs (requested_by_user_id, export_type, filters_json, row_count, output_path)
      VALUES (?, ?, ?, ?, ?)
    `,
    [requestedByUserId, report, JSON.stringify(filters || {}), rows.length, fullPath]
  );

  await writeAuditEvent({
    actorUserId: requestedByUserId,
    eventType: "analytics.export.generated",
    entityType: "analytics_export",
    entityId: String(exportLogInsert.insertId),
    payload: { report, rowCount: rows.length, outputPath: fullPath, filters: filters || {} }
  });

  return {
    exportLogId: exportLogInsert.insertId,
    fileName,
    csv,
    rowCount: rows.length
  };
}

async function listExportAccessLogs(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const [rows] = await pool.query(
    `
      SELECT l.*, u.username AS requested_by_username
      FROM analytics_export_access_logs l
      JOIN users u ON u.id = l.requested_by_user_id
      ORDER BY l.id DESC
      LIMIT ${safeLimit}
    `
  );
  return rows;
}

module.exports = {
  runReport,
  runDashboard,
  exportReportCsv,
  listExportAccessLogs
};
