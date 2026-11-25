// Synthetic storage latency; no credentials, production data or network requests.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const baseline=process.argv[2];if(!baseline)throw Error('Usage: node scripts/benchmark-public-cache.mjs BASELINE_ROOT');
for(const [label,root] of [['baseline',baseline],['candidate',process.cwd()]]){
 const {cachedPublished}=await import(pathToFileURL(resolve(root,'worker/published-cache.js')));
 for(const scenario of ['warm','burst']){
  let reads=0,writes=0,loads=0;const data=new Map();
  const env={BUCKET:{async get(key){reads++;await new Promise(r=>setTimeout(r,5));const value=data.get(key);return value?{json:async()=>JSON.parse(value)}:null;},async put(key,value){writes++;data.set(key,value);}}};
  const run=()=>cachedPublished(env,'benchmark',async()=>{loads++;return {rows:[{position:1,lap:90}]};});
  if(scenario==='warm'){await run();reads=0;writes=0;loads=0;}
  const started=performance.now(),cpu=process.cpuUsage();
  if(scenario==='warm')for(let i=0;i<100;i++)await run();else await Promise.all(Array.from({length:20},run));
  const used=process.cpuUsage(cpu);
  console.log(JSON.stringify({label,scenario,reads,writes,loads,wall_ms:+(performance.now()-started).toFixed(2),cpu_ms:+((used.user+used.system)/1000).toFixed(2)}));
 }
}
