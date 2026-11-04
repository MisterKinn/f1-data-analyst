import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translateText,translateHtml} from '../worker/localization.js';
import {websiteRoute} from '../worker/website.js';

test('localisation never substitutes UI words inside names, records or unknown prose',()=>{
 for(const text of ['김팀장','순위 이후에 다시 물어볼게요','레이스 좋아하는 사람','팀코리아','https://example.test/순위?팀=레이스'])assert.equal(translateText(text),text);
 assert.equal(translateText('팀'),'Teams');
 assert.equal(translateText('  계정 연결\n'),'  Account connections\n');
 assert.equal(translateText('toString'), 'toString');
});

test('HTML translation protects code, user text and record subtrees',()=>{
 const html='<html lang="ko"><title>홈 · 꽁보다 모터스포츠</title><script>const name="팀";if(1<2)console.log("계정");</script><style>.팀{color:red}</style><textarea>계정 연결</textarea><p data-no-translate><b title="팀">팀</b></p><p translate="no">계정</p><p>계정 연결</p></html>';
 const result=translateHtml(html,'en');
 assert.match(result,/<html lang="en">/);
 assert.match(result,/<title>Home · KONGBODA MOTORSPORTS<\/title>/);
 assert.ok(result.includes('<script>const name="팀";if(1<2)console.log("계정");</script>'));
 assert.ok(result.includes('<style>.팀{color:red}</style>'));
 assert.ok(result.includes('<textarea>계정 연결</textarea>'));
 assert.ok(result.includes('<p data-no-translate><b title="팀">팀</b></p>'));
 assert.ok(result.includes('<p translate="no">계정</p>'));
 assert.ok(result.includes('<p>Account connections</p>'));
 assert.equal(translateHtml(html,'ko'),html);
 const script='<script>const template=\'<html lang="ko"><img src="/assets/brand-mark.svg">\';</script>';
 assert.equal(translateHtml(script,'en'),script);
});

test('English resources and first-use instructions have complete authored translations',async()=>{
 const request=path=>new Request('https://example.test'+path,{headers:{cookie:'kongboda_lang=en'}});
 const resources=await websiteRoute(request('/resources')).text();
 const body=resources.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g,'').replace(/<[^>]*>/g,'');
 assert.equal(/[가-힣]/.test(body.replaceAll('한국어','')),false);
 const guide=await websiteRoute(request('/guide')).text();
 const beforeExamples=guide.split('<div id="kb-recorded"')[0].replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g,'').replace(/<[^>]*>/g,'');
 assert.equal(/[가-힣]/.test(beforeExamples.replaceAll('한국어','')),false);
 assert.ok(guide.includes('Each card is a snapshot from the time it was requested.'));
 assert.ok(guide.includes('Actual Claude connectivity and interactive card rendering still require verification.'));
});

test('English account interface preserves names and explains the exact deletion confirmation',async()=>{
 const request=new Request('https://example.test/account',{headers:{cookie:'kongboda_lang=en'}});
 const identity={google:{name:'김팀장',email:'synthetic@example.invalid',sub:'synthetic'},accountInfo:{account:{id:'synthetic',name:'김팀장',preferences:{},identities:[{provider:'google'}]}}};
 const html=await websiteRoute(request,identity).text();
 assert.ok(html.includes('김팀장'));
 assert.equal(html.includes('김Teams장'),false);
 assert.ok(html.includes('To confirm, enter the Korean word “탈퇴”'));
 assert.ok(html.includes('pattern="탈퇴"'));
 assert.ok(html.includes('Delete Kongboda account'));
 assert.equal(html.includes('Account 연결'),false);
});
