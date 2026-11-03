import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseR2Export} from '../scripts/import-r2-export-to-firestore.mjs';

const record=(key,value)=>{const body=Buffer.from(JSON.stringify(value));return {key,contentType:'application/json',size:body.length,etag:'etag',uploaded:'2026-11-02T00:00:00Z',data:body.toString('base64'),encoding:'base64',redacted_paths:[],exact_original:true,exported_size:body.length,exported_sha256:createHash('sha256').update(body).digest('hex')};};

test('R2 import plan keeps durable objects and excludes transient credentials',()=>{
 const rows=[record('standings/v1/2026/f1/data.json',{data:[]}),record('website-auth/google/session/hash.json',{sub:'old'}),record('website-accounts/mcp-token/hash.json',{accountId:'a'}),record('crew-events/pending/event.json',{eventId:'e'})];
 const plan=parseR2Export(rows.map(value=>JSON.stringify(value)).join('\n'));
 assert.equal(plan.total,4);
 assert.deepEqual(plan.included.map(item=>item.record.key),['standings/v1/2026/f1/data.json']);
 assert.equal(plan.excluded.length,3);
});

test('R2 import plan rejects a modified body hash',()=>{
 const value=record('live/current.json',{ok:true});value.exported_sha256='0'.repeat(64);
 assert.throws(()=>parseR2Export(JSON.stringify(value)),/hash mismatch/);
});
