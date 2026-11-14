import {createClient} from '@supabase/supabase-js';
import {config} from './config.js';
import {sha256} from './security.js';
export const adminDb = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {persistSession: false, autoRefreshToken: false}
});
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function auth(req, _res, next) {
  try {
    const jwt = /^Bearer (\S+)$/i.exec(req.get('authorization') || '')?.[1];
    if (!jwt) throw new HttpError(401, 'تسجيل الدخول مطلوب');
    const {data, error} = await adminDb.auth.getUser(jwt);
    if (error || !data.user || !data.user.email || !data.user.email_confirmed_at) throw new HttpError(401, 'يجب استخدام حساب بريد مؤكد');
    req.user = {id: data.user.id, email: data.user.email.toLowerCase()};
    next();
  } catch (e) { next(e); }
}
export async function merchantStore(userId) {
  const {data: store, error} = await adminDb.from('mr_stores').select('id,status,owner_id').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  if (!store || store.status !== 'approved') throw new HttpError(403, 'المتجر غير معتمد');
  const {data: entitlement, error: err} = await adminDb.from('mr10_entitlements').select('expires_at').eq('store_id',store.id).maybeSingle();
  if (err) throw err;
  if (!entitlement || Date.parse(entitlement.expires_at) <= Date.now()) throw new HttpError(403, 'انتهى اشتراك المتجر');
  return store;
}
export async function verifiedPage(token) {
  if (!/^[a-f0-9-]{36}$/i.test(token || '')) throw new HttpError(400, 'رابط غير صالح');
  const {data:page,error} = await adminDb.from('mr10_customer_pages')
    .select('id,store_id,expires_at,order_reference,product_name')
    .eq('token_hash',sha256(token)).maybeSingle();
  if (error) throw error;
  if (!page || Date.parse(page.expires_at) <= Date.now()) throw new HttpError(404, 'الرابط منتهي أو غير صالح');
  return page;
}
