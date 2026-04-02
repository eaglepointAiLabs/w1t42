const { pool } = require("../db/pool");
const ApiError = require("../errors/api-error");
const { hashSessionToken } = require("../security/session");

const SESSION_COOKIE = "trailforge_session";

async function optionalAuth(ctx, next) {
  const token = ctx.cookies.get(SESSION_COOKIE, { signed: true });
  if (!token) {
    await next();
    return;
  }

  const tokenHash = hashSessionToken(token);
  const [rows] = await pool.query(
    `
      SELECT s.id AS session_id, s.user_id, s.expires_at, u.username, u.email, u.status
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token_hash = ?
        AND s.status = 'active'
        AND s.expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash]
  );

  if (!rows.length) {
    ctx.cookies.set(SESSION_COOKIE, "", { signed: true, maxAge: 0 });
    await next();
    return;
  }

  const [roleRows] = await pool.query(
    `
      SELECT r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `,
    [rows[0].user_id]
  );

  ctx.state.user = {
    id: rows[0].user_id,
    username: rows[0].username,
    email: rows[0].email,
    status: rows[0].status,
    sessionId: rows[0].session_id,
    roles: roleRows.map((row) => row.code)
  };

  await pool.query("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?", [rows[0].session_id]);

  await next();
}

async function requireAuth(ctx, next) {
  if (!ctx.state.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  if (ctx.state.user.status !== "active") {
    throw new ApiError(403, "ACCOUNT_DISABLED", "Account is not active");
  }

  await next();
}

function requireRole(allowedRoles) {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const hasRole = ctx.state.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      throw new ApiError(403, "FORBIDDEN", "Insufficient role permissions");
    }

    await next();
  };
}

module.exports = {
  SESSION_COOKIE,
  optionalAuth,
  requireAuth,
  requireRole
};
