const { pool } = require("../../db/pool");
const env = require("../../config/env");
const { cancelUnpaidOrder } = require("../orders/orders.service");
const {
  claimRunnableJobs,
  markJobCompleted,
  markJobFailed,
  enqueueJob,
  requeueStaleRunningJobs
} = require("../queue/queue.service");
const { applyPaymentRecordJob } = require("./payments.service");
const {
  enqueueIngestionScanJob,
  handleIngestionScanSourcesJob,
  handleIngestionProcessFileJob,
  logIngestionEvent
} = require("../ingestion/ingestion.service");
const logger = require("../../logger");

async function scheduleUnpaidOrderSweep() {
  await enqueueJob({
    jobType: "sweep_unpaid_orders",
    payload: { cutoffMinutes: env.ORDER_AUTO_CANCEL_MINUTES },
    idempotencyKey: `sweep_unpaid_orders:${new Date().toISOString().slice(0, 16)}`
  });
}

async function scheduleIngestionSweep() {
  await enqueueIngestionScanJob();
}

async function handleSweepUnpaidOrders(job) {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM orders
      WHERE order_status = 'pending_payment'
        AND payment_due_at <= CURRENT_TIMESTAMP
      LIMIT 100
    `
  );

  for (const row of rows) {
    await enqueueJob({
      jobType: "cancel_unpaid_order",
      payload: { orderId: row.id },
      idempotencyKey: `cancel_unpaid_order:${row.id}`
    });
  }
}

async function processOneJob(job) {
  if (job.jobType === "apply_payment_record") {
    await applyPaymentRecordJob(job.payload || {});
    return;
  }

  if (job.jobType === "cancel_unpaid_order") {
    await cancelUnpaidOrder(job.payload.orderId);
    return;
  }

  if (job.jobType === "sweep_unpaid_orders") {
    await handleSweepUnpaidOrders(job);
    return;
  }

  if (job.jobType === "ingestion_scan_sources") {
    await handleIngestionScanSourcesJob(job.payload || {});
    return;
  }

  if (job.jobType === "ingestion_process_file") {
    await handleIngestionProcessFileJob(job.payload || {});
    return;
  }

  if (job.jobType === "payment_compensation_review" || job.jobType === "refund_settlement_noop") {
    logger.warn({ jobId: job.id, jobType: job.jobType }, "Compensation/noop job acknowledged");
    return;
  }

  logger.warn({ jobId: job.id, jobType: job.jobType }, "Unknown job type; marked complete");
}

async function processQueueTick(limit = 10) {
  await requeueStaleRunningJobs();
  const jobs = await claimRunnableJobs(limit);
  for (const job of jobs) {
    try {
      await processOneJob(job);
      await markJobCompleted(job.id);
    } catch (error) {
      if (job.jobType === "ingestion_process_file" && job.payload?.sourceId) {
        const nextAttempts = Number(job.attempts || 0) + 1;
        const finalFailure = nextAttempts >= Number(job.maxAttempts || 0);
        try {
          await logIngestionEvent({
            sourceId: job.payload.sourceId,
            logType: finalFailure ? "failed" : "retried",
            logMessage: finalFailure ? "Ingestion job failed permanently" : "Ingestion job scheduled for retry",
            payload: {
              filePath: job.payload.filePath || null,
              error: error.message,
              attempt: nextAttempts,
              maxAttempts: job.maxAttempts
            }
          });
        } catch (logError) {
          logger.error({ err: logError, jobId: job.id }, "Failed to write ingestion retry/failure log");
        }
      }
      await markJobFailed(job, error.message);
    }
  }
}

module.exports = {
  processQueueTick,
  scheduleUnpaidOrderSweep,
  scheduleIngestionSweep
};
