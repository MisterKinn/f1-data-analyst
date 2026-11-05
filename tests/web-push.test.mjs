import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptPayload,vapidAuthorization,vapidKeys,b64u,allowedEndpoint,saveSubscription,broadcast,setAccountOff} from '../worker/web-push.js';
import {memoryBucket} from './helpers/memory-bucket.mjs';

const enc=new TextEncoder();
async function hkdf(salt,ikm,info,bytes){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,bytes*8));}
const cat=(...p)=>{const o=new Uint8Array(p.reduce((n,x)=>n+x.length,0));let i=0;for(const x of p){o.set(x,i);i+=x.length;}return o;};

// The browser side of RFC 8291, written independently from the server code.
async function decrypt(body,ua,auth){
 const salt=body.slice(0,16),rs=new DataView(body.buffer,body.byteOffset).getUint32(16),idlen=body[20],asPublic=body.slice(21,21+idlen),cipher=body.slice(21+idlen);
 assert.equal(rs,4096);
 const uaPublic=new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey));
 const asKey=await crypto.subtle.importKey('raw',asPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:asKey},ua.privateKey,256));
 const ikm=await hkdf(auth,shared,cat(enc.encode('WebPush: info\0'),uaPublic,asPublic),32);
 const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']);
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,cipher));
 assert.equal(plain.at(-1),2,'last-record delimiter');
 return new TextDecoder().decode(plain.slice(0,-1));
}
async function browserKeys(){const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const auth=crypto.getRandomValues(new Uint8Array(16));
 return {ua,auth,p256dh:b64u.encode(await crypto.subtle.exportKey('raw',ua.publicKey)),authText:b64u.encode(auth)};}

test('aes128gcm payload decrypts on the browser side',async()=>{
 const b=await browserKeys(),msg=JSON.stringify({title:'상파울루 GP PU 운용 한도 공개',body:'레이스 8.0 MJ'});
 const body=await encryptPayload(msg,b.p256dh,b.authText);
 assert.equal(await decrypt(body,b.ua,b.auth),msg);
});

test('VAPID header is a valid ES256 JWT for the push service origin',async()=>{
 const env={BUCKET:memoryBucket()},keys=await vapidKeys(env);
 assert.equal((await vapidKeys(env)).publicKey,keys.publicKey,'keys are created once and reused');
 const h=await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc',keys,{now:Date.parse('2026-11-06T00:00:00Z')});
 const [,jwt,k]=h.match(/^vapid t=([^,]+), k=(.+)$/);assert.equal(k,keys.publicKey);
 const [hd,cl,sig]=jwt.split('.');const claims=JSON.parse(new TextDecoder().decode(b64u.decode(cl)));
 assert.equal(claims.aud,'https://fcm.googleapis.com');
 const pub=await crypto.subtle.importKey('raw',b64u.decode(keys.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 assert.ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,b64u.decode(sig),enc.encode(hd+'.'+cl)));
});

test('only real push services are accepted and expired devices are removed',async()=>{
 assert.ok(allowedEndpoint('https://web.push.apple.com/QW'));assert.ok(allowedEndpoint('https://fcm.googleapis.com/fcm/send/x'));
 assert.ok(!allowedEndpoint('https://evil.example/fcm.googleapis.com'));assert.ok(!allowedEndpoint('http://fcm.googleapis.com/x'));
 const env={BUCKET:memoryBucket()},a=await browserKeys(),b=await browserKeys(),c=await browserKeys();
 await saveSubscription(env,'acct1',{endpoint:'https://fcm.googleapis.com/fcm/send/live',keys:{p256dh:a.p256dh,auth:a.authText}},'ko');
 await saveSubscription(env,'acct2',{endpoint:'https://web.push.apple.com/gone',keys:{p256dh:b.p256dh,auth:b.authText}},'en');
 await saveSubscription(env,'acct3',{endpoint:'https://fcm.googleapis.com/fcm/send/muted',keys:{p256dh:c.p256dh,auth:c.authText}},'ko');
 await setAccountOff(env,'acct3',true);
 await assert.rejects(saveSubscription(env,'x',{endpoint:'https://evil.example/',keys:{p256dh:a.p256dh,auth:a.authText}}),/Invalid/);
 const seen=[];
 const tally=await broadcast(env,lang=>({title:lang==='en'?'EN':'KO'}),{fetchImpl:async(url,init)=>{seen.push({url,headers:init.headers});return new Response(null,{status:url.includes('gone')?410:201});}});
 assert.deepEqual(tally,{sent:1,failed:0,removed:1});
 assert.equal(seen.length,2,'muted account gets nothing');
 assert.ok(seen.every(s=>s.headers['content-encoding']==='aes128gcm'&&s.headers.authorization.startsWith('vapid t=')));
 assert.equal([...env.BUCKET.data.keys()].filter(k=>k.startsWith('push/sub/')).length,2,'the 410 device was deleted');
});
