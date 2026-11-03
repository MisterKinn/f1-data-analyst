import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cert,deleteApp,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {FIRESTORE_BUCKET_MAX_BODY_BYTES} from '../server/firestore-bucket.js';

const EXCLUDED_PREFIXES=[
 'website-auth/google/flow/',
 'website-auth/google/session/',
 'website-accounts/mcp-token/',
 'crew-events/pending/'
];
const digest=value=>createHash('sha256').update(value).digest('hex');
const excludedReason=key=>{
 if(key.startsWith('website-auth/google/flow/'))return 'expired OAuth flow';
 if(key.startsWith('website-auth/google/session/'))return 'old-domain session';
 if(key.startsWith('website-accounts/mcp-token/'))return 'redacted token index';
 if(key.startsWith('crew-events/pending/'))return 'old pending notification';
 return null;
};

export function parseR2Export(text){
 const lines=text.trimEnd()?text.trimEnd().split('\n'):[],seen=new Set(),included=[],excluded=[];
 for(let index=0;index<lines.length;index++){
  let record;try{record=JSON.parse(lines[index]);}catch{throw new Error(`Invalid JSON on line ${index+1}`);}
  if(typeof record.key!=='string'||!record.key)throw new Error(`Missing key on line ${index+1}`);
  if(seen.has(record.key))throw new Error(`Duplicate key: ${record.key}`);seen.add(record.key);
  if(record.encoding!=='base64'||typeof record.data!=='string')throw new Error(`Unsupported encoding: ${record.key}`);
  const body=Buffer.from(record.data,'base64');
  if(body.length!==record.exported_size)throw new Error(`Exported size mismatch: ${record.key}`);
  if(digest(body)!==record.exported_sha256)throw new Error(`Exported hash mismatch: ${record.key}`);
  if(body.length>FIRESTORE_BUCKET_MAX_BODY_BYTES)throw new Error(`Object exceeds Firestore limit: ${record.key}`);
  try{JSON.parse(body.toString('utf8'));}catch{throw new Error(`Object is not JSON: ${record.key}`);}
  const reason=excludedReason(record.key),item={record,body,reason};
  if(reason)excluded.push(item);else included.push(item);
 }
 return {total:lines.length,included,excluded,excludedPrefixes:EXCLUDED_PREFIXES};
}

function args(values){
 const result={apply:false};
 for(let i=0;i<values.length;i++){
  const value=values[i];
  if(value==='--apply')result.apply=true;
  else if(value==='--input'||value==='--service-account'||value==='--collection')result[value.slice(2).replace('-','_')]=values[++i];
  else throw new Error(`Unknown argument: ${value}`);
 }
 if(!result.input)throw new Error('--input is required');
 if(result.apply&&!result.service_account)throw new Error('--service-account is required with --apply');
 return result;
}

async function main(){
 const options=args(process.argv.slice(2)),text=await readFile(resolve(options.input),'utf8'),plan=parseR2Export(text);
 const excludedByReason={};for(const item of plan.excluded)excludedByReason[item.reason]=(excludedByReason[item.reason]||0)+1;
 const summary={mode:options.apply?'apply':'dry-run',sourceObjects:plan.total,importObjects:plan.included.length,excludedObjects:plan.excluded.length,excludedByReason,importBytes:plan.included.reduce((sum,item)=>sum+item.body.length,0)};
 if(!options.apply){console.log(JSON.stringify(summary,null,2));return;}
 const service=JSON.parse(await readFile(resolve(options.service_account),'utf8'));
 if(service.type!=='service_account'||typeof service.project_id!=='string'||!service.project_id)throw new Error('Invalid Firebase service account');
 const app=initializeApp({credential:cert(service),projectId:service.project_id},`r2-import-${Date.now()}`),db=getFirestore(app),collection=options.collection||'objectStore',store=db.collection(collection);
 try{
  const existing=await store.limit(1).get();if(!existing.empty)throw new Error(`Target collection ${collection} is not empty`);
  const batch=db.batch();
  for(const {record,body} of plan.included){
   const uploaded=Date.parse(record.uploaded);
   batch.set(store.doc(digest(record.key)),{key:record.key,body:body.toString('utf8'),contentType:record.contentType||'application/json; charset=utf-8',etag:record.etag,updatedAt:Number.isFinite(uploaded)?uploaded:Date.now(),migration:{source:'chatgpt-sites-r2',sourceSize:record.size,sourceExportedSize:record.exported_size,sourceExactOriginal:record.exact_original,sourceSha256:record.exported_sha256}});
  }
  await batch.commit();
  const refs=plan.included.map(({record})=>store.doc(digest(record.key))),snapshots=await db.getAll(...refs);
  let verified=0;
  for(let i=0;i<snapshots.length;i++){
   const data=snapshots[i].data(),source=plan.included[i];
   if(!snapshots[i].exists||data.key!==source.record.key||digest(Buffer.from(data.body,'utf8'))!==source.record.exported_sha256||data.etag!==source.record.etag)throw new Error(`Verification failed: ${source.record.key}`);
   verified++;
  }
  console.log(JSON.stringify({...summary,projectId:service.project_id,collection,verifiedObjects:verified},null,2));
 }finally{await deleteApp(app);}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
