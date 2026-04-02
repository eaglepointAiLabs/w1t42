const logger = require("../logger");
const { errorResponse } = require("../utils/api-response");

async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (error) {
    const status = error.status || 500;
    const code = error.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    ctx.status = status;
    ctx.body = errorResponse({
      code,
      message: status === 500 ? "Internal Server Error" : error.message,
      details: error.details || null,
      requestId: ctx.state.requestId || null
    });

    logger.error(
      {
        err: error,
        requestId: ctx.state.requestId,
        status,
        path: ctx.path,
        method: ctx.method
      },
      "Request failed"
    );
  }
}

module.exports = errorHandler;
