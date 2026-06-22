// email.js — Minimal Lambda handler for ReceiptReadyEvent
// Consumes from email SQS queue (fan-out from SNS receipt-ready-topic).
// The email-worker Lambda execution role (from IAM module) grants:
//   sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes on email queue
//   logs:CreateLogGroup/CreateLogStream/PutLogEvents on CloudWatch
//   secretsmanager:GetSecretValue on project secrets (for DB connection)
//   kms:Decrypt on KMS key (for secret decryption)

exports.handler = async (event) => {
  for (const record of event.Records) {
    const messageId = record.messageId || 'unknown';
    let payload = {};

    try { payload = JSON.parse(record.body || '{}'); } catch { /* empty */ }

    const event_type = payload.event_type || 'ReceiptReadyEvent';
    const reservation_id = payload.data?.reservation_id;
    const user_id = payload.data?.user_id;
    const receipt_s3_key = payload.data?.receipt_s3_key;

    console.log(JSON.stringify({
      event_type,
      message_id: messageId,
      reservation_id,
      user_id,
      receipt_s3_key,
      status: 'email_sent_stub',
    }, null, 2));

    // Full implementation: look up user email from DB,
    // generate presigned URL for receipt_s3_key,
    // send email via SES/SendGrid
  }

  return { statusCode: 200, body: JSON.stringify({ processed: event.Records.length }) };
};
