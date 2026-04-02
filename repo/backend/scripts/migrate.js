const fs = require("fs");
const path = require("path");
const { pool } = require("../src/db/pool");
const logger = require("../src/logger");

const migrationsDir = path.resolve(__dirname, "../migrations");
const direction = process.argv[2] || "up";

function loadMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => require(path.join(migrationsDir, file)));
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function up(connection, migrations) {
  const [rows] = await connection.query("SELECT id FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    logger.info({ migration: migration.id }, "Applying migration");
    await migration.up(connection);
    await connection.query("INSERT INTO schema_migrations (id) VALUES (?)", [migration.id]);
  }
}

async function down(connection, migrations) {
  const [rows] = await connection.query(
    "SELECT id FROM schema_migrations ORDER BY applied_at DESC, id DESC LIMIT 1"
  );

  if (!rows.length) {
    logger.info("No migrations to roll back");
    return;
  }

  const migrationId = rows[0].id;
  const migration = migrations.find((item) => item.id === migrationId);

  if (!migration || typeof migration.down !== "function") {
    throw new Error(`Missing down migration handler for ${migrationId}`);
  }

  logger.info({ migration: migration.id }, "Rolling back migration");
  await migration.down(connection);
  await connection.query("DELETE FROM schema_migrations WHERE id = ?", [migration.id]);
}

async function run() {
  const connection = await pool.getConnection();
  const migrations = loadMigrations();

  try {
    await connection.beginTransaction();
    await ensureMigrationTable(connection);

    if (direction === "up") {
      await up(connection, migrations);
    } else if (direction === "down") {
      await down(connection, migrations);
    } else {
      throw new Error("Unsupported migration direction. Use 'up' or 'down'.");
    }

    await connection.commit();
    logger.info({ direction }, "Migration command completed");
  } catch (error) {
    await connection.rollback();
    logger.error({ err: error }, "Migration command failed");
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
