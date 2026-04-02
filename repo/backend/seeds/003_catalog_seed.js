module.exports = {
  id: "003_catalog_seed",
  async run(connection) {
    const [coachRows] = await connection.query("SELECT id FROM users WHERE username = 'coach1' LIMIT 1");
    const providerId = coachRows.length ? coachRows[0].id : null;

    await connection.query(
      `
        INSERT INTO courses_services (kind, title, description, provider_user_id, status)
        VALUES
          ('course', '5K Starter Plan', 'Intro running plan for beginners', ?, 'active'),
          ('service', 'Bike Fit Session', 'Basic bike fit and setup service', ?, 'active')
      `,
      [providerId, providerId]
    );
  }
};
