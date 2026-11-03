import assert from 'node:assert/strict';
import {researchLookup,pitScenario,buildResearchContext} from '../worker/research.js';
import {liveRead} from '../worker/live.js';
import worker from '../worker/index.js';
import catalog from '../knowledge/research-catalog.json' with {type:'json'};
const all=researchLookup({limit:10});
assert.equal(all.total,19); assert.equal(all.papers.length,10);assert.equal(all.next_offset,10);
const approvedCards=[];for(let offset=0;offset!==null;){const r=researchLookup({offset,limit:10});approvedCards.push(...r.papers);offset=r.next_offset;}
for(const p of approvedCards){assert.equal(p.license,'CC-BY-4.0');assert.ok(p.authors&&p.doi&&p.source_locator&&p.license_evidence_url&&p.adaptation_notice);assert.ok(p.limitations);}
assert.deepEqual(catalog.counts,{reviewed:19,candidates:4,held:12});
assert.equal(new Set([...catalog.papers,...catalog.candidates,...catalog.held].map(p=>p.id)).size,35);
for(const id of ['C01','C04','C07','K10','K11','K12','K13','K14','K15']){
 const p=researchLookup({paper_id:id}).papers[0];assert.equal(p.id,id);assert.equal(p.execution_status,'explanatory_reference_not_executed');
 assert.equal(researchLookup({paper_id:id,include_pending:true}).pending.length,0);
}
assert.equal(researchLookup({paper_id:'C07'}).papers[0].url,'https://arxiv.org/abs/2512.07847v3');
assert.match(researchLookup({paper_id:'C07'}).papers[0].limitations,/CC BY-NC/);
assert.match(researchLookup({paper_id:'C04'}).papers[0].limitations,/시간 오차 불일치/);
assert.equal(researchLookup({paper_id:'R01'}).papers.length,0);
const pending=researchLookup({include_pending:true}).pending;
assert.equal(pending.length,16);assert.ok(pending.every(p=>p.eligible_for_analysis===false&&!p.summary));
for(const id of ['C03','C05','C06','C08','R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12']){
 assert.equal(researchLookup({paper_id:id}).total,0);
 const p=researchLookup({paper_id:id,include_pending:true}).pending[0];assert.equal(p.id,id);assert.equal(p.eligible_for_analysis,false);
}
assert.ok(researchLookup({query:'타이어',limit:10}).papers.some(p=>p.id==='K04'));
assert.ok(researchLookup({topic:'aerodynamics'}).papers.every(p=>['K01','K02','K09','C07','K13','K14'].includes(p.id)));
assert.ok(researchLookup({topic:'aerodynamics'}).papers.some(p=>p.id==='C07'));
assert.ok(researchLookup({topic:'energy',limit:10}).papers.some(p=>p.id==='C01'));
assert.ok(researchLookup({query:'Formula E',limit:10}).papers.some(p=>p.id==='C04'));
assert.equal(researchLookup({paper_id:'C02'}).papers[0].execution_status,'equations_6_to_9_scenario_only');
assert.equal(researchLookup({query:'no matching paper'}).total,0);
assert.throws(()=>researchLookup({query:'x'.repeat(201)}));assert.throws(()=>researchLookup({limit:11}));
const paged=[];for(let offset=0;offset!==null;){const r=researchLookup({offset,limit:3});paged.push(...r.papers.map(p=>p.id));offset=r.next_offset;}assert.equal(new Set(paged).size,19);
const a={remaining_laps:10,current_age:10,next_age:0,current_offset_seconds:0,current_slope_seconds_per_lap:0.1,next_offset_seconds:0,next_slope_seconds_per_lap:0.1,pit_loss_seconds:20,warmup_loss_seconds:2,coefficient_basis:'Synthetic explicit example, not live measurements',input_kind:'explicit_scenario_assumptions'};
const result=pitScenario(a);
assert.equal(result.stay_modeled_loss_seconds,15.5);assert.equal(result.pit_modeled_loss_seconds,27.5);assert.equal(result.pit_minus_stay_seconds,12);
assert.equal(result.kind,'conditional_scenario_not_live_forecast');assert.equal(result.citation.id,'C02');
for(const age of [0,3,50])for(const n of [1,2,19]){
 const r=pitScenario({...a,remaining_laps:n,current_age:age});
 const loop=Array.from({length:n},(_,i)=>(age+i+1)*0.1).reduce((x,y)=>x+y,0);
 assert.ok(Math.abs(r.stay_modeled_loss_seconds-loop)<1e-9);
}
assert.equal(pitScenario({...a,current_slope_seconds_per_lap:0,next_slope_seconds_per_lap:0}).pit_minus_stay_seconds,22);
assert.throws(()=>pitScenario({...a,coefficient_basis:''}));assert.throws(()=>pitScenario({...a,remaining_laps:1.5}));assert.throws(()=>pitScenario({...a,pit_loss_seconds:NaN}));assert.throws(()=>pitScenario({...a,next_age:undefined}));
const now=Date.now(), iso=new Date(now).toISOString();
const topicTimes=Object.fromEntries(['Heartbeat','TimingData','TimingAppData','WeatherData','TrackStatus','RaceControlMessages'].map(t=>[t,{received_at:iso,source_time:iso,initial_snapshot:false}]));
const snapshot={generated_at:iso,connected:true,last_message_at:iso,topics:{Heartbeat:{},SessionInfo:{Key:123,Name:'TEST'},SessionStatus:{Status:'Started'},TimingData:{Lines:{}},TimingAppData:{Lines:{}},WeatherData:{},TrackStatus:{Status:'1'},RaceControlMessages:{}},topic_times:topicTimes,recent_events:[]};
const ctx=buildResearchContext(snapshot,{live:true},now);
assert.equal(ctx.mode,'conditional_interpretation');assert.equal(ctx.causal_conclusions.length,0);assert.ok(ctx.methods.every(m=>m.application_status==='check_lap_and_field_alignment'));
assert.ok(ctx.citations.every(c=>!c.id.startsWith('R')));
for(const altered of [
 {...snapshot,topic_times:{}},
 {...snapshot,topic_times:{...topicTimes,TimingData:{received_at:iso,initial_snapshot:true}}},
 {...snapshot,topic_times:{...topicTimes,TimingData:{received_at:new Date(now-60000).toISOString(),initial_snapshot:false}}},
 {...snapshot,topic_times:{...topicTimes,TimingData:{received_at:new Date(now+60000).toISOString(),initial_snapshot:false}}},
 {...snapshot,topic_times:{...topicTimes,TimingData:{received_at:'bad',initial_snapshot:false}}}
])assert.equal(buildResearchContext(altered,{live:true},now).methods[0].application_status,'needs_topic_or_field_verification');
for(const fresh of [{live:false},null])assert.ok(buildResearchContext(snapshot,fresh,now).methods.every(m=>m.application_status==='blocked_for_current_claims'));
const stored={received_at:iso,snapshot};
const env={BUCKET:{get:async()=>({json:async()=>structuredClone(stored)})}};
assert.equal((await liveRead(env,{recent_events:0})).research_context.mode,'conditional_interpretation');
stored.snapshot.connected=false;
assert.equal((await liveRead(env)).research_context.mode,'reference_only_not_current');
const rpc=(name,args={},auth=true)=>new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json',...(auth?{'oai-authenticated-user-id':'owner'}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
const blocked=await worker.fetch(rpc('research_lookup',{},false),{});assert.equal(blocked.status,200);const challenge=await blocked.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
let r=await(await worker.fetch(rpc('research_lookup',{paper_id:'K04'}),{})).json();assert.equal(JSON.parse(r.result.content[0].text).papers[0].id,'K04');
r=await(await worker.fetch(rpc('research_pit_scenario',a),{})).json();assert.equal(JSON.parse(r.result.content[0].text).pit_minus_stay_seconds,12);
r=await(await worker.fetch(rpc('research_pit_scenario',{...a,unknown:1}),{})).json();assert.equal(r.error.code,-32602);
r=await(await worker.fetch(rpc('research_lookup',{query:'x'.repeat(201)}),{})).json();assert.equal(r.result.isError,true);
console.log('PASS: research provenance, held-source exclusion, lookup, linear scenario arithmetic, freshness, live integration and authenticated MCP');
