const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const { ORDER_STATES } = require("./order.state-machine");
const { dollarsToCents } = require("../payments/money");
const { writeAuditEvent } = require("../../services/audit-log");

async function createOrder({ userId, courseServiceId, orderType, totalAmountDollars, idempotencyKey, requestId }) {
  const totalAmountCents = dollarsToCents(totalAmountDollars);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query("SELECT * FROM orders WHERE idempotency_key = ? LIMIT 1", [idempotencyKey]);
    if (existingRows.length) {
      await connection.commit();
      return existingRows[0];
    }

    const [courseRows] = await connection.query(
      "SELECT id, kind, status, provider_user_id FROM courses_services WHERE id = ? LIMIT 1",
      [courseServiceId]
    );
    if (!courseRows.length) {
      throw new ApiError(404, "COURSE_SERVICE_NOT_FOUND", "Course/service does not exist");
    }
    if (courseRows[0].kind !== orderType) {
      throw new ApiError(400, "ORDER_TYPE_MISMATCH", "Order type does not match target item");
    }
    if (courseRows[0].status !== "active") {
      throw new ApiError(400, "COURSE_SERVICE_INACTIVE", "Course/service is not active");
    }

    const [insert] = await connection.query(
      `
        INSERT INTO orders (
          user_id,
          course_service_id,
          order_type,
        order_status,
        total_amount_cents,
        estimated_cost_cents,
        sales_channel,
        location_code,
        assigned_instructor_user_id,
        payment_due_at,
        idempotency_key
        )
        VALUES (?, ?, ?, ?, ?, ?, 'direct', 'global', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE), ?)
      `,
      [
        userId,
        courseServiceId,
        orderType,
        ORDER_STATES.PENDING_PAYMENT,
        totalAmountCents,
        Math.round(totalAmountCents * 0.6),
        courseRows[0].provider_user_id || null,
        idempotencyKey
      ]
    );

    const orderId = insert.insertId;
    await connection.query(
      `
        INSERT INTO queue_jobs (job_type, payload, status, next_run_at, idempotency_key)
        VALUES ('cancel_unpaid_order', ?, 'pending', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE), ?)
        ON DUPLICATE KEY UPDATE idempotency_key = idempotency_key
      `,
      [JSON.stringify({ orderId }), `cancel_unpaid_order:${orderId}`]
    );

    await connection.commit();

    await writeAuditEvent({
      actorUserId: userId,
      eventType: "order.created",
      entityType: "order",
      entityId: String(orderId),
      requestId,
      payload: { orderType, totalAmountCents }
    });

    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getOrderForUser({ orderId, userId, roles }) {
  const [rows] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
  if (!rows.length) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  const order = rows[0];
  const isPrivileged = roles.includes("admin") || roles.includes("support");
  if (!isPrivileged && order.user_id !== userId) {
    throw new ApiError(403, "FORBIDDEN", "Cannot access this order");
  }

  return order;
}

async function listOrdersForUser({ userId, roles }) {
  const isPrivileged = roles.includes("admin") || roles.includes("support");
  const [rows] = await pool.query(
    `
      SELECT o.*, c.title AS course_service_title, c.kind AS course_service_kind
      FROM orders o
      JOIN courses_services c ON c.id = o.course_service_id
      ${isPrivileged ? "" : "WHERE o.user_id = ?"}
      ORDER BY o.id DESC
      LIMIT 500
    `,
    isPrivileged ? [] : [userId]
  );

  return rows;
}

async function cancelUnpaidOrder(orderId, requestId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [orderId]);
    if (!rows.length) {
      await connection.commit();
      return { cancelled: false, reason: "not_found" };
    }

    const order = rows[0];
    if (order.order_status !== ORDER_STATES.PENDING_PAYMENT) {
      await connection.commit();
      return { cancelled: false, reason: "state_not_pending_payment" };
    }

    await connection.query(
      `
        UPDATE orders
        SET order_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [orderId]
    );
    await connection.commit();

    await writeAuditEvent({
      actorUserId: null,
      eventType: "order.auto_cancelled",
      entityType: "order",
      entityId: String(orderId),
      requestId,
      payload: { previousState: order.order_status }
    });

    return { cancelled: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function markOrderCompleted(orderId, actorUserId = null, requestId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [orderId]);
    if (!rows.length) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (rows[0].order_status !== "paid") {
      throw new ApiError(400, "ORDER_NOT_PAID", "Only paid orders can be completed");
    }

    await connection.query(
      "UPDATE orders SET order_status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [orderId]
    );
    await connection.commit();

    await writeAuditEvent({
      actorUserId,
      eventType: "order.completed",
      entityType: "order",
      entityId: String(orderId),
      requestId
    });

    const [updated] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
    return updated[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createOrder,
  listOrdersForUser,
  getOrderForUser,
  cancelUnpaidOrder,
  markOrderCompleted
};
