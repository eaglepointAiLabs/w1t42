const { z } = require("zod");

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const actionSchema = z.object({
  action: z.enum(["clicked", "not_interested", "block_author", "block_tag"]),
  itemType: z.enum(["activity", "course_update", "news"]),
  similarityKey: z.string().min(1).max(255),
  contentItemId: z.number().int().positive().optional().nullable(),
  author: z.string().max(120).optional().nullable(),
  tag: z.string().max(80).optional().nullable()
});

const preferencesSchema = z.object({
  preferredSports: z.array(z.string().min(1).max(60)).max(20).default([]),
  includeTrainingUpdates: z.boolean().default(true),
  includeCourseUpdates: z.boolean().default(true),
  includeNews: z.boolean().default(true)
});

module.exports = {
  feedQuerySchema,
  actionSchema,
  preferencesSchema
};
