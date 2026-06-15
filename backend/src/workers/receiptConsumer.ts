import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { s3 } from '../lib/s3';
import {
  receiveReceiptMessages,
  deleteReceiptMessage,
  type Message,
} from '../lib/sqs';

// Delivery 4 — async consumer (ECS Fargate polling worker, VPC track).
// Triggered by polling the receipt SQS queue (NOT by HTTP). For each message it
// writes one object to the S3 receipts bucket, logs the processed MessageId, and
// deletes the message. Failures leave the message on the queue so SQS retries it
// and, after max_receive_count attempts, routes it to the DLQ.

// Batch size is injected by Terraform (var.polling_batch_size). Default 10 (SQS max).
const POLLING_BATCH_SIZE = Number(process.env.POLLING_BATCH_SIZE ?? '10');

async function processMessage(msg: Message): Promise<void> {
  if (!env.S3_BUCKET) throw new Error('S3_BUCKET not configured');
  const messageId = msg.MessageId ?? `unknown-${Date.now()}`;

  // Object key is derived from the SQS MessageId (spec requirement).
  const key = `receipts/async/${messageId}.json`;

  const object = {
    message_id: messageId,
    received_at: new Date().toISOString(),
    body: safeParse(msg.Body),
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: JSON.stringify(object, null, 2),
      ContentType: 'application/json',
    }),
  );

  logger.info({ messageId, key }, '[receiptConsumer] processed message and wrote object to S3');
}

function safeParse(body: string | undefined): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

let running = false;

export async function startReceiptConsumerWorker(): Promise<void> {
  if (running) return;
  running = true;
  logger.info({ batchSize: POLLING_BATCH_SIZE }, '[receiptConsumer] worker started, polling receipt queue');

  while (running) {
    try {
      const messages = await receiveReceiptMessages(POLLING_BATCH_SIZE);
      for (const msg of messages) {
        try {
          await processMessage(msg);
          if (msg.ReceiptHandle) await deleteReceiptMessage(msg.ReceiptHandle);
        } catch (err) {
          // Do NOT delete — let SQS redeliver and eventually dead-letter.
          logger.error({ err, messageId: msg.MessageId }, '[receiptConsumer] message processing failed; left on queue for retry');
        }
      }
    } catch (err) {
      logger.error({ err }, '[receiptConsumer] receive loop error');
      // Brief backoff so a persistent error does not hot-loop.
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}

export function stopReceiptConsumerWorker(): void {
  running = false;
}
