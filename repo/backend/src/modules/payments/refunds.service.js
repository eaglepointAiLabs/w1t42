const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { ensureRefundWithinBounds, dollarsToCents } = require("./money");
const { writeAuditEvent } = require("../../services/audit-log");

function ensureRefundAuthorized(actorRoles) {
  const roles = Array.isArray(actorRoles) ? actorRoles : [];
  const allowed = roles.some((role) => role === "admin" || role === "support");
  if (!allowed) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient role permissions for refund processing");
  }
}

async function requestRefund({ orderId, actorUserId, actorRoles = [], amountDollars, reason, idempotencyKey, requestId }) {
  ensureRefundAuthorized(actorRoles);

  const amountCents = dollarsToCents(amountDollars);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      "SELECT id FROM queue_jobs WHERE idempotency_key = ? LIMIT 1",
      [idempotencyKey]
    );
    if (existingRows.length) {
      const [refundRows] = await connection.query(
        "SELECT * FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1",
        [orderId]
      );
      await connection.commit();
      return refundRows[0] || null;
    }

    const [orderRows] = await connection.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [orderId]);
    if (!orderRows.length) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    const order = orderRows[0];
    ensureRefundWithinBounds({
      requestedRefundCents: amountCents,
      paidCents: order.paid_amount_cents,
      alreadyRefundedCents: order.refunded_amount_cents
    });

    const [paymentRows] = await connection.query(
      "SELECT * FROM payments WHERE order_id = ? AND payment_status IN ('confirmed','refunded_partial') ORDER BY id DESC LIMIT 1",
      [orderId]
    );
    if (!paymentRows.length) {
      throw new ApiError(400, "REFUND_NOT_ALLOWED", "No confirmed payment found for order");
    }

    const [refundInsert] = await connection.query(
      `
        INSERT INTO refunds (order_id, payment_id, refund_status, amount_cents, reason, requested_by_user_id)
        VALUES (?, ?, 'processed', ?, ?, ?)
      `,
      [orderId, paymentRows[0].id, amountCents, reason, actorUserId]
    );

    const nextRefundedAmount = order.refunded_amount_cents + amountCents;
    const nextOrderStatus = nextRefundedAmount >= order.paid_amount_cents ? "refund_full" : "refund_partial";
    const nextPaymentStatus = nextRefundedAmount >= order.paid_amount_cents ? "refunded_full" : "refunded_partial";

    await connection.query(
      `
        UPDATE orders
        SET refunded_amount_cents = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [nextRefundedAmount, nextOrderStatus, orderId]
    );

    await connection.query("UPDATE payments SET payment_status = ? WHERE id = ?", [nextPaymentStatus, paymentRows[0].id]);

    await connection.query(
      `
        INSERT INTO ledger_entries (order_id, payment_id, refund_id, entry_type, amount_cents, metadata)
        VALUES (?, ?, ?, 'refund_credit', ?, ?)
      `,
      [orderId, paymentRows[0].id, refundInsert.insertId, -amountCents, JSON.stringify({ reason })]
    );

    await connection.query(
      `
        INSERT INTO queue_jobs (job_type, payload, idempotency_key, status)
        VALUES ('refund_settlement_noop', ?, ?, 'completed')
      `,
      [JSON.stringify({ refundId: refundInsert.insertId }), idempotencyKey]
    );

    await connection.commit();

    await writeAuditEvent({
      actorUserId,
      eventType: "refund.processed",
      entityType: "order",
      entityId: String(orderId),
      requestId,
      payload: { refundId: refundInsert.insertId, amountCents }
    });

    const [rows] = await pool.query("SELECT * FROM refunds WHERE id = ? LIMIT 1", [refundInsert.insertId]);
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  requestRefund
};
