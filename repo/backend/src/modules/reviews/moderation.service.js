const crypto = require("crypto");
const ApiError = require("../../errors/api-error");
const { pool } = require("../../db/pool");

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// PNG: 8-byte magic \x89PNG\r\n\x1a\n
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// JPEG: 3-byte SOI marker \xff\xd8\xff
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function matchesMagic(buffer, magic) {
  return buffer.length >= magic.length && buffer.slice(0, magic.length).equals(magic);
}

async function ensureUserNotBlacklisted(userId) {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM review_blacklist
      WHERE user_id = ?
        AND is_active = 1
        AND ends_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [userId]
  );

  if (rows.length) {
    throw new ApiError(403, "REVIEW_BLACKLISTED", "User is temporarily blocked from publishing reviews");
  }
}

async function checkSensitiveWords(text) {
  const normalized = String(text || "").toLowerCase();
  const [rows] = await pool.query("SELECT word FROM sensitive_words WHERE is_active = 1");
  const matched = rows.map((row) => row.word).filter((word) => normalized.includes(String(word).toLowerCase()));

  if (matched.length) {
    throw new ApiError(400, "SENSITIVE_WORD_DETECTED", "Content contains restricted words", { matched });
  }
}

function decodeAndValidateImage({ base64Data, mimeType, sizeBytes }) {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ApiError(400, "INVALID_IMAGE_TYPE", "Image must be PNG or JPEG");
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) {
    throw new ApiError(400, "INVALID_IMAGE_SIZE", "Image size must be between 1 byte and 5 MB");
  }

  const buffer = Buffer.from(String(base64Data || ""), "base64");
  if (!buffer.length) {
    throw new ApiError(400, "INVALID_IMAGE_PAYLOAD", "Image payload is empty");
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ApiError(400, "INVALID_IMAGE_SIZE", "Decoded image exceeds 5 MB");
  }

  if (mimeType === "image/png" && !matchesMagic(buffer, PNG_MAGIC)) {
    throw new ApiError(400, "INVALID_IMAGE_CONTENT", "File content does not match declared PNG type");
  }
  if (mimeType === "image/jpeg" && !matchesMagic(buffer, JPEG_MAGIC)) {
    throw new ApiError(400, "INVALID_IMAGE_CONTENT", "File content does not match declared JPEG type");
  }

  return buffer;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function ensureImageHashAllowed(hash) {
  const [rows] = await pool.query("SELECT id FROM image_hash_denylist WHERE sha256_hash = ? LIMIT 1", [hash]);
  if (rows.length) {
    throw new ApiError(400, "IMAGE_HASH_DENIED", "Image hash is deny-listed");
  }
}

async function enforceDailyPublishCap(userId) {
  const [reviewRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM reviews
      WHERE user_id = ?
        AND published_at IS NOT NULL
        AND DATE(published_at) = CURRENT_DATE
    `,
    [userId]
  );

  const [followupRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM review_followups
      WHERE user_id = ?
        AND DATE(created_at) = CURRENT_DATE
    `,
    [userId]
  );

  const total = Number(reviewRows[0].total || 0) + Number(followupRows[0].total || 0);
  if (total >= 2) {
    throw new ApiError(429, "DAILY_REVIEW_LIMIT", "User can publish at most 2 review items per day");
  }
}

module.exports = {
  ensureUserNotBlacklisted,
  checkSensitiveWords,
  decodeAndValidateImage,
  sha256,
  ensureImageHashAllowed,
  enforceDailyPublishCap,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES
};
