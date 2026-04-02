const { pool } = require("../db/pool");

async function writeAuditEvent({
  actorUserId = null,
  eventType,
  entityType,
  entityId = null,
  requestId = null,
  payload = null
}) {
  await pool.query(
    `
      INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, request_id, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [actorUserId, eventType, entityType, entityId, requestId, payload ? JSON.stringify(payload) : null]
  );
}

module.exports = {
  writeAuditEvent
};
