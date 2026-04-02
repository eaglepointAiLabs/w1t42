const { z } = require("zod");

const createImportSchema = z.object({
  fileName: z.string().min(3).max(255),
  content: z.string().min(10)
});

const importIdParamSchema = z.object({
  importId: z.coerce.number().int().positive()
});

const refundSchema = z.object({
  amountDollars: z.number().positive(),
  reason: z.string().min(1).max(255),
  idempotencyKey: z.string().min(6).max(100)
});

module.exports = {
  createImportSchema,
  importIdParamSchema,
  refundSchema
};
