import {createHash} from 'node:crypto';

const MAX_BODY_BYTES=850_000;
const enc=value=>Buffer.from(value,'utf8').toString('base64url');
const dec=value=>Buffer.from(value,'base64url').toString('utf8');
const digest=value=>createHash('sha256').update(value).digest('hex');

export function createFirestoreBucket(db,{collection='objectStore'}={}){
 const store=db.collection(collection);
 const ref=key=>store.doc(digest(key));
 const object=data=>({
  key:data.key,etag:data.etag,httpMetadata:{contentType:data.contentType||'application/json; charset=utf-8'},
  text:async()=>data.body,json:async()=>JSON.parse(data.body),arrayBuffer:async()=>{const value=Buffer.from(data.body);return value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);}
 });
 return {
  async get(key){const snap=await ref(key).get();return snap.exists?object(snap.data()):null;},
  async put(key,value,options={}){
   const body=typeof value==='string'?value:Buffer.from(value).toString('utf8');
   if(Buffer.byteLength(body)>MAX_BODY_BYTES)throw new Error(`Firestore object exceeds ${MAX_BODY_BYTES} bytes`);
   const contentType=options.httpMetadata?.contentType||'application/json; charset=utf-8';
   return db.runTransaction(async transaction=>{
    const target=ref(key),snap=await transaction.get(target),current=snap.exists?snap.data():null,condition=options.onlyIf;
    if(condition?.etagMatches!==undefined&&current?.etag!==condition.etagMatches)return null;
    if(condition?.etagDoesNotMatch==='*'&&current)return null;
    if(condition?.etagDoesNotMatch!==undefined&&condition.etagDoesNotMatch!=='*'&&current?.etag===condition.etagDoesNotMatch)return null;
    const etag=digest(`${key}\0${body}\0${Date.now()}\0${Math.random()}`);
    transaction.set(target,{key,body,contentType,etag,updatedAt:Date.now()});
    return {key,etag};
   });
  },
  async delete(key){await ref(key).delete();},
  async list({prefix='',limit=1000,cursor}={}){
   const size=Math.max(1,Math.min(Number(limit)||1000,1000));
   let query=store.where('key','>=',prefix).where('key','<',prefix+'\uf8ff').orderBy('key').limit(size+1);
   if(cursor){const last=dec(cursor);if(!last.startsWith(prefix))throw new Error('Invalid cursor');query=query.startAfter(last);}
   const snap=await query.get(),docs=snap.docs.slice(0,size),truncated=snap.docs.length>size;
   return {objects:docs.map(doc=>({key:doc.data().key})),truncated,cursor:truncated&&docs.length?enc(docs.at(-1).data().key):undefined};
  }
 };
}

export const FIRESTORE_BUCKET_MAX_BODY_BYTES=MAX_BODY_BYTES;
