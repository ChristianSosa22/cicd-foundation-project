// release.js — Lambda handler for ReleaseExpiredReservationCommand
// Consumes from release SQS queue (EventBridge Scheduler → SQS).
// VPC-attached: needs access to RDS for UPDATE reservations.
//
// Idempotent by design: the UPDATE WHERE status='reservada' clause means
// reprocessing the same message has no additional effect.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Pool } = require('pg');

const pool = new Pool({
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

let dbPassword = null;

async function getDbPassword() {
  if (dbPassword) return dbPassword;
  const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_PASSWORD_SECRET_ARN }));
  dbPassword = res.SecretString;
  return dbPassword;
}

async function getDbPool() {
  if (pool.options.password) return pool;
  const password = await getDbPassword();
  pool.options.password = password;
  pool.options.connectionString = `postgres://${process.env.DB_USER}:${encodeURIComponent(password)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  return pool;
}

exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    let payload = {};
    try {
      payload = JSON.parse(record.body || '{}');
    } catch { /* empty */ }

    const scan_before = payload.data?.scan_before || new Date().toISOString();

    try {
      const db = await getDbPool();

      // Idempotent UPDATE: only affects rows matching the condition.
      // Reprocessing the same message finds no matching rows — no effect.
      const updateResult = await db.query(
        `UPDATE reservations
         SET status = 'expirada', updated_at = NOW()
         WHERE status = 'reservada' AND confirm_deadline < $1`,
        [scan_before],
      );

      console.log(JSON.stringify({
        event_type: 'ReleaseExpiredReservationCommand',
        message_id: record.messageId,
        scan_before,
        released_count: updateResult.rowCount,
        status: 'completed',
      }));
    } catch (err) {
      console.error(JSON.stringify({
        error: err.message,
        message_id: record.messageId,
        scan_before,
        stack: err.stack,
      }));
      // Return as batch item failure so SQS retries
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    results.push({ itemIdentifier: record.messageId });
  }

  return { batchItemFailures: results };
};
