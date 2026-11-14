import {pool,query,transaction,sql} from './db.js';
import {decrypt,encrypt,digestCode} from './security.js';
import {extractVerificationCode} from './extract.js';
import {matchingOrders} from './matcher.js';
import {refreshAccess,fetchGmail,fetchOutlook} from './providers.js';
import {config} from './config.js';
import {merchantStore} from './auth.js';

function safeError(e) {
  // Do not persist API response bodies, tokens, message content or network error details.
  if(e.httpStatus===401 || e.httpStatus===403) return 'provider_auth_failure';
  if(e.httpStatus===429) return 'provider_rate_limit';
  return 'sync_failure';
}
export async function processMessage(account, msg) {
  if (!msg.id || msg.id.length>300 || !Number.isFinite(msg.received?.getTime())) return;
  // Store no raw email text; processing log contains only immutable provider ID and status.
  const received=msg.received;
  const candidates=await query(`SELECT Id,AllowedSender,MatchMode,MatchValue,CreatedAt,ExpiresAt
    FROM dbo.Orders WHERE MailboxId=@mailbox AND CreatedAt<=@received AND ExpiresAt>@received
      AND ExpiresAt>SYSUTCDATETIME()`,{mailbox:account.Id,received});
  const matched=matchingOrders(candidates.recordset,msg);
  let status='unmatched', orderId=null, code=null;
  if(matched.length>1) status='ambiguous';
  else if(matched.length===1) {
    orderId=matched[0].Id;
    code=extractVerificationCode(msg.subject,msg.body);
    status=code && received.getTime()>Date.now()-10*60_000 && received.getTime()<=Date.now()+2*60_000?'delivered':'no_code';
  }
  await transaction(async t=>{
    const insert=t.request();
    insert.input('mailbox',account.Id).input('message',msg.id).input('received',received)
      .input('status',status).input('order',orderId);
    // Lock on the unique provider message ID; duplicates do not trigger deliveries.
    const exists=await t.request().input('mailbox',account.Id).input('message',msg.id)
      .query('SELECT Id FROM dbo.EmailProcessingLogs WITH (UPDLOCK,HOLDLOCK) WHERE MailboxId=@mailbox AND ProviderMessageId=@message');
    if(exists.recordset.length) return;
    const log=await insert.query(`INSERT dbo.EmailProcessingLogs (MailboxId,ProviderMessageId,MessageReceivedAt,Status,OrderId)
      OUTPUT inserted.Id VALUES (@mailbox,@message,@received,@status,@order)`);
    if(status!=='delivered')return;
    const order=await t.request().input('order',orderId)
      .query('SELECT Id FROM dbo.Orders WITH (UPDLOCK,HOLDLOCK) WHERE Id=@order');
    if(!order.recordset.length)return;
    const previous=await t.request().input('order',orderId).query('SELECT Id FROM dbo.VerificationCodes WHERE OrderId=@order');
    if(previous.recordset.length) {
      await t.request().input('id',log.recordset[0].Id).query("UPDATE dbo.EmailProcessingLogs SET Status='duplicate' WHERE Id=@id");
      return;
    }
    await t.request().input('order',orderId).input('log',log.recordset[0].Id)
      .input('cipher',encrypt(code)).input('digest',digestCode(String(orderId),code)).input('received',received)
      .query(`INSERT dbo.VerificationCodes(OrderId,EmailLogId,CodeCipher,CodeDigest,ExpiresAt)
        VALUES(@order,@log,@cipher,@digest,DATEADD(MINUTE,10,@received))`);
  });
}
async function lease(accountId) {
  const result=await query(`UPDATE dbo.EmailAccounts SET PollLeaseUntil=DATEADD(MINUTE,15,SYSUTCDATETIME())
    OUTPUT inserted.* WHERE Id=@id AND ConnectionStatus='connected'
      AND (PollLeaseUntil IS NULL OR PollLeaseUntil<SYSUTCDATETIME())`,{id:accountId});
  return result.recordset[0] || null;
}
export async function pollAccount(accountId) {
  const account=await lease(accountId);
  if(!account)return;
  try {
    // A suspended/expired store must not keep polling mailboxes.
    await merchantStore(String(account.OwnerUserId));
    const active=await query('SELECT COUNT(*) AS total FROM dbo.Orders WHERE MailboxId=@id AND ExpiresAt>SYSUTCDATETIME()', {id:account.Id});
    if(!active.recordset[0].total) {
      await query(`UPDATE dbo.EmailAccounts SET LastSyncAt=SYSUTCDATETIME(),PollLeaseUntil=NULL
        WHERE Id=@id`,{id:account.Id});
      return;
    }
    const tokens=JSON.parse(decrypt(account.TokenCipher));
    if(!tokens.refresh_token) throw new Error('Reauthorization needed');
    // Refresh only near expiration; frequent token rotation can exhaust provider quotas.
    if(!tokens.access_token || Number(tokens.expires_at||0)<Date.now()+90_000) {
      const newer=await refreshAccess(account.Provider,tokens.refresh_token);
      if(newer.refresh_token) tokens.refresh_token=newer.refresh_token;
      tokens.access_token=newer.access_token;
      tokens.expires_at=Date.now()+Math.max(60,Number(newer.expires_in||3600))*1000;
      await query(`UPDATE dbo.EmailAccounts SET TokenCipher=@cipher,UpdatedAt=SYSUTCDATETIME()
        WHERE Id=@id`,{id:account.Id,cipher:encrypt(JSON.stringify(tokens))});
    }
    const since=account.LastSyncAt || account.ConnectedAt;
    const stream=account.Provider==='gmail'?fetchGmail(tokens.access_token,since):fetchOutlook(tokens.access_token,since);
    for await (const msg of stream) await processMessage(account,msg);
    await query(`UPDATE dbo.EmailAccounts SET LastSyncAt=SYSUTCDATETIME(),LastError=NULL,
      UpdatedAt=SYSUTCDATETIME(),PollLeaseUntil=NULL WHERE Id=@id`,{id:account.Id});
  } catch(e) {
    const label=safeError(e);
    const invalid=/invalid_grant|missing refresh token|Reauthorization needed/i.test(String(e.message)) || e.httpStatus===401;
    await query(`UPDATE dbo.EmailAccounts SET LastError=@error, ConnectionStatus=CASE
      WHEN @reauth=1 THEN 'needs_reauth' ELSE ConnectionStatus END,
      PollLeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id`,
      {id:account.Id,error:label,reauth:invalid?1:0}).catch(()=>{});
    console.error('Mailbox polling failed',String(account.Id),label);
  }
}
let running=false;
export async function pollAll() {
  if(running)return;
  running=true;
  try {
    const list=await query(`SELECT Id FROM dbo.EmailAccounts WHERE ConnectionStatus='connected'
      AND (PollLeaseUntil IS NULL OR PollLeaseUntil<SYSUTCDATETIME())`);
    for(const account of list.recordset) await pollAccount(account.Id);
    await query('DELETE dbo.OAuthStates WHERE ExpiresAt<SYSUTCDATETIME()');
    // Short retention for raw-code ciphertext and operational logs.
    await query('DELETE dbo.VerificationCodes WHERE ExpiresAt<DATEADD(DAY,-1,SYSUTCDATETIME())');
    await query('DELETE dbo.EmailProcessingLogs WHERE ProcessedAt<DATEADD(DAY,-30,SYSUTCDATETIME()) AND Id NOT IN (SELECT EmailLogId FROM dbo.VerificationCodes)');
  } catch(e) { console.error('Poll cycle failed',safeError(e)); }
  finally {running=false;}
}
