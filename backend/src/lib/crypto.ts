import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env';

// Column encryption for plate_enc / phone_enc (data-model.md §8).
// Layout of the stored buffer: iv(12) || authTag(16) || ciphertext.
function key(): Buffer {
  if (!env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured');
  const k = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY must decode to 32 bytes (AES-256)');
  return k;
}

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decrypt(payload: Buffer): string {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ct = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// HMAC over the normalized plate: unique lookup without decryption.
export function plateHash(plate: string): string {
  if (!env.HMAC_KEY) throw new Error('HMAC_KEY not configured');
  return createHmac('sha256', env.HMAC_KEY).update(plate.trim().toUpperCase()).digest('hex');
}
