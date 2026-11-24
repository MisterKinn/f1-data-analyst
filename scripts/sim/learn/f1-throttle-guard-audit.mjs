// Step 26 guard audit (central decision 2026-11-24 23:20, report-only, no fit, no re-judge): the plausibility guard of the gate
// (|Δthrottle| > 50 pp between consecutive samples less than 0.05 s apart, as f1-throttle-loto.mjs steps()) applied to the measured 2023-24
// hold-out laps, next to the production and candidate page counts stored in f1-throttle-loto-result.json. Out: scripts/sim/data/f1-throttle-guard-audit.json
import {readFileSync} from 'node:fs';
import {cleanTel} from '../../../worker/lapsim/real-tel-gaps.js';
const H=JSON.parse(readFileSync('scripts/sim/data/f1-pole-tel-2023-2024.json')).laps;
const R=JSON.parse(readFileSync('scripts/sim/data/f1-throttle-loto-result.json'));
const med=a=>{const s=[...a].sort((x,y)=>x-y);return (s[(s.length-1)>>1]+s[s.length>>1])/2;};
const out=[];
for(const u of R.units){const laps=[];
 for(const [y,r] of Object.entries(H[u.track])){const c=cleanTel(r); if(c.share>0.5) continue;
  const x=c.x,v=c.speed.map(s=>s/3.6),th=c.throttle; let g=0,any=0; const dts=[];
  for(let k=1;k<th.length;k++){const dt=(x[k]-x[k-1])/Math.max(1,v[k]); dts.push(dt); const d=Math.abs(th[k]-th[k-1]); if(d>50){any++; if(dt<0.05)g++;}}
  laps.push({y,guard:g,any,dtMed:med(dts),dtMin:Math.min(...dts.filter(d=>d>0)),share05:dts.filter(d=>d<0.05).length/dts.length,n:th.length});}
 out.push({track:u.track,laps,prod:u.plaus.base,cand:u.plaus.cand});}
let G=0,A=0,L=0,P=0,C=0,D=[],S=[];
for(const o of out){for(const l of o.laps){G+=l.guard;A+=l.any;L++;D.push(l.dtMed);S.push(l.share05);} P+=o.prod;C+=o.cand;
 console.log([o.track,o.laps.map(l=>`${l.y}:${l.guard}/${l.any} dt${l.dtMed.toFixed(3)}`).join(' '),o.prod,o.cand].join(' | '));}
console.log({laps:L,tracks:out.length,measGuardPerLap:G/L,measAny50PerLap:A/L,prodPerTrack:P/out.length,candPerTrack:C/out.length,dtMedian:med(D),share_dt_lt_005:med(S)});
import('node:fs').then(fs=>fs.writeFileSync('scripts/sim/data/f1-throttle-guard-audit.json', JSON.stringify({rows: out, summary: {laps:L,tracks:out.length,measGuardPerLap:G/L,measAny50PerLap:A/L,prodPerTrack:P/out.length,candPerTrack:C/out.length,prodTotal:P,candTotal:C,dtMedian:med(D),shareDtBelow005:med(S)}}, null, 1)));
