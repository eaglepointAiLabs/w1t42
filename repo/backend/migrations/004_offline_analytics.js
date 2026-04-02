module.exports = {
  id: "004_offline_analytics",
  async up(connection) {
    const [salesChannelColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'sales_channel' LIMIT 1"
    );
    if (!salesChannelColumn.length) {
      await connection.query("ALTER TABLE orders ADD COLUMN sales_channel VARCHAR(80) NOT NULL DEFAULT 'direct'");
    }

    const [locationCodeColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'location_code' LIMIT 1"
    );
    if (!locationCodeColumn.length) {
      await connection.query("ALTER TABLE orders ADD COLUMN location_code VARCHAR(80) NOT NULL DEFAULT 'global'");
    }

    const [estimatedCostColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_cost_cents' LIMIT 1"
    );
    if (!estimatedCostColumn.length) {
      await connection.query("ALTER TABLE orders ADD COLUMN estimated_cost_cents INT UNSIGNED NOT NULL DEFAULT 0");
    }

    const [assignedInstructorColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'assigned_instructor_user_id' LIMIT 1"
    );
    if (!assignedInstructorColumn.length) {
      await connection.query("ALTER TABLE orders ADD COLUMN assigned_instructor_user_id BIGINT UNSIGNED NULL");
    }

    const [instructorConstraint] = await connection.query(
      "SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_assigned_instructor' LIMIT 1"
    );
    if (!instructorConstraint.length) {
      await connection.query(
        "ALTER TABLE orders ADD CONSTRAINT fk_orders_assigned_instructor FOREIGN KEY (assigned_instructor_user_id) REFERENCES users(id) ON DELETE SET NULL"
      );
    }

    const [channelIndex] = await connection.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_channel_created' LIMIT 1"
    );
    if (!channelIndex.length) {
      await connection.query("CREATE INDEX idx_orders_channel_created ON orders(sales_channel, created_at)");
    }

    const [locationIndex] = await connection.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_location_created' LIMIT 1"
    );
    if (!locationIndex.length) {
      await connection.query("CREATE INDEX idx_orders_location_created ON orders(location_code, created_at)");
    }

    const [instructorIndex] = await connection.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_instructor_created' LIMIT 1"
    );
    if (!instructorIndex.length) {
      await connection.query("CREATE INDEX idx_orders_instructor_created ON orders(assigned_instructor_user_id, created_at)");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS analytics_export_access_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        requested_by_user_id BIGINT UNSIGNED NOT NULL,
        export_type VARCHAR(80) NOT NULL,
        filters_json JSON NULL,
        row_count INT UNSIGNED NOT NULL DEFAULT 0,
        output_path VARCHAR(512) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_analytics_export_access_user_time (requested_by_user_id, created_at),
        CONSTRAINT fk_analytics_export_access_user FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  },
  async down(connection) {
    await connection.query("DROP TABLE IF EXISTS analytics_export_access_logs");

    const [instructorIndex] = await connection.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_instructor_created' LIMIT 1"
    );
    if (instructorIndex.length) {
      await connection.query("DROP INDEX idx_orders_instructor_created ON orders");
    }

    const [locationIndex] = await connection.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_location_created' LIMIT 1"
    );
    if (locationIndex.length) {
      await connection.query("DROP INDEX idx_orders_location_created ON orders");
    }

    const [channelIndex] = await connection.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_channel_created' LIMIT 1"
    );
    if (channelIndex.length) {
      await connection.query("DROP INDEX idx_orders_channel_created ON orders");
    }

    const [instructorConstraint] = await connection.query(
      "SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_assigned_instructor' LIMIT 1"
    );
    if (instructorConstraint.length) {
      await connection.query("ALTER TABLE orders DROP FOREIGN KEY fk_orders_assigned_instructor");
    }

    const [assignedInstructorColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'assigned_instructor_user_id' LIMIT 1"
    );
    if (assignedInstructorColumn.length) {
      await connection.query("ALTER TABLE orders DROP COLUMN assigned_instructor_user_id");
    }

    const [estimatedCostColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_cost_cents' LIMIT 1"
    );
    if (estimatedCostColumn.length) {
      await connection.query("ALTER TABLE orders DROP COLUMN estimated_cost_cents");
    }

    const [locationCodeColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'location_code' LIMIT 1"
    );
    if (locationCodeColumn.length) {
      await connection.query("ALTER TABLE orders DROP COLUMN location_code");
    }

    const [salesChannelColumn] = await connection.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'sales_channel' LIMIT 1"
    );
    if (salesChannelColumn.length) {
      await connection.query("ALTER TABLE orders DROP COLUMN sales_channel");
    }
  }
};
