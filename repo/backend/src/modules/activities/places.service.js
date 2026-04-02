const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { writeAuditEvent } = require("../../services/audit-log");

async function listPlaces(userId) {
  const [rows] = await pool.query(
    `
      SELECT id, label, location_text, latitude, longitude, is_default, created_at, updated_at
      FROM saved_places
      WHERE user_id = ?
      ORDER BY is_default DESC, updated_at DESC
    `,
    [userId]
  );
  return rows;
}

async function createPlace({ userId, payload, requestId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (payload.isDefault) {
      await connection.query("UPDATE saved_places SET is_default = 0 WHERE user_id = ?", [userId]);
    }

    const [insert] = await connection.query(
      `
        INSERT INTO saved_places (user_id, label, location_text, latitude, longitude, is_default)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, payload.label, payload.locationText, payload.latitude || null, payload.longitude || null, payload.isDefault ? 1 : 0]
    );

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "place.created",
      entityType: "saved_place",
      entityId: String(insert.insertId),
      requestId,
      payload: { label: payload.label }
    });

    const [rows] = await pool.query("SELECT * FROM saved_places WHERE id = ? LIMIT 1", [insert.insertId]);
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePlace({ userId, placeId, payload, requestId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query("SELECT id FROM saved_places WHERE id = ? AND user_id = ? LIMIT 1", [placeId, userId]);
    if (!existingRows.length) {
      throw new ApiError(404, "PLACE_NOT_FOUND", "Saved place not found");
    }

    if (payload.isDefault) {
      await connection.query("UPDATE saved_places SET is_default = 0 WHERE user_id = ?", [userId]);
    }

    const fields = [];
    const values = [];

    if (payload.label !== undefined) {
      fields.push("label = ?");
      values.push(payload.label);
    }
    if (payload.locationText !== undefined) {
      fields.push("location_text = ?");
      values.push(payload.locationText);
    }
    if (payload.latitude !== undefined) {
      fields.push("latitude = ?");
      values.push(payload.latitude);
    }
    if (payload.longitude !== undefined) {
      fields.push("longitude = ?");
      values.push(payload.longitude);
    }
    if (payload.isDefault !== undefined) {
      fields.push("is_default = ?");
      values.push(payload.isDefault ? 1 : 0);
    }

    if (!fields.length) {
      throw new ApiError(400, "NO_UPDATES", "No fields provided to update");
    }

    values.push(placeId, userId);
    await connection.query(`UPDATE saved_places SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, values);

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "place.updated",
      entityType: "saved_place",
      entityId: String(placeId),
      requestId
    });

    const [rows] = await pool.query("SELECT * FROM saved_places WHERE id = ? LIMIT 1", [placeId]);
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deletePlace({ userId, placeId, requestId }) {
  const [result] = await pool.query("DELETE FROM saved_places WHERE id = ? AND user_id = ?", [placeId, userId]);
  if (!result.affectedRows) {
    throw new ApiError(404, "PLACE_NOT_FOUND", "Saved place not found");
  }

  await writeAuditEvent({
    actorUserId: userId,
    eventType: "place.deleted",
    entityType: "saved_place",
    entityId: String(placeId),
    requestId
  });

  return { removed: true };
}

module.exports = {
  listPlaces,
  createPlace,
  updatePlace,
  deletePlace
};
