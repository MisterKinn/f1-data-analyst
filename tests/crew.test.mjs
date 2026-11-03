import {test} from 'node:test';import assert from 'node:assert/strict';import {listCrew} from '../worker/crew.js';
test('crew roster is owner-only, excludes deleted members and secrets, and preserves pagination',async()=>{
 let reads=0;const records={a:{name:'선원',email:'crew@example.test',identities:[{sub:'private-sub'}],liveAnalysisAccess:{revision:'1',activatedAt:1}},b:{deleted:true,liveAnalysisAccess:{activatedAt:2}},c:{name:'non-crew'}};
 const env={DEPLOY_OWNER_EMAIL:'owner@example.test',BUCKET:{list:async o=>{reads++;assert.equal(o.prefix,'website-accounts/account/');return {objects:Object.keys(records).map(key=>({key})),truncated:true,cursor:'next'}},get:async key=>({json:async()=>records[key]})}};
 const req=email=>new Request('https://example.test/mcp',{headers:{'oai-authenticated-user-id':'verified','oai-authenticated-user-email':email}});
 await assert.rejects(()=>listCrew(req('crew@example.test'),env));assert.equal(reads,0);
 const result=JSON.parse((await listCrew(req('owner@example.test'),env)).content[0].text);assert.equal(result.crew.length,1);assert.equal(result.next_cursor,'next');assert.equal(result.crew[0].name,'선원');assert.equal(result.crew[0].shared_collector_access,true);assert.ok(!JSON.stringify(result).includes('private-sub'));
});
