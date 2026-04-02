const ApiError = require("../../errors/api-error");

const ALLOWED_ACTIVITY_TYPES = ["running", "cycling", "walking"];

function parseTags(tagsInput) {
  if (!tagsInput) {
    return [];
  }

  const tags = Array.isArray(tagsInput) ? tagsInput : String(tagsInput).split(",");
  const cleaned = tags.map((tag) => String(tag).trim()).filter(Boolean);
  const unique = [...new Set(cleaned)];

  if (unique.length > 20) {
    throw new ApiError(400, "TOO_MANY_TAGS", "At most 20 tags are allowed");
  }

  for (const tag of unique) {
    if (tag.length > 50) {
      throw new ApiError(400, "TAG_TOO_LONG", "Each tag must be 50 characters or less");
    }
  }

  return unique;
}

function validateActivityPayload(payload, isUpdate = false) {
  const data = { ...payload };

  if (!isUpdate || data.activityType !== undefined) {
    if (!ALLOWED_ACTIVITY_TYPES.includes(data.activityType)) {
      throw new ApiError(400, "INVALID_ACTIVITY_TYPE", "activityType must be running, cycling, or walking");
    }
  }

  const numericRules = [
    ["durationSeconds", 1, 7 * 24 * 60 * 60],
    ["distanceMiles", 0.01, 1000],
    ["calories", 0, 100000],
    ["avgHeartRate", 20, 260],
    ["paceSecondsPerMile", 1, 100000]
  ];

  for (const [field, min, max] of numericRules) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      if (!isUpdate && (field === "durationSeconds" || field === "distanceMiles")) {
        throw new ApiError(400, "MISSING_REQUIRED_FIELD", `${field} is required`);
      }
      continue;
    }

    const value = Number(data[field]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new ApiError(400, "INVALID_NUMERIC_FIELD", `${field} must be between ${min} and ${max}`);
    }

    data[field] = field === "distanceMiles" ? Number(value.toFixed(2)) : Math.round(value);
  }

  if (data.notes !== undefined && data.notes !== null && String(data.notes).length > 5000) {
    throw new ApiError(400, "NOTES_TOO_LONG", "notes must be 5000 characters or less");
  }

  if (data.locationText !== undefined && data.locationText !== null && String(data.locationText).length > 255) {
    throw new ApiError(400, "LOCATION_TOO_LONG", "locationText must be 255 characters or less");
  }

  data.tags = parseTags(data.tags || []);

  if (data.savedPlaceId !== undefined && data.savedPlaceId !== null) {
    const parsedPlaceId = Number(data.savedPlaceId);
    if (!Number.isInteger(parsedPlaceId) || parsedPlaceId <= 0) {
      throw new ApiError(400, "INVALID_SAVED_PLACE_ID", "savedPlaceId must be a positive integer");
    }
    data.savedPlaceId = parsedPlaceId;
  }

  if (data.startedAt) {
    const d = new Date(data.startedAt);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(400, "INVALID_STARTED_AT", "startedAt must be a valid ISO datetime");
    }
    data.startedAt = d.toISOString();
  }

  if (data.completedAt) {
    const d = new Date(data.completedAt);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(400, "INVALID_COMPLETED_AT", "completedAt must be a valid ISO datetime");
    }
    data.completedAt = d.toISOString();
  }

  if (data.startedAt && data.completedAt && new Date(data.completedAt) < new Date(data.startedAt)) {
    throw new ApiError(400, "INVALID_TIME_RANGE", "completedAt cannot be earlier than startedAt");
  }

  return data;
}

module.exports = {
  validateActivityPayload,
  parseTags,
  ALLOWED_ACTIVITY_TYPES
};
