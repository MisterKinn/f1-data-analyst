import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readAppResource,LIVE_APP_URI} from '../worker/mcp-app.js';

function mount(toolOutput){
 const elements=new Map();
 const el=()=>({textContent:'',className:'',hidden:false,children:[],attributes:{},listeners:{},classList:{toggle(){}},
  replaceChildren(...items){this.children=[...items];},append(...items){this.children.push(...items);},
  setAttribute(key,value){this.attributes[key]=value;},addEventListener(name,callback){this.listeners[name]=callback;}});
 const document={querySelector:selector=>{
  if(!elements.has(selector))elements.set(selector,el());
  return elements.get(selector);
 },createElement:()=>el(),documentElement:{scrollHeight:260},body:{}};
 const sent=[],timers=new Map();let listener,timerId=0;
 const parent={postMessage:message=>sent.push(message)};
 const window={parent,openai:toolOutput?{toolOutput}:undefined,addEventListener:(name,callback)=>{if(name==='message')listener=callback;}};
 const html=readAppResource(LIVE_APP_URI).contents[0].text;
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window,document,
  setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},
  clearTimeout:id=>timers.delete(id)});
 return {sent,elements,timers,receive:(data,source=parent)=>listener({source,data}),
  timeout:()=>{for(const callback of timers.values())callback();}};
}
const reply=(id=1)=>({jsonrpc:'2.0',id,result:{protocolVersion:'2026-01-26',hostCapabilities:{}}});
test('view initializes and acknowledges exactly once after the host response',()=>{
 const app=mount();
 assert.equal(app.sent.length,1);
 assert.equal(app.sent[0].method,'ui/initialize');
 assert.equal(app.sent[0].params.protocolVersion,'2026-01-26');
 assert.equal(app.sent[0].params.clientInfo.name,'kongboda-live-analysis');
 app.receive(reply(),{});
 app.receive(reply(99));
 assert.equal(app.sent.length,1);
 app.receive(reply());
 assert.equal(app.sent[1].method,'ui/notifications/initialized');
 assert.equal(app.timers.size,0);
 app.receive(reply());
 assert.equal(app.sent.length,3);
 assert.equal(app.sent[2].method,'ui/notifications/size-changed');
 app.receive({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{
  available:true,freshness:{live:false,session_status:'Ends'},briefing:'Session ended'
 }}});
 assert.equal(app.elements.get('#status').textContent,'Ends');
 assert.equal(app.elements.get('#summary').textContent,'Session ended');
});
test('no-session result renders without waiting for a live race',()=>{
 const app=mount();app.receive(reply());
 app.receive({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{available:false,reason:'No session'}}});
 assert.equal(app.elements.get('#status').textContent,'자료 없음');
 assert.equal(app.elements.get('#summary').textContent,'No session');
});
test('host errors and missing responses show a UI connection error',()=>{
 for(const error of [true,false]){
  const app=mount();
  if(error)app.receive({jsonrpc:'2.0',id:1,error:{code:-32603,message:'Unavailable'}});
  else app.timeout();
  assert.equal(app.elements.get('#status').textContent,'연결 확인 필요');
  assert.equal(app.sent.length,1);
  app.receive(reply());assert.equal(app.sent.length,1);
 }
});
test('unsupported host protocol never announces readiness',()=>{
 const app=mount();app.receive({jsonrpc:'2.0',id:1,result:{protocolVersion:'unsupported'}});
 assert.equal(app.sent.length,1);
 assert.equal(app.elements.get('#status').textContent,'연결 확인 필요');
});
test('legacy ChatGPT tool output remains readable if bridge initialization times out',()=>{
 const app=mount({freshness:{live:false,session_status:'Ends'},briefing:'Saved result'});
 app.timeout();
 assert.equal(app.elements.get('#summary').textContent,'Saved result');
 assert.equal(app.elements.get('#status').textContent,'Ends');
});
