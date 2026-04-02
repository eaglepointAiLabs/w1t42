const { z } = require("zod");

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120).optional(),
  legalName: z.string().min(1).max(120).optional(),
  phone: z.string().min(5).max(30).optional()
});

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(128),
  deviceFingerprint: z.string().min(8).max(500).optional()
});

module.exports = {
  registerSchema,
  loginSchema
};
