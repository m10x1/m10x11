import 'dotenv/config';

function must(name) {
  const x = process.env[name]?.trim();
  if (!x || x.startsWith('REPLACE_')) throw new Error(`Required environment variable: ${name}`);
  return x;
}
function hexKey(name) {
  const value = must(name);
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error(`${name} must be 64 hex characters`);
  return Buffer.from(value, 'hex');
}
const prod = process.env.NODE_ENV === 'production';
export const config = {
  prod,
  port: Number(process.env.PORT || 4000),
  frontend: (process.env.FRONTEND_SITE_URL?.trim() || must('FRONTEND_ORIGIN')).replace(/\/$/, ''),
  origins: (process.env.FRONTEND_ORIGINS || must('FRONTEND_ORIGIN')).split(',').map(s => s.trim().replace(/\/$/, '')),
  backend: must('BACKEND_URL').replace(/\/$/, ''),
  supabaseUrl: must('SUPABASE_URL'),
  supabaseServiceKey: must('SUPABASE_SERVICE_ROLE_KEY'),
  encryptionKey: hexKey('DATA_ENCRYPTION_KEY'),
  codeHashKey: hexKey('CODE_HASH_KEY'),
  sql: {
    server: must('SQL_SERVER'),
    port: Number(process.env.SQL_PORT || 1433),
    database: must('SQL_DATABASE'),
    user: must('SQL_USER'),
    password: must('SQL_PASSWORD'),
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: process.env.SQL_ENCRYPT !== 'false',
      trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true'
    }
  },
  google: { id: process.env.GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '' },
  microsoft: { id: process.env.MICROSOFT_CLIENT_ID || '', secret: process.env.MICROSOFT_CLIENT_SECRET || '', tenant: process.env.MICROSOFT_TENANT || 'common' },
  pollSeconds: Math.max(30, Number(process.env.POLL_INTERVAL_SECONDS || 60))
};
if (prod) {
  if (![config.backend, config.frontend, ...config.origins].every(x => x.startsWith('https://'))) throw new Error('HTTPS required in production');
  if (config.sql.options.trustServerCertificate || !config.sql.options.encrypt) throw new Error('TLS SQL Server certificate validation is required in production');
}
