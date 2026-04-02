const ApiError = require("../errors/api-error");
const logger = require("../logger");

const DEFAULT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const DEFAULT_MAX_ATTEMPTS_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_MAX_PER_IP || 30);
const DEFAULT_MAX_ATTEMPTS_PER_IP_USERNAME = Number(process.env.LOGIN_RATE_LIMIT_MAX_PER_IP_USERNAME || 8);

function nowMs() {
  return Date.now();
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function pruneAttempts(attempts, cutoff) {
  while (attempts.length && attempts[0] <= cutoff) {
    attempts.shift();
  }
}

function createWindowRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  const maxPerIp = Number(options.maxPerIp || DEFAULT_MAX_ATTEMPTS_PER_IP);
  const maxPerIpUsername = Number(options.maxPerIpUsername || DEFAULT_MAX_ATTEMPTS_PER_IP_USERNAME);
  const buckets = new Map();

  function getBucket(key) {
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    return buckets.get(key);
  }

  function isLimited(key, now) {
    const bucket = getBucket(key);
    pruneAttempts(bucket, now - windowMs);
    return bucket.length;
  }

  function recordAttempt(key, now) {
    const bucket = getBucket(key);
    pruneAttempts(bucket, now - windowMs);
    bucket.push(now);
  }

  function resetKey(key) {
    if (key) {
      buckets.delete(key);
    }
  }

  function clear() {
    buckets.clear();
  }

  async function middleware(ctx, next) {
    const sourceIp = ctx.ip || ctx.request.ip || "unknown";
    const username = normalizeUsername(ctx.request.body?.username);
    const ipKey = `login:ip:${sourceIp}`;
    const ipUsernameKey = username ? `login:ip-user:${sourceIp}:${username}` : null;
    const now = nowMs();

    const ipCount = isLimited(ipKey, now);
    const ipUserCount = ipUsernameKey ? isLimited(ipUsernameKey, now) : 0;
    const exceedsIp = ipCount >= maxPerIp;
    const exceedsIpUser = ipUsernameKey ? ipUserCount >= maxPerIpUsername : false;

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

    recordAttempt(ipKey, now);
    if (ipUsernameKey) {
      recordAttempt(ipUsernameKey, now);
    }

    await next();

    if (ctx.status < 400 && ipUsernameKey) {
      resetKey(ipUsernameKey);
    }
  }

  middleware.reset = clear;
  return middleware;
}

const loginRateLimit = createWindowRateLimiter();

module.exports = {
  createWindowRateLimiter,
  loginRateLimit
};
