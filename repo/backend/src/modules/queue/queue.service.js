const { pool } = require("../../db/pool");
const logger = require("../../logger");

async function enqueueJob({ jobType, payload, idempotencyKey = null, nextRunAt = null, maxAttempts = 5 }) {
  await pool.query(
    `
      INSERT INTO queue_jobs (job_type, payload, idempotency_key, next_run_at, max_attempts)
      VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)
      ON DUPLICATE KEY UPDATE
        payload = VALUES(payload),
        next_run_at = LEAST(next_run_at, VALUES(next_run_at))
    `,
    [jobType, payload ? JSON.stringify(payload) : null, idempotencyKey, nextRunAt, maxAttempts]
  );
}

async function claimRunnableJobs(limit = 10) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `
        SELECT id, job_type, payload, attempts, max_attempts
        FROM queue_jobs
        WHERE status IN ('pending', 'failed')
          AND next_run_at <= CURRENT_TIMESTAMP
        ORDER BY next_run_at ASC, id ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED
      `,
      [limit]
    );

    for (const row of rows) {
      await connection.query(
        `
          UPDATE queue_jobs
          SET status = 'running', locked_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [row.id]
      );
    }

    await connection.commit();
    return rows.map((row) => ({
      id: row.id,
      jobType: row.job_type,
      payload:
        row.payload == null ? null : typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts
    }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function requeueStaleRunningJobs() {
  await pool.query(
    `
      UPDATE queue_jobs
      SET status = 'failed', locked_at = NULL,
          next_run_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 SECOND),
          last_error = COALESCE(last_error, 'Recovered stale running job')
      WHERE status = 'running'
        AND locked_at IS NOT NULL
        AND locked_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)
    `
  );
}

async function markJobCompleted(jobId) {
  await pool.query(
    `
      UPDATE queue_jobs
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [jobId]
  );
}

async function markJobFailed(job, errorMessage) {
  const nextAttempts = job.attempts + 1;
  if (nextAttempts >= job.maxAttempts) {
    await pool.query(
      `
        UPDATE queue_jobs
        SET status = 'dead_letter', attempts = ?, last_error = ?, locked_at = NULL
        WHERE id = ?
      `,
      [nextAttempts, errorMessage, job.id]
    );
    logger.error({ jobId: job.id, errorMessage }, "Job moved to dead letter");
    return;
  }

  const backoffSeconds = Math.min(300, Math.pow(2, nextAttempts));
  await pool.query(
    `
      UPDATE queue_jobs
      SET status = 'failed', attempts = ?, last_error = ?,
          next_run_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
          locked_at = NULL
      WHERE id = ?
    `,
    [nextAttempts, errorMessage, backoffSeconds, job.id]
  );
}

module.exports = {
  enqueueJob,
  claimRunnableJobs,
  markJobCompleted,
  markJobFailed,
  requeueStaleRunningJobs
};
