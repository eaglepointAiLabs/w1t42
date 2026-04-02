module.exports = {
  id: "005_analytics_seed",
  async run(connection) {
    const [athleteRows] = await connection.query("SELECT id FROM users WHERE username = 'athlete1' LIMIT 1");
    const [coachRows] = await connection.query("SELECT id FROM users WHERE username = 'coach1' LIMIT 1");
    const [courseRows] = await connection.query("SELECT id, kind, provider_user_id FROM courses_services ORDER BY id ASC LIMIT 1");

    if (!athleteRows.length || !courseRows.length) {
      return;
    }

    const athleteId = athleteRows[0].id;
    const courseId = courseRows[0].id;
    const courseKind = courseRows[0].kind;
    const instructorId = courseRows[0].provider_user_id || coachRows[0]?.id || null;

    await connection.query(
      `
        INSERT INTO orders (
          user_id,
          course_service_id,
          order_type,
          order_status,
          total_amount_cents,
          paid_amount_cents,
          refunded_amount_cents,
          estimated_cost_cents,
          sales_channel,
          location_code,
          assigned_instructor_user_id,
          payment_due_at,
          completed_at,
          idempotency_key
        )
        VALUES
          (?, ?, ?, 'completed', 2999, 2999, 0, 1700, 'direct', 'global', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), CURRENT_TIMESTAMP, 'seed-analytics-order-1'),
          (?, ?, ?, 'refund_partial', 4500, 4500, 500, 2800, 'partner', 'city-center', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), CURRENT_TIMESTAMP, 'seed-analytics-order-2'),
          (?, ?, ?, 'paid', 1999, 1999, 0, 1100, 'direct', 'global', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), NULL, 'seed-analytics-order-3'),
          (?, ?, ?, 'cancelled', 1500, 0, 0, 700, 'community', 'north-hub', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), NULL, 'seed-analytics-order-4')
      `,
      [
        athleteId,
        courseId,
        courseKind,
        instructorId,
        athleteId,
        courseId,
        courseKind,
        instructorId,
        athleteId,
        courseId,
        courseKind,
        instructorId,
        athleteId,
        courseId,
        courseKind,
        instructorId
      ]
    );

    await connection.query(
      `
        INSERT INTO entitlements (user_id, entitlement_type, status, starts_at, ends_at, metadata)
        VALUES
          (?, 'subscription', 'expired', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 60 DAY), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY), ?),
          (?, 'subscription', 'active', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 29 DAY), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), ?)
      `,
      [athleteId, JSON.stringify({ tier: "starter" }), athleteId, JSON.stringify({ tier: "starter" })]
    );
  }
};
