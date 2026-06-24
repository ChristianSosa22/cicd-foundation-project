// email.js — Lambda handler for ReceiptReadyEvent
// Consumes from email SQS queue (fan-out from SNS receipt-ready-topic).
// OUTSIDE VPC: needs internet for SES API (no VPCE for SES exists).
//
// Idempotency: the email-worker runs outside VPC and cannot reach RDS, so it
// cannot use a processed_messages table. For the class demonstration, duplicate
// emails on SQS retry are accepted. In production, idempotency would be handled
// via DynamoDB TTL or an in-memory dedup cache.
//
// The user_email and user_full_name are included in the ReceiptReadyEvent payload
// by the receipt-worker (TRADE-OFF documented in receipt.js and main.tf).

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ses = new SESClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    let payload;
    try {
      const body = JSON.parse(record.body || '{}');
      // SNS wraps the message in a "Message" field when delivered via SQS subscription
      payload = typeof body.Message === 'string' ? JSON.parse(body.Message) : body;
    } catch {
      console.error(JSON.stringify({ error: 'invalid JSON', messageId: record.messageId }));
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    const { reservation_id, receipt_s3_key, user_email, user_full_name } = payload.data || {};

    if (!reservation_id || !receipt_s3_key || !user_email) {
      console.error(JSON.stringify({
        error: 'missing required fields (reservation_id, receipt_s3_key, user_email)',
        messageId: record.messageId,
      }));
      results.push({ itemIdentifier: record.messageId });
      continue;
    }

    try {
      // Generate presigned URL (5 min expiry)
      const presignedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: receipt_s3_key }),
        { expiresIn: 300 },
      );

      // Send email via SES
      await ses.send(new SendEmailCommand({
        Source: process.env.SES_FROM_ADDRESS,
        Destination: { ToAddresses: [user_email] },
        Message: {
          Subject: { Data: `Comprobante de Reserva #${reservation_id}` },
          Body: {
            Html: {
              Data: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #2563eb; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">Comprobante de Reserva</h2>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <p>Hola <strong>${user_full_name || 'Colaborador'}</strong>,</p>
    <p>Tu reserva <strong>#${reservation_id}</strong> ha sido confirmada. Adjuntamos tu comprobante con código QR.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${presignedUrl}"
         style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Descargar Comprobante
      </a>
    </p>
    <p style="color: #6b7280; font-size: 12px;">El enmlink expira en 5 minutos. Si no funciona, contacta al administrador.</p>
  </div>
  <div style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">
    Sistema de Reserva de Parqueos — Grupo 5 OyD
  </div>
</body>
</html>`,
            },
            Text: {
              Data: `Hola ${user_full_name || 'Colaborador'}, tu reserva #${reservation_id} ha sido confirmada.\nDescarga tu comprobante: ${presignedUrl}\n(Enlace expira en 5 minutos)`,
            },
          },
        },
      }));

      console.log(JSON.stringify({
        event_type: 'ReceiptReadyEvent',
        reservation_id,
        user_email,
        message_id: record.messageId,
        status: 'email_sent',
      }));
    } catch (err) {
      console.error(JSON.stringify({
        error: err.message,
        reservation_id,
        message_id: record.messageId,
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
