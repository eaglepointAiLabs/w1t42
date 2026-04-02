const fs = require("fs");
const path = require("path");
const { pool } = require("../src/db/pool");
const logger = require("../src/logger");

const seedsDir = path.resolve(__dirname, "../seeds");

function loadSeeds() {
  return fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => require(path.join(seedsDir, file)));
}

async function ensureSeedHistory(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS seed_history (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function run() {
  const connection = await pool.getConnection();
  const seeds = loadSeeds();

  try {
    await connection.beginTransaction();
    await ensureSeedHistory(connection);

    const [rows] = await connection.query("SELECT id FROM seed_history");
    const applied = new Set(rows.map((row) => row.id));

    for (const seed of seeds) {
      if (applied.has(seed.id)) {
        continue;
      }

      logger.info({ seed: seed.id }, "Applying seed");
      await seed.run(connection);
      await connection.query("INSERT INTO seed_history (id) VALUES (?)", [seed.id]);
    }

    await connection.commit();
    logger.info("Seed command completed");
  } catch (error) {
    await connection.rollback();
    logger.error({ err: error }, "Seed command failed");
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
