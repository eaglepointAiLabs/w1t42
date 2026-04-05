const { pool } = require("../db/pool");
const ApiError = require("../errors/api-error");
const logger = require("../logger");

const DEFAULT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const DEFAULT_MAX_ATTEMPTS_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_MAX_PER_IP || 30);
const DEFAULT_MAX_ATTEMPTS_PER_IP_USERNAME = Number(process.env.LOGIN_RATE_LIMIT_MAX_PER_IP_USERNAME || 8);

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

/**
 * Atomically increment a DB-backed fixed-window counter and return the new count.
 * Window boundaries are aligned to epoch multiples of windowMs.
 */
async function incrementAndGetCount(dbPool, key, windowMs) {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

  await dbPool.query(
    `INSERT INTO rate_limit_counters (bucket_key, window_start_ms, count)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       count = IF(window_start_ms != ?, 1, count + 1),
       window_start_ms = IF(window_start_ms != ?, ?, window_start_ms)`,
    [key, windowStart, windowStart, windowStart, windowStart]
  );

  const [rows] = await dbPool.query(
    "SELECT count FROM rate_limit_counters WHERE bucket_key = ?",
    [key]
  );

  return rows[0]?.count ?? 1;
}

async function resetKey(dbPool, key) {
  await dbPool.query("DELETE FROM rate_limit_counters WHERE bucket_key = ?", [key]);
}

/**
 * Creates a DB-backed login rate limiter middleware.
 * Tracks attempts per IP and per IP+username combination.
 * Shared across multiple server processes via the database.
 */
function createWindowRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  const maxPerIp = Number(options.maxPerIp || DEFAULT_MAX_ATTEMPTS_PER_IP);
  const maxPerIpUsername = Number(options.maxPerIpUsername || DEFAULT_MAX_ATTEMPTS_PER_IP_USERNAME);

  async function middleware(ctx, next) {
    const sourceIp = ctx.ip || ctx.request.ip || "unknown";
    const username = normalizeUsername(ctx.request.body?.username);
    const ipKey = `login:ip:${sourceIp}`;
    const ipUsernameKey = username ? `login:ip-user:${sourceIp}:${username}` : null;

    const ipCount = await incrementAndGetCount(pool, ipKey, windowMs);
    const ipUserCount = ipUsernameKey ? await incrementAndGetCount(pool, ipUsernameKey, windowMs) : 0;

    const exceedsIp = ipCount > maxPerIp;
    const exceedsIpUser = ipUsernameKey ? ipUserCount > maxPerIpUsername : false;

    if (exceedsIp || exceedsIpUser) {
      logger.warn(
        {
          requestId: ctx.state.requestId,
          path: ctx.path,
          method: ctx.method,
          ip: sourceIp,
          rateLimitScope: exceedsIp ? "ip" : "ip_username"
        },
        "Login rate limit exceeded"
      );

      ctx.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      throw new ApiError(429, "TOO_MANY_LOGIN_ATTEMPTS", "Too many login attempts. Please try again later.");
    }

    await next();

    if (ctx.status < 400 && ipUsernameKey) {
      await resetKey(pool, ipUsernameKey);
    }
  }

  return middleware;
}

const loginRateLimit = createWindowRateLimiter();

module.exports = {
  createWindowRateLimiter,
  loginRateLimit
};
