import {test} from 'node:test';import assert from 'node:assert/strict';
import {websiteRoute,championships} from '../worker/website.js';
test('missing display name never exposes email in header and reference-only GTWC is not offered as analysis',async()=>{
 const html=await websiteRoute(new Request('https://kongboda-motorsports.jeongmin480.chatgpt.site/'),{google:{email:'person+<tag>@example.com'}}).text();
 assert.match(html,/signed-in-name/);assert.match(html,/내 계정/);assert.doesNotMatch(html,/person\+|tag&gt;@example\.com/);
 assert.equal(championships.filter(c=>c.group==='post'&&c.slug.startsWith('gtwc')).length,0);
 assert.doesNotMatch(html,/GT World Challenge 로고/);assert.doesNotMatch(html,/href="\/championships\/gtwc-/);
});
test('verified display names replace header emails; encoded ChatGPT names decode safely',async()=>{
 const url='https://kongboda-motorsports.jeongmin480.chatgpt.site/';
 const google=await websiteRoute(new Request(url),{google:{email:'qa@example.com',name:'민 <김>'}}).text();assert.match(google,/민 &lt;김&gt;/);assert.doesNotMatch(google,/qa@example.com/);
 const chat=await websiteRoute(new Request(url,{headers:{'oai-authenticated-user-id':'u','oai-authenticated-user-email':'qa@example.com','oai-authenticated-user-full-name':encodeURIComponent('정민'),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}})).text();assert.match(chat,/정민/);assert.doesNotMatch(chat,/qa@example.com/);
 const malformed=await websiteRoute(new Request(url,{headers:{'oai-authenticated-user-id':'u','oai-authenticated-user-email':'qa@example.com','oai-authenticated-user-full-name':'%ZZ','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}})).text();assert.match(malformed,/내 계정/);assert.doesNotMatch(malformed,/qa@example.com/);
});
