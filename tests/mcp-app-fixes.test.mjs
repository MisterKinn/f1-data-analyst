import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildLiveBriefing,liveBriefingText,nextF1Session,dataAgeText} from '../worker/live-briefing.js';
import {readAppResource,LIVE_APP_URI} from '../worker/mcp-app.js';

const now=Date.parse('2026-11-04T03:00:00Z');
// Next session comes from the official schedule, shown in Korean time.
const next=nextF1Session(now);
assert.equal(next.event,'상파울루 그랑프리');
assert.match(next.text,/FP1 · 11\. 7\. 00:30 \(한국시간\)/);
assert.equal(dataAgeText('2026-11-01T22:05:00Z',now),'2일 전 (11. 2. 07:05)');
assert.equal(dataAgeText('2026-11-04T02:59:30Z',now).startsWith('30초 전'),true);

// No saved data: plain Korean with the next session, not developer English.
const empty=buildLiveBriefing({available:false,reason:'No collector snapshot saved.'},{now});
assert.match(empty.briefing,/^아직 수집된 세션이 없습니다\. 다음 세션은 상파울루 그랑프리 FP1/);
assert.doesNotMatch(empty.briefing,/collector/);
assert.equal(empty.reason,'No collector snapshot saved.');
// Signed-in users without shared access get the right explanation.
assert.match(buildLiveBriefing({available:false},{now,accessMode:'personal'}).briefing,/등록된 선원만/);

// A finished session shows its real age and the final order, never as live.
const at='2026-11-01T22:05:00Z';
const finished={available:true,connected:false,received_at:at,freshness:{live:false,feed_age_seconds:200000},
 topics:{SessionInfo:{Key:1,Meeting:{Name:'Mexico City Grand Prix'},Name:'Race'},SessionStatus:{Status:'Finalised'},
  DriverList:{'3':{Tla:'VER'},'44':{Tla:'HAM'}},TimingData:{Lines:{'3':{Position:'1'},'44':{Position:'2',GapToLeader:'+0.799'}}}},
 topic_times:{TimingData:{source_time:at,received_at:at}}};
const done=buildLiveBriefing(finished,{now});
assert.equal(done.status,'종료');
assert.equal(done.freshness.live,false);
assert.equal(done.leaderboard.length,0);
assert.deepEqual(done.final_leaderboard.map(r=>r.code),['VER','HAM']);
assert.match(done.briefing,/Race 세션이 끝났습니다/);
assert.ok(done.details.some(d=>d.label==='자료 시각'&&d.value==='2일 전 (11. 2. 07:05)'));
assert.ok(!done.details.some(d=>d.label==='원본 지연'));
assert.match(liveBriefingText(done),/최종 기록 \(실시간 아님\)\n1\. VER/);

// App: accepts other real protocol versions, reads late ChatGPT data, sizes to content, follows theme.
const html=readAppResource(LIVE_APP_URI).contents[0].text,script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function mount(openai){
 const nodes={},listeners={},posted=[],attrs={};
 const el=()=>({textContent:'',className:'',hidden:false,children:[],attributes:{},classList:{toggle(){}},append(...x){this.children.push(...x);},replaceChildren(...x){this.children=[...x];},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){},getBoundingClientRect(){return {height:318};}});
 const window={parent:{postMessage(m){posted.push(m);}},addEventListener(n,f){listeners[n]=f;},openai};
 const document={querySelector:s=>nodes[s]??=el(),createElement:el,documentElement:{scrollHeight:900,setAttribute(k,v){attrs[k]=v;}},body:{}};
 vm.runInNewContext(script,{window,document,setTimeout(){return 1;},clearTimeout(){},ResizeObserver:undefined,Date});
 return {nodes,listeners,posted,attrs,window};
}
let app=mount();
app.listeners.message({source:app.window.parent,data:{jsonrpc:'2.0',id:1,result:{protocolVersion:'2026-06-18',hostContext:{theme:'light'}}}});
assert.ok(app.posted.some(m=>m.method==='ui/notifications/initialized'),'newer host version accepted');
assert.equal(app.attrs['data-theme'],'light');
app.listeners.message({source:app.window.parent,data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:done}}});
assert.equal(app.nodes['#leaderboard'].children.length,2);
assert.equal(app.nodes['#timing-note'].hidden,false);
assert.equal(app.posted.filter(m=>m.method==='ui/notifications/size-changed').at(-1).params.height,320,'height from content, not page');
app=mount({});
app.window.openai.toolOutput=done;app.listeners['openai:set_globals']();
assert.match(app.nodes['#summary'].textContent,/끝났습니다/,'late ChatGPT output is rendered');
console.log('PASS: MCP app fixes');
