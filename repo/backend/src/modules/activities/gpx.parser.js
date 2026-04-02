const ApiError = require("../../errors/api-error");

const ALLOWED_GPX_MIME_TYPES = ["application/gpx+xml", "application/xml", "text/xml", "text/plain"];
const MAX_GPX_BYTES = 10 * 1024 * 1024;

function validateGpxUploadMeta({ fileName, mimeType, sizeBytes }) {
  if (!fileName || !String(fileName).toLowerCase().endsWith(".gpx")) {
    throw new ApiError(400, "INVALID_GPX_FILE_NAME", "GPX file must use .gpx extension");
  }

  if (!ALLOWED_GPX_MIME_TYPES.includes(String(mimeType || "").toLowerCase())) {
    throw new ApiError(400, "INVALID_GPX_MIME_TYPE", "GPX mimeType is not allowed");
  }

  const size = Number(sizeBytes);
  if (!Number.isInteger(size) || size < 1 || size > MAX_GPX_BYTES) {
    throw new ApiError(400, "INVALID_GPX_SIZE", "GPX size must be between 1 byte and 10 MB");
  }
}

function parseGpxCoordinates(xmlText) {
  const text = String(xmlText || "");
  if (!text.includes("<gpx") && !text.includes("<GPX")) {
    throw new ApiError(400, "INVALID_GPX_CONTENT", "Provided file is not valid GPX content");
  }

  const trkptRegex = /<trkpt\s+[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  const points = [];
  let match;
  let seq = 1;

  while ((match = trkptRegex.exec(text)) !== null) {
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const block = match[3] || "";
    const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(block);
    const timeMatch = /<time>([^<]+)<\/time>/i.exec(block);

    points.push({
      seqNo: seq++,
      latitude: Number(lat.toFixed(7)),
      longitude: Number(lon.toFixed(7)),
      elevationMeters: eleMatch ? Number(Number(eleMatch[1]).toFixed(2)) : null,
      pointTimestamp: timeMatch ? new Date(timeMatch[1]).toISOString() : null
    });
  }

  if (!points.length) {
    throw new ApiError(400, "NO_GPX_POINTS", "No coordinate points found in GPX file");
  }

  return points;
}

module.exports = {
  validateGpxUploadMeta,
  parseGpxCoordinates,
  ALLOWED_GPX_MIME_TYPES,
  MAX_GPX_BYTES
};
