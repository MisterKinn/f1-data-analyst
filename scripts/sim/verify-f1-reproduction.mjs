// Read-only exact historical F1 audit on the same dry rows retained by the fit.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [folder='.',output='.cache/f1-reproduction.json']=process.argv.slice(2),root=resolve(folder);
const load=p=>import(pathToFileURL(join(root,p)));
const {lapsimCalibration:c}=await load('worker/lapsim/calibration-data.js');
const {lapsimF1Poles:p}=await load('worker/lapsim/f1-poles-data.js');
const {simulate}=await load('worker/lapsim/tool.js');
const rows=[],excluded=[];
for(const year of [2025,2026]){
 const errors=[];
 for(const [track,t]of Object.entries(c.seasons[year].tracks)){
  if(t.weather?.rain){excluded.push({year,track,reason:'rain-marked row'});continue;}
  const real=p[track]?.[year]?.lap??(t.position===1?t.realLap:null);if(real==null)continue;
  const sim=simulate({track,car:String(year),conditions:'real'}).result.lap_seconds;
  errors.push({track,realSec:real,simSec:sim,errorSec:sim-real});
 }
 rows.push({year,n:errors.length,maxAbsErrorSec:Math.max(...errors.map(e=>Math.abs(e.errorSec))),errors});
}
const result={pass:rows.every(r=>r.n>0&&r.maxAbsErrorSec===0),n:rows.reduce((s,r)=>s+r.n,0),maxAbsErrorSec:Math.max(...rows.map(r=>r.maxAbsErrorSec)),rows,excluded,productionFilesWritten:false};
await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n');assert.ok(result.pass,'Raced-session reproduction failed');console.log(JSON.stringify({pass:result.pass,n:result.n,maxAbsErrorSec:result.maxAbsErrorSec}));
