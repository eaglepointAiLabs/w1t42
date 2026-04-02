const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { canAppeal } = require("./review.rules");
const { handleUpheldViolation, refreshGovernanceAnalyticsSnapshot } = require("./risk.service");
const { withTransaction, writeReviewAudit } = require("./reviews.shared");

function reviewStateFromAppealStatus(appealStatus) {
  if (appealStatus === "under_review") {
    return "under_arbitration";
  }
  if (appealStatus === "upheld") {
    return "hidden";
  }
  return "published";
}

async function createAppeal({ userId, reviewId, reason, requestId }) {
  const appealId = await withTransaction(pool, async (connection) => {
    const [reviewRows] = await connection.query("SELECT * FROM reviews WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE", [reviewId, userId]);
    if (!reviewRows.length) {
      throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found for user");
    }

    const review = reviewRows[0];
    if (!canAppeal(review.published_at)) {
      throw new ApiError(400, "APPEAL_WINDOW_EXPIRED", "Appeals can be submitted within 7 days of publishing");
    }

    const [existingAppealRows] = await connection.query(
      "SELECT id FROM appeals WHERE review_id = ? AND appeal_status IN ('submitted', 'under_review') LIMIT 1",
      [reviewId]
    );
    if (existingAppealRows.length) {
      throw new ApiError(409, "APPEAL_ALREADY_OPEN", "An appeal is already active for this review");
    }

    const [insert] = await connection.query(
      `
        INSERT INTO appeals (review_id, appellant_user_id, appeal_status, appeal_reason)
        VALUES (?, ?, 'submitted', ?)
      `,
      [reviewId, userId, reason]
    );

    await connection.query(
      `
        INSERT INTO appeal_timeline_events (appeal_id, event_type, event_status, event_note, created_by_user_id)
        VALUES (?, 'appeal_submitted', 'submitted', ?, ?)
      `,
      [insert.insertId, "Appeal submitted", userId]
    );
    await connection.query("UPDATE reviews SET review_state = 'under_arbitration' WHERE id = ?", [reviewId]);

    return insert.insertId;
  });

  await writeReviewAudit({
    actorUserId: userId,
    eventType: "appeal.created",
    entityType: "appeal",
    entityId: String(appealId),
    requestId,
    payload: { reviewId }
  });

  const [rows] = await pool.query("SELECT * FROM appeals WHERE id = ? LIMIT 1", [appealId]);
  return rows[0];
}

async function listAppealsForStaff(status = null) {
  const [rows] = await pool.query(
    `
      SELECT a.*, r.user_id AS review_author_user_id, r.review_state, r.review_text
      FROM appeals a
      JOIN reviews r ON r.id = a.review_id
      ${status ? "WHERE a.appeal_status = ?" : ""}
      ORDER BY a.id DESC
      LIMIT 500
    `,
    status ? [status] : []
  );

  return rows;
}

async function updateAppealStatus({ actorUserId, appealId, appealStatus, note, requestId }) {
  const updatedAppeal = await withTransaction(pool, async (connection) => {
    const [appealRows] = await connection.query("SELECT * FROM appeals WHERE id = ? LIMIT 1 FOR UPDATE", [appealId]);
    if (!appealRows.length) {
      throw new ApiError(404, "APPEAL_NOT_FOUND", "Appeal not found");
    }

    const appeal = appealRows[0];
    await connection.query(
      "UPDATE appeals SET appeal_status = ?, resolved_at = CASE WHEN ? IN ('upheld','rejected','resolved') THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id = ?",
      [appealStatus, appealStatus, appealId]
    );
    await connection.query(
      `
        INSERT INTO appeal_timeline_events (appeal_id, event_type, event_status, event_note, created_by_user_id)
        VALUES (?, 'status_update', ?, ?, ?)
      `,
      [appealId, appealStatus, note || null, actorUserId]
    );

    await connection.query("UPDATE reviews SET review_state = ? WHERE id = ?", [reviewStateFromAppealStatus(appealStatus), appeal.review_id]);

    return appeal;
  });

  if (appealStatus === "upheld") {
    const [reviewRows] = await pool.query("SELECT user_id FROM reviews WHERE id = ? LIMIT 1", [updatedAppeal.review_id]);
    if (reviewRows.length) {
      await handleUpheldViolation(reviewRows[0].user_id);
    }
  }

  await refreshGovernanceAnalyticsSnapshot();
  await writeReviewAudit({
    actorUserId,
    eventType: "appeal.status.updated",
    entityType: "appeal",
    entityId: String(appealId),
    requestId,
    payload: { appealStatus }
  });

  const [rows] = await pool.query("SELECT * FROM appeals WHERE id = ? LIMIT 1", [appealId]);
  return rows[0];
}

module.exports = {
  createAppeal,
  listAppealsForStaff,
  updateAppealStatus,
  reviewStateFromAppealStatus
};
