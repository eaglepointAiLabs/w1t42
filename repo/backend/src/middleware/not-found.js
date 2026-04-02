const { errorResponse } = require("../utils/api-response");

function notFound(ctx) {
  ctx.status = 404;
  ctx.body = errorResponse({
    code: "NOT_FOUND",
    message: "Route not found",
    requestId: ctx.state.requestId || null
  });
}

module.exports = notFound;
