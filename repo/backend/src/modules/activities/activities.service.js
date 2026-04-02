const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { writeAuditEvent } = require("../../services/audit-log");
const { validateActivityPayload } = require("./activity.validation");
const { validateGpxUploadMeta, parseGpxCoordinates } = require("./gpx.parser");

const GPX_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "gpx");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function withDerivedMetrics(activityRow) {
  if (!activityRow) {
    return null;
  }

  const durationHours = Number(activityRow.duration_seconds || 0) / 3600;
  const avgSpeedMph = durationHours > 0 ? Number((Number(activityRow.distance_miles || 0) / durationHours).toFixed(2)) : null;

  return {
    ...activityRow,
    derived: {
      avgSpeedMph
    }
  };
}

async function ensureSavedPlaceOwnership(connection, userId, savedPlaceId) {
  if (!savedPlaceId) {
    return;
  }

  const [rows] = await connection.query("SELECT id FROM saved_places WHERE id = ? AND user_id = ? LIMIT 1", [savedPlaceId, userId]);
  if (!rows.length) {
    throw new ApiError(400, "INVALID_SAVED_PLACE", "Selected saved place does not belong to user");
  }
}

async function createActivity({ userId, payload, requestId }) {
  const data = validateActivityPayload(payload, false);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureSavedPlaceOwnership(connection, userId, data.savedPlaceId);

    const [insert] = await connection.query(
      `
        INSERT INTO activities (
          user_id, activity_type, duration_seconds, distance_miles, calories,
          avg_heart_rate, pace_seconds_per_mile, notes, location_text,
          saved_place_id, started_at, completed_at, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
      `,
      [
        userId,
        data.activityType,
        data.durationSeconds,
        data.distanceMiles,
        data.calories ?? null,
        data.avgHeartRate ?? null,
        data.paceSecondsPerMile ?? null,
        data.notes ?? null,
        data.locationText ?? null,
        data.savedPlaceId ?? null,
        data.startedAt ? new Date(data.startedAt) : null,
        data.completedAt ? new Date(data.completedAt) : null
      ]
    );

    for (const tag of data.tags) {
      await connection.query("INSERT INTO activity_tags (activity_id, tag) VALUES (?, ?)", [insert.insertId, tag]);
    }

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "activity.created",
      entityType: "activity",
      entityId: String(insert.insertId),
      requestId
    });

    return getActivityById({ userId, activityId: insert.insertId, includeArchived: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateActivity({ userId, activityId, payload, requestId }) {
  const data = validateActivityPayload(payload, true);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM activities WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE", [activityId, userId]);
    if (!rows.length) {
      throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found");
    }

    await ensureSavedPlaceOwnership(connection, userId, data.savedPlaceId);

    const fields = [];
    const values = [];
    const map = {
      activityType: "activity_type",
      durationSeconds: "duration_seconds",
      distanceMiles: "distance_miles",
      calories: "calories",
      avgHeartRate: "avg_heart_rate",
      paceSecondsPerMile: "pace_seconds_per_mile",
      notes: "notes",
      locationText: "location_text",
      savedPlaceId: "saved_place_id",
      startedAt: "started_at",
      completedAt: "completed_at"
    };

    for (const [inputKey, dbKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(data, inputKey)) {
        fields.push(`${dbKey} = ?`);
        values.push(data[inputKey] ?? null);
      }
    }

    if (fields.length) {
      values.push(activityId, userId);
      await connection.query(`UPDATE activities SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, values);
    }

    if (Object.prototype.hasOwnProperty.call(data, "tags")) {
      await connection.query("DELETE FROM activity_tags WHERE activity_id = ?", [activityId]);
      for (const tag of data.tags) {
        await connection.query("INSERT INTO activity_tags (activity_id, tag) VALUES (?, ?)", [activityId, tag]);
      }
    }

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "activity.updated",
      entityType: "activity",
      entityId: String(activityId),
      requestId
    });

    return getActivityById({ userId, activityId, includeArchived: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listActivities(userId) {
  const [rows] = await pool.query(
    `
      SELECT a.*,
             sp.label AS saved_place_label,
             sp.location_text AS saved_place_location
      FROM activities a
      LEFT JOIN saved_places sp ON sp.id = a.saved_place_id
      WHERE a.user_id = ?
        AND a.status <> 'archived'
      ORDER BY a.created_at DESC
    `,
    [userId]
  );

  const [tagRows] = await pool.query(
    `
      SELECT activity_id, tag
      FROM activity_tags
      WHERE activity_id IN (
        SELECT id FROM activities WHERE user_id = ? AND status <> 'archived'
      )
    `,
    [userId]
  );

  const tagsByActivity = new Map();
  for (const tagRow of tagRows) {
    if (!tagsByActivity.has(tagRow.activity_id)) {
      tagsByActivity.set(tagRow.activity_id, []);
    }
    tagsByActivity.get(tagRow.activity_id).push(tagRow.tag);
  }

  return rows.map((row) => withDerivedMetrics({ ...row, tags: tagsByActivity.get(row.id) || [] }));
}

async function getActivityById({ userId, activityId, includeArchived = false }) {
  const [rows] = await pool.query(
    `
      SELECT a.*,
             sp.label AS saved_place_label,
             sp.location_text AS saved_place_location
      FROM activities a
      LEFT JOIN saved_places sp ON sp.id = a.saved_place_id
      WHERE a.id = ?
        AND a.user_id = ?
        ${includeArchived ? "" : "AND a.status <> 'archived'"}
      LIMIT 1
    `,
    [activityId, userId]
  );

  if (!rows.length) {
    throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found");
  }

  const [tags] = await pool.query("SELECT tag FROM activity_tags WHERE activity_id = ? ORDER BY id ASC", [activityId]);
  const [uploads] = await pool.query(
    `
      SELECT id, original_filename, content_type, file_size_bytes, parse_status, created_at
      FROM gpx_uploads
      WHERE activity_id = ?
      ORDER BY id DESC
    `,
    [activityId]
  );

  return withDerivedMetrics({
    ...rows[0],
    tags: tags.map((item) => item.tag),
    gpxUploads: uploads
  });
}

async function archiveActivity({ userId, activityId, requestId }) {
  const [result] = await pool.query(
    "UPDATE activities SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    [activityId, userId]
  );
  if (!result.affectedRows) {
    throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found");
  }

  await writeAuditEvent({
    actorUserId: userId,
    eventType: "activity.archived",
    entityType: "activity",
    entityId: String(activityId),
    requestId
  });

  return { removed: true };
}

async function uploadGpx({ userId, activityId, payload, requestId }) {
  validateGpxUploadMeta(payload);

  const [activityRows] = await pool.query("SELECT id FROM activities WHERE id = ? AND user_id = ? LIMIT 1", [activityId, userId]);
  if (!activityRows.length) {
    throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found");
  }

  const buffer = Buffer.from(String(payload.base64Data), "base64");
  if (!buffer.length) {
    throw new ApiError(400, "INVALID_GPX_CONTENT", "GPX payload is empty");
  }

  if (buffer.length > 10 * 1024 * 1024) {
    throw new ApiError(400, "INVALID_GPX_SIZE", "Decoded GPX content exceeds 10 MB");
  }

  const xmlText = buffer.toString("utf8");
  const points = parseGpxCoordinates(xmlText);

  ensureDir(GPX_UPLOAD_DIR);
  const userDir = path.join(GPX_UPLOAD_DIR, String(userId));
  ensureDir(userDir);

  const fileName = `${crypto.randomUUID()}.gpx`;
  const filePath = path.join(userDir, fileName);
  fs.writeFileSync(filePath, buffer);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [uploadInsert] = await connection.query(
      `
        INSERT INTO gpx_uploads (
          user_id,
          activity_id,
          original_filename,
          content_type,
          file_path,
          file_size_bytes,
          parse_status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'parsed')
      `,
      [userId, activityId, payload.fileName, payload.mimeType, filePath, buffer.length]
    );

    for (const point of points) {
      await connection.query(
        `
          INSERT INTO gpx_points (gpx_upload_id, seq_no, latitude, longitude, elevation_meters, point_timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          uploadInsert.insertId,
          point.seqNo,
          point.latitude,
          point.longitude,
          point.elevationMeters,
          point.pointTimestamp ? new Date(point.pointTimestamp) : null
        ]
      );
    }

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "activity.gpx.uploaded",
      entityType: "gpx_upload",
      entityId: String(uploadInsert.insertId),
      requestId,
      payload: { activityId, points: points.length }
    });

    return {
      uploadId: uploadInsert.insertId,
      points: points.length,
      fileSizeBytes: buffer.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listGpxCoordinates({ userId, activityId }) {
  const [uploadRows] = await pool.query(
    `
      SELECT id
      FROM gpx_uploads
      WHERE user_id = ?
        AND activity_id = ?
        AND parse_status = 'parsed'
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId, activityId]
  );

  if (!uploadRows.length) {
    return [];
  }

  const [points] = await pool.query(
    `
      SELECT seq_no, latitude, longitude, elevation_meters, point_timestamp
      FROM gpx_points
      WHERE gpx_upload_id = ?
      ORDER BY seq_no ASC
    `,
    [uploadRows[0].id]
  );

  return points;
}

module.exports = {
  createActivity,
  updateActivity,
  listActivities,
  getActivityById,
  archiveActivity,
  uploadGpx,
  listGpxCoordinates
};
