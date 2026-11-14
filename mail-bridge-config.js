// Public frontend configuration. No passwords or tokens belong in this file.
// Leave empty until the real Render HTTPS URL is confirmed.
const HOSTED_API_ORIGIN = '';
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_BASE = isLocal
  ? 'http://localhost:4000'
  : HOSTED_API_ORIGIN.replace(/\/$/, '');

export function requireApiBase() {
  if (!API_BASE || (!isLocal && !API_BASE.startsWith('https://'))) {
    throw new Error('لم يتم ربط الخادم المنشور بموقع Mr10x بعد. تواصل مع إدارة المنصة.');
  }
  return API_BASE;
}
