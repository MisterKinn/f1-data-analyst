import test from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTOR_SETUP_TOOLS,collectorSetupGuide,collectorSetupCall,collectorKitRoute} from '../worker/collector-setup.js';

test('install helper tool is read-only and asks for the OS when unknown',()=>{
 const [tool]=COLLECTOR_SETUP_TOOLS;assert.equal(tool.name,'kongboda_collector_setup');assert.equal(tool.annotations.readOnlyHint,true);
 const g=collectorSetupGuide();assert.ok(g.ask);assert.match(g.windows_kit,/\/download\/kongboda-collector-setup\.zip$/);
});
test('windows and mac guides give steps, commands and never handle passwords',()=>{
 const w=collectorSetupGuide('windows','install');assert.ok(w.steps.length>=4);assert.match(w.commands.install,/collector-kit\.ps1/);assert.match(w.for_assistants_with_computer_control,/user type the F1/);
 const m=collectorSetupGuide('mac','remove');assert.match(m.commands.remove,/kit-mac\.sh\)" - uninstall$/);
 for(const g of [w,m])assert.ok(!/password=|F1_PASSWORD/.test(JSON.stringify(g)));
});
test('my collectors are added for a signed-in account',async()=>{
 const store=new Map();const env={BUCKET:{get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v)=>store.set(k,v)}};
 store.set('collector/fleet.json',JSON.stringify({revision:1,hosts:[{name:'pc-a',key:'A'.repeat(43),status:'approved',enabled:true,account:{id:'acc-1',name:'민수'}}]}));
 const r=await collectorSetupCall(new Request('https://x/mcp'),env,{os:'windows',action:'check'},{identity:async()=>({account:{id:'acc-1'}})});
 assert.equal(r.structuredContent.my_collectors.length,1);assert.equal(r.structuredContent.my_collectors[0].name,'pc-a');
});
test('kit downloads are served with the right types',async()=>{
 const zip=collectorKitRoute(new Request('https://x/download/kongboda-collector-setup.zip'));
 assert.equal(zip.headers.get('content-type'),'application/zip');const b=new Uint8Array(await zip.arrayBuffer());assert.deepEqual([...b.slice(0,2)],[0x50,0x4b]);
 const ps=collectorKitRoute(new Request('https://x/download/collector-kit.ps1'));const t=new Uint8Array(await ps.arrayBuffer());
 assert.deepEqual([...t.slice(0,3)],[0xef,0xbb,0xbf],'UTF-8 BOM so Windows PowerShell 5.1 reads Korean text');
 assert.equal(collectorKitRoute(new Request('https://x/download/other')),null);
});
