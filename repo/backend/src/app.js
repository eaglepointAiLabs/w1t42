const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("@koa/cors");
const helmet = require("koa-helmet");
const env = require("./config/env");
const logger = require("./logger");
const requestId = require("./middleware/request-id");
const errorHandler = require("./middleware/error-handler");
const notFound = require("./middleware/not-found");
const { optionalAuth } = require("./middleware/auth");
const routes = require("./routes");

const app = new Koa();
app.keys = [env.SESSION_SECRET];

app.use(errorHandler);
app.use(requestId);
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;
  logger.info(
    {
      requestId: ctx.state.requestId,
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      durationMs
    },
    "Request completed"
  );
});
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(
  bodyParser({
    enableTypes: ["json"],
    jsonLimit: "10mb"
  })
);
app.use(optionalAuth);

app.use(routes.routes());
app.use(routes.allowedMethods());
app.use(notFound);

module.exports = app;
