// release.js — Lambda handler for ReleaseExpiredReservationCommand
// Consumes from release SQS queue (EventBridge Scheduler → SQS).
// VPC-attached: needs access to RDS for UPDATE reservations.
//
// Idempotent by design: the UPDATE WHERE status='reservada' clause means
// reprocessing the same message has no additional effect.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Pool } = require('pg');
const dns = require('dns');
const _origLookup = dns.lookup;
let _rdsIpCached = null;
dns.lookup = function (hostname, options, callback) {
  if (hostname === process.env.DB_HOST || (typeof hostname === 'string' && hostname.endsWith('.amazonaws.com'))) {
    if (hostname === process.env.DB_HOST && _rdsIpCached) {
      if (typeof options === 'function') { options(null, _rdsIpCached, 4); return; }
      if (callback) callback(null, _rdsIpCached, 4);
      else return Promise.resolve({ address: _rdsIpCached, family: 4 });
      return;
    }
    if (typeof options === 'function') { callback = options; options = {}; }
    options = options || {};
    options.family = 4;
    return _origLookup.call(dns, hostname, options, (err, addr, family) => {
      if (!err && hostname === process.env.DB_HOST) _rdsIpCached = addr;
      if (typeof callback === 'function') callback(err, addr, family);
    });
  }
  return _origLookup.apply(dns, arguments);
};

let pool = null;

async function getDbPassword() {
  const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_PASSWORD_SECRET_ARN }));
  return res.SecretString;
}

async function getDbPool() {
  if (pool) return pool;
  const password = await getDbPassword();
  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
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
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    results.push({ itemIdentifier: record.messageId });
  }

  return { batchItemFailures: results };
};
