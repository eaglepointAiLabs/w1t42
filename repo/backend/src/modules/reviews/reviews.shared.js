const { writeAuditEvent } = require("../../services/audit-log");

async function withTransaction(pool, operation) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function resolveReplyAuthorRole(roles = []) {
  if (roles.includes("coach")) {
    return "coach";
  }
  if (roles.includes("support")) {
    return "support";
  }
  if (roles.includes("admin")) {
    return "admin";
  }
  return "user";
}

async function writeReviewAudit(event) {
  await writeAuditEvent(event);
}

module.exports = {
  withTransaction,
  resolveReplyAuthorRole,
  writeReviewAudit
};
