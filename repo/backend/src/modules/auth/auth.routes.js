const Router = require("@koa/router");
const bcrypt = require("bcrypt");
const { pool } = require("../../db/pool");
const validate = require("../../middleware/validate");
const { SESSION_COOKIE, requireAuth } = require("../../middleware/auth");
const { loginRateLimit } = require("../../middleware/auth-rate-limit");
const { successResponse } = require("../../utils/api-response");
const ApiError = require("../../errors/api-error");
const { registerSchema, loginSchema } = require("./auth.schemas");
const { generateSessionToken, hashSessionToken } = require("../../security/session");
const { encrypt, decrypt } = require("../../security/encryption");
const { writeAuditEvent } = require("../../services/audit-log");
const env = require("../../config/env");

const router = new Router({ prefix: "/api/v1/auth" });

router.post("/register", validate({ body: registerSchema }), async (ctx) => {
  const { username, password, email, displayName, legalName, phone } = ctx.request.body;

  const [existingUsers] = await pool.query("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
  if (existingUsers.length) {
    throw new ApiError(409, "USERNAME_EXISTS", "Username is already taken");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `,
      [username, email || null, passwordHash]
    );

    const userId = result.insertId;

    const [roleRows] = await connection.query("SELECT id FROM roles WHERE code = 'user' LIMIT 1");
    if (!roleRows.length) {
      throw new ApiError(500, "ROLE_CONFIG_ERROR", "Default role is not configured");
    }

    await connection.query("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, roleRows[0].id]);

    await connection.query(
      `
        INSERT INTO user_profiles (user_id, display_name, legal_name_encrypted, phone_encrypted)
        VALUES (?, ?, ?, ?)
      `,
      [userId, displayName || username, encrypt(legalName || null), encrypt(phone || null)]
    );

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "auth.register",
      entityType: "user",
      entityId: String(userId),
      requestId: ctx.state.requestId,
      payload: { username }
    });

    ctx.status = 201;
    ctx.body = successResponse({
      id: userId,
      username,
      email: email || null,
      roles: ["user"]
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.post("/login", loginRateLimit, validate({ body: loginSchema }), async (ctx) => {
  const { username, password, deviceFingerprint } = ctx.request.body;

  const [users] = await pool.query(
    `
      SELECT id, username, email, password_hash, status
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );

  if (!users.length) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  const user = users[0];
  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "ACCOUNT_DISABLED", "Account is not active");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let deviceFingerprintId = null;
    if (deviceFingerprint) {
      const fingerprintHash = hashSessionToken(deviceFingerprint);
      const [existingDeviceRows] = await connection.query(
        "SELECT id FROM device_fingerprints WHERE fingerprint_hash = ? LIMIT 1",
        [fingerprintHash]
      );

      if (existingDeviceRows.length) {
        deviceFingerprintId = existingDeviceRows[0].id;
        await connection.query(
          `
            UPDATE device_fingerprints
            SET user_id = ?, last_seen_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [user.id, deviceFingerprintId]
        );
      } else {
        const [deviceInsert] = await connection.query(
          `
            INSERT INTO device_fingerprints (user_id, fingerprint_hash)
            VALUES (?, ?)
          `,
          [user.id, fingerprintHash]
        );
        deviceFingerprintId = deviceInsert.insertId;
      }

      if (deviceFingerprintId) {
        await connection.query(
          `
            INSERT INTO user_device_fingerprints (user_id, device_fingerprint_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP
          `,
          [user.id, deviceFingerprintId]
        );
      }
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    await connection.query(
      `
        INSERT INTO auth_sessions (user_id, session_token_hash, device_fingerprint_id, expires_at)
        VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? HOUR))
      `,
      [user.id, tokenHash, deviceFingerprintId, env.SESSION_TTL_HOURS]
    );

    await connection.query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

    const [roles] = await connection.query(
      `
        SELECT r.code
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `,
      [user.id]
    );

    await connection.commit();

    ctx.cookies.set(SESSION_COOKIE, rawToken, {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      maxAge: Number(env.SESSION_TTL_HOURS) * 60 * 60 * 1000,
      secure: env.NODE_ENV === "production"
    });

    await writeAuditEvent({
      actorUserId: user.id,
      eventType: "auth.login",
      entityType: "user",
      entityId: String(user.id),
      requestId: ctx.state.requestId,
      payload: { username: user.username }
    });

    ctx.body = successResponse({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: roles.map((item) => item.code)
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.post("/logout", requireAuth, async (ctx) => {
  const token = ctx.cookies.get(SESSION_COOKIE, { signed: true });

  if (token) {
    const tokenHash = hashSessionToken(token);
    await pool.query(
      `
        UPDATE auth_sessions
        SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'logout'
        WHERE session_token_hash = ?
      `,
      [tokenHash]
    );
  }

  ctx.cookies.set(SESSION_COOKIE, "", { signed: true, maxAge: 0 });

  await writeAuditEvent({
    actorUserId: ctx.state.user.id,
    eventType: "auth.logout",
    entityType: "session",
    entityId: String(ctx.state.user.sessionId || ""),
    requestId: ctx.state.requestId
  });

  ctx.body = successResponse({ loggedOut: true });
});

router.get("/me", requireAuth, async (ctx) => {
  const [profileRows] = await pool.query(
    `
      SELECT display_name, legal_name_encrypted, phone_encrypted
      FROM user_profiles
      WHERE user_id = ?
      LIMIT 1
    `,
    [ctx.state.user.id]
  );

  const [rolesRows] = await pool.query(
    `
      SELECT r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `,
    [ctx.state.user.id]
  );

  const [entitlementRows] = await pool.query(
    `
      SELECT status, starts_at, ends_at
      FROM entitlements
      WHERE user_id = ?
        AND entitlement_type = 'subscription'
      ORDER BY id DESC
      LIMIT 1
    `,
    [ctx.state.user.id]
  );

  const profile = profileRows[0] || {};

  ctx.body = successResponse({
    id: ctx.state.user.id,
    username: ctx.state.user.username,
    email: ctx.state.user.email,
    status: ctx.state.user.status,
    roles: rolesRows.map((row) => row.code),
    subscriber: {
      isSubscriber: Boolean(entitlementRows.length && entitlementRows[0].status === "active"),
      status: entitlementRows[0]?.status || "none",
      startsAt: entitlementRows[0]?.starts_at || null,
      endsAt: entitlementRows[0]?.ends_at || null
    },
    profile: {
      displayName: profile.display_name || null,
      legalName: decrypt(profile.legal_name_encrypted || null),
      phone: decrypt(profile.phone_encrypted || null)
    }
  });
});

module.exports = router;
