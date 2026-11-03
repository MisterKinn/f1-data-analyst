const key='mcp/tool-catalog-v1.json';
export async function publishCatalog(env,tools){
 const version=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(tools)))),n=>n.toString(16).padStart(2,'0')).join('');
 if(env.BUCKET){const old=await env.BUCKET.get(key);const value=old?await old.json():null;if(value?.version!==version)await env.BUCKET.put(key,JSON.stringify({version,updatedAt:Date.now()}));}
 return version;
}
export function catalogStream(request,env,{interval=15000,lifetime=60000}={}){
 const encoder=new TextEncoder();let timer,deadline,closed=false;
 const stream=new ReadableStream({async start(controller){
  const close=()=>{if(closed)return;closed=true;clearInterval(timer);clearTimeout(deadline);controller.close();};
  const send=value=>{if(!closed)controller.enqueue(encoder.encode(value));};
  let initial;try{const o=await env.BUCKET?.get(key);initial=o?(await o.json()).version:null;}catch{close();return;}
  send(': MCP tool catalog notifications\nretry: 3000\n\n');
  let checking=false;
  timer=setInterval(async()=>{if(checking||closed)return;checking=true;try{
   const o=await env.BUCKET?.get(key),current=o?(await o.json()).version:null;
   if(initial&&current&&initial!==current){send('data: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/tools/list_changed'})+'\n\n');close();}
   else {if(!initial)initial=current;send(': keepalive\n\n');}
  }catch{close();}finally{checking=false;}},interval);
  deadline=setTimeout(close,lifetime);request.signal.addEventListener('abort',close,{once:true});if(request.signal.aborted)close();
 },cancel(){closed=true;clearInterval(timer);clearTimeout(deadline);}});
 return new Response(stream,{headers:{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
