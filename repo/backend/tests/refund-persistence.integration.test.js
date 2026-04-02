const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/db/pool");

const runDbTests = process.env.RUN_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

function unique(label) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describeDb("Refund persistence integration", () => {
  test("authorized refund persists refund/order/payment/ledger side effects", async () => {
    const connection = await pool.getConnection();
    const cleanup = {
      courseServiceId: null,
      orderId: null,
      paymentId: null,
      refundId: null
    };

    try {
      const [userRows] = await connection.query(
        "SELECT id, username FROM users WHERE username IN ('support1', 'athlete1')"
      );

      const supportUser = userRows.find((row) => row.username === "support1");
      const athleteUser = userRows.find((row) => row.username === "athlete1");
      expect(Boolean(supportUser)).toBe(true);
      expect(Boolean(athleteUser)).toBe(true);

      const [courseInsert] = await connection.query(
        `
          INSERT INTO courses_services (kind, title, description, provider_user_id, status)
          VALUES ('service', ?, 'refund integration fixture', ?, 'active')
        `,
        [unique("Refund Fixture Service"), supportUser.id]
      );
      cleanup.courseServiceId = courseInsert.insertId;

      const [orderInsert] = await connection.query(
        `
          INSERT INTO orders (
            user_id,
            course_service_id,
            order_type,
            order_status,
            total_amount_cents,
            paid_amount_cents,
            refunded_amount_cents,
            currency,
            idempotency_key
          )
          VALUES (?, ?, 'service', 'paid', 1000, 1000, 0, 'USD', ?)
        `,
        [athleteUser.id, cleanup.courseServiceId, unique("refund-order")]
      );
      cleanup.orderId = orderInsert.insertId;

      const [paymentInsert] = await connection.query(
        `
          INSERT INTO payments (
            order_id,
            provider,
            provider_txn_id,
            payment_status,
            amount_cents,
            signature_valid,
            raw_payload,
            confirmed_at
          )
          VALUES (?, 'wechat_pay', ?, 'confirmed', 1000, 1, JSON_OBJECT('source', 'refund-integration-test'), CURRENT_TIMESTAMP)
        `,
        [cleanup.orderId, unique("txn")]
      );
      cleanup.paymentId = paymentInsert.insertId;

      const agent = request.agent(app.callback());
      const loginResponse = await agent
        .post("/api/v1/auth/login")
        .send({ username: "support1", password: "support12345" });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      const refundResponse = await agent
        .post(`/api/v1/payments/orders/${cleanup.orderId}/refunds`)
        .send({
          amountDollars: 2.5,
          reason: "integration refund validation",
          idempotencyKey: unique("refundkey")
        });

      expect(refundResponse.status).toBe(201);
      expect(refundResponse.body.success).toBe(true);

      const [refundRows] = await connection.query(
        "SELECT id, order_id, payment_id, refund_status, amount_cents, requested_by_user_id FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1",
        [cleanup.orderId]
      );
      expect(refundRows.length).toBe(1);
      cleanup.refundId = refundRows[0].id;
      expect(refundRows[0]).toMatchObject({
        order_id: cleanup.orderId,
        payment_id: cleanup.paymentId,
        refund_status: "processed",
        amount_cents: 250,
        requested_by_user_id: supportUser.id
      });

      const [orderRows] = await connection.query(
        "SELECT refunded_amount_cents, order_status FROM orders WHERE id = ? LIMIT 1",
        [cleanup.orderId]
      );
      expect(orderRows[0].refunded_amount_cents).toBe(250);
      expect(orderRows[0].order_status).toBe("refund_partial");

      const [paymentRows] = await connection.query(
        "SELECT payment_status FROM payments WHERE id = ? LIMIT 1",
        [cleanup.paymentId]
      );
      expect(paymentRows[0].payment_status).toBe("refunded_partial");

      const [ledgerRows] = await connection.query(
        "SELECT entry_type, amount_cents, order_id, payment_id, refund_id FROM ledger_entries WHERE refund_id = ? LIMIT 1",
        [cleanup.refundId]
      );
      expect(ledgerRows.length).toBe(1);
      expect(ledgerRows[0]).toMatchObject({
        entry_type: "refund_credit",
        amount_cents: -250,
        order_id: cleanup.orderId,
        payment_id: cleanup.paymentId,
        refund_id: cleanup.refundId
      });
    } finally {
      if (cleanup.refundId) {
        await connection.query("DELETE FROM ledger_entries WHERE refund_id = ?", [cleanup.refundId]);
        await connection.query("DELETE FROM refunds WHERE id = ?", [cleanup.refundId]);
      }
      if (cleanup.orderId) {
        await connection.query("DELETE FROM queue_jobs WHERE idempotency_key LIKE ?", [`refund:${cleanup.orderId}:%`]);
      }
      if (cleanup.paymentId) {
        await connection.query("DELETE FROM payments WHERE id = ?", [cleanup.paymentId]);
      }
      if (cleanup.orderId) {
        await connection.query("DELETE FROM orders WHERE id = ?", [cleanup.orderId]);
      }
      if (cleanup.courseServiceId) {
        await connection.query("DELETE FROM courses_services WHERE id = ?", [cleanup.courseServiceId]);
      }
      await connection.release();
    }
  }, 20000);
});
