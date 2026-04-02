const { z } = require("zod");

const placePayloadSchema = z.object({
  label: z.string().min(1).max(100),
  locationText: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isDefault: z.boolean().default(false)
});

const placeIdParamSchema = z.object({
  placeId: z.coerce.number().int().positive()
});

module.exports = {
  placePayloadSchema,
  placeIdParamSchema
};
