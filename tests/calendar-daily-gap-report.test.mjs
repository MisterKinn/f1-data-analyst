import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const run=(args,env)=>new Promise(resolve=>execFile(process.execPath,['scripts/refresh-published-calendars.mjs',...args],{env:{...process.env,...env}},(error,stdout,stderr)=>resolve({code:error?.code??0,stdout,stderr})));
const soon=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);

test('the session-gap check runs on its own, so failing source refreshes cannot hide a missing timetable',async()=>{
 const paths=[];let events=[{id:'alms-x',series:'alms',start:soon(2),end:soon(4),sessions:[]}];
 const server=createServer((request,response)=>{paths.push(request.url);response.setHeader('content-type','application/json');response.end(JSON.stringify({events,sourceStatus:[]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const env={CALENDAR_ORIGIN:'http://127.0.0.1:'+server.address().port};
  const gap=await run(['coverage'],env);
  assert.equal(gap.code,1);assert.match(gap.stderr,/Missing session timetable: alms-x/);assert.doesNotMatch(gap.stderr,/Unverified sources/);
  assert.ok(paths.every(path=>!path.includes('series=')),'coverage mode must not wait on source refreshes');
  events=[{id:'alms-x',series:'alms',start:soon(2),end:soon(4),sessions:[{},{}]}];
  const clean=await run(['coverage'],env);assert.equal(clean.code,0);assert.match(clean.stdout,/session coverage: ok/);
 }finally{server.close();}
});

test('the daily workflow reports session gaps in a separate always-run step',async()=>{
 const yml=await readFile('.github/workflows/refresh-calendar.yml','utf8');
 assert.match(yml,/refresh-published-calendars\.mjs refresh\n/);
 assert.match(yml,/if: always\(\)\n\s+run: node scripts\/refresh-published-calendars\.mjs coverage/);
});
