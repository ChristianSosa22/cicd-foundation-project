import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import { env } from '../config/env';

// SQS client for the async receipt pipeline (Delivery 4).
// Credentials are resolved at runtime from the ECS task role — never hardcoded,
// mirroring how lib/s3.ts instantiates its client.
export const sqs = new SQSClient({ region: env.AWS_REGION });

function queueUrl(): string {
  if (!env.RECEIPT_QUEUE_URL) throw new Error('RECEIPT_QUEUE_URL not configured');
  return env.RECEIPT_QUEUE_URL;
}

// ── Producer side (used by POST /reservas/enqueue) ────────────────────────────
// Enqueues a JSON-serializable payload on the receipt queue.
// Returns the SQS-assigned MessageId so the producer endpoint can echo it back.
export async function enqueueReceiptMessage(payload: unknown): Promise<string> {
  const out = await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl(),
      MessageBody: JSON.stringify(payload),
    }),
  );
  if (!out.MessageId) throw new Error('SQS did not return a MessageId');
  return out.MessageId;
}

// ── Consumer side (used by the receipt worker) ────────────────────────────────
export type { Message };

// Long-polls the queue for up to `batchSize` messages, waiting up to 20s
// (max long-poll window) to reduce empty receives and cost.
export async function receiveReceiptMessages(batchSize: number): Promise<Message[]> {
  const out = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl(),
      MaxNumberOfMessages: batchSize,
      WaitTimeSeconds: 20,
    }),
  );
  return out.Messages ?? [];
}

// Deletes a successfully-processed message so it is not re-delivered.
// If a message is NOT deleted, SQS makes it visible again after the
// visibility timeout and, after max_receive_count attempts, routes it to the DLQ.
export async function deleteReceiptMessage(receiptHandle: string): Promise<void> {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl(),
      ReceiptHandle: receiptHandle,
    }),
  );
}
