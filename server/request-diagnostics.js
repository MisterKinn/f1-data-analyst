import {randomUUID} from 'node:crypto';

export function beginRequestMeasurement(){return {at:new Date().toISOString(),wall:performance.now(),cpu:process.cpuUsage()};}
export async function saveRequestMeasurement(bucket,start,commit){
 const elapsed=performance.now()-start.wall,cpu=process.cpuUsage(start.cpu);
 const record={version:1,at:start.at,wall_ms:elapsed,process_cpu_user_ms:cpu.user/1000,process_cpu_system_ms:cpu.system/1000,
  process_cpu_percent_one_core:elapsed>0?(cpu.user+cpu.system)/1000/elapsed*100:null,rss_bytes:process.memoryUsage().rss,
  commit_sha:/^[a-f0-9]{40}$/i.test(commit??'')?commit:null,
  scope:'Vercel process during a live/MCP request; concurrent requests may share this process. Not host CPU saturation or a separate collector measurement.'};
 await bucket.put(`live/diagnostics/vercel/${start.at.slice(0,10)}/${randomUUID()}.json`,JSON.stringify(record));
 return record;
}
