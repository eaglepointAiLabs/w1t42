const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { writeAuditEvent } = require("../../services/audit-log");

async function ensureTargetUser(targetUserId) {
  const [rows] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [targetUserId]);
  if (!rows.length) {
    throw new ApiError(404, "USER_NOT_FOUND", "Target user not found");
  }
}

async function followUser({ followerUserId, followedUserId, requestId }) {
  if (Number(followerUserId) === Number(followedUserId)) {
    throw new ApiError(400, "INVALID_FOLLOW_TARGET", "Users cannot follow themselves");
  }

  await ensureTargetUser(followedUserId);

  const [existingRows] = await pool.query(
    "SELECT id FROM user_follows WHERE follower_user_id = ? AND followed_user_id = ? LIMIT 1",
    [followerUserId, followedUserId]
  );

  if (existingRows.length) {
    return { followed: true, duplicate: true };
  }

  await pool.query("INSERT INTO user_follows (follower_user_id, followed_user_id) VALUES (?, ?)", [followerUserId, followedUserId]);

  await writeAuditEvent({
    actorUserId: followerUserId,
    eventType: "follow.created",
    entityType: "user_follow",
    entityId: `${followerUserId}:${followedUserId}`,
    requestId,
    payload: { followedUserId }
  });

  return { followed: true, duplicate: false };
}

async function unfollowUser({ followerUserId, followedUserId, requestId }) {
  const [result] = await pool.query("DELETE FROM user_follows WHERE follower_user_id = ? AND followed_user_id = ?", [followerUserId, followedUserId]);

  if (result.affectedRows) {
    await writeAuditEvent({
      actorUserId: followerUserId,
      eventType: "follow.removed",
      entityType: "user_follow",
      entityId: `${followerUserId}:${followedUserId}`,
      requestId,
      payload: { followedUserId }
    });
  }

  return { followed: false, removed: Boolean(result.affectedRows) };
}

async function listMyFollows(userId) {
  const [rows] = await pool.query(
    `
      SELECT uf.followed_user_id AS user_id, u.username, p.display_name, uf.created_at
      FROM user_follows uf
      JOIN users u ON u.id = uf.followed_user_id
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE uf.follower_user_id = ?
      ORDER BY uf.created_at DESC
    `,
    [userId]
  );

  return rows;
}

async function listFollowedAuthorIds(userId) {
  const [rows] = await pool.query("SELECT followed_user_id FROM user_follows WHERE follower_user_id = ?", [userId]);
  return rows.map((row) => Number(row.followed_user_id));
}

module.exports = {
  followUser,
  unfollowUser,
  listMyFollows,
  listFollowedAuthorIds
};
