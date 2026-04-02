const bcrypt = require("bcrypt");
const { encrypt } = require("../src/security/encryption");

module.exports = {
  id: "001_base_seed",
  async run(connection) {
    const roles = [
      { code: "admin", name: "Admin" },
      { code: "coach", name: "Coach" },
      { code: "support", name: "Support Agent" },
      { code: "user", name: "Regular User" }
    ];

    for (const role of roles) {
      await connection.query(
        `
          INSERT INTO roles (code, name, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description)
        `,
        [role.code, role.name, `${role.name} default role`]
      );
    }

    const permissions = [
      { code: "admin.full", name: "Admin Full Access" },
      { code: "reviews.reply", name: "Reply to Reviews" },
      { code: "reviews.moderate", name: "Moderate Reviews" },
      { code: "activities.manage", name: "Manage Activities" },
      { code: "auth.self", name: "Self Authentication Access" }
    ];

    for (const permission of permissions) {
      await connection.query(
        `
          INSERT INTO permissions (code, name, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description)
        `,
        [permission.code, permission.name, `${permission.name} permission`]
      );
    }

    const [roleRows] = await connection.query("SELECT id, code FROM roles");
    const [permissionRows] = await connection.query("SELECT id, code FROM permissions");

    const roleIdByCode = Object.fromEntries(roleRows.map((row) => [row.code, row.id]));
    const permissionIdByCode = Object.fromEntries(permissionRows.map((row) => [row.code, row.id]));

    const rolePermissionMap = {
      admin: ["admin.full", "reviews.reply", "reviews.moderate", "activities.manage", "auth.self"],
      coach: ["reviews.reply", "activities.manage", "auth.self"],
      support: ["reviews.reply", "reviews.moderate", "auth.self"],
      user: ["activities.manage", "auth.self"]
    };

    for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
      for (const permissionCode of permissionCodes) {
        await connection.query(
          `
            INSERT IGNORE INTO role_permissions (role_id, permission_id)
            VALUES (?, ?)
          `,
          [roleIdByCode[roleCode], permissionIdByCode[permissionCode]]
        );
      }
    }

    const users = [
      {
        username: "admin",
        email: "admin@trailforge.local",
        password: "admin12345",
        role: "admin",
        displayName: "System Admin",
        legalName: "Admin User",
        phone: "+10000000001"
      },
      {
        username: "coach1",
        email: "coach1@trailforge.local",
        password: "coach12345",
        role: "coach",
        displayName: "Coach One",
        legalName: "Coach Person",
        phone: "+10000000002"
      },
      {
        username: "support1",
        email: "support1@trailforge.local",
        password: "support12345",
        role: "support",
        displayName: "Support Agent",
        legalName: "Support Person",
        phone: "+10000000003"
      },
      {
        username: "athlete1",
        email: "athlete1@trailforge.local",
        password: "athlete12345",
        role: "user",
        displayName: "Athlete One",
        legalName: "Athlete User",
        phone: "+10000000004"
      }
    ];

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      await connection.query(
        `
          INSERT INTO users (username, email, password_hash, status)
          VALUES (?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            password_hash = VALUES(password_hash),
            status = VALUES(status)
        `,
        [user.username, user.email, passwordHash]
      );

      const [userRows] = await connection.query("SELECT id FROM users WHERE username = ? LIMIT 1", [user.username]);
      const userId = userRows[0].id;

      await connection.query(
        `
          INSERT INTO user_profiles (user_id, display_name, legal_name_encrypted, phone_encrypted)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            legal_name_encrypted = VALUES(legal_name_encrypted),
            phone_encrypted = VALUES(phone_encrypted)
        `,
        [userId, user.displayName, encrypt(user.legalName), encrypt(user.phone)]
      );

      await connection.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await connection.query("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, roleIdByCode[user.role]]);
    }

    const [athleteRows] = await connection.query("SELECT id FROM users WHERE username = 'athlete1' LIMIT 1");
    if (athleteRows.length) {
      await connection.query(
        `
          INSERT INTO entitlements (user_id, entitlement_type, status, starts_at, ends_at, metadata)
          VALUES (?, 'subscription', 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), ?)
        `,
        [athleteRows[0].id, JSON.stringify({ tier: "starter" })]
      );
    }
  }
};
