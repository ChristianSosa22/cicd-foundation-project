// receipt.js — Lambda handler for GenerateReceiptCommand
// Consumes from receipt SQS queue. Generates receipt PDF with QR code in S3.
// VPC-attached: queries RDS for user/vehicle data, reads encryption keys from SSM.
//
// TRADE-OFF (E4 policy relaxation): This handler reads users.email and users.full_name
// from RDS and includes them in the ReceiptReadyEvent published to SNS. This allows
// the email-worker (outside VPC, needs internet for SES) to send the email without
// needing RDS access. Data travels encrypted with the project CMK via SNS/SQS only.

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { Pool } = require('pg');
const crypto = require('crypto');
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
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');

let pool = null;

async function getDbPassword() {
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
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

const s3 = new S3Client({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });
const ssm = new SSMClient({ region: process.env.AWS_REGION });

// AES-256-GCM decryption (mirrors backend/src/lib/crypto.ts)
function decrypt(encryptedBase64, keyBase64) {
  const key = Buffer.from(keyBase64, 'base64');
  const buf = Buffer.from(encryptedBase64, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

async function fetchSsmParam(name) {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return res.Parameter.Value;
}

async function generateReceiptPdf(data) {
  const qrPayload = JSON.stringify({ r: data.reservationId, s: data.spaceLabel, d: data.reservationDate });
  const qrPng = await QRCode.toBuffer(qrPayload, { width: 240, margin: 1 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText('Comprobante de Reserva', {
    x: 40, y: 540, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1),
  });

  const lines = [
    `Reserva #: ${data.reservationId}`,
    `Colaborador: ${data.driverName}`,
    `Espacio: ${data.spaceLabel}`,
    `Vehiculo: ${data.vehicleType} (${data.plate})`,
    `Fecha: ${data.reservationDate}`,
  ];
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 500 - i * 22, size: 12, font }));

  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, { x: 90, y: 140, width: 240, height: 240 });

  return Buffer.from(await pdf.save());
}

exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch {
      console.error(JSON.stringify({ error: 'invalid JSON', messageId: record.messageId }));
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    const { reservation_id } = payload.data || {};
    if (!reservation_id) {
      console.error(JSON.stringify({ error: 'missing reservation_id', messageId: record.messageId }));
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    try {
      const db = await getDbPool();

      // Idempotency: skip if receipt already generated
      const existing = await db.query(
        'SELECT receipt_s3_key FROM reservations WHERE id = $1',
        [reservation_id],
      );
      if (existing.rows[0]?.receipt_s3_key) {
        console.log(JSON.stringify({ reservation_id, status: 'already_processed' }));
        results.push({ itemIdentifier: record.messageId });
        continue;
      }

      // Fetch all needed data sequentially (single Client, avoid pg deprecation)
      const resResult = await db.query(
        'SELECT id, user_id, space_id, vehicle_id, reservation_date FROM reservations WHERE id = $1',
        [reservation_id],
      );
      const userResult = await db.query(
        'SELECT id, full_name, email FROM users WHERE id = $1',
        [payload.data.user_id],
      );
      const spaceResult = await db.query(
        'SELECT id, label, vehicle_type FROM parking_spaces WHERE id = $1',
        [payload.data.space_id],
      );
      const vehicleResult = await db.query(
        'SELECT id, plate_enc, vehicle_type FROM vehicles WHERE id = $1',
        [payload.data.vehicle_id],
      );

      const reservation = resResult.rows[0];
      const user = userResult.rows[0];
      const space = spaceResult.rows[0];
      const vehicle = vehicleResult.rows[0];

      if (!reservation || !user || !space || !vehicle) {
        console.error(JSON.stringify({ error: 'missing data', reservation_id }));
        results.push({ itemIdentifier: record.messageId });
        continue;
      }

      // Fetch encryption key from SSM
      const encryptionKey = await fetchSsmParam(process.env.ENCRYPTION_KEY_PARAM);

      // Decrypt plate number
      const plate = decrypt(vehicle.plate_enc.toString('base64'), encryptionKey);

      // Generate PDF with QR code
      const pdfBytes = await generateReceiptPdf({
        reservationId: reservation.id,
        spaceLabel: space.label,
        vehicleType: space.vehicle_type,
        plate,
        driverName: user.full_name,
        reservationDate: reservation.reservation_date,
      });

      // Upload to S3 (deterministic key)
      const s3Key = `receipts/${reservation.id}.pdf`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: pdfBytes,
        ContentType: 'application/pdf',
      }));

      // Update reservation with receipt key
      await db.query(
        'UPDATE reservations SET receipt_s3_key = $1, updated_at = NOW() WHERE id = $2',
        [s3Key, reservation.id],
      );

      // Publish ReceiptReadyEvent to SNS (includes user_email for email-worker)
      await sns.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: JSON.stringify({
          event_type: 'ReceiptReadyEvent',
          idempotency_key: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          data: {
            reservation_id: reservation.id,
            user_id: user.id,
            receipt_s3_key: s3Key,
            user_email: user.email,
            user_full_name: user.full_name,
          },
        }),
      }));

      console.log(JSON.stringify({
        reservation_id,
        s3_key: s3Key,
        event_type: 'GenerateReceiptCommand',
        status: 'completed',
      }));
    } catch (err) {
      console.error(JSON.stringify({ error: err.message, errors: err.errors && err.errors.map(e => e.message), reservation_id, stack: err.stack?.substring(0, 500) }));
      // Return as batch item failure so SQS retries
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    results.push({ itemIdentifier: record.messageId });
  }

  return { batchItemFailures: results };
};
