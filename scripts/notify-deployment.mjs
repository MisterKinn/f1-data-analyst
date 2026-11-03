const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
if(!process.env.SITES_SERVICE_TOKEN)throw Error('Configure the repository Actions secret SITES_SERVICE_TOKEN before enabling deployment.');
async function authentication(){
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience','f1-data-analyst-deploy');
 const r=await fetch(url,{headers:{authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});
 if(!r.ok)throw Error('GitHub OIDC request failed');
 const {value}=await r.json();if(!value)throw Error('GitHub OIDC token missing');
 console.log('::add-mask::'+value);
 // The Sites gateway owns authorization headers. Keep GitHub's short-lived proof
 // in the HTTPS body so gateway rewriting and header logging cannot expose it.
 return {headers:{'OAI-Sites-Authorization':'Bearer '+process.env.SITES_SERVICE_TOKEN,'content-type':'application/json'},body:JSON.stringify({oidc:value})};
}
let response;
for(let attempt=0;attempt<3;attempt++){
 response=await fetch(origin+'/api/deploy-events',{method:'POST',...await authentication(),redirect:'error',signal:AbortSignal.timeout(60000)});
 if(response.ok)break;
 if(response.status<500)throw Error('Deployment event rejected: HTTP '+response.status+' '+await response.text());
 if(attempt<2)await new Promise(r=>setTimeout(r,2000*2**attempt));
}
if(!response.ok)throw Error('Deployment event delivery failed');
console.log('Deployment event accepted for '+process.env.GITHUB_SHA);
// Only await the deployment initiated by THIS event; never poll for repository changes.
for(let attempt=0;attempt<40;attempt++){
 const status=await fetch(origin+'/api/deploy-events/status',{method:'POST',...await authentication(),redirect:'error',signal:AbortSignal.timeout(20000)});
 if(status.ok&&(await status.json()).deployed_sha===process.env.GITHUB_SHA){console.log('Shared plugin deployment verified: '+process.env.GITHUB_SHA);process.exit(0);}
 await new Promise(r=>setTimeout(r,30000));
}
throw Error('Cloud deployment has not completed within 20 minutes. Inspect the ChatGPT event task before retrying.');

