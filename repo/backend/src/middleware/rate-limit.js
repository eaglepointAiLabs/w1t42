const { pool } = require("../db/pool");
const ApiError = require("../errors/api-error");

function buildKey(ctx) {
  const ip = ctx.ip || "unknown";
  return `${ip}:${ctx.path}`;
}

/**
 * Database-backed fixed-window rate limiter.
 * Suitable for multiple server processes and survives restarts.
 * Window boundaries are aligned to epoch multiples of windowMs.
 */
function rateLimit({ limit, windowMs }) {
  return async (ctx, next) => {
    const key = buildKey(ctx);
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

    // Atomic upsert: insert or increment within current window, reset if window has rolled over
    await pool.query(
      `INSERT INTO rate_limit_counters (bucket_key, window_start_ms, count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         count = IF(window_start_ms != ?, 1, count + 1),
         window_start_ms = IF(window_start_ms != ?, ?, window_start_ms)`,
      [key, windowStart, windowStart, windowStart, windowStart]
    );

    const [rows] = await pool.query(
      "SELECT count FROM rate_limit_counters WHERE bucket_key = ?",
      [key]
    );

    const count = rows[0]?.count ?? 1;

    if (count > limit) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests, please retry later");
    }

    await next();
  };
}

module.exports = rateLimit;
