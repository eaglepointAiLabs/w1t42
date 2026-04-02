const ApiError = require("../../errors/api-error");

function dollarsToCents(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, "INVALID_MONEY", "Money amount must be a non-negative number");
  }

  const cents = Math.round(num * 100);
  if (Math.abs(num * 100 - cents) > 1e-8) {
    throw new ApiError(400, "INVALID_MONEY_PRECISION", "Money amount supports up to 2 decimal places");
  }

  return cents;
}

function ensureRefundWithinBounds({ requestedRefundCents, paidCents, alreadyRefundedCents }) {
  if (!Number.isInteger(requestedRefundCents) || requestedRefundCents < 1) {
    throw new ApiError(400, "INVALID_REFUND_AMOUNT", "Refund must be at least $0.01");
  }

  const remaining = paidCents - alreadyRefundedCents;
  if (requestedRefundCents > remaining) {
    throw new ApiError(400, "REFUND_EXCEEDS_PAID", "Refund exceeds remaining paid amount");
  }
}

module.exports = {
  dollarsToCents,
  ensureRefundWithinBounds
};
