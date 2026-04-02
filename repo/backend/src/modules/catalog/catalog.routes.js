const Router = require("@koa/router");
const { successResponse } = require("../../utils/api-response");
const { pool } = require("../../db/pool");

const router = new Router({ prefix: "/api/v1/catalog" });

router.get("/", async (ctx) => {
  const [rows] = await pool.query(
    `
      SELECT id, kind, title, description, provider_user_id, status, created_at, updated_at
      FROM courses_services
      WHERE status = 'active'
      ORDER BY id DESC
    `
  );

  ctx.body = successResponse(rows);
});

module.exports = router;
