import {test} from 'node:test';
import assert from 'node:assert/strict';
import {websiteRoute} from '../worker/website.js';
import {weekBounds} from '../worker/race-features.js';
import {ANSWER_POLICY} from '../worker/answer-policy.js';
import {demoCases} from '../worker/analysis-demo.js';

test('Dakar and Macau appear in their event weeks with plain identity labels, without analysis support',async()=>{
 const data=await websiteRoute(new Request('https://test/api/race-calendar')).json();
 for(const [series,date] of [['dakar','2027-01-09T12:00:00'],['macau','2026-11-22T12:00:00']]){
  const events=data.events.filter(e=>e.series===series);assert.equal(events.length,1);
  const e=events[0],week=weekBounds(new Date(date));
  assert.ok(new Date(e.start+'T12:00:00')<week.end&&new Date(e.end+'T12:00:00')>=week.start);
  assert.equal(data.supported.includes(series),false);
  const label=websiteRoute(new Request('https://test/assets/schedule/'+series));assert.equal(label.status,200);assert.match(label.headers.get('content-type'),/^image\/svg\+xml/);assert.match(await label.text(),/<text\b/);
 }
 const dakar=data.events.find(e=>e.series==='dakar');assert.equal(dakar.start,'2027-01-09');assert.equal(dakar.end,'2027-01-23');assert.equal(dakar.raceStart,undefined);
});
test('Giorgio Piola is discoverable and technical interpretation remains separate from official evidence',async()=>{
 const html=await websiteRoute(new Request('https://test/resources')).text();
 assert.match(html,/Giorgio Piola/);assert.match(html,/giorgiopiola\.com/);
 assert.match(ANSWER_POLICY,/Giorgio Piola/);assert.match(ANSWER_POLICY,/도해에서 확인되는 형상/);assert.match(ANSWER_POLICY,/무단 재배포하지 않는다/);
});
test('official F1 Unlocked membership is linked without claiming all timing is free',async()=>{
 const html=await websiteRoute(new Request('https://test/resources')).text();
 assert.match(html,/https:\/\/www\.formula1\.com\/en\/page\/unlocked/);
 assert.match(html,/공식 무료 팬 멤버십/);assert.match(html,/유료 구독/);
});
test('homepage keeps at least fifteen distinct example questions',()=>{
 assert.ok(demoCases.length>=15,`expected at least 15 examples, got ${demoCases.length}`);
 const questions=demoCases.map(example=>example.questionKo?.trim()).filter(Boolean);
 assert.equal(questions.length,demoCases.length);
 assert.equal(new Set(questions).size,questions.length);
});
