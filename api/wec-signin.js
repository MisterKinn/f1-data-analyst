// FIAWEC+ 연결 sign-in browser (headless Chromium), started by the site itself.
// POST {key, run[, chain, after, started]} with Bearer = HMAC(key, run) (worker/wec_connect.js runnerToken).
// Answers 202 at once and keeps the browser running in the background (waitUntil).
import {timingSafeEqual} from 'node:crypto';
import {waitUntil} from '@vercel/functions';
import {firebaseAdmin} from '../server/firebase-admin.js';
import {createFirestoreBucket} from '../server/firestore-bucket.js';
import {runnerToken} from '../worker/wec_connect.js';
import {runSignIn} from '../server/wec-signin-runner.js';

const KEY=/^(?:operator|[a-zA-Z0-9-]{1,80})$/,RUN=/^[0-9a-f-]{36}$/;
const json=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data));};
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;let s='';for await(const c of req){s+=c;if(s.length>4096)throw Error('too large');}return JSON.parse(s||'{}');}

export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'POST required'});
 let body;try{body=await readBody(req);}catch{return json(res,400,{error:'JSON required'});}
 const {key,run}=body||{};
 if(typeof key!=='string'||!KEY.test(key)||typeof run!=='string'||!RUN.test(run))return json(res,400,{error:'Invalid request'});
 const env={...process.env,APP_ORIGIN:'https://'+(req.headers['x-forwarded-host']||req.headers.host)};
 let expected;try{expected=Buffer.from(await runnerToken(env,key,run));}catch{return json(res,503,{error:'Not configured'});}
 const given=Buffer.from(String(req.headers.authorization||'').replace(/^Bearer /,''));
 if(given.length!==expected.length||!timingSafeEqual(given,expected))return json(res,401,{error:'Unauthorized'});
 env.BUCKET=createFirestoreBucket(firebaseAdmin().firestore);
 const job={key,run,chain:body.chain===true,after:Number.isInteger(body.after)?body.after:0,started:Number.isFinite(body.started)?body.started:Date.now()};
 waitUntil(runSignIn(env,job).catch(e=>console.error('wec-signin failed',e?.name||'error')));
 return json(res,202,{ok:true});
}
