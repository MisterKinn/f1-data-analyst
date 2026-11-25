export async function webRequest(req){
 const proto=req.headers['x-forwarded-proto']||'https',host=req.headers['x-forwarded-host']||req.headers.host;
 const incoming=new URL(req.url,`${proto}://${host}`),path=incoming.searchParams.get('__path');
 const url=new URL(path===null?incoming.pathname:`/${path}`,`${proto}://${host}`);for(const [key,value] of incoming.searchParams)if(key!=='__path')url.searchParams.append(key,value);
 const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
 for(const key of [...headers.keys()])if(key.startsWith('oai-authenticated-user-')||key.startsWith('x-kongboda-'))headers.delete(key);
 const init={method:req.method,headers};if(!['GET','HEAD'].includes(req.method)){const chunks=[];for await(const chunk of req)chunks.push(chunk);init.body=Buffer.concat(chunks);init.duplex='half';}
 return new Request(url,init);
}

export async function send(response,res){res.statusCode=response.status;for(const [key,value] of response.headers){if(key==='set-cookie'&&response.headers.getSetCookie)continue;res.setHeader(key,value);}if(response.headers.getSetCookie){const values=response.headers.getSetCookie();if(values.length)res.setHeader('set-cookie',values);}if(!response.body){res.end();return;}
 // Stream the body so MCP SSE comments and keepalives reach the client immediately instead of after the stream closes.
 res.flushHeaders?.();const reader=response.body.getReader();let gone=false;const stop=()=>{gone=true;reader.cancel().catch(()=>{});};res.once?.('close',stop);
 try{for(;;){const {done,value}=await reader.read();if(done||gone)break;if(!res.write(Buffer.from(value)))await new Promise(resolve=>{res.once('drain',resolve);res.once('close',resolve);});}}
 catch{stop();}finally{res.off?.('close',stop);if(!res.writableEnded)res.end();}}
