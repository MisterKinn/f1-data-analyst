// Browser side of the document alerts: service worker, web app manifest, the alerts page,
// one-tap enable (site banner, /alerts page, connector consent page) and the JSON APIs.
import {vapidKeys,saveSubscription,removeSubscription,accountPushState,setAccountOff,broadcast} from './web-push.js';
import {runCheck,currentF1Event,eventState,aiStatus,saveAiKey} from './doc-alerts.js';
import {opsStatus,saveOpsKey} from './patents.js';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;

const SERVICE_WORKER=`self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(_){d={body:e.data?e.data.text():''};}
 e.waitUntil(self.registration.showNotification(d.title||'꽁보다 모터스포츠',{body:d.body||'',tag:d.tag||undefined,icon:'/assets/brand-icon.png',badge:'/assets/brand-icon.png',data:{url:d.url||'/alerts'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'/alerts',self.location.origin).href;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if(c.url.startsWith(self.location.origin)&&'focus' in c){if('navigate' in c)c.navigate(url);return c.focus();}}return self.clients.openWindow(url);}));});`;

const MANIFEST=JSON.stringify({name:'꽁보다 모터스포츠',short_name:'꽁보다',start_url:'/',scope:'/',display:'standalone',background_color:'#0b0c0d',theme_color:'#0b0c0d',lang:'ko',
 icons:[{src:'/assets/brand-icon.png',sizes:'1254x1254',type:'image/png',purpose:'any'},{src:'/assets/brand-icon.svg',sizes:'any',type:'image/svg+xml'}]});

// Plain browser script; must stay framework-free and safe on pages that do not use it.
function alertsClient(){
 const en=document.documentElement.lang==='en',lang=en?'en':'ko';
 const T=en?{ask:'Get a phone alert when new FIA or Pirelli documents come out?',on:'Turn on alerts',later:'Later',enabled:'Alerts are on for this device.',off:'Alerts are off on this device.',denied:'Notifications are blocked for this site. Allow them in your browser settings.',ios:'iPhone: tap Share → Add to Home Screen, then turn alerts on in the Kongboda app on your Home Screen.',unsupported:'This browser cannot receive web notifications.',failed:'Could not turn alerts on. Please try again.',signin:'Sign in to turn on alerts.',optin:'Also send me alerts for new FIA and Pirelli documents on this device'}
  :{ask:'새 FIA·피렐리 문서가 나오면 휴대폰 알림으로 받아볼까요?',on:'알림 켜기',later:'나중에',enabled:'이 기기에서 알림을 받고 있습니다.',off:'이 기기는 알림이 꺼져 있습니다.',denied:'이 사이트의 알림이 차단돼 있습니다. 브라우저 설정에서 허용해 주세요.',ios:'iPhone: Safari 공유 버튼 → ‘홈 화면에 추가’ 후, 홈 화면의 꽁보다 앱에서 알림을 켜 주세요.',unsupported:'이 브라우저는 웹 알림을 받을 수 없습니다.',failed:'알림을 켜지 못했습니다. 다시 시도해 주세요.',signin:'로그인하면 알림을 켤 수 있습니다.',optin:'새 FIA·피렐리 문서 알림을 이 기기로 받기'};
 const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
 const store={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}};
 const key=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');const r=atob(s+'='.repeat((4-s.length%4)%4));return Uint8Array.from(r,c=>c.charCodeAt(0));};
 const post=(url,body)=>fetch(url,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 async function current(){if(!supported)return null;const r=await navigator.serviceWorker.getRegistration('/');return r?r.pushManager.getSubscription():null;}
 async function enable(){
  if(!supported)throw Error(ios&&!standalone?'ios':'unsupported');
  const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('denied');
  const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;
  const {publicKey}=await (await fetch('/api/push/key')).json();
  let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(publicKey)});
  const res=await post('/api/push/subscribe',{subscription:sub.toJSON(),lang});if(!res.ok)throw Error(res.status===401?'signin':'failed');
  store.set('kb-push-synced',String(Date.now()));return true;
 }
 async function disable(){const s=await current();if(s){await post('/api/push/unsubscribe',{endpoint:s.endpoint}).catch(()=>{});await s.unsubscribe();}}
 const reason=e=>T[e&&e.message]||T.failed;

 // Connector consent page: pre-checked opt-in, enabled on the approve click.
 const optin=document.getElementById('kb-alert-optin');
 if(optin){
  const row=optin.closest('label'),note=document.getElementById('kb-alert-note');
  if(!supported){optin.checked=false;if(row)row.hidden=true;if(note){note.hidden=false;note.textContent=ios&&!standalone?T.ios:T.unsupported;}return;}
  if(Notification.permission==='denied'){optin.checked=false;if(row)row.hidden=true;return;}
  const form=optin.form;let busy=false;
  form.addEventListener('submit',e=>{
   const btn=e.submitter;if(busy||!optin.checked||!btn||btn.value!=='approve')return;
   e.preventDefault();busy=true;const keep=document.createElement('input');keep.type='hidden';keep.name='decision';keep.value='approve';form.appendChild(keep);
   Promise.race([enable(),new Promise(r=>setTimeout(r,15000))]).catch(()=>{}).finally(()=>form.submit());
  });
  return;
 }

 // /alerts page panel.
 const panel=document.getElementById('kb-alerts-panel');
 document.querySelectorAll('[data-lang]').forEach(el=>{el.hidden=el.getAttribute('data-lang')!==lang;});
 if(panel){
  const status=panel.querySelector('[data-kb-status]'),on=panel.querySelector('[data-kb-enable]'),off=panel.querySelector('[data-kb-disable]'),tip=panel.querySelector('[data-kb-ios]');
  const show=async()=>{
   if(panel.dataset.signedIn!=='1'){status.textContent=T.signin;on.hidden=true;off.hidden=true;return;}
   if(!supported){status.textContent=ios&&!standalone?T.ios:T.unsupported;on.hidden=true;off.hidden=true;if(tip)tip.hidden=!ios;return;}
   if(Notification.permission==='denied'){status.textContent=T.denied;on.hidden=true;off.hidden=true;return;}
   const s=await current();status.textContent=s?T.enabled:T.off;on.hidden=!!s;off.hidden=!s;
  };
  on.addEventListener('click',()=>{enable().then(show,e=>{status.textContent=reason(e);});});
  off.addEventListener('click',()=>{disable().then(show);});
  show();
  document.querySelectorAll('[data-kb-owner]').forEach(btn=>btn.addEventListener('click',async()=>{
   const out=document.getElementById('kb-owner-result'),action=btn.getAttribute('data-kb-owner');
   const body=action==='ai'?{key:document.getElementById('kb-ai-key').value,model:document.getElementById('kb-ai-model').value}:action==='ai-remove'||action==='epo-remove'?{key:''}:action==='epo'?{key:document.getElementById('kb-epo-key').value,secret:document.getElementById('kb-epo-secret').value}:{force:true};
   const url=action==='test'?'/api/push/test':action==='run'?'/api/doc-alerts/run':/^epo/.test(action)?'/api/doc-alerts/epo':'/api/doc-alerts/ai';
   const res=await post(url,body).catch(()=>null);out.textContent=res?JSON.stringify(await res.json().catch(()=>({status:res.status}))):'network error';
  }));
  return;
 }

 // Every other page: a small banner for signed-in visitors who have not decided yet.
 if(document.body.getAttribute('data-kb-user')!=='1')return;
 (async()=>{
  const s=await current().catch(()=>null);
  if(s){const last=Number(store.get('kb-push-synced')||0);if(Date.now()-last>7*86400000)post('/api/push/subscribe',{subscription:s.toJSON(),lang}).then(r=>{if(r.ok)store.set('kb-push-synced',String(Date.now()));}).catch(()=>{});return;}
  if(supported&&Notification.permission==='denied')return;
  if(!supported&&!ios)return;
  if(Date.now()-Number(store.get('kb-push-later')||0)<14*86400000)return;
  const bar=document.createElement('div');bar.className='kb-push-banner';bar.setAttribute('data-no-translate','');bar.setAttribute('role','region');
  bar.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:560px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 16px;border-radius:14px;background:var(--surface,#16181a);color:var(--text,#f2f4f5);border:1px solid var(--line,#2a2d30);box-shadow:0 8px 30px rgba(0,0,0,.35);font-size:15px';
  const text=document.createElement('span');text.style.flex='1 1 220px';text.textContent=supported?T.ask:T.ios;bar.appendChild(text);
  const mk=(label,primary)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='font:inherit;padding:8px 14px;border-radius:9px;cursor:pointer;border:1px solid var(--line,#2a2d30);'+(primary?'background:var(--mint,#00d2be);color:#0b0c0d;border-color:transparent;font-weight:600':'background:transparent;color:inherit');bar.appendChild(b);return b;};
  if(supported){const go=mk(T.on,true);go.addEventListener('click',()=>{enable().then(()=>{text.textContent=T.enabled;setTimeout(()=>bar.remove(),2500);go.remove();},e=>{text.textContent=reason(e);});});}
  const later=mk(T.later,false);later.addEventListener('click',()=>{store.set('kb-push-later',String(Date.now()));bar.remove();});
  document.body.appendChild(bar);
 })().catch(()=>{});
}
export const ALERTS_SCRIPT='('+alertsClient.toString()+')();';
export const ALERTS_SCRIPT_VERSION=(()=>{let h=2166136261;for(let i=0;i<ALERTS_SCRIPT.length;i++){h^=ALERTS_SCRIPT.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);})();
export const ALERTS_HEAD=`<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/brand-icon.png"><meta name="theme-color" content="#0b0c0d"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="꽁보다"><script src="/assets/alerts.js?v=${ALERTS_SCRIPT_VERSION}" defer></script>`;

// ---------- /alerts page body ----------
const LABEL={pu:'PU',pirelli:'Pirelli',race_director:'Race Director',updates:'Upgrades',decision:'Stewards',classification:'Classification',other:'FIA'};
function alertHtml(a){
 const part=(l,code)=>`<div data-lang="${code}"${code==='en'?' hidden':''}><h3>${esc(l.headline)}</h3><ul>${l.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${l.interpretation?`<p><strong>${code==='en'?'Why it matters':'해석'}:</strong> ${esc(l.interpretation)}</p>`:''}</div>`;
 return `<article class="panel kb-alert" id="${esc(a.id)}" data-no-translate><p class="tag">${esc(LABEL[a.category]||'FIA')}${a.ai?'':' · '+(`<span data-lang="ko">제목만</span><span data-lang="en" hidden>title only</span>`)}</p>${part(a.ko,'ko')}${part(a.en,'en')}<p class="fine"><a href="${esc(a.url)}" target="_blank" rel="noopener">FIA ${a.document_number?'Doc '+esc(a.document_number)+' · ':''}${esc(a.title)}</a>${a.published?' · '+esc(a.published):''}</p></article>`;
}
export async function alertsPageBody(env,{google=null,owner=false,now=Date.now()}={}){
 const ev=currentF1Event(now),state=ev&&env.BUCKET?await eventState(env,ev):null;
 const list=state?.alerts?.length?state.alerts.map(alertHtml).join(''):`<p class="fine">${ev?'아직 이번 주말의 새 문서 알림이 없습니다.':'지금은 진행 중인 F1 주말이 없습니다.'}</p>`;
 let ownerPanel='';
 if(owner){const ai=await aiStatus(env),epo=await opsStatus(env);ownerPanel=`<section class="panel" data-no-translate><h2>운영자 설정</h2><p>AI 요약: ${ai.configured?`사용 중 (${esc(ai.source)} · ${esc(ai.model)})`:'꺼짐 · 키가 없으면 제목만 알립니다'}</p>
<label>Anthropic API 키<input id="kb-ai-key" type="password" autocomplete="off" placeholder="sk-ant-..."></label><label>모델 ID (비우면 기본값)<input id="kb-ai-model" type="text" autocomplete="off" placeholder="claude-sonnet-5-5"></label>
<p><button class="button small-button" type="button" data-kb-owner="ai">키 저장</button> <button class="button small-button" type="button" data-kb-owner="ai-remove">키 삭제</button> <button class="button small-button" type="button" data-kb-owner="run">지금 문서 확인</button> <button class="button small-button" type="button" data-kb-owner="test">내 기기로 테스트 알림</button></p>
<h3>특허 수집 (EPO OPS)</h3><p>${epo.configured?'키 설정됨 · 매주 자동 수집':'꺼짐 · developers.epo.org에서 앱을 만들고 키를 넣으세요'}</p><label>Consumer Key<input id="kb-epo-key" type="password" autocomplete="off"></label><label>Consumer Secret<input id="kb-epo-secret" type="password" autocomplete="off"></label><p><button class="button small-button" type="button" data-kb-owner="epo">EPO 키 저장</button> <button class="button small-button" type="button" data-kb-owner="epo-remove">EPO 키 삭제</button></p><pre id="kb-owner-result" class="fine" style="white-space:pre-wrap"></pre></section>`;}
 return `<section class="hero"><h1>FIA 문서 알림</h1><p class="lead">새 FIA·피렐리 공식 문서가 나오면 핵심 내용과 해석을 휴대폰 알림으로 보내드립니다.</p></section>
<section class="panel" id="kb-alerts-panel" data-signed-in="${google?'1':'0'}"><h2>이 기기 알림</h2><p data-kb-status>확인 중…</p><p><button class="button" type="button" data-kb-enable hidden>알림 켜기</button> <button class="button" type="button" data-kb-disable hidden>알림 끄기</button></p><p class="fine" data-kb-ios hidden>iPhone은 Safari 공유 버튼 → ‘홈 화면에 추가’ 후, 홈 화면의 꽁보다 앱에서 알림을 켤 수 있습니다.</p>${google?'':'<p><a class="button" href="/auth/google/start?return_to=%2Falerts">Google로 로그인</a></p>'}</section>
<section><h2 data-no-translate>${esc(ev?ev.name_ko:'최근 알림')}<span data-lang="en" hidden> ${esc(ev?.name||'')}</span></h2>${list}</section>${ownerPanel}`;
}

// ---------- routes ----------
export async function alertsRoute(request,env,{google=null,owner=false,ctx=null}={}){
 const url=new URL(request.url),path=url.pathname,m=request.method;
 if(path==='/sw.js'&&m==='GET')return new Response(SERVICE_WORKER,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-cache','service-worker-allowed':'/'}});
 if(path==='/manifest.webmanifest'&&m==='GET')return new Response(MANIFEST,{headers:{'content-type':'application/manifest+json; charset=utf-8','cache-control':'public, max-age=3600'}});
 if(path==='/assets/alerts.js'&&m==='GET')return new Response(ALERTS_SCRIPT,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':url.searchParams.get('v')===ALERTS_SCRIPT_VERSION?'public, max-age=31536000, immutable':'no-cache'}});
 if(!path.startsWith('/api/push/')&&!path.startsWith('/api/doc-alerts/'))return null;
 if(!env.BUCKET)return json({error:'Storage is not configured.'},503);
 if(path==='/api/push/key'&&m==='GET')return json({publicKey:(await vapidKeys(env)).publicKey});
 if(path==='/api/doc-alerts/run'&&m==='POST'){
  const body=await request.json().catch(()=>({}));
  try{return json(await runCheck(env,{force:owner&&body?.force===true}));}
  catch(e){return json({state:'error',error:String(e.message).slice(0,200)},502);}
 }
 if(m==='POST'&&!sameOrigin(request))return json({error:'Origin not allowed.'},403);
 if(path==='/api/push/unsubscribe'&&m==='POST'){const body=await request.json().catch(()=>null);if(typeof body?.endpoint!=='string')return json({error:'endpoint required'},400);await removeSubscription(env,body.endpoint);return json({ok:true});}
 if(!google)return json({error:'Sign in required.'},401);
 if(!owner)return json({error:'운영자만 사용할 수 있습니다.'},403);
 if(path==='/api/push/subscribe'&&m==='POST'){
  const body=await request.json().catch(()=>null);
  try{await saveSubscription(env,google.sub,body?.subscription,body?.lang);}catch(e){return json({error:e.message},400);}
  await setAccountOff(env,google.sub,false);return json({ok:true});
 }
 if(path==='/api/push/status'&&m==='GET')return json(await accountPushState(env,google.sub));
 if(path==='/api/push/account'&&m==='POST'){const body=await request.json().catch(()=>({}));await setAccountOff(env,google.sub,body?.off===true);return json({ok:true,off:body?.off===true});}
 if(path==='/api/push/test'&&m==='POST'){
  const tally=await broadcast(env,lang=>lang==='en'?{title:'Kongboda test alert',body:'Alerts work on this device.',url:'/alerts',tag:'test'}:{title:'꽁보다 테스트 알림',body:'이 기기에서 알림이 정상 작동합니다.',url:'/alerts',tag:'test'},{account:google.sub});
  return json(tally);
 }
 if(path==='/api/doc-alerts/epo'){
  if(m==='GET')return json(await opsStatus(env));
  if(m==='POST'){const body=await request.json().catch(()=>({}));try{return json(await saveOpsKey(env,body?.key,body?.secret));}catch(e){return json({error:e.message},400);}}
 }
 if(path==='/api/doc-alerts/ai'){
  if(m==='GET')return json(await aiStatus(env));
  if(m==='POST'){const body=await request.json().catch(()=>({}));try{return json(await saveAiKey(env,body?.key,body?.model));}catch(e){return json({error:e.message},400);}}
 }
 return json({error:'Not found'},404);
}
