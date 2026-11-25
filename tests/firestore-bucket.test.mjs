import assert from 'node:assert/strict';
import test from 'node:test';
import {createFirestoreBucket,FIRESTORE_BUCKET_MAX_BODY_BYTES} from '../server/firestore-bucket.js';

function fakeFirestore(){
 const values=new Map();
 const collection=()=>({
  doc:id=>({get:async()=>({exists:values.has(id),data:()=>values.get(id)}),set:async value=>values.set(id,value),delete:async()=>values.delete(id),id}),
  where(field,op,value){return query().where(field,op,value);}
 });
 const query=(state={prefix:'',after:null,limit:1000})=>({
  where(field,op,value){return query({...state,...(op==='>='?{prefix:value}:{})});},orderBy(){return this;},
  limit(limit){return query({...state,limit});},startAfter(after){return query({...state,after});},
  async get(){const docs=[...values.values()].filter(v=>v.key.startsWith(state.prefix)&&(!state.after||v.key>state.after)).sort((a,b)=>a.key.localeCompare(b.key)).slice(0,state.limit).map(data=>({data:()=>data}));return {docs};}
 });
 return {collection,runTransaction:async fn=>fn({get:target=>target.get(),set:(target,value)=>values.set(target.id,value)}),values};
}

test('Firestore bucket preserves JSON, optimistic writes and prefix pagination',async()=>{
 const db=fakeFirestore(),bucket=createFirestoreBucket(db);
 const first=await bucket.put('accounts/a.json',JSON.stringify({value:1}),{onlyIf:{etagDoesNotMatch:'*'}});assert.ok(first?.etag);
 assert.equal(await bucket.put('accounts/a.json','{}',{onlyIf:{etagDoesNotMatch:'*'}}),null);
 assert.equal((await (await bucket.get('accounts/a.json')).json()).value,1);
 assert.equal(await bucket.put('accounts/a.json','{}',{onlyIf:{etagMatches:'wrong'}}),null);
 assert.ok(await bucket.put('accounts/a.json',JSON.stringify({value:2}),{onlyIf:{etagMatches:first.etag}}));
 await bucket.put('accounts/b.json','{}');await bucket.put('other/c.json','{}');
 const one=await bucket.list({prefix:'accounts/',limit:1});assert.deepEqual(one.objects,[{key:'accounts/a.json'}]);assert.equal(one.truncated,true);assert.ok(one.cursor);
 const two=await bucket.list({prefix:'accounts/',limit:1,cursor:one.cursor});assert.deepEqual(two.objects,[{key:'accounts/b.json'}]);assert.equal(two.truncated,false);
 await bucket.delete('accounts/a.json');assert.equal(await bucket.get('accounts/a.json'),null);
});

test('Firestore bucket rejects oversized values and cross-prefix cursors',async()=>{
 const bucket=createFirestoreBucket(fakeFirestore());
 await assert.rejects(()=>bucket.put('large','x'.repeat(FIRESTORE_BUCKET_MAX_BODY_BYTES+1)),/exceeds/);
 const encoded=Buffer.from('other/key').toString('base64url');await assert.rejects(()=>bucket.list({prefix:'accounts/',cursor:encoded}),/Invalid cursor/);
});

test('Firestore bucket reuses a just-listed document instead of reading it again',async()=>{
 const db=fakeFirestore(),bucket=createFirestoreBucket(db);
 await bucket.put('subs/a.json','{"n":1}');await bucket.put('subs/b.json','{"n":2}');
 let reads=0;const coll=db.collection;db.collection=()=>{const c=coll();return {...c,doc:id=>{const d=c.doc(id);return {...d,get:async()=>{reads++;return d.get();}};}};};
 const fresh=createFirestoreBucket(db),page=await fresh.list({prefix:'subs/'});
 for(const item of page.objects)assert.ok(await fresh.get(item.key));
 assert.equal(reads,0);
 await fresh.put('subs/a.json','{"n":3}');assert.equal((await (await fresh.get('subs/a.json')).json()).n,3);
 await fresh.delete('subs/b.json');assert.equal(await fresh.get('subs/b.json'),null);
});
