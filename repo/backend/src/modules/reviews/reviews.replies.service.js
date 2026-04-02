const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { checkSensitiveWords } = require("./moderation.service");
const { resolveReplyAuthorRole, writeReviewAudit } = require("./reviews.shared");

async function addReply({ actorUser, reviewId, parentReplyId, replyText, requestId }) {
  await checkSensitiveWords(replyText);

  const [reviewRows] = await pool.query("SELECT id FROM reviews WHERE id = ? LIMIT 1", [reviewId]);
  if (!reviewRows.length) {
    throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found");
  }

  if (parentReplyId) {
    const [parentRows] = await pool.query("SELECT id FROM review_replies WHERE id = ? AND review_id = ? LIMIT 1", [parentReplyId, reviewId]);
    if (!parentRows.length) {
      throw new ApiError(400, "INVALID_PARENT_REPLY", "Parent reply does not belong to this review");
    }
  }

  const role = resolveReplyAuthorRole(actorUser.roles || []);
  const [insert] = await pool.query(
    `
      INSERT INTO review_replies (review_id, parent_reply_id, author_user_id, author_role, reply_text)
      VALUES (?, ?, ?, ?, ?)
    `,
    [reviewId, parentReplyId || null, actorUser.id, role, replyText]
  );

  await writeReviewAudit({
    actorUserId: actorUser.id,
    eventType: "review.reply.created",
    entityType: "review_reply",
    entityId: String(insert.insertId),
    requestId,
    payload: { reviewId }
  });

  const [rows] = await pool.query("SELECT * FROM review_replies WHERE id = ? LIMIT 1", [insert.insertId]);
  return rows[0];
}

module.exports = {
  addReply
};
