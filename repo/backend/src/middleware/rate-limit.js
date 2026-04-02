const ApiError = require("../errors/api-error");

const buckets = new Map();

function buildKey(ctx) {
  const ip = ctx.ip || "unknown";
  return `${ip}:${ctx.path}`;
}

function rateLimit({ limit, windowMs }) {
  return async (ctx, next) => {
    const key = buildKey(ctx);
    const now = Date.now();
    const state = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > state.resetAt) {
      state.count = 0;
      state.resetAt = now + windowMs;
    }

    state.count += 1;
    buckets.set(key, state);

    if (state.count > limit) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests, please retry later");
    }

    await next();
  };
}

module.exports = rateLimit;
