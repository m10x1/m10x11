import {randomBytes, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual} from 'node:crypto';
import {config} from './config.js';
export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const digestCode = (orderId, code) => createHmac('sha256', config.codeHashKey).update(`${orderId}:${code}`).digest('hex');
export function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.encryptionKey, iv);
  const content = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString('base64');
}
export function decrypt(value) {
  const buf = Buffer.from(value, 'base64');
  if (buf.length < 29) throw new Error('Invalid encrypted value');
  const dec = createDecipheriv('aes-256-gcm', config.encryptionKey, buf.subarray(0, 12));
  dec.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([dec.update(buf.subarray(28)), dec.final()]).toString('utf8');
}
export function safeCompare(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
