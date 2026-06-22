// receipt.js — Minimal Lambda handler for GenerateReceiptCommand
// Consumes from receipt SQS queue, writes a receipt object to S3.
// The receipt-worker Lambda execution role (from IAM module) grants:
//   sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes on receipt queue
//   s3:PutObject on receipts bucket
//   logs:CreateLogGroup/CreateLogStream/PutLogEvents on CloudWatch

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const bucket = process.env.S3_BUCKET;

  for (const record of event.Records) {
    const messageId = record.messageId || 'unknown';
    const body = record.body || '{}';

    const key = `receipts/async/${messageId}.json`;

    const object = {
      message_id: messageId,
      received_at: new Date().toISOString(),
      body: safeParse(body),
    };

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(object, null, 2),
      ContentType: 'application/json',
    }));

    console.log(JSON.stringify({ messageId, key, event_type: 'GenerateReceiptCommand' }, null, 2));
  }

  return { statusCode: 200, body: JSON.stringify({ processed: event.Records.length }) };
};

function safeParse(body) {
  try { return JSON.parse(body); } catch { return body; }
}
