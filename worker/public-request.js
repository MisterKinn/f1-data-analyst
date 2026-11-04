// Public read requests only. The deadline includes reading/parsing the body.
// Cancellation by a newer selection stays distinct from a network timeout.
export async function publicJsonRequest(url,{signal,timeoutMs=30000,...options}={}){
 const controller=new AbortController();
 const cancel=()=>controller.abort(signal.reason);
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),timeoutMs);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  const data=await response.json();
  return {response,data};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
