const ApiError = require("../errors/api-error");

function validate({ body, query, params }) {
  return async (ctx, next) => {
    if (body) {
      const parsedBody = body.safeParse(ctx.request.body);
      if (!parsedBody.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten());
      }
      ctx.request.body = parsedBody.data;
    }

    if (query) {
      const parsedQuery = query.safeParse(ctx.request.query || {});
      if (!parsedQuery.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid query parameters", parsedQuery.error.flatten());
      }
      ctx.request.query = parsedQuery.data;
    }

    if (params) {
      const parsedParams = params.safeParse(ctx.params || {});
      if (!parsedParams.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid path parameters", parsedParams.error.flatten());
      }
      ctx.params = parsedParams.data;
    }

    await next();
  };
}

module.exports = validate;
