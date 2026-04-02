const { z } = require("zod");

const createOrderSchema = z.object({
  courseServiceId: z.number().int().positive(),
  orderType: z.enum(["course", "service"]),
  totalAmountDollars: z.number().positive(),
  idempotencyKey: z.string().min(6).max(100)
});

const orderIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

module.exports = {
  createOrderSchema,
  orderIdParamSchema
};
