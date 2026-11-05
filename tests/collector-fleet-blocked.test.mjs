import test from 'node:test';
import assert from 'node:assert/strict';
import {decideBaton,chooseLead,hostBeat,hostBatonGate,BEAT_FRESH_MS} from '../worker/collector-fleet.js';

const W='2026-20-1';
test('baton: a host F1 refuses (403) never publishes or does post-session data while another host is alive',()=>{
 const H=name=>({name,status:'approved'});const hosts=[H('cloud'),H('pc')];const now=Date.parse('2026-11-06T16:00:00Z');
 const at=new Date(now).toISOString();
 const beats={cloud:{f1:{at,window:W,ready:false,f1_blocked:true},_:{at,f1_blocked:true}},pc:{f1:{at,window:W,ready:false},_:{at}}};
 // Nobody receives yet: the unblocked PC holds the baton even though the cloud server is rank 1.
 let r=decideBaton(hosts,beats,'f1',W,null,{now});assert.equal(r.holder,'pc');
 assert.equal(chooseLead(hosts,beats,now),'pc');
 // The cloud server alone: still used as the last resort.
 r=decideBaton([H('cloud')],beats,'f1',W,null,{now});assert.equal(r.holder,'cloud');
 assert.equal(chooseLead([H('cloud')],beats,now),'cloud');
 // Not blocked: rank 1 (cloud) is first again.
 const ok={cloud:{f1:{at,window:W,ready:false},_:{at}},pc:beats.pc};
 assert.equal(decideBaton(hosts,ok,'f1',W,null,{now}).holder,'cloud');assert.equal(chooseLead(hosts,ok,now),'cloud');
 // A host flagged blocked that does receive data counts as working.
 const recv={cloud:{f1:{at,window:W,ready:true,f1_blocked:true}},pc:beats.pc};
 assert.equal(decideBaton(hosts,recv,'f1',W,null,{now}).holder,'cloud');
});

// Whole-session rehearsal through the real heartbeat endpoint (memory bucket):
// Google Cloud is rank 1, the owner's PC rank 2, both record (warm 2), one publishes.
function bucketEnv(){
 const store=new Map();
 const key=c=>c.repeat(43);
 store.set('collector/fleet.json',JSON.stringify({revision:1,hosts:[{name:'kongboda-gcp',key:key('g'),status:'approved',enabled:true},{name:'desktop-568ditg',key:key('p'),status:'approved',enabled:true,builtin:true}]}));
 return {store,env:{BUCKET:{get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v)=>{store.set(k,typeof v==='string'?v:JSON.stringify(v));},delete:async k=>{store.delete(k);}}}};
}
const GCP='kongboda-gcp',PC='desktop-568ditg';
async function beat(env,name,now,extra={}){const [status,data]=await hostBeat(env,name,JSON.stringify({series:'f1',window:W,recording:true,...extra}),now);assert.equal(status,200);return data;}

test('rehearsal: Google Cloud blocked mid-session hands the baton to the PC at once, and back only if the PC fails',async()=>{
 const {env}=bucketEnv();let now=Date.parse('2026-11-08T16:15:00Z');
 // T-45 min: both connect, nobody receives yet -> rank 1 (cloud) holds, both record.
 await beat(env,PC,now,{ready:false});let g=await beat(env,GCP,now,{ready:false});
 assert.equal(g.holder,GCP);assert.equal(g.warm,true);
 let p=await beat(env,PC,now,{ready:false});assert.equal(p.warm,true,'the PC records as the spare from the start');
 // Both receive: cloud keeps publishing; the PC's uploads are refused (409 gate).
 // (The first host to receive takes the baton; here the cloud receives first.)
 now+=5000;g=await beat(env,GCP,now,{ready:true});await beat(env,PC,now,{ready:true});
 assert.equal(g.active,true);assert.equal(await hostBatonGate(env,GCP,'f1',W),null);
 assert.equal((await hostBatonGate(env,PC,'f1',W))?.standby,true);
 // Mid-session F1 starts refusing Google (403 on reconnect): its feed stops, beats go on.
 now+=5000;g=await beat(env,GCP,now,{ready:false,f1_blocked:true});
 assert.equal(g.holder,PC,'the spare PC takes over on the very next beat');
 assert.equal(await hostBatonGate(env,PC,'f1',W),null,'the PC may upload now');
 assert.equal((await hostBatonGate(env,GCP,'f1',W))?.standby,true,'cloud uploads are refused');
 // Cloud recovers: the PC keeps the baton (no ping-pong while it receives).
 now+=5000;await beat(env,PC,now,{ready:true});g=await beat(env,GCP,now,{ready:true});
 assert.equal(g.holder,PC);
 // The PC then dies (power cut): after BEAT_FRESH_MS the receiving cloud server takes over.
 now+=BEAT_FRESH_MS+1000;g=await beat(env,GCP,now,{ready:true});
 assert.equal(g.holder,GCP);
 // The PC comes back: it records as a spare again but does not take the baton back this session.
 now+=5000;p=await beat(env,PC,now,{ready:true});assert.equal(p.holder,GCP);assert.equal(p.retired,true);assert.equal(p.warm,true);
});

test('rehearsal: Google Cloud blocked before the session never holds the baton; post-session data goes to the PC',async()=>{
 const {env}=bucketEnv();let now=Date.parse('2026-11-08T16:15:00Z');
 // Idle beats: cloud reports the block found by its own check.
 await hostBeat(env,GCP,JSON.stringify({window:null,f1_blocked:true}),now);
 const [,idle]=await hostBeat(env,PC,JSON.stringify({window:null}),now);
 assert.equal(idle.lead,PC);assert.equal(idle.is_lead,true);
 // Session: cloud beats first but is blocked, so the PC holds from the first beat.
 let g=await beat(env,GCP,now,{ready:false,f1_blocked:true});assert.equal(g.holder,GCP,'PC not on yet: the blocked cloud is the last resort');
 await beat(env,PC,now,{ready:false});g=await beat(env,GCP,now+1000,{ready:false,f1_blocked:true});
 assert.equal(g.holder,PC);
 now+=5000;await beat(env,PC,now,{ready:true});g=await beat(env,GCP,now,{ready:false,f1_blocked:true});assert.equal(g.holder,PC);
});

test('rehearsal: Google Cloud server crashes mid-session (no more beats) -> PC publishes within 15 s',async()=>{
 const {env}=bucketEnv();let now=Date.parse('2026-11-08T16:15:00Z');
 let g=await beat(env,GCP,now,{ready:true});await beat(env,PC,now,{ready:true});assert.equal(g.holder,GCP);
 now+=BEAT_FRESH_MS-1000;let p=await beat(env,PC,now,{ready:true});assert.equal(p.holder,GCP,'still inside the grace period');
 now+=2000;p=await beat(env,PC,now,{ready:true});assert.equal(p.holder,PC);assert.equal(p.active,true);
});
