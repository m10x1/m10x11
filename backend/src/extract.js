// Returns a code only when the email clearly labels one unique code.
// This is not a general number-scraper and intentionally prefers false negatives.
const LABEL = String.raw`(?:verification\s*(?:code|pin)|security\s*code|one[\s-]*time\s*(?:passcode|password|code|pin)|authentication\s*code|login\s*code|sign[\s-]*in\s*code|access\s*code|confirmation\s*code|otp(?:\s*code)?|passcode|رمز\s*(?:التحقق|التأكيد|الدخول|الأمان)|كود\s*(?:التحقق|التأكيد|الدخول))`;
const VALUE = String.raw`([A-Z0-9]{4,10})`;
const BEFORE = new RegExp(`${LABEL}(?:\\s*(?:is|هو|:|#|=|-|–)){0,3}\\s*${VALUE}(?![A-Z0-9])`, 'giu');
const AFTER = new RegExp(`(?<![A-Z0-9])${VALUE}\\s*(?:is\\s*)?(?:your|the|هو)?\\s*${LABEL}`, 'giu');
const STOP = new Set(['CODE','YOUR','THIS','LOGIN','EMAIL','VERIFY','ORDER','ABOUT','AGAIN','NEVER','TOKEN','CLICK','BELOW']);
function valid(code) {
  const x = code.toUpperCase();
  if (STOP.has(x) || /^(?:19|20)\d{2}$/.test(x)) return false;
  return /^\d{4,8}$/.test(x) || (/^[A-Z0-9]{5,10}$/.test(x) && /[A-Z]/.test(x) && /\d/.test(x));
}
export function extractVerificationCode(subject='', body='') {
  const text = `${subject}\n${body}`.replace(/\s+/g,' ').slice(0,25000);
  // An OTP must be near an explicit code label; if ambiguous, do not deliver.
  const found = new Set();
  for (const pattern of [BEFORE, AFTER]) {
    pattern.lastIndex=0;
    for (const match of text.matchAll(pattern)) {
      const code = match[1].toUpperCase();
      if (valid(code)) found.add(code);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}
export function normEmail(str='') {
  return String(str).toLowerCase().trim();
}
export function exactMarkerIn(text, marker) {
  if (!marker || marker.length < 6) return false;
  const content = ` ${String(text || '').toLowerCase()} `;
  const needle = marker.toLowerCase();
  let i = content.indexOf(needle);
  while (i !== -1) {
    const before=content[i-1] || '', after=content[i+needle.length] || '';
    if (!/[a-z0-9_-]/i.test(before) && !/[a-z0-9_-]/i.test(after)) return true;
    i = content.indexOf(needle,i+1);
  }
  return false;
}
