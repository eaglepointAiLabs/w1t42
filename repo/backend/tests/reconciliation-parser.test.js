const crypto = require("crypto");
const {
  parseReconciliationContent,
  verifyRecordSignature,
  buildSignaturePayload
} = require("../src/modules/payments/reconciliation-parser");

describe("Reconciliation parser and signature verifier", () => {
  test("parses csv and validates signature", () => {
    const secret = "trailforge-recon-secret";
    const row = {
      orderId: 1,
      providerTxnId: "WX-123",
      amountCents: 2500,
      status: "SUCCESS",
      occurredAt: "2026-03-29T10:00:00Z"
    };
    const signature = crypto.createHmac("sha256", secret).update(buildSignaturePayload(row)).digest("hex");

    const csv = [
      "order_id,provider_txn_id,amount_cents,status,occurred_at,signature",
      `${row.orderId},${row.providerTxnId},${row.amountCents},${row.status},${row.occurredAt},${signature}`
    ].join("\n");

    const parsed = parseReconciliationContent(csv);
    expect(parsed).toHaveLength(1);
    expect(verifyRecordSignature(parsed[0], secret)).toBe(true);
  });
});
