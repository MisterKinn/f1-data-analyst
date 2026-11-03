import assert from 'node:assert/strict';
import test from 'node:test';
import {firebaseIdentity,platformIdentity} from '../worker/accounts.js';
import {crossSiteGoogleLoginAllowed,firebaseGoogleSubject,firebaseSessionFailure} from '../api/index.js';

test('Firebase session uses the Google provider subject for legacy account continuity',()=>{
 assert.equal(firebaseGoogleSubject({uid:'firebase-only-id',firebase:{identities:{'google.com':['google-provider-id']}}}),'google-provider-id');
 assert.equal(firebaseGoogleSubject({uid:'firebase-only-id',firebase:{identities:{}}}),null);
});

test('cross-site Google login is limited to the MCP OAuth return flow',()=>{
 assert.equal(crossSiteGoogleLoginAllowed('/oauth/authorize?client_id=test'),true);
 assert.equal(crossSiteGoogleLoginAllowed('/account'),false);
 assert.equal(crossSiteGoogleLoginAllowed('//evil.example/oauth/authorize'),false);
});

test('Firebase session failures expose only a stable diagnostic code',async()=>{
 const response=firebaseSessionFailure('auth/token-verification-failed',401);
 assert.equal(response.status,401);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{error:'auth/token-verification-failed'});
});

test('Firebase website identity is separate from ChatGPT platform identity',()=>{
 const request=new Request('https://preview.example/account',{headers:{'x-kongboda-firebase-user-id':'firebase-user','x-kongboda-firebase-user-email':'verified@example.test','x-kongboda-firebase-user-name':encodeURIComponent('테스트 사용자'),'x-kongboda-firebase-user-name-encoding':'percent-encoded-utf-8'}});
 assert.deepEqual(firebaseIdentity(request),{provider:'google',sub:'firebase-user',email:'verified@example.test',name:'테스트 사용자'});
 assert.equal(platformIdentity(request),null);
});
