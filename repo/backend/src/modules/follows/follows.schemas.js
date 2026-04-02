const { z } = require("zod");

const followUserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive()
});

module.exports = {
  followUserIdParamSchema
};
