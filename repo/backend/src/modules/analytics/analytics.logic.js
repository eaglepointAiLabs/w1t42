function pct(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function enrollmentFunnelMetrics(rows) {
  const counts = {
    created: 0,
    pending_payment: 0,
    paid: 0,
    completed: 0,
    cancelled: 0,
    refund_partial: 0,
    refund_full: 0
  };

  for (const row of rows) {
    if (counts[row.order_status] !== undefined) {
      counts[row.order_status] += 1;
    }
  }

  const created = counts.created + counts.pending_payment + counts.paid + counts.completed + counts.cancelled + counts.refund_partial + counts.refund_full;
  const paidOrBeyond = counts.paid + counts.completed + counts.refund_partial + counts.refund_full;

  return {
    counts,
    rates: {
      paymentConversionRate: pct(paidOrBeyond, created),
      completionRate: pct(counts.completed + counts.refund_partial + counts.refund_full, created),
      cancellationRate: pct(counts.cancelled, created)
    }
  };
}

function renewalRateMetrics(entitlements) {
  const byUser = new Map();
  for (const row of entitlements) {
    const key = row.user_id;
    byUser.set(key, (byUser.get(key) || 0) + 1);
  }

  const totalUsers = byUser.size;
  let renewedUsers = 0;
  for (const count of byUser.values()) {
    if (count > 1) {
      renewedUsers += 1;
    }
  }

  return {
    totalUsers,
    renewedUsers,
    renewalRate: pct(renewedUsers, totalUsers)
  };
}

function refundRateMetrics(orderRows) {
  let refundableBase = 0;
  let refunded = 0;

  for (const row of orderRows) {
    const isPaidOrCompleted = ["paid", "completed", "refund_partial", "refund_full"].includes(row.order_status);
    if (isPaidOrCompleted) {
      refundableBase += 1;
      if (Number(row.refunded_amount_cents || 0) > 0) {
        refunded += 1;
      }
    }
  }

  return {
    refundableBase,
    refunded,
    refundRate: pct(refunded, refundableBase)
  };
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header] == null ? "" : String(row[header]);
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

module.exports = {
  pct,
  enrollmentFunnelMetrics,
  renewalRateMetrics,
  refundRateMetrics,
  toCsv
};
