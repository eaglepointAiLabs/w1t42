module.exports = {
  id: "006_rate_limit_counters",
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_counters (
        bucket_key VARCHAR(512) NOT NULL,
        window_start_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
        count INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (bucket_key),
        KEY idx_rate_limit_updated (updated_at)
      )
    `);
  },
  async down(connection) {
    await connection.query("DROP TABLE IF EXISTS rate_limit_counters");
  }
};
