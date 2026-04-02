module.exports = {
  id: "002_core_domain",
  async up(connection) {
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN email VARCHAR(255) NULL,
      ADD COLUMN status ENUM('active', 'disabled', 'locked') NOT NULL DEFAULT 'active',
      ADD COLUMN last_login_at TIMESTAMP NULL,
      ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `);

    await connection.query("CREATE UNIQUE INDEX uq_users_email ON users(email)").catch(() => null);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_roles_code (code)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(100) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_permissions_code (code)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id BIGINT UNSIGNED NOT NULL,
        permission_id BIGINT UNSIGNED NOT NULL,
        granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id BIGINT UNSIGNED NOT NULL,
        role_id BIGINT UNSIGNED NOT NULL,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id BIGINT UNSIGNED NOT NULL,
        display_name VARCHAR(120) NULL,
        legal_name_encrypted TEXT NULL,
        phone_encrypted TEXT NULL,
        emergency_contact_encrypted TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        session_token_hash CHAR(64) NOT NULL,
        device_fingerprint_id BIGINT UNSIGNED NULL,
        status ENUM('active', 'revoked', 'expired') NOT NULL DEFAULT 'active',
        expires_at TIMESTAMP NOT NULL,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP NULL,
        revoke_reason VARCHAR(255) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_auth_sessions_token_hash (session_token_hash),
        KEY idx_auth_sessions_user_status (user_id, status),
        CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NULL,
        fingerprint_hash CHAR(64) NOT NULL,
        risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
        first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSON NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_device_fingerprints_hash (fingerprint_hash),
        KEY idx_device_fingerprints_user (user_id),
        CONSTRAINT fk_device_fingerprints_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      ALTER TABLE auth_sessions
      ADD CONSTRAINT fk_auth_sessions_device_fingerprint
      FOREIGN KEY (device_fingerprint_id) REFERENCES device_fingerprints(id) ON DELETE SET NULL
    `).catch(() => null);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        actor_user_id BIGINT UNSIGNED NULL,
        event_type VARCHAR(120) NOT NULL,
        entity_type VARCHAR(120) NOT NULL,
        entity_id VARCHAR(120) NULL,
        request_id VARCHAR(64) NULL,
        payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_audit_events_type_created (event_type, created_at),
        CONSTRAINT fk_audit_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS entitlements (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        entitlement_type ENUM('subscription', 'course_access', 'service_credit') NOT NULL,
        status ENUM('active', 'expired', 'revoked') NOT NULL DEFAULT 'active',
        starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ends_at TIMESTAMP NULL,
        metadata JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_entitlements_user_status (user_id, status),
        CONSTRAINT fk_entitlements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS saved_places (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        label VARCHAR(100) NOT NULL,
        location_text VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 7) NULL,
        longitude DECIMAL(10, 7) NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_saved_places_user (user_id),
        CONSTRAINT fk_saved_places_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        activity_type ENUM('running', 'cycling', 'walking') NOT NULL,
        status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
        duration_seconds INT UNSIGNED NOT NULL,
        distance_miles DECIMAL(8, 2) NOT NULL,
        calories INT UNSIGNED NULL,
        avg_heart_rate INT UNSIGNED NULL,
        pace_seconds_per_mile INT UNSIGNED NULL,
        notes TEXT NULL,
        location_text VARCHAR(255) NULL,
        saved_place_id BIGINT UNSIGNED NULL,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_activities_user_created (user_id, created_at),
        CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_activities_place FOREIGN KEY (saved_place_id) REFERENCES saved_places(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_tags (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        activity_id BIGINT UNSIGNED NOT NULL,
        tag VARCHAR(80) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_activity_tag (activity_id, tag),
        CONSTRAINT fk_activity_tags_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS gpx_uploads (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        activity_id BIGINT UNSIGNED NULL,
        original_filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        file_path VARCHAR(512) NOT NULL,
        file_size_bytes BIGINT UNSIGNED NOT NULL,
        parse_status ENUM('uploaded', 'parsed', 'failed') NOT NULL DEFAULT 'uploaded',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_gpx_uploads_user (user_id),
        CONSTRAINT fk_gpx_uploads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_gpx_uploads_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS gpx_points (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        gpx_upload_id BIGINT UNSIGNED NOT NULL,
        seq_no INT UNSIGNED NOT NULL,
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        elevation_meters DECIMAL(8, 2) NULL,
        point_timestamp TIMESTAMP NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_gpx_points_seq (gpx_upload_id, seq_no),
        CONSTRAINT fk_gpx_points_upload FOREIGN KEY (gpx_upload_id) REFERENCES gpx_uploads(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS courses_services (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        kind ENUM('course', 'service') NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        provider_user_id BIGINT UNSIGNED NULL,
        status ENUM('draft', 'active', 'inactive', 'retired') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_courses_services_kind_status (kind, status),
        CONSTRAINT fk_courses_services_provider FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        course_service_id BIGINT UNSIGNED NOT NULL,
        order_type ENUM('course', 'service') NOT NULL,
        order_status ENUM('created', 'pending_payment', 'paid', 'completed', 'cancelled', 'refund_partial', 'refund_full') NOT NULL DEFAULT 'created',
        total_amount_cents INT UNSIGNED NOT NULL,
        paid_amount_cents INT UNSIGNED NOT NULL DEFAULT 0,
        refunded_amount_cents INT UNSIGNED NOT NULL DEFAULT 0,
        currency CHAR(3) NOT NULL DEFAULT 'USD',
        payment_due_at TIMESTAMP NULL,
        idempotency_key VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_orders_idempotency_key (idempotency_key),
        KEY idx_orders_user_status (user_id, order_status),
        CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_orders_course_service FOREIGN KEY (course_service_id) REFERENCES courses_services(id) ON DELETE RESTRICT
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_reconciliation_imports (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        file_name VARCHAR(255) NOT NULL,
        file_hash CHAR(64) NOT NULL,
        signature_verified TINYINT(1) NOT NULL DEFAULT 0,
        imported_by_user_id BIGINT UNSIGNED NULL,
        import_status ENUM('pending', 'processed', 'failed') NOT NULL DEFAULT 'pending',
        imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_payment_recon_file_hash (file_hash),
        CONSTRAINT fk_payment_recon_imported_by FOREIGN KEY (imported_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id BIGINT UNSIGNED NOT NULL,
        reconciliation_import_id BIGINT UNSIGNED NULL,
        provider ENUM('wechat_pay') NOT NULL DEFAULT 'wechat_pay',
        provider_txn_id VARCHAR(120) NOT NULL,
        payment_status ENUM('pending', 'confirmed', 'failed', 'refunded_partial', 'refunded_full') NOT NULL DEFAULT 'pending',
        amount_cents INT UNSIGNED NOT NULL,
        signature_valid TINYINT(1) NOT NULL DEFAULT 0,
        raw_payload JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_payments_provider_txn (provider, provider_txn_id),
        KEY idx_payments_order_status (order_id, payment_status),
        CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_payments_recon FOREIGN KEY (reconciliation_import_id) REFERENCES payment_reconciliation_imports(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id BIGINT UNSIGNED NOT NULL,
        payment_id BIGINT UNSIGNED NOT NULL,
        refund_status ENUM('requested', 'approved', 'processed', 'rejected') NOT NULL DEFAULT 'requested',
        amount_cents INT UNSIGNED NOT NULL,
        reason VARCHAR(255) NULL,
        requested_by_user_id BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        KEY idx_refunds_order_status (order_id, refund_status),
        CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
        CONSTRAINT fk_refunds_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id BIGINT UNSIGNED NOT NULL,
        payment_id BIGINT UNSIGNED NULL,
        refund_id BIGINT UNSIGNED NULL,
        entry_type ENUM('payment_debit', 'refund_credit', 'adjustment') NOT NULL,
        amount_cents INT NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'USD',
        metadata JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_ledger_entries_order (order_id),
        CONSTRAINT fk_ledger_entries_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_ledger_entries_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        CONSTRAINT fk_ledger_entries_refund FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_dimension_configs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        key_name VARCHAR(80) NOT NULL,
        label VARCHAR(120) NOT NULL,
        weight DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_review_dimension_configs_key_name (key_name)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        rating TINYINT UNSIGNED NOT NULL,
        review_state ENUM('draft', 'published', 'hidden', 'under_arbitration') NOT NULL DEFAULT 'draft',
        anonymous_display TINYINT(1) NOT NULL DEFAULT 0,
        review_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        published_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_reviews_order_user (order_id, user_id),
        KEY idx_reviews_user_state (user_id, review_state),
        CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_images (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        review_id BIGINT UNSIGNED NOT NULL,
        file_path VARCHAR(512) NOT NULL,
        mime_type VARCHAR(64) NOT NULL,
        file_size_bytes BIGINT UNSIGNED NOT NULL,
        sha256_hash CHAR(64) NOT NULL,
        sort_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_review_images_review (review_id),
        CONSTRAINT fk_review_images_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_dimension_scores (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        review_id BIGINT UNSIGNED NOT NULL,
        dimension_config_id BIGINT UNSIGNED NOT NULL,
        score TINYINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_review_dimension_score (review_id, dimension_config_id),
        CONSTRAINT fk_review_dimension_scores_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        CONSTRAINT fk_review_dimension_scores_dimension FOREIGN KEY (dimension_config_id) REFERENCES review_dimension_configs(id) ON DELETE RESTRICT,
        CONSTRAINT chk_review_dimension_score CHECK (score BETWEEN 1 AND 5)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_replies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        review_id BIGINT UNSIGNED NOT NULL,
        parent_reply_id BIGINT UNSIGNED NULL,
        author_user_id BIGINT UNSIGNED NOT NULL,
        author_role ENUM('admin', 'coach', 'support', 'user') NOT NULL,
        reply_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_review_replies_review (review_id),
        CONSTRAINT fk_review_replies_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        CONSTRAINT fk_review_replies_parent FOREIGN KEY (parent_reply_id) REFERENCES review_replies(id) ON DELETE CASCADE,
        CONSTRAINT fk_review_replies_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_followups (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        review_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        followup_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_review_followups_review (review_id),
        CONSTRAINT fk_review_followups_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        CONSTRAINT fk_review_followups_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS appeals (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        review_id BIGINT UNSIGNED NOT NULL,
        appellant_user_id BIGINT UNSIGNED NOT NULL,
        appeal_status ENUM('submitted', 'under_review', 'upheld', 'rejected', 'resolved') NOT NULL DEFAULT 'submitted',
        appeal_reason TEXT NOT NULL,
        submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        KEY idx_appeals_review_status (review_id, appeal_status),
        CONSTRAINT fk_appeals_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        CONSTRAINT fk_appeals_appellant FOREIGN KEY (appellant_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS appeal_timeline_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        appeal_id BIGINT UNSIGNED NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        event_status VARCHAR(80) NOT NULL,
        event_note TEXT NULL,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_appeal_timeline_appeal (appeal_id),
        CONSTRAINT fk_appeal_timeline_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
        CONSTRAINT fk_appeal_timeline_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS risk_flags (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NULL,
        device_fingerprint_id BIGINT UNSIGNED NULL,
        flag_type VARCHAR(100) NOT NULL,
        severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
        flag_status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
        details JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        KEY idx_risk_flags_user_status (user_id, flag_status),
        CONSTRAINT fk_risk_flags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_risk_flags_device FOREIGN KEY (device_fingerprint_id) REFERENCES device_fingerprints(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_blacklist (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        reason VARCHAR(255) NOT NULL,
        starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ends_at TIMESTAMP NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_review_blacklist_user_active (user_id, is_active),
        CONSTRAINT fk_review_blacklist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_review_blacklist_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS content_sources (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        source_name VARCHAR(150) NOT NULL,
        source_type ENUM('rss', 'api_payload', 'html_extract') NOT NULL,
        ingest_path VARCHAR(512) NOT NULL,
        allowlisted TINYINT(1) NOT NULL DEFAULT 1,
        blocklisted TINYINT(1) NOT NULL DEFAULT 0,
        rate_limit_per_minute INT UNSIGNED NOT NULL DEFAULT 60,
        source_status ENUM('active', 'paused', 'disabled') NOT NULL DEFAULT 'active',
        last_ingested_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_content_sources_name_path (source_name, ingest_path)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ingested_content_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        source_id BIGINT UNSIGNED NOT NULL,
        external_item_id VARCHAR(150) NULL,
        title VARCHAR(255) NOT NULL,
        author_name VARCHAR(120) NULL,
        tag_list_json JSON NULL,
        summary TEXT NULL,
        body_text MEDIUMTEXT NULL,
        published_at TIMESTAMP NULL,
        content_hash CHAR(64) NOT NULL,
        ingestion_status ENUM('new', 'published', 'blocked', 'quarantined') NOT NULL DEFAULT 'new',
        raw_payload_path VARCHAR(512) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ingested_content_hash (content_hash),
        KEY idx_ingested_content_source_status (source_id, ingestion_status),
        CONSTRAINT fk_ingested_content_source FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_feed_preferences (
        user_id BIGINT UNSIGNED NOT NULL,
        preferred_sports JSON NULL,
        blocked_tags JSON NULL,
        blocked_authors JSON NULL,
        include_training_updates TINYINT(1) NOT NULL DEFAULT 1,
        include_course_updates TINYINT(1) NOT NULL DEFAULT 1,
        include_news TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        CONSTRAINT fk_user_feed_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS feed_impression_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        content_item_id BIGINT UNSIGNED NULL,
        source_kind ENUM('activity', 'course_update', 'news') NOT NULL,
        action_taken ENUM('shown', 'clicked', 'not_interested', 'block_author', 'block_tag', 'dismissed') NOT NULL,
        similarity_key VARCHAR(255) NULL,
        impressed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_feed_impression_user_time (user_id, impressed_at),
        KEY idx_feed_impression_similarity (user_id, similarity_key),
        CONSTRAINT fk_feed_impression_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_feed_impression_content FOREIGN KEY (content_item_id) REFERENCES ingested_content_items(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        snapshot_type VARCHAR(80) NOT NULL,
        snapshot_date DATE NOT NULL,
        metrics_json JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_analytics_snapshot_type_date (snapshot_type, snapshot_date)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS analytics_export_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        export_type VARCHAR(80) NOT NULL,
        requested_by_user_id BIGINT UNSIGNED NULL,
        export_status ENUM('requested', 'running', 'completed', 'failed') NOT NULL DEFAULT 'requested',
        output_path VARCHAR(512) NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        KEY idx_analytics_export_status_time (export_status, requested_at),
        CONSTRAINT fk_analytics_export_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      ALTER TABLE queue_jobs
      ADD COLUMN idempotency_key VARCHAR(100) NULL,
      ADD COLUMN max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
      ADD COLUMN last_error TEXT NULL,
      ADD COLUMN locked_at TIMESTAMP NULL,
      ADD COLUMN completed_at TIMESTAMP NULL
    `);

    await connection
      .query("CREATE UNIQUE INDEX uq_queue_jobs_idempotency_key ON queue_jobs(idempotency_key)")
      .catch(() => null);

    await connection.query(`
      ALTER TABLE queue_jobs
      MODIFY COLUMN status ENUM('pending', 'running', 'completed', 'failed', 'dead_letter') NOT NULL DEFAULT 'pending'
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS immutable_ingestion_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        source_id BIGINT UNSIGNED NOT NULL,
        log_type ENUM('detected', 'parsed', 'filtered', 'stored', 'retried', 'failed') NOT NULL,
        log_message VARCHAR(255) NOT NULL,
        payload_json JSON NULL,
        event_hash CHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_immutable_ingestion_event_hash (event_hash),
        KEY idx_immutable_ingestion_source_created (source_id, created_at),
        CONSTRAINT fk_immutable_ingestion_source FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE
      )
    `);
  },
  async down(connection) {
    await connection.query("DROP TABLE IF EXISTS immutable_ingestion_logs");
    await connection.query("DROP TABLE IF EXISTS analytics_export_logs");
    await connection.query("DROP TABLE IF EXISTS analytics_snapshots");
    await connection.query("DROP TABLE IF EXISTS feed_impression_history");
    await connection.query("DROP TABLE IF EXISTS user_feed_preferences");
    await connection.query("DROP TABLE IF EXISTS ingested_content_items");
    await connection.query("DROP TABLE IF EXISTS content_sources");
    await connection.query("DROP TABLE IF EXISTS review_blacklist");
    await connection.query("DROP TABLE IF EXISTS risk_flags");
    await connection.query("DROP TABLE IF EXISTS appeal_timeline_events");
    await connection.query("DROP TABLE IF EXISTS appeals");
    await connection.query("DROP TABLE IF EXISTS review_followups");
    await connection.query("DROP TABLE IF EXISTS review_replies");
    await connection.query("DROP TABLE IF EXISTS review_dimension_scores");
    await connection.query("DROP TABLE IF EXISTS review_images");
    await connection.query("DROP TABLE IF EXISTS reviews");
    await connection.query("DROP TABLE IF EXISTS review_dimension_configs");
    await connection.query("DROP TABLE IF EXISTS ledger_entries");
    await connection.query("DROP TABLE IF EXISTS refunds");
    await connection.query("DROP TABLE IF EXISTS payments");
    await connection.query("DROP TABLE IF EXISTS payment_reconciliation_imports");
    await connection.query("DROP TABLE IF EXISTS orders");
    await connection.query("DROP TABLE IF EXISTS courses_services");
    await connection.query("DROP TABLE IF EXISTS gpx_points");
    await connection.query("DROP TABLE IF EXISTS gpx_uploads");
    await connection.query("DROP TABLE IF EXISTS activity_tags");
    await connection.query("DROP TABLE IF EXISTS activities");
    await connection.query("DROP TABLE IF EXISTS saved_places");
    await connection.query("DROP TABLE IF EXISTS entitlements");
    await connection.query("DROP TABLE IF EXISTS audit_events");
    await connection.query("DROP TABLE IF EXISTS auth_sessions");
    await connection.query("DROP TABLE IF EXISTS device_fingerprints");
    await connection.query("DROP TABLE IF EXISTS user_profiles");
    await connection.query("DROP TABLE IF EXISTS user_roles");
    await connection.query("DROP TABLE IF EXISTS role_permissions");
    await connection.query("DROP TABLE IF EXISTS permissions");
    await connection.query("DROP TABLE IF EXISTS roles");
  }
};
