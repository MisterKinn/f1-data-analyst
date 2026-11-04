// Reproduces concurrent creation using a local bucket; never contacts an account/server.
import{accountIdentity}from'../worker/accounts.js';
import{writeFile}from'node:fs/promises';
const data=new Map();let reads=0,release;const gate=new Promise(resolve=>{release=resolve;});const env={BUCKET:{get:async k=>{const value=data.get(k);if(k.startsWith('website-accounts/identity/')&&reads<2){reads++;if(reads===2)release();await gate;}return value===undefined?null:{json:async()=>JSON.parse(value)};},put:async(k,v,options={})=>{if(options.onlyIf?.etagDoesNotMatch==='*'&&data.has(k))return null;data.set(k,v);return{etag:'fixture'};},delete:async k=>data.delete(k)}};
const identity={provider:'google',sub:'fixture-only-sub',email:'fixture@example.invalid',name:'Fixture'};
const request=new Request('https://preview.invalid/account');
const results=await Promise.all([accountIdentity(request,env,identity,{create:true}),accountIdentity(request,env,identity,{create:true})]);
const result={scope:'Isolated in-memory mock; no production account touched',sameIdentityProducedDifferentAccounts:results[0].account.id!==results[1].account.id,accountRecords:[...data.keys()].filter(k=>k.startsWith('website-accounts/account/')).length,identityMappings:[...data.keys()].filter(k=>k.startsWith('website-accounts/identity/')).length,disposition:'After atomic identity claim: both requests must reuse the same account. Crew policy is untouched.'};
await writeFile('../verification/account-concurrency.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

if(result.sameIdentityProducedDifferentAccounts||result.accountRecords!==1)process.exitCode=1;
