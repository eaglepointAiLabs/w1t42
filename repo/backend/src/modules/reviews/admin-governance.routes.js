const Router = require("@koa/router");
const { z } = require("zod");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { pool } = require("../../db/pool");
const { successResponse } = require("../../utils/api-response");

const router = new Router({ prefix: "/api/v1/admin/review-governance" });

const dimensionSchema = z.object({
  keyName: z.string().min(2).max(80),
  label: z.string().min(2).max(120),
  weight: z.number().positive().max(100),
  isActive: z.boolean().default(true)
});

const wordSchema = z.object({ word: z.string().min(1).max(120) });
const hashSchema = z.object({ sha256Hash: z.string().length(64), reason: z.string().min(3).max(255) });
const blacklistSchema = z.object({ userId: z.number().int().positive(), reason: z.string().min(3).max(255), days: z.number().int().min(1).max(365).default(30) });
const idParam = z.object({ id: z.coerce.number().int().positive() });

router.use(requireAuth, requireRole(["admin"]));

router.get("/dimensions", async (ctx) => {
  const [rows] = await pool.query("SELECT * FROM review_dimension_configs ORDER BY id ASC");
  ctx.body = successResponse(rows);
});

router.post("/dimensions", validate({ body: dimensionSchema }), async (ctx) => {
  const { keyName, label, weight, isActive } = ctx.request.body;
  await pool.query(
    `
      INSERT INTO review_dimension_configs (key_name, label, weight, is_active)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE label = VALUES(label), weight = VALUES(weight), is_active = VALUES(is_active)
    `,
    [keyName, label, weight, isActive ? 1 : 0]
  );
  const [rows] = await pool.query("SELECT * FROM review_dimension_configs WHERE key_name = ? LIMIT 1", [keyName]);
  ctx.status = 201;
  ctx.body = successResponse(rows[0]);
});

router.patch("/dimensions/:id", validate({ params: idParam, body: dimensionSchema.partial() }), async (ctx) => {
  const id = ctx.params.id;
  const body = ctx.request.body;
  const fields = [];
  const values = [];
  if (body.keyName !== undefined) {
    fields.push("key_name = ?");
    values.push(body.keyName);
  }
  if (body.label !== undefined) {
    fields.push("label = ?");
    values.push(body.label);
  }
  if (body.weight !== undefined) {
    fields.push("weight = ?");
    values.push(body.weight);
  }
  if (body.isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(body.isActive ? 1 : 0);
  }
  if (fields.length) {
    values.push(id);
    await pool.query(`UPDATE review_dimension_configs SET ${fields.join(", ")} WHERE id = ?`, values);
  }
  const [rows] = await pool.query("SELECT * FROM review_dimension_configs WHERE id = ? LIMIT 1", [id]);
  ctx.body = successResponse(rows[0] || null);
});

router.get("/sensitive-words", async (ctx) => {
  const [rows] = await pool.query("SELECT * FROM sensitive_words ORDER BY id ASC");
  ctx.body = successResponse(rows);
});

router.post("/sensitive-words", validate({ body: wordSchema }), async (ctx) => {
  await pool.query(
    `
      INSERT INTO sensitive_words (word, is_active, created_by_user_id)
      VALUES (?, 1, ?)
      ON DUPLICATE KEY UPDATE is_active = 1
    `,
    [ctx.request.body.word, ctx.state.user.id]
  );
  const [rows] = await pool.query("SELECT * FROM sensitive_words WHERE word = ? LIMIT 1", [ctx.request.body.word]);
  ctx.status = 201;
  ctx.body = successResponse(rows[0]);
});

router.delete("/sensitive-words/:id", validate({ params: idParam }), async (ctx) => {
  await pool.query("UPDATE sensitive_words SET is_active = 0 WHERE id = ?", [ctx.params.id]);
  ctx.body = successResponse({ removed: true });
});

router.get("/denylist-hashes", async (ctx) => {
  const [rows] = await pool.query("SELECT id, sha256_hash, reason, created_at FROM image_hash_denylist ORDER BY id DESC");
  ctx.body = successResponse(rows);
});

router.post("/denylist-hashes", validate({ body: hashSchema }), async (ctx) => {
  await pool.query(
    `
      INSERT INTO image_hash_denylist (sha256_hash, reason, created_by_user_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE reason = VALUES(reason)
    `,
    [ctx.request.body.sha256Hash.toLowerCase(), ctx.request.body.reason, ctx.state.user.id]
  );
  ctx.status = 201;
  ctx.body = successResponse({ added: true });
});

router.delete("/denylist-hashes/:id", validate({ params: idParam }), async (ctx) => {
  await pool.query("DELETE FROM image_hash_denylist WHERE id = ?", [ctx.params.id]);
  ctx.body = successResponse({ removed: true });
});

router.get("/blacklist", async (ctx) => {
  const [rows] = await pool.query("SELECT * FROM review_blacklist ORDER BY id DESC");
  ctx.body = successResponse(rows);
});

router.post("/blacklist", validate({ body: blacklistSchema }), async (ctx) => {
  const { userId, reason, days } = ctx.request.body;
  await pool.query(
    `
      INSERT INTO review_blacklist (user_id, reason, starts_at, ends_at, is_active, created_by_user_id)
      VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY), 1, ?)
    `,
    [userId, reason, days, ctx.state.user.id]
  );
  ctx.status = 201;
  ctx.body = successResponse({ added: true });
});

router.delete("/blacklist/:id", validate({ params: idParam }), async (ctx) => {
  await pool.query("UPDATE review_blacklist SET is_active = 0 WHERE id = ?", [ctx.params.id]);
  ctx.body = successResponse({ removed: true });
});

module.exports = router;
