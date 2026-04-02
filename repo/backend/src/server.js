const app = require("./app");
const env = require("./config/env");
const logger = require("./logger");
const { checkDbConnection, pool } = require("./db/pool");

let server;

async function start() {
  try {
    await checkDbConnection();
    logger.info("MySQL connectivity check passed");

    server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, "Backend server started");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start backend server");
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down backend server");
  if (server) {
    server.close();
  }
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
