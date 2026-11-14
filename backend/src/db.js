import sql from 'mssql';
import {config} from './config.js';
let connection;
export async function pool() {
  if (!connection) connection = new sql.ConnectionPool(config.sql).connect().catch(e => {connection = null; throw e;});
  return connection;
}
export async function query(statement, params={}) {
  const p = await pool();
  const req = p.request();
  for (const [key, value] of Object.entries(params)) req.input(key, value);
  return req.query(statement);
}
export async function transaction(work) {
  const t = new sql.Transaction(await pool());
  await t.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const out = await work(t);
    await t.commit();
    return out;
  } catch (e) {
    try {await t.rollback();} catch {}
    throw e;
  }
}
export {sql};
