import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

// Receipts (QR/PDF) live in S3; the DB stores only reservations.receipt_s3_key
// (data-model.md §"Qué va en base de datos vs. almacenamiento de objetos").
export const s3 = new S3Client({ region: env.AWS_REGION });

function bucket(): string {
  if (!env.S3_BUCKET) throw new Error('S3_BUCKET not configured');
  return env.S3_BUCKET;
}

export function presignGetReceipt(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

export function presignPutReceipt(
  key: string,
  contentType = 'application/pdf',
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}
