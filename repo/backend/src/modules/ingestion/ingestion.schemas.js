const { z } = require("zod");

const sourceSchema = z.object({
  sourceName: z.string().min(2).max(150),
  sourceType: z.enum(["rss", "api_payload", "html_extract"]),
  ingestPath: z.string().min(1).max(512),
  allowlisted: z.boolean().default(true),
  blocklisted: z.boolean().default(false),
  rateLimitPerMinute: z.number().int().positive().max(10000).default(60),
  sourceStatus: z.enum(["active", "paused", "disabled"]).default("active")
});

const sourcePatchSchema = sourceSchema.partial();

const sourceIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const logsQuerySchema = z.object({
  sourceId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(200)
});

module.exports = {
  sourceSchema,
  sourcePatchSchema,
  sourceIdParamSchema,
  logsQuerySchema
};
