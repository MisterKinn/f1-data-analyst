// Standard Web Push (RFC 8291 message encryption, RFC 8292 VAPID) with WebCrypto only,
// so it runs in the bundled worker code without Node-only libraries.
// Subscriptions live in the server-only store: push/sub/<sha256(endpoint)>.
const enc=new TextEncoder();
export const b64u={
 encode:bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');},
 decode:text=>{const s=String(text).replace(/-/g,'+').replace(/_/g,'/');const bin=atob(s+'='.repeat((4-s.length%4)%4));return Uint8Array.from(bin,c=>c.charCodeAt(0));}
};
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
export async function sha256Hex(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}

async function hkdf(salt,ikm,info,bytes){
 const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bytes*8));
}

// aes128gcm body for one push message (single record, no padding).
export async function encryptPayload(payload,p256dh,authSecret,{salt=crypto.getRandomValues(new Uint8Array(16)),serverKeys}={}){
 const uaPublic=typeof p256dh==='string'?b64u.decode(p256dh):p256dh,auth=typeof authSecret==='string'?b64u.decode(authSecret):authSecret;
 const local=serverKeys||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const asPublic=new Uint8Array(await crypto.subtle.exportKey('raw',local.publicKey));
 const uaKey=await crypto.subtle.importKey('raw',uaPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},local.privateKey,256));
 const ikm=await hkdf(auth,shared,concat(enc.encode('WebPush: info\0'),uaPublic,asPublic),32);
 const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\0'),12);
 const body=typeof payload==='string'?enc.encode(payload):payload;
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,concat(body,new Uint8Array([2]))));
 const header=new Uint8Array(21+asPublic.length);header.set(salt,0);new DataView(header.buffer).setUint32(16,4096);header[20]=asPublic.length;header.set(asPublic,21);
 return concat(header,cipher);
}

// VAPID keys: env (VAPID_PUBLIC_KEY raw base64url + VAPID_PRIVATE_KEY JWK JSON) or created once and kept server-side.
export async function vapidKeys(env){
 if(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY)return {publicKey:env.VAPID_PUBLIC_KEY,privateJwk:JSON.parse(env.VAPID_PRIVATE_KEY)};
 if(!env.BUCKET)throw Error('Push storage is not configured.');
 const read=async()=>{const o=await env.BUCKET.get('push/vapid');return o?await o.json():null;};
 const existing=await read();if(existing)return existing;
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const value={publicKey:b64u.encode(await crypto.subtle.exportKey('raw',pair.publicKey)),privateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey),created_at:new Date().toISOString()};
 await env.BUCKET.put('push/vapid',JSON.stringify(value),{onlyIf:{etagDoesNotMatch:'*'}});
 return await read()||value;
}

export async function vapidAuthorization(endpoint,keys,{subject='https://kongboda-motorsports.vercel.app',now=Date.now()}={}){
 const header=b64u.encode(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const claims=b64u.encode(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:subject})));
 const key=await crypto.subtle.importKey('jwk',keys.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(header+'.'+claims));
 return `vapid t=${header}.${claims}.${b64u.encode(sig)}, k=${keys.publicKey}`;
}

export async function sendPush(subscription,message,keys,{fetchImpl=fetch,ttl=12*3600,urgency='high'}={}){
 const body=await encryptPayload(JSON.stringify(message),subscription.keys.p256dh,subscription.keys.auth);
 const res=await fetchImpl(subscription.endpoint,{method:'POST',headers:{authorization:await vapidAuthorization(subscription.endpoint,keys),'content-encoding':'aes128gcm','content-type':'application/octet-stream',ttl:String(ttl),urgency},body});
 return res.status;
}

// Only well-known push services; a stored endpoint must never turn the server into a proxy.
export function allowedEndpoint(endpoint){
 try{const u=new URL(endpoint);return u.protocol==='https:'&&/(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com|web\.push\.apple\.com)$/.test(u.hostname);}catch{return false;}
}

export async function saveSubscription(env,account,subscription,lang='ko',now=Date.now()){
 if(!subscription||!allowedEndpoint(subscription.endpoint)||typeof subscription.keys?.p256dh!=='string'||typeof subscription.keys?.auth!=='string')throw Error('Invalid push subscription.');
 if(b64u.decode(subscription.keys.p256dh).length!==65||b64u.decode(subscription.keys.auth).length!==16)throw Error('Invalid push subscription keys.');
 const id=await sha256Hex(subscription.endpoint);
 const prev=await env.BUCKET.get('push/sub/'+id),old=prev?(await prev.json()).account:null;
 if(old&&old!==account)await env.BUCKET.delete(`push/by-account/${old}/${id}`);
 await env.BUCKET.put('push/sub/'+id,JSON.stringify({endpoint:subscription.endpoint,keys:{p256dh:subscription.keys.p256dh,auth:subscription.keys.auth},account,lang:lang==='en'?'en':'ko',created_at:new Date(now).toISOString()}));
 await env.BUCKET.put(`push/by-account/${account}/${id}`,'{}');
 return id;
}
async function dropSubscription(env,id){
 const o=await env.BUCKET.get('push/sub/'+id);if(!o)return;const {account}=await o.json();
 await env.BUCKET.delete('push/sub/'+id);if(account)await env.BUCKET.delete(`push/by-account/${account}/${id}`);
}
export async function removeSubscription(env,endpoint){const id=await sha256Hex(endpoint);await dropSubscription(env,id);return id;}
// Cheap per-account lookup: one small index entry per device, no scan of all subscriptions.
export async function accountPushState(env,account){
 const o=await env.BUCKET.get('push/account/'+account);const prefs=o?await o.json():{};
 const page=await env.BUCKET.list({prefix:`push/by-account/${account}/`,limit:20});
 return {off:!!prefs.off,devices:page.objects.length};
}
export async function setAccountOff(env,account,off){await env.BUCKET.put('push/account/'+account,JSON.stringify({off:!!off,updated_at:new Date().toISOString()}));}

async function eachSubscription(env,fn){
 let cursor;do{const page=await env.BUCKET.list({prefix:'push/sub/',...(cursor?{cursor}:{})});
  for(const item of page.objects){const o=await env.BUCKET.get(item.key);if(o)await fn({...(await o.json()),key:item.key});}
  cursor=page.truncated?page.cursor:undefined;}while(cursor);
}

// Send one alert to every device; message(lang) builds the localized payload.
export async function broadcast(env,message,{fetchImpl=fetch,account=null}={}){
 if(!env.BUCKET)return {sent:0,failed:0,removed:0};
 const keys=await vapidKeys(env),offCache=new Map(),tally={sent:0,failed:0,removed:0},jobs=[];
 const isOff=async a=>{if(!offCache.has(a)){const o=await env.BUCKET.get('push/account/'+a);offCache.set(a,o?!!(await o.json()).off:false);}return offCache.get(a);};
 await eachSubscription(env,async s=>{
  if(account&&s.account!==account)return;if(await isOff(s.account))return;
  jobs.push(sendPush(s,message(s.lang),keys,{fetchImpl}).then(async status=>{
   if(status>=200&&status<300)tally.sent++;else if(status===404||status===410){tally.removed++;await dropSubscription(env,s.key.slice('push/sub/'.length));}else tally.failed++;
  }).catch(()=>{tally.failed++;}));
 });
 await Promise.all(jobs);
 return tally;
}
