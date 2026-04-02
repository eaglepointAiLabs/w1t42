const { z } = require("zod");

const createReviewSchema = z.object({
  orderId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(1).max(5000),
  anonymousDisplay: z.boolean().default(false),
  dimensionScores: z.array(z.object({ dimensionConfigId: z.number().int().positive(), score: z.number().int().min(1).max(5) })).default([])
});

const createFollowupSchema = z.object({
  followupText: z.string().min(1).max(3000)
});

const createAppealSchema = z.object({
  reason: z.string().min(1).max(2000)
});

const createReplySchema = z.object({
  reviewId: z.number().int().positive(),
  parentReplyId: z.number().int().positive().nullable().optional(),
  replyText: z.string().min(1).max(2000)
});

const updateAppealStatusSchema = z.object({
  appealStatus: z.enum(["under_review", "upheld", "rejected", "resolved"]),
  note: z.string().max(2000).optional()
});

const uploadImageSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["image/png", "image/jpeg"]),
  sizeBytes: z.number().int().positive(),
  base64Data: z.string().min(10)
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const imageIdParamSchema = z.object({
  imageId: z.coerce.number().int().positive()
});

const appealIdParamSchema = z.object({
  appealId: z.coerce.number().int().positive()
});

module.exports = {
  createReviewSchema,
  createFollowupSchema,
  createAppealSchema,
  createReplySchema,
  updateAppealStatusSchema,
  uploadImageSchema,
  idParamSchema,
  imageIdParamSchema,
  appealIdParamSchema
};
