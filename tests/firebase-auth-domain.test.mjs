import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {firebaseAuthDomain} from '../worker/firebase-auth-domain.js';

const env={FIREBASE_WEB_AUTH_DOMAIN:'kongboda-motorsports-2026.firebaseapp.com'};

test('first-party auth handler stays off until the OAuth redirect URI is registered', () => {
 assert.equal(firebaseAuthDomain(env,'kongboda-motorsports.vercel.app'),env.FIREBASE_WEB_AUTH_DOMAIN);
});

test('other hosts keep the configured firebaseapp.com domain', () => {
 assert.equal(firebaseAuthDomain(env,'kongboda-motorsports-git-x.vercel.app'),env.FIREBASE_WEB_AUTH_DOMAIN);
 assert.equal(firebaseAuthDomain(env,''),env.FIREBASE_WEB_AUTH_DOMAIN);
 assert.equal(firebaseAuthDomain({...env,FIREBASE_AUTH_PROXY_HOSTS:'Example.com'},'example.com'),'example.com');
});

test('vercel proxies /__/auth before the app catch-all', () => {
 const {rewrites}=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(rewrites[0].source,'/__/auth/:path*');
 assert.match(rewrites[0].destination,/^https:\/\/kongboda-motorsports-2026\.firebaseapp\.com\/__\/auth\//);
});

test('login script detects in-app browsers and keeps redirect first-party only', async () => {
 const {googleLoginScript,IN_APP_PATTERN}=await import('../worker/google-login-script.js');
 for(const ua of ['Mozilla/5.0 (iPhone) KAKAOTALK 10.0','Mozilla/5.0 (iPhone) Instagram 300','Mozilla/5.0 (Linux; Android 14; wv) Chrome/120','Mozilla/5.0 (iPhone) NAVER(inapp; search)','Line/14.0'])assert.ok(IN_APP_PATTERN.test(ua),ua);
 for(const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1','Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36','Mozilla/5.0 (Windows NT 10.0) Firefox/130.0','SamsungBrowser/25.0'])assert.ok(!IN_APP_PATTERN.test(ua),ua);
 const script=googleLoginScript('{}');
 assert.match(script,/firstParty=d\.config\.authDomain===location\.host/);
 assert.match(script,/if\(firstParty&&REDIRECT_CODES/);
 assert.match(script,/kakaotalk:\/\/web\/openExternal/);
});
