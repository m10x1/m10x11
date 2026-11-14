import {createHash} from 'node:crypto';
import {convert} from 'html-to-text';
import {config} from './config.js';
import {HttpError} from './auth.js';

const callback = provider => `${config.backend}/api/oauth/${provider}/callback`;
const scope = {
  gmail: 'openid email https://www.googleapis.com/auth/gmail.readonly',
  outlook: 'openid profile email offline_access User.Read Mail.Read'
};
function providerInfo(provider) {
  if (provider === 'gmail') return {
    id: config.google.id, secret: config.google.secret,
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token'
  };
  if (provider === 'outlook') {
    const root = `https://login.microsoftonline.com/${encodeURIComponent(config.microsoft.tenant)}/oauth2/v2.0`;
    return {id:config.microsoft.id,secret:config.microsoft.secret,authorize:`${root}/authorize`,token:`${root}/token`};
  }
  throw new HttpError(400, 'Unsupported provider');
}
export function oauthUrl(provider, state, verifier) {
  const p = providerInfo(provider);
  if (!p.id || !p.secret) throw new HttpError(503, 'OAuth provider is not configured');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id:p.id,response_type:'code',redirect_uri:callback(provider),scope:scope[provider],
    state,code_challenge:challenge,code_challenge_method:'S256',response_mode:'query'
  });
  if(provider==='gmail') {params.set('access_type','offline');params.set('prompt','consent');}
  return `${p.authorize}?${params}`;
}
async function httpJson(url, options={}) {
  const r=await fetch(url, { ...options, signal:AbortSignal.timeout(18000), redirect:'error' });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) {
    const msg=typeof data.error==='string'?data.error:(data.error?.code || `HTTP ${r.status}`);
    const e=new Error(`Provider error (${r.status}): ${msg}`);
    e.httpStatus=r.status;
    throw e;
  }
  return data;
}
async function tokenRequest(provider, params) {
  const p=providerInfo(provider);
  return httpJson(p.token, {
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:p.id,client_secret:p.secret,...params})
  });
}
export async function exchangeAuthCode(provider, code, verifier) {
  return tokenRequest(provider,{grant_type:'authorization_code',code,redirect_uri:callback(provider),code_verifier:verifier});
}
export async function refreshAccess(provider, refreshToken) {
  if(!refreshToken) throw new Error('Missing refresh token');
  return tokenRequest(provider,{grant_type:'refresh_token',refresh_token:refreshToken,scope:scope[provider]});
}
function apiHeaders(token, extras={}) {return {authorization:`Bearer ${token}`,...extras};}
export async function accountIdentity(provider, accessToken) {
  if(provider==='gmail') {
    const data=await httpJson('https://www.googleapis.com/oauth2/v3/userinfo',{headers:apiHeaders(accessToken)});
    if(!data.email_verified || !data.sub || !data.email) throw new Error('Email identity cannot be verified');
    return {id:String(data.sub),email:String(data.email).toLowerCase()};
  }
  const data=await httpJson('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName',{headers:apiHeaders(accessToken)});
  if(!data.id || !(data.mail || data.userPrincipalName)) throw new Error('Outlook identity missing');
  return {id:String(data.id), email:String(data.mail || data.userPrincipalName).toLowerCase()};
}
function gmailPart(part, output) {
  if(!part) return;
  const mime=String(part.mimeType||'').toLowerCase();
  if(part.body?.data && ['text/plain','text/html'].includes(mime)) {
    const text=Buffer.from(part.body.data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
    if(mime==='text/plain') output.plain.push(text);
    else output.html.push(text);
  }
  for(const p of part.parts||[]) gmailPart(p,output);
}
function parseRecipients(text='') {
  const emails=String(text).match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(emails.map(e=>e.toLowerCase()))];
}
export function normalizeGmailMessage(data) {
  const headers=Object.fromEntries((data.payload?.headers||[]).map(x=>[String(x.name).toLowerCase(),x.value]));
  const segments={plain:[],html:[]};
  gmailPart(data.payload,segments);
  const body=segments.plain.join('\n') || convert(segments.html.join('\n'),{wordwrap:false});
  return {
    id:data.id, received:new Date(Number(data.internalDate)),subject:headers.subject||'',
    from:parseRecipients(headers.from)[0] || '',
    recipients:parseRecipients([headers.to,headers.cc,headers['delivered-to'],headers['x-original-to']].filter(Boolean).join(',')),
    body:body.slice(0,25000)
  };
}
export async function* fetchGmail(token, since) {
  const after=Math.floor((since.getTime()-5*60_000)/1000);
  let next='';
  for(let page=0;page<20;page++) {
    const q=new URLSearchParams({q:`in:inbox after:${Math.max(0,after)}`,maxResults:'100'});
    if(next)q.set('pageToken',next);
    const list=await httpJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`,{headers:apiHeaders(token)});
    for(const item of list.messages||[]) {
      const raw=await httpJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,{headers:apiHeaders(token)});
      yield normalizeGmailMessage(raw);
    }
    if(!list.nextPageToken) return;
    next=list.nextPageToken;
  }
  throw new Error('Gmail backlog exceeded 2000 messages; sync checkpoint was not advanced');
}
export async function* fetchOutlook(token, since) {
  const start=new Date(since.getTime()-5*60_000).toISOString();
  const query=new URLSearchParams({
    '$filter':`receivedDateTime ge ${start}`,
    '$select':'id,receivedDateTime,subject,from,sender,toRecipients,ccRecipients,body',
    '$top':'50'
  });
  let next=`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${query}`;
  for(let page=0;page<40;page++) {
    const url=new URL(next);
    if(url.origin!=='https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/me/mailFolders/inbox/messages')) throw new Error('Unsafe Microsoft Graph pagination URL');
    const data=await httpJson(next,{headers:apiHeaders(token,{'Prefer':'outlook.body-content-type="text", IdType="ImmutableId"'})});
    for(const msg of data.value||[]) {
      const body=msg.body?.contentType==='html'?convert(msg.body.content||'',{wordwrap:false}):String(msg.body?.content||'');
      yield {
        id:msg.id,received:new Date(msg.receivedDateTime),subject:msg.subject||'',
        from:String(msg.from?.emailAddress?.address || '').toLowerCase(),
        recipients:[...(msg.toRecipients||[]),...(msg.ccRecipients||[])].map(x=>String(x.emailAddress?.address||'').toLowerCase()).filter(Boolean),
        body:body.slice(0,25000)
      };
    }
    if(!data['@odata.nextLink']) return;
    next=data['@odata.nextLink'];
  }
  throw new Error('Outlook backlog exceeded 2000 messages; sync checkpoint was not advanced');
}
