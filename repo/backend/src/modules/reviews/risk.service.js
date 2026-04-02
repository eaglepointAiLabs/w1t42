const { pool } = require("../../db/pool");
const { shouldEscalateHighRisk } = require("./review.rules");

async function flagSharedDeviceRisk(userId) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(DISTINCT udf2.user_id) AS shared_users
      FROM user_device_fingerprints udf
      JOIN user_device_fingerprints udf2 ON udf2.device_fingerprint_id = udf.device_fingerprint_id
      WHERE udf.user_id = ?
    `,
    [userId]
  );

  const sharedUsers = Number(rows[0]?.shared_users || 0);
  if (sharedUsers > 1) {
    await pool.query(
      `
        INSERT INTO risk_flags (user_id, flag_type, severity, flag_status, details)
        VALUES (?, 'shared_device', 'high', 'open', ?)
      `,
      [userId, JSON.stringify({ sharedUsers })]
    );
    return true;
  }

  return false;
}

async function handleUpheldViolation(reviewAuthorUserId) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM appeals a
      JOIN reviews r ON r.id = a.review_id
      WHERE r.user_id = ?
        AND a.appeal_status = 'upheld'
    `,
    [reviewAuthorUserId]
  );

  const upheldCount = Number(rows[0]?.total || 0);
  if (!shouldEscalateHighRisk(upheldCount)) {
    return { escalated: false, upheldCount };
  }

  await pool.query(
    `
      INSERT INTO risk_flags (user_id, flag_type, severity, flag_status, details)
      VALUES (?, 'upheld_violations', 'critical', 'open', ?)
    `,
    [reviewAuthorUserId, JSON.stringify({ upheldCount })]
  );

  await pool.query(
    `
      INSERT INTO review_blacklist (user_id, reason, starts_at, ends_at, is_active)
      VALUES (?, 'Auto blacklist after 3 upheld violations', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), 1)
    `,
    [reviewAuthorUserId]
  );

  return { escalated: true, upheldCount };
}

async function refreshGovernanceAnalyticsSnapshot() {
  const [reviewCountRows] = await pool.query("SELECT COUNT(*) AS total FROM reviews WHERE review_state <> 'draft'");
  const [appealCountRows] = await pool.query("SELECT COUNT(*) AS total FROM appeals");
  const [resolvedRows] = await pool.query(
    `
      SELECT AVG(TIMESTAMPDIFF(HOUR, submitted_at, resolved_at)) AS avg_hours
      FROM appeals
      WHERE resolved_at IS NOT NULL
    `
  );

  const reviewTotal = Number(reviewCountRows[0]?.total || 0);
  const appealTotal = Number(appealCountRows[0]?.total || 0);
  const complaintRate = reviewTotal === 0 ? 0 : appealTotal / reviewTotal;

  const metrics = {
    reviewTotal,
    appealTotal,
    complaintRate,
    avgResolutionHours: Number(resolvedRows[0]?.avg_hours || 0)
  };

  await pool.query(
    `
      INSERT INTO analytics_snapshots (snapshot_type, snapshot_date, metrics_json)
      VALUES ('review_governance_daily', CURRENT_DATE, ?)
      ON DUPLICATE KEY UPDATE metrics_json = VALUES(metrics_json)
    `,
    [JSON.stringify(metrics)]
  );
}

module.exports = {
  flagSharedDeviceRisk,
  handleUpheldViolation,
  refreshGovernanceAnalyticsSnapshot
};
