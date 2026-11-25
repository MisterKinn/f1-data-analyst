// Run with Node 22 and a baseline checkout with its dependencies installed.
// Measures warm first-view preparation only, not end-to-end latency or billing.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const baseline=process.argv[2];
if(!baseline)throw Error('Usage: node scripts/benchmark-runtime-cache.mjs <baseline-checkout>');
for(const [label,root] of [['before',baseline],['after',process.cwd()]]){
 const {simulationFirstView}=await import(pathToFileURL(resolve(root,'worker/simulation-cache.js')));
 let fetches=0;
 const options={fetchImpl:async()=>{fetches++;return new Response(null,{status:404});},now:100};
 await simulationFirstView({track:'monza'},'ko',null,options);
 const start=performance.now(),cpu=process.cpuUsage();
 for(let i=0;i<200;i++)await simulationFirstView({track:'monza'},'ko',null,options);
 const used=process.cpuUsage(cpu);
 console.log(JSON.stringify({label,iterations:200,wall_ms:performance.now()-start,cpu_ms:(used.user+used.system)/1000,fetches}));
}
