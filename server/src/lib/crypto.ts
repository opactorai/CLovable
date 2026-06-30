/**
 * Application-layer encryption for user secrets (BYOK Anthropic keys).
 * AES-256-GCM with a server-side ENCRYPTION_KEY (32 bytes / 64 hex chars).
 * Stored format: base64(iv):base64(authTag):base64(ciphertext).
 */
import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

/** Masked preview for UI confirmation, e.g. "sk-ant-…powQ". Never returns the full key. */
export function maskKey(raw: string): string {
  if (raw.length <= 10) return '••••';
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}
