module.exports = {
  id: "003_review_governance",
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sensitive_words (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        word VARCHAR(120) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sensitive_words_word (word),
        CONSTRAINT fk_sensitive_words_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS image_hash_denylist (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        sha256_hash CHAR(64) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_image_hash_denylist_hash (sha256_hash),
        CONSTRAINT fk_image_hash_denylist_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS moderation_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        review_id BIGINT UNSIGNED NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        event_type VARCHAR(80) NOT NULL,
        decision ENUM('allow', 'reject', 'hide', 'escalate') NOT NULL,
        notes TEXT NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_moderation_events_review (review_id),
        CONSTRAINT fk_moderation_events_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        CONSTRAINT fk_moderation_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_device_fingerprints (
        user_id BIGINT UNSIGNED NOT NULL,
        device_fingerprint_id BIGINT UNSIGNED NOT NULL,
        first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, device_fingerprint_id),
        KEY idx_user_device_fingerprint_device (device_fingerprint_id),
        CONSTRAINT fk_user_device_fingerprint_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_device_fingerprint_device FOREIGN KEY (device_fingerprint_id) REFERENCES device_fingerprints(id) ON DELETE CASCADE
      )
    `);

    await connection.query("CREATE INDEX idx_reviews_published_at_user ON reviews(user_id, published_at)").catch(() => null);
    await connection.query("CREATE INDEX idx_review_followups_user_created ON review_followups(user_id, created_at)").catch(() => null);
    await connection.query("CREATE INDEX idx_appeals_status_submitted ON appeals(appeal_status, submitted_at)").catch(() => null);
  },
  async down(connection) {
    await connection.query("DROP TABLE IF EXISTS user_device_fingerprints");
    await connection.query("DROP TABLE IF EXISTS moderation_events");
    await connection.query("DROP TABLE IF EXISTS image_hash_denylist");
    await connection.query("DROP TABLE IF EXISTS sensitive_words");
  }
};
