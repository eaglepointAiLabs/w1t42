const pino = require("pino");
const env = require("../config/env");

const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "trailforge-backend"
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
