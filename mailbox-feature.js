import {requireApiBase} from './mail-bridge-config.js';

async function api(db,path,{method='GET',data}={}) {
  const {data:auth,error}=await db.auth.getSession();
  if(error || !auth.session?.access_token)throw new Error('سجّل الدخول أولاً');
  const r=await fetch(`${requireApiBase()}${path}`,{
    method,
    headers:{'Authorization':`Bearer ${auth.session.access_token}`,'Content-Type':'application/json'},
    ...(data===undefined?{}:{body:JSON.stringify(data)}),
    cache:'no-store'
  });
  const json=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(json.error||`API ${r.status}`);
  return json;
}
export {api};

// Reuses existing store authentication and its existing Gmail / Outlook controls.
// No CSS, card layout, or original UI elements are changed.
export function initStoreBridge({db,getStore}) {
  const section=document.getElementById('mailboxesSection');
  if(!section)return;
  const buttons=[...section.querySelectorAll('.mailbox-provider button')];
  ['gmail','outlook'].forEach((provider,index)=>{
    const btn=buttons[index];
    if(!btn)return;
    btn.disabled=false;
    btn.removeAttribute('title');
    btn.textContent=provider==='gmail'?'ربط Gmail':'ربط Outlook';
    btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try {
        const {url}=await api(db,`/api/oauth/${provider}/start`);
        location.href=url;
      }catch(e){alert(e.message);btn.disabled=false;}
    });
  });
  const note=section.querySelector('.mailbox-note');
  if(note) {
    note.textContent='اربط بريدك عبر OAuth، ثم خصص كل طلب للعميل والبريد والمرسل المطابق. إعداد الطلبات: ';
    const a=document.createElement('a');
    a.href='./mailbox-settings.html'; a.textContent='فتح صفحة إعداد الطلبات';
    a.style.color='inherit'; a.style.textDecoration='underline';
    note.appendChild(a);
  }
  async function update() {
    if(!getStore()?.active)return;
    try {
      const [{mailboxes},{stats}]=await Promise.all([api(db,'/api/mailboxes'),api(db,'/api/mailboxes/stats')]);
      const online=mailboxes.filter(x=>x.status==='connected');
      document.getElementById('connectedMailboxCount').textContent=String(online.length);
      document.getElementById('mailboxMessageCount').textContent=String(stats.processed||0);
      document.getElementById('mailboxSystemStatus').textContent=online.length?'متصل':'لا توجد صناديق متصلة';
      const latest=mailboxes.filter(x=>x.last_sync).sort((a,b)=>Date.parse(b.last_sync)-Date.parse(a.last_sync))[0];
      document.getElementById('mailboxLastSync').textContent=latest?.last_sync?new Date(latest.last_sync).toLocaleString('ar-SA'):'لم تبدأ';
      const counters=section.querySelectorAll('.provider-state');
      ['gmail','outlook'].forEach((provider,index)=>{
        const m=mailboxes.find(x=>x.provider===provider);
        if(counters[index])counters[index].textContent=m?`الحالة: ${m.status} — ${m.email}`:'الحالة: غير مرتبط';
      });
      document.getElementById('mailboxPlanMessage').textContent='لإرسال رمز آمن، اربط كل رابط طلب ببريد عميل مؤكد ومعرّف مطابقة فريد.';
    } catch (e) {console.warn('Mail bridge status unavailable',e.message);}
  }
  setTimeout(update,2000);
  setInterval(update,30000);
}

export function initCustomerBridge({db}) {
  const notice=document.getElementById('notice');
  const token=new URLSearchParams(location.search).get('token');
  if(!notice || !token)return;
  let busy=false;
  let hadSession=false;
  async function check() {
    if(busy)return;
    const {data}=await db.auth.getSession();
    if(!data.session?.access_token){hadSession=false;return;}
    // Only update after customer login, never treat a public link as identity.
    busy=true;
    try {
      const result=await api(db,'/api/customer/status',{method:'POST',data:{pageToken:token}});
      hadSession=true;
      if(result.status==='received') {
        notice.textContent=`تم استلام الرمز: ${result.code} (ينتهي خلال دقائق)`;
      }else if(result.status==='waiting') {
        notice.textContent='بانتظار الكود — جاري المتابعة تلقائياً';
      }else{
        notice.textContent='الكود غير متاح لهذا الطلب حالياً';
      }
    }catch(e) {
      if(hadSession || document.getElementById('email')?.value)
        notice.textContent=e.message;
    }finally{busy=false;}
  }
  db.auth.onAuthStateChange((_event,session)=>{if(session)setTimeout(check,1200);});
  setTimeout(check,1500);
  setInterval(check,8000);
}
