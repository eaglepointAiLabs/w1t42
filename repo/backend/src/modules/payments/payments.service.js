const { pool } = require("../../db/pool");
const ApiError = require("../../errors/api-error");
const env = require("../../config/env");
const { writeAuditEvent } = require("../../services/audit-log");
const { enqueueJob } = require("../queue/queue.service");
const { parseReconciliationContent, verifyRecordSignature, hashImportFile } = require("./reconciliation-parser");

async function createPaymentImport({ actorUserId, fileName, content, requestId }) {
  const fileHash = hashImportFile(content);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id, import_status FROM payment_reconciliation_imports WHERE file_hash = ? LIMIT 1",
      [fileHash]
    );

    if (existing.length) {
      await connection.commit();
      return { importId: existing[0].id, duplicate: true, status: existing[0].import_status };
    }

    const records = parseReconciliationContent(content);
    const validSignatures = records.filter((record) => verifyRecordSignature(record, env.WECHAT_RECON_SECRET)).length;
    const signatureVerified = validSignatures === records.length;

    const [insert] = await connection.query(
      `
        INSERT INTO payment_reconciliation_imports (
          file_name, file_hash, signature_verified, imported_by_user_id, import_status
        )
        VALUES (?, ?, ?, ?, 'pending')
      `,
      [fileName, fileHash, signatureVerified ? 1 : 0, actorUserId]
    );

    const importId = insert.insertId;
    for (const record of records) {
      const idempotencyKey = `payment_apply:${importId}:${record.providerTxnId}`;
      await connection.query(
        `
          INSERT INTO queue_jobs (job_type, payload, idempotency_key, status)
          VALUES ('apply_payment_record', ?, ?, 'pending')
          ON DUPLICATE KEY UPDATE idempotency_key = idempotency_key
        `,
        [JSON.stringify({ importId, record }), idempotencyKey]
      );
    }

    await connection.commit();

    await writeAuditEvent({
      actorUserId,
      eventType: "payments.import.created",
      entityType: "payment_reconciliation_import",
      entityId: String(importId),
      requestId,
      payload: { fileName, records: records.length, signatureVerified }
    });

    return { importId, duplicate: false, signatureVerified, records: records.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function applyPaymentRecordJob({ importId, record, requestId = null }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [importRows] = await connection.query(
      "SELECT * FROM payment_reconciliation_imports WHERE id = ? LIMIT 1 FOR UPDATE",
      [importId]
    );
    if (!importRows.length) {
      throw new ApiError(404, "IMPORT_NOT_FOUND", "Payment import not found");
    }

    const signatureValid = verifyRecordSignature(record, env.WECHAT_RECON_SECRET);
    const [paymentExisting] = await connection.query(
      "SELECT id FROM payments WHERE provider = 'wechat_pay' AND provider_txn_id = ? LIMIT 1",
      [record.providerTxnId]
    );

    if (paymentExisting.length) {
      await connection.commit();
      return { skipped: true, reason: "duplicate_provider_txn" };
    }

    const [orderRows] = await connection.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [record.orderId]);
    if (!orderRows.length) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order for payment record not found");
    }

    const order = orderRows[0];
    const paymentStatus = record.status === "SUCCESS" && signatureValid ? "confirmed" : "failed";

    const [paymentInsert] = await connection.query(
      `
        INSERT INTO payments (
          order_id,
          reconciliation_import_id,
          provider,
          provider_txn_id,
          payment_status,
          amount_cents,
          signature_valid,
          raw_payload,
          confirmed_at
        )
        VALUES (?, ?, 'wechat_pay', ?, ?, ?, ?, ?, CASE WHEN ? = 'confirmed' THEN CURRENT_TIMESTAMP ELSE NULL END)
      `,
      [order.id, importId, record.providerTxnId, paymentStatus, record.amountCents, signatureValid ? 1 : 0, JSON.stringify(record), paymentStatus]
    );

    if (paymentStatus === "confirmed" && order.order_status === "pending_payment") {
      await connection.query(
        `
          UPDATE orders
          SET order_status = 'paid', paid_amount_cents = paid_amount_cents + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [record.amountCents, order.id]
      );
      await connection.query(
        `
          INSERT INTO ledger_entries (order_id, payment_id, entry_type, amount_cents, metadata)
          VALUES (?, ?, 'payment_debit', ?, ?)
        `,
        [order.id, paymentInsert.insertId, record.amountCents, JSON.stringify({ importId, providerTxnId: record.providerTxnId })]
      );
    } else if (paymentStatus === "confirmed" && order.order_status !== "pending_payment") {
      await connection.query(
        `
          INSERT INTO ledger_entries (order_id, payment_id, entry_type, amount_cents, metadata)
          VALUES (?, ?, 'adjustment', ?, ?)
        `,
        [order.id, paymentInsert.insertId, record.amountCents, JSON.stringify({ reason: "late_or_duplicate_state_payment", importId })]
      );
      await connection.query(
        `
          INSERT INTO queue_jobs (job_type, payload, idempotency_key, status)
          VALUES ('payment_compensation_review', ?, ?, 'pending')
          ON DUPLICATE KEY UPDATE idempotency_key = idempotency_key
        `,
        [JSON.stringify({ orderId: order.id, paymentId: paymentInsert.insertId, reason: "late_payment" }), `payment_compensation_review:${paymentInsert.insertId}`]
      );
    }

    await connection.query(
      `
        UPDATE payment_reconciliation_imports
        SET import_status = 'processed'
        WHERE id = ?
      `,
      [importId]
    );

    await connection.commit();

    await writeAuditEvent({
      actorUserId: null,
      eventType: "payments.record.applied",
      entityType: "order",
      entityId: String(order.id),
      requestId,
      payload: { importId, providerTxnId: record.providerTxnId, paymentStatus, signatureValid }
    });

    return { applied: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getImportById(importId) {
  const [rows] = await pool.query("SELECT * FROM payment_reconciliation_imports WHERE id = ? LIMIT 1", [importId]);
  if (!rows.length) {
    throw new ApiError(404, "IMPORT_NOT_FOUND", "Import not found");
  }
  return rows[0];
}

module.exports = {
  createPaymentImport,
  applyPaymentRecordJob,
  getImportById
};
