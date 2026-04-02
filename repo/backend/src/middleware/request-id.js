const crypto = require("crypto");

async function requestId(ctx, next) {
  const incoming = ctx.get("x-request-id");
  const id = incoming || crypto.randomUUID();
  ctx.state.requestId = id;
  ctx.set("x-request-id", id);
  await next();
}

module.exports = requestId;
