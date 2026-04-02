const crypto = require("crypto");
const ApiError = require("../../errors/api-error");

function parseReconciliationContent(content) {
  const text = String(content || "").trim();
  if (!text) {
    throw new ApiError(400, "EMPTY_RECON_FILE", "Reconciliation content is empty");
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new ApiError(400, "INVALID_RECON_FILE", "Reconciliation file must include a header and at least one row");
  }

  const header = lines[0].split(",").map((col) => col.trim());
  const required = ["order_id", "provider_txn_id", "amount_cents", "status", "occurred_at", "signature"];
  for (const col of required) {
    if (!header.includes(col)) {
      throw new ApiError(400, "INVALID_RECON_HEADER", `Missing required column: ${col}`);
    }
  }

  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = lines.slice(1).map((line, lineIndex) => {
    const cols = line.split(",").map((item) => item.trim());
    const row = {
      orderId: Number(cols[index.order_id]),
      providerTxnId: cols[index.provider_txn_id],
      amountCents: Number(cols[index.amount_cents]),
      status: cols[index.status],
      occurredAt: cols[index.occurred_at],
      signature: cols[index.signature],
      lineNumber: lineIndex + 2
    };

    if (!Number.isInteger(row.orderId) || row.orderId <= 0) {
      throw new ApiError(400, "INVALID_RECON_ROW", `Invalid order_id at line ${row.lineNumber}`);
    }
    if (!row.providerTxnId) {
      throw new ApiError(400, "INVALID_RECON_ROW", `Missing provider_txn_id at line ${row.lineNumber}`);
    }
    if (!Number.isInteger(row.amountCents) || row.amountCents < 1) {
      throw new ApiError(400, "INVALID_RECON_ROW", `Invalid amount_cents at line ${row.lineNumber}`);
    }
    if (!["SUCCESS", "FAILED"].includes(row.status)) {
      throw new ApiError(400, "INVALID_RECON_ROW", `Invalid status at line ${row.lineNumber}`);
    }

    return row;
  });

  return rows;
}

function buildSignaturePayload(row) {
  return `${row.orderId}|${row.providerTxnId}|${row.amountCents}|${row.status}|${row.occurredAt}`;
}

function verifyRecordSignature(row, sharedSecret) {
  const payload = buildSignaturePayload(row);
  const digest = crypto.createHmac("sha256", sharedSecret).update(payload).digest("hex");
  return digest === row.signature;
}

function hashImportFile(content) {
  return crypto.createHash("sha256").update(String(content || "")).digest("hex");
}

module.exports = {
  parseReconciliationContent,
  verifyRecordSignature,
  hashImportFile,
  buildSignaturePayload
};
