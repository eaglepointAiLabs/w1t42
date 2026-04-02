const { z } = require("zod");

const activityPayloadSchema = z.object({
  activityType: z.enum(["running", "cycling", "walking"]),
  durationSeconds: z.number().int().positive(),
  distanceMiles: z.number().positive(),
  calories: z.number().int().nonnegative().optional().nullable(),
  avgHeartRate: z.number().int().optional().nullable(),
  paceSecondsPerMile: z.number().int().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
  locationText: z.string().max(255).optional().nullable(),
  savedPlaceId: z.number().int().positive().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable()
});

const activityPatchSchema = activityPayloadSchema.partial();

const activityIdParamSchema = z.object({
  activityId: z.coerce.number().int().positive()
});

const gpxUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  base64Data: z.string().min(10)
});

module.exports = {
  activityPayloadSchema,
  activityPatchSchema,
  activityIdParamSchema,
  gpxUploadSchema
};
