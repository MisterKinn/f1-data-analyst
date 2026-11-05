// In-memory stand-in for the server object store (same calls as server/firestore-bucket.js).
export function memoryBucket(){
 const data=new Map();let n=0;
 const object=v=>({key:v.key,etag:v.etag,text:async()=>v.body,json:async()=>JSON.parse(v.body)});
 const bucket={
  data,
  async get(key){const v=data.get(key);return v?object(v):null;},
  async put(key,value,options={}){
   const prev=data.get(key),c=options.onlyIf;
   if(c?.etagDoesNotMatch==='*'&&prev)return null;
   if(c?.etagMatches!==undefined&&prev?.etag!==c.etagMatches)return null;
   const v={key,body:typeof value==='string'?value:String(value),etag:'e'+(++n)};data.set(key,v);return {key,etag:v.etag};
  },
  async delete(key){data.delete(key);},
  async list({prefix=''}={}){return {objects:[...data.keys()].filter(k=>k.startsWith(prefix)).sort().map(key=>({key})),truncated:false};},
  async atomic(callback){return callback(bucket);}
 };
 return bucket;
}
