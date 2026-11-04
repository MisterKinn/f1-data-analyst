// Run by the daily workflow. A 200 response alone is not proof of a refresh.
const origin='https://kongboda-motorsports.vercel.app';
const series=['f1','wec','imsa','formula-e','nls','elms','alms','gtwc-europe','gtwc-asia','gtwc-america','gtwc-australia','wrc','super-taikyu','24h-series','nascar','igtc','british-gt','super-gt','dakar','macau'];
let cursor=0;const failures=[];
await Promise.all(Array.from({length:4},async()=>{while(cursor<series.length){const name=series[cursor++];try{let verified=false;for(let attempt=0;attempt<5;attempt++){if(attempt)await new Promise(resolve=>setTimeout(resolve,10000));const response=await fetch(origin+'/api/race-calendar?series='+name+'&refresh='+Date.now(),{signal:AbortSignal.timeout(45000),headers:{'cache-control':'no-cache'}});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json(),status=data.sourceStatus?.find(s=>s.series===name);if(status?.available&&!status.error&&Date.now()-Date.parse(status.lastVerifiedAt)<6*3600000){verified=true;break;}if(status?.lastAttemptAt&&status.error&&Date.now()-Date.parse(status.lastAttemptAt)<60000)throw Error(status.error);}if(!verified)throw Error('No fresh verified schedule after refresh');console.log(name+': verified');}catch(error){failures.push(name);console.error(name+': '+error.message);}}}));
// Pre-load standings for official-record series so the first visitor of the day
// sees a table instead of "preparing the collector, about 1 minute".
for(const name of ['imsa','formula-e','nls','elms','alms','lemanscup']){
 try{let loaded=false;for(let attempt=0;attempt<12&&!loaded;attempt++){if(attempt)await new Promise(resolve=>setTimeout(resolve,10000));const response=await fetch(origin+'/api/championship-standings?series='+name+'&kind=drivers&category=default',{signal:AbortSignal.timeout(45000)});loaded=response.status===200;}console.log(name+' standings: '+(loaded?'loaded':'still preparing'));}
 catch(error){console.error(name+' standings: '+error.message);}
}
if(failures.length){console.error('Unverified sources: '+failures.join(', '));process.exitCode=1;}
