const logger = require("./logger");
const { checkDbConnection, pool } = require("./db/pool");
const env = require("./config/env");
const { processQueueTick, scheduleUnpaidOrderSweep, scheduleIngestionSweep } = require("./modules/payments/processor.service");

let interval;
let ingestionTickCounter = 0;

async function startWorker() {
  try {
    await checkDbConnection();
    logger.info("Worker DB connectivity check passed");

    await scheduleUnpaidOrderSweep();
    await scheduleIngestionSweep();
    interval = setInterval(async () => {
      try {
        await scheduleUnpaidOrderSweep();
        ingestionTickCounter += 1;
        const scanEveryTicks = Math.max(
          1,
          Math.round((env.INGESTION_SCAN_INTERVAL_MINUTES * 60 * 1000) / env.WORKER_POLL_INTERVAL_MS)
        );
        if (ingestionTickCounter % scanEveryTicks === 0) {
          await scheduleIngestionSweep();
        }
        await processQueueTick(20);
      } catch (error) {
        logger.error({ err: error }, "Worker tick failed");
      }
    }, env.WORKER_POLL_INTERVAL_MS);

    logger.info({ intervalMs: env.WORKER_POLL_INTERVAL_MS }, "Worker queue processor started");
  } catch (error) {
    logger.error({ err: error }, "Worker startup failed");
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, "Worker shutdown requested");
  if (interval) {
    clearInterval(interval);
  }
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startWorker();
