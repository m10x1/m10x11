import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {config} from './config.js';
import {query,pool} from './db.js';
import {auth,adminDb,merchantStore,verifiedPage,HttpError} from './auth.js';
import {randomToken,sha256,encrypt,decrypt} from './security.js';
import {oauthUrl,exchangeAuthCode,accountIdentity} from './providers.js';
import {pollAll,pollAccount} from './poller.js';

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',config.prod?1:false);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'12kb'}));
app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const origin=req.get('origin');
  if(origin && config.origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  }
  if(req.method==='OPTIONS')return res.status(origin && !config.origins.includes(origin)?403:204).end();
  if(origin && !config.origins.includes(origin))return res.status(403).json({error:'Origin not allowed'});
  next();
});
const limiter=rateLimit({windowMs:60_000,limit:90,standardHeaders:'draft-7',legacyHeaders:false});
app.use('/api',limiter);
const parse=(schema,value)=>{
  const r=schema.safeParse(value);
  if(!r.success)throw new HttpError(400,'بيانات الطلب غير صحيحة');
  return r.data;
};
const uuid=z.string().uuid(), email=z.string().email().max(254).transform(x=>x.toLowerCase().trim());
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const providerSchema=z.enum(['gmail','outlook']);
const guestLimiter=rateLimit({windowMs:60_000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});

// Public store-registration requests. Separate low rate limit reduces automated spam.
const registrationLimiter=rateLimit({windowMs:15*60_000,limit:5,standardHeaders:'draft-7',legacyHeaders:false});
const registrationSchema=z.object({
  customerName:z.string().trim().min(2).max(80),
  storeName:z.string().trim().min(2).max(100),
  email:email
}).strict();
app.post('/api/registration-requests',registrationLimiter,wrap(async(req,res)=>{
  const args=parse(registrationSchema,req.body);
  const {error}=await adminDb.from('mr10_registration_requests').insert({
    customer_name:args.customerName,store_name:args.storeName,email:args.email
  });
  if(error){
    if(error.code==='23505') return res.status(202).json({ok:true,status:'pending'});
    console.error('Registration insert failed:',error.code || 'unknown');
    throw new HttpError(503,'خدمة استقبال الطلبات غير متاحة الآن');
  }
  res.status(201).json({ok:true,status:'pending'});
}));

app.get('/api/health',wrap(async(_req,res)=>{
  await query('SELECT 1 AS ok');
  res.json({ok:true});
}));
app.get('/api/mailboxes',auth,wrap(async(req,res)=>{
  const s=await merchantStore(req.user.id);
  const rows=await query(`SELECT Id AS id,Provider AS provider,EmailAddress AS email,
    ConnectionStatus AS status,LastSyncAt AS last_sync,LastError AS last_error
    FROM dbo.EmailAccounts WHERE StoreId=@store ORDER BY CreatedAt DESC`,{store:s.id});
  res.json({mailboxes:rows.recordset});
}));
app.get('/api/mailboxes/stats',auth,wrap(async(req,res)=>{
  const s=await merchantStore(req.user.id);
  const result=await query(`SELECT
    (SELECT COUNT(*) FROM dbo.EmailAccounts WHERE StoreId=@store AND ConnectionStatus='connected') AS connected,
    (SELECT COUNT(*) FROM dbo.EmailProcessingLogs l JOIN dbo.EmailAccounts m ON m.Id=l.MailboxId WHERE m.StoreId=@store) AS processed,
    (SELECT MAX(LastSyncAt) FROM dbo.EmailAccounts WHERE StoreId=@store) AS last_sync`,{store:s.id});
  res.json({stats:result.recordset[0]});
}));
app.get('/api/oauth/:provider/start',auth,wrap(async(req,res)=>{
  const provider=parse(providerSchema,req.params.provider);
  const store=await merchantStore(req.user.id);
  const state=randomToken(),verifier=randomToken();
  const url=oauthUrl(provider,state,verifier);
  await query(`INSERT dbo.OAuthStates(StateHash,StoreId,OwnerUserId,Provider,VerifierCipher,ExpiresAt)
    VALUES(@state,@store,@owner,@provider,@verifier,DATEADD(MINUTE,10,SYSUTCDATETIME()))`,{
    state:sha256(state),store:store.id,owner:req.user.id,provider,verifier:encrypt(verifier)
  });
  res.json({url});
}));
app.get('/api/oauth/:provider/callback',wrap(async(req,res)=>{
  const provider=parse(providerSchema,req.params.provider);
  const {code,state,error}=req.query;
  if(error || typeof code!=='string' || typeof state!=='string' || state.length>100) throw new HttpError(400,'OAuth request denied');
  // Atomic one-time state consumption, safe against replay and CSRF.
  const record=await query(`DELETE dbo.OAuthStates OUTPUT DELETED.*
    WHERE StateHash=@hash AND Provider=@provider AND ExpiresAt>SYSUTCDATETIME()`,{hash:sha256(state),provider});
  const row=record.recordset[0];
  if(!row)throw new HttpError(400,'OAuth state expired or already used');
  await merchantStore(row.OwnerUserId);
  const tokens=await exchangeAuthCode(provider,code,decrypt(row.VerifierCipher));
  tokens.expires_at=Date.now()+Math.max(60,Number(tokens.expires_in||3600))*1000;
  if(!tokens.access_token || !tokens.refresh_token) throw new HttpError(400,'No offline refresh token received. Reconnect and grant consent.');
  const identity=await accountIdentity(provider,tokens.access_token);
  const existing=await query('SELECT Id,StoreId FROM dbo.EmailAccounts WHERE Provider=@provider AND ProviderAccountId=@pid',{
    provider,pid:identity.id
  });
  if(existing.recordset.length && String(existing.recordset[0].StoreId).toLowerCase()!==String(row.StoreId).toLowerCase())
    throw new HttpError(409,'Mailbox already connected to a different store');
  // OAuth mailbox ownership is proven by the provider's userinfo /me endpoint.
  await query(`MERGE dbo.EmailAccounts WITH (HOLDLOCK) AS target
    USING (SELECT @provider AS Provider,@pid AS ProviderAccountId) AS source
    ON target.Provider=source.Provider AND target.ProviderAccountId=source.ProviderAccountId
    WHEN MATCHED THEN UPDATE SET TokenCipher=@tokens,ConnectionStatus='connected',
      EmailAddress=@email,LastError=NULL,PollLeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (StoreId,OwnerUserId,Provider,ProviderAccountId,EmailAddress,TokenCipher)
      VALUES (@store,@owner,@provider,@pid,@email,@tokens);`,{
    provider,pid:identity.id,tokens:encrypt(JSON.stringify(tokens)),email:identity.email,
    store:row.StoreId,owner:row.OwnerUserId
  });
  res.redirect(303,`${config.frontend}/store.html?mailbox=connected`);
}));
app.delete('/api/mailboxes/:id',auth,wrap(async(req,res)=>{
  const id=parse(uuid,req.params.id),store=await merchantStore(req.user.id);
  const account=await query(`UPDATE dbo.EmailAccounts SET ConnectionStatus='disconnected',
    TokenCipher='',PollLeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME()
    OUTPUT inserted.Id WHERE Id=@id AND StoreId=@store`,{id,store:store.id});
  if(!account.recordset.length)throw new HttpError(404,'Mailbox not found');
  res.json({ok:true});
}));
const bindSchema=z.object({
  pageToken:uuid,customerEmail:email,mailboxId:uuid,serviceName:z.string().trim().min(2).max(100),
  allowedSender:email,matchMode:z.enum(['reference','recipient']),
  matchValue:z.string().trim().min(6).max(254),
  // Store-managed product account credentials, never the Gmail OAuth password.
  loginEmail:email,
  loginPassword:z.string().min(1).max(512)
});
app.post('/api/orders/bind',auth,wrap(async(req,res)=>{
  const args=parse(bindSchema,req.body),store=await merchantStore(req.user.id);
  const page=await verifiedPage(args.pageToken);
  if(page.store_id!==store.id)throw new HttpError(403,'This customer link belongs to another store');
  const mailbox=await query(`SELECT Id,EmailAddress,ConnectionStatus FROM dbo.EmailAccounts WHERE Id=@id AND StoreId=@store`,{id:args.mailboxId,store:store.id});
  if(!mailbox.recordset.length || mailbox.recordset[0].ConnectionStatus!=='connected')throw new HttpError(400,'Mailbox must be connected');
  let value=args.matchValue;
  if(args.matchMode==='recipient') {
    value=parse(email,value);
  } else if(!/^[\w-]{6,100}$/.test(value)) {
    throw new HttpError(400,'Reference must contain only letters, numbers, underscore or hyphen');
  }
  const expiresAt=new Date(Math.min(Date.parse(page.expires_at), Date.now()+24*60*60_000));
  if(expiresAt<=new Date())throw new HttpError(400,'Order already expired');
  try {
    // A guest delivery key is independent of the Supabase customer-link UUID.
    // Neither the access key nor product password is stored in plaintext.
    const guestKey=randomToken();
    const inserted=await query(`INSERT dbo.Orders(CustomerPageId,StoreId,CustomerEmail,MailboxId,ServiceName,
      AllowedSender,MatchMode,MatchValue,ExpiresAt,GuestTokenHash,ServiceEmailCipher,ServicePasswordCipher)
      OUTPUT inserted.Id AS id,inserted.ExpiresAt AS expires_at
      VALUES(@page,@store,@customer,@mailbox,@service,@sender,@mode,@value,@expiry,@guestHash,@loginEmail,@loginPassword)`,{
      page:page.id,store:store.id,customer:args.customerEmail,mailbox:args.mailboxId,
      service:args.serviceName,sender:args.allowedSender,mode:args.matchMode,value,expiry:expiresAt,
      guestHash:sha256(guestKey),loginEmail:encrypt(args.loginEmail),loginPassword:encrypt(args.loginPassword)
    });
    const link=new URL(`${config.frontend}/customer.html`);
    link.searchParams.set('token',args.pageToken);
    // The fragment is not sent in HTTP requests or Referer headers.
    link.hash=`access=${guestKey}`;
    res.status(201).json({ok:true,order:inserted.recordset[0],guest_link:link.toString()});
  } catch(e) {
    if(e.number===2601 || e.number===2627)throw new HttpError(409,'This customer link or matching identifier is already assigned');
    throw e;
  }
}));
app.get('/api/orders',auth,wrap(async(req,res)=>{
  const store=await merchantStore(req.user.id);
  const list=await query(`SELECT o.Id AS id,o.ServiceName AS service,o.CustomerEmail AS customer_email,
    o.CreatedAt AS created_at,o.ExpiresAt AS expires_at,o.MatchMode AS match_mode,
    CASE WHEN c.Id IS NOT NULL AND c.ExpiresAt>SYSUTCDATETIME() THEN 'received'
      WHEN o.ExpiresAt<=SYSUTCDATETIME() OR (c.Id IS NOT NULL AND c.ExpiresAt<=SYSUTCDATETIME()) THEN 'unavailable'
      ELSE 'waiting' END AS status
    FROM dbo.Orders o LEFT JOIN dbo.VerificationCodes c ON c.OrderId=o.Id
    WHERE o.StoreId=@store ORDER BY o.CreatedAt DESC`,{store:store.id});
  res.json({orders:list.recordset});
}));
// Login-free guest fulfillment. The merchant sends the complete private link only to
// the intended recipient. Possession of BOTH the page token and a 256-bit secret
// is required. Client email input alone is never accepted as authorization.
const guestSchema=z.object({
  pageToken:uuid,
  accessKey:z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  includeCode:z.boolean().default(false)
}).strict();
app.post('/api/customer/guest/status',guestLimiter,wrap(async(req,res)=>{
  const args=parse(guestSchema,req.body);
  const page=await verifiedPage(args.pageToken);
  const result=await query(`SELECT TOP(1) o.Id,o.ServiceName,o.ExpiresAt,
      o.GuestTokenHash,o.ServiceEmailCipher,o.ServicePasswordCipher,
      c.CodeCipher,c.ExpiresAt AS CodeExpiry
    FROM dbo.Orders o LEFT JOIN dbo.VerificationCodes c ON c.OrderId=o.Id
    WHERE o.CustomerPageId=@page AND o.StoreId=@store
      AND o.GuestTokenHash=@accessHash`,{
      page:page.id,store:page.store_id,accessHash:sha256(args.accessKey)
  });
  const order=result.recordset[0];
  if(!order || !order.ServiceEmailCipher || !order.ServicePasswordCipher)
    throw new HttpError(404,'رابط التسليم غير صالح أو لا يخص هذا الطلب');
  if(order.ExpiresAt.getTime()<=Date.now())return res.json({status:'unavailable'});
  const validCode=Boolean(order.CodeCipher && order.CodeExpiry?.getTime()>Date.now());
  const expiredCode=Boolean(order.CodeCipher && !validCode);
  const response={
    status:expiredCode?'code_unavailable':validCode?'received':'waiting',
    service:order.ServiceName,
    account_email:decrypt(order.ServiceEmailCipher),
    account_password:decrypt(order.ServicePasswordCipher),
    expires_at:order.ExpiresAt.toISOString()
  };
  if(args.includeCode && validCode){
    response.code=decrypt(order.CodeCipher);
    response.code_expires_at=order.CodeExpiry.toISOString();
    await query(`UPDATE dbo.VerificationCodes SET ViewedAt=COALESCE(ViewedAt,SYSUTCDATETIME())
      WHERE OrderId=@order`,{order:order.Id});
  }
  res.json(response);
}));

app.post('/api/customer/status',auth,wrap(async(req,res)=>{
  const {pageToken}=parse(z.object({pageToken:uuid}),req.body);
  const page=await verifiedPage(pageToken);
  const list=await query(`SELECT TOP(1) o.Id,o.CustomerEmail,o.ExpiresAt,
    c.CodeCipher,c.ExpiresAt AS CodeExpiry
    FROM dbo.Orders o LEFT JOIN dbo.VerificationCodes c ON c.OrderId=o.Id
    WHERE o.CustomerPageId=@page AND o.StoreId=@store`,{page:page.id,store:page.store_id});
  if(!list.recordset.length) return res.json({status:'unavailable',reason:'order_not_bound'});
  const order=list.recordset[0];
  if(order.CustomerEmail!==req.user.email)throw new HttpError(403,'You are not the customer assigned to this order');
  const validPage=Date.parse(page.expires_at)>Date.now(), validOrder=order.ExpiresAt.getTime()>Date.now();
  const validCode=order.CodeCipher && order.CodeExpiry?.getTime()>Date.now();
  if(!validPage || !validOrder || (order.CodeCipher && !validCode))return res.json({status:'unavailable'});
  if(!validCode)return res.json({status:'waiting'});
  await query('UPDATE dbo.VerificationCodes SET ViewedAt=COALESCE(ViewedAt,SYSUTCDATETIME()) WHERE OrderId=@id', {id:order.Id});
  res.json({status:'received',code:decrypt(order.CodeCipher),expires_at:order.CodeExpiry.toISOString()});
}));
app.use((err,_req,res,_next)=>{
  if(err instanceof z.ZodError)err=new HttpError(400,'Invalid input');
  const status=err.status>=400&&err.status<500?err.status:500;
  if(status===500)console.error('Backend request failed:',err.name,err.code || 'internal');
  res.status(status).json({error:status===500?'حدث خطأ داخلي':err.message});
});
async function boot(){
  await pool();
  app.listen(config.port,()=>console.log(`Mr10x Mail API listening on ${config.port}`));
  // Workers also run in a separate hosting process if required, using the same SQL lease.
  await pollAll();
  const t=setInterval(pollAll,config.pollSeconds*1000);
  t.unref();
}
boot().catch(e=>{console.error('Cannot start API:',e.message);process.exitCode=1;});
