// Read-only reproduction audit. Historical WEC seasons are selected in memory only.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {splitWecSessions} from './wec-session-scope.mjs';
const [folder='.',output='.cache/wec-reproduction.json',sessionFile='.cache/lapsim/wec.json']=process.argv.slice(2),root=resolve(folder);
const load=p=>import(pathToFileURL(join(root,p)).href);
const {lapsimCalibration:c}=await load('worker/lapsim/calibration-data.js');
const {lapsimWecPoles:P}=await load('worker/lapsim/wec-poles-data.js');
const {simulate}=await load('worker/lapsim/tool.js');
// Use the fit's actual session rows. A stale pole-table weather marker must not
// create a different audit exclusion list.
const fitRows=JSON.parse(await readFile(join(root,sessionFile),'utf8'));
const identity=w=>`${w.cls}/${w.year}/${w.track}`;
const fitByIdentity=new Map(fitRows.map(w=>[identity(w),w]));
assert.equal(fitByIdentity.size,fitRows.length,'Duplicate fit session identity');
const before=JSON.stringify(c),rows=[],excluded=[];
for(const [cls,seasons] of Object.entries(c.series.wec)){
 try{for(const [year,season] of Object.entries(seasons)){
  c.series.wec[cls]={[year]:season};
  const errors=[];
  const sessions=Object.entries(P).flatMap(([track,ys])=>{
   const pole=ys[year]?.[cls];if(!pole)return [];
   const source=fitByIdentity.get(`${cls}/${year}/${track}`);
   assert.ok(source,`STOP: missing fit session for audit ${cls}/${year}/${track}`);
   return [{...pole,track,year:Number(year),cls,weather:source.weather}];
  });
  assert.deepEqual(sessions.map(identity).sort(),fitRows.filter(w=>w.cls===cls&&Number(w.year)===Number(year)).map(identity).sort(),
   `STOP: audit and fit session inventories differ for ${cls}/${year}`);
  const scope=splitWecSessions(sessions);
  excluded.push(...scope.excluded.map(({row, ...exclusion})=>({group:'wec-'+cls+'/'+year,track:row.track,realSec:row.lap,...exclusion})));
  for(const p of scope.dry){
   const {track}=p;
   const r=simulate({track,car:'wec-'+cls,conditions:'real'});
   assert.equal(r.car.year,Number(year));
   const errorSec=r.result.lap_seconds-p.lap;
   errors.push({track,realSec:p.lap,simSec:r.result.lap_seconds,errorSec});
  }
  assert.ok(errors.length>0);
  rows.push({group:'wec-'+cls+'/'+year,n:errors.length,maxAbsErrorSec:Math.max(...errors.map(e=>Math.abs(e.errorSec))),pass:errors.every(e=>e.errorSec===0),
   mode:Number(year)===Math.max(...Object.keys(seasons).map(Number))?'public latest-season selector':'historical season selected in memory; API does not expose a WEC year selector',errors});
 }}finally{c.series.wec[cls]=seasons}
}
assert.equal(JSON.stringify(c),before,'Audit must restore calibration in memory');
const report={pass:rows.every(r=>r.pass),comparison:'exact at public result precision',n:rows.reduce((n,r)=>n+r.n,0),maxAbsErrorSec:Math.max(...rows.map(r=>r.maxAbsErrorSec)),productionFilesWritten:false,rows,excluded};
await writeFile(resolve(output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,groups:rows.map(({errors,...r})=>r)},null,2));
assert.ok(report.pass,'STOP 5.3: raced-session reproduction failed');
