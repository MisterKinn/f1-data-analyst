// Logical repositories over the existing object store. No data migration or
// collection changes: key/ETag/atomic semantics stay compatible with R2 and Firestore.
const prefixes={accounts:'website-accounts/',diagnostics:'live/diagnostics/',published:'published-cache/'};
const bindings=new WeakMap();
export function storageDomain(bucket,purpose){
 if(!bucket)return bucket;
 const prefix=prefixes[purpose];if(!prefix)throw Error('Unknown storage purpose');
 let stores=bindings.get(bucket);if(!stores){stores=new Map();bindings.set(bucket,stores);}
 if(stores.has(purpose))return stores.get(purpose);
 const check=key=>{if(typeof key!=='string'||!key.startsWith(prefix))throw Error('Storage purpose boundary violation');return key;};
 const store={
  get:key=>bucket.get(check(key)),
  put:(key,value,options)=>bucket.put(check(key),value,options),
  delete:key=>bucket.delete(check(key)),
 };
 // Preserve optional capabilities: callers use their presence to choose legacy
 // migration fallbacks, and minimal/read-only bindings need not implement them.
 for(const method of ['get','put','delete'])if(typeof bucket[method]!=='function')delete store[method];
 if(typeof bucket.list==='function')store.list=(options={})=>bucket.list({...options,prefix:check(options.prefix??prefix)});
 if(bucket.atomic)store.atomic=callback=>bucket.atomic(tx=>callback(storageDomain(tx,purpose)));
 stores.set(purpose,store);bindings.set(store,new Map([[purpose,store]]));
 return store;
}
