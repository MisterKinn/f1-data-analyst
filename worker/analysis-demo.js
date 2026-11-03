import {everydayCases} from './demo-everyday-data.js';
import {demoCases as barCases} from './analysis-demo-data.js';
import {REAL_F1_LINE_DEMOS} from './demo-telemetry-data.js';
import {interpretations,researchLinks} from './demo-interpretations.js';
import {barcelonaCase} from './demo-barcelona-data.js';
import {seasonCases} from './demo-season-data.js';
import {expandedCases} from './demo-expanded-data.js';
const fixed=v=>v.toFixed(3)+'s';
const lineCases=REAL_F1_LINE_DEMOS.map((c,i)=>{
 const [questionKo,questionEn,answerKo,answerEn]=interpretations[i];
 const stats=c.tracks.map(tr=>{const ys=tr.points.map(p=>p[1]);return [tr.name,fixed(ys.reduce((a,b)=>a+b,0)/ys.length),fixed(ys.slice(-3).reduce((a,b)=>a+b,0)/3),fixed(Math.min(...ys))];});
 const telemetry=c.panels?.length;
 return {...c,questionKo,questionEn,answerKo,answerEn,series:'F1',research:researchLinks[telemetry?'telemetry':'pace'],
 ...(!telemetry?{table:{headersKo:['드라이버','평균','최근 3랩','최고 랩'],headersEn:['Driver','Mean','Last 3','Best'],rows:stats},factsKo:[['비교 범위',c.tracks[0].points[0][0]+'–'+c.tracks[0].points.at(-1)[0]+'랩'],['해석 조건','연료·타이어 나이·트래픽 미보정']],factsEn:[['Window','Laps '+c.tracks[0].points[0][0]+'–'+c.tracks[0].points.at(-1)[0]],['Conditions','Fuel, tyre age and traffic uncorrected']]}:{})};
});
const imola={...barCases[2],chart:'table',series:'WEC',questionKo:'이몰라 하이퍼폴, 페라리 #51의 0.011초 우위를 다음 랩에도 기대할 수 있을까?',questionEn:'Can Ferrari #51 repeat its 0.011s Imola Hyperpole edge on another lap?',answerKo:'S2 이득을 재현하면 #51이 다시 앞설 수 있지만 접전일 것 같습니다. #8보다 S1·S3에서 총 0.099초 잃고 S2에서 0.110초 만회했습니다. 준비 랩·타이어·트래픽 변화로 순서가 바뀔 여지가 커 고정된 우열로 단정할 수 없습니다. 이 한 랩을 장거리 페이스로 확대하지 않겠습니다.',answerEn:'Repeating its S2 gain could keep #51 ahead, but it looks fragile: 0.110s recovered there offsets 0.099s lost in S1 and S3. Preparation, tyres or traffic could reverse the order. This qualifying lap does not establish endurance pace.',titleKo:'실제 최고 랩의 섹터 차이',titleEn:'Sectors on the actual best laps',unitKo:'#51 − #8 · 음수는 #51 우위 · 가상 베스트 랩 아님',unitEn:'#51 minus #8 · negative favours #51 · not an ideal lap',table:{headersKo:['구간','#51 − #8','우위'],headersEn:['Section','#51 − #8','Advantage'],rows:[['S1','+0.046s','#8'],['S2','−0.110s','#51'],['S3','+0.053s','#8'],['LAP','−0.011s','#51']]},factsKo:[['#51 · 7랩','1:30.127 · S2 29.591s'],['#8 · 6랩','1:30.138 · S2 29.701s'],['해석 조건','S2 이득의 반복성·타이어 준비']],factsEn:[['#51 · lap 7','1:30.127 · S2 29.591s'],['#8 · lap 6','1:30.138 · S2 29.701s'],['Conditions','Repeatable S2 gain / tyre preparation']]};
const pit={...barCases[3],series:'F1',questionKo:'피트에서 잃은 3.191초, 안토넬리가 페이스로 만회하려면 얼마나 필요할까?',questionEn:'How long would Antonelli need to recover the 3.191s pit-lane deficit on pace?',answerKo:'가령 0.3초/랩 우위가 유지된다면 약 11랩이 필요합니다. 이는 실측 페이스 예측이 아닌 조건부 계산입니다. 공식 피트 구간 차이는 3.191초지만 정차 작업 지연으로 단정할 수 없습니다. 트래픽이나 타이어 이득이 줄면 회복은 더 늦어질 것 같습니다.',answerEn:'At an assumed sustained 0.3s/lap advantage, recovery takes about 11 laps. That is a conditional calculation, not measured future pace. The official pit-lane gap is 3.191s; it does not identify stationary-service delay. Traffic or fading tyre benefit would extend recovery.',research:researchLinks.pace,table:{headersKo:['가정한 우위','회복 필요','계산'],headersEn:['Assumed gain','Recovery','Calculation'],rows:[['0.2s/lap','16 laps','3.191 / 0.2'],['0.3s/lap','11 laps','3.191 / 0.3'],['0.5s/lap','7 laps','3.191 / 0.5']]},factsKo:[['러셀 / 안토넬리','17.794s / 20.985s'],['해석','올림 계산 · 상대 반응·트래픽 제외']],factsEn:[['Russell / Antonelli','17.794s / 20.985s'],['Scope','Rounded up · no traffic / rival reaction']]};
const wecConsistency={...barcelonaCase,questionKo:'바르셀로나 제네시스 #19, 가장 빠른 한 랩을 빼도 #17보다 페이스가 좋을까?',questionEn:'At Barcelona, is Genesis #19 still faster if we remove its quickest lap?',answerKo:'네, 이 표본에서는 우세가 남습니다. 각 차량의 최고 랩을 하나씩 제외한 평균도 #19가 약 2.089초 빠릅니다. 한 번의 좋은 랩만으로 생긴 차이는 아닐 것 같습니다. 다만 #17은 피트 직후 구간이고 연료·타이어 나이·트래픽은 보정하지 않았으므로 차량의 순수 성능 차이로 단정할 수 없습니다.',answerEn:'Yes in this sample: removing each car’s quickest lap still leaves #19 about 2.089s ahead on average. One exceptional lap is unlikely to explain the whole gap. However, #17 is in a post-pit window, and fuel, tyre age and traffic are uncorrected; this is not a pure car-performance comparison.',titleKo:'최고 랩 제외 후에도 남는 페이스 차이',titleEn:'Pace gap after removing the quickest laps',table:{headersKo:['차량','전체 8랩','최고 랩 제외'],headersEn:['Car','All 8 laps','Without quickest'],rows:[['#17','97.559s','97.783s'],['#19','95.591s','95.695s']]}};
const wecSectors={...imola,questionKo:'이몰라에서 토요타 #8은 다음 하이퍼폴 랩에서 어디를 개선해야 페라리를 넘을까?',questionEn:'Where should Toyota #8 improve on its next Imola Hyperpole lap to beat Ferrari?',answerKo:'S1·S3 기록을 유지한다면 S2에서 0.012초만 줄여도 이 두 베스트 랩의 순서는 바뀝니다. #8의 S2 손실 0.110초 중 일부만 회복하면 되므로 재역전 가능성이 있어 보입니다. 다만 섹터는 서로 연결돼 있어 S2 개선이 S3 손실로 이어질 수 있습니다. 이 계산은 목표치이며 다음 랩 결과를 단정할 수 없습니다.',answerEn:'Holding its S1 and S3 times, a 0.012s S2 improvement would reverse these two best laps. Recovering only part of its 0.110s S2 loss looks plausible. But sectors interact: an S2 gain could cost time in S3. This is a conditional target, not a prediction of the next lap.',titleKo:'다음 시도 · S2 개선 목표',titleEn:'Next attempt · S2 improvement target'};
const demoCases=[...lineCases.filter((_,i)=>i!==3),imola,...expandedCases,barcelonaCase,wecConsistency,wecSectors,...seasonCases.slice(1),...everydayCases];
export const demoCss=`
.demo-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.demo-section-title{font-size:23px;margin:0}.demo-play{font-size:12px;min-height:40px;padding:8px 12px}.analysis-demo{border:1px solid var(--line);border-radius:18px;background:linear-gradient(140deg,#141e23,#0c1216);padding:18px}.demo-top{height:42px;display:flex;align-items:center;gap:12px;margin-bottom:12px}.demo-series-logo{width:72px;height:25px;object-fit:contain;object-position:left;filter:brightness(0) invert(1);flex:none}.demo-context{font-size:11px;color:var(--muted);margin:0;line-height:1.4}.demo-layout{height:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto auto;gap:12px;align-items:start}.demo-copy{min-width:0;align-self:start}.demo-layout:not(.has-channels){grid-template-rows:auto auto}.demo-layout.has-channels{grid-template-rows:auto auto}.demo-copy,.demo-chart,.demo-channel{align-self:start}.demo-chart{gap:10px}.demo-question{margin-top:0}.demo-answer p{color:#c3cfd5}.demo-question{background:#25343c;border-radius:12px 12px 3px 12px;padding:11px 13px;font-size:15px;line-height:1.5;margin-bottom:10px;animation:demo-appear .18s both}.demo-answer{border-left:2px solid var(--mint);padding-left:12px}.demo-answer p{font-size:13px;margin:0;line-height:1.65}.demo-chart,.demo-channel,.demo-evidence{min-width:0;border:1px solid var(--line);border-radius:12px;background:#091014;padding:10px;display:flex;flex-direction:column;gap:6px}.demo-chart{grid-column:2;grid-row:1}.has-channels>.demo-chart{grid-row:1}.demo-chart h3,.demo-channel h4,.demo-evidence h4{font-size:13px;margin:0;line-height:1.4}.demo-channel svg,.demo-chart svg{display:block;width:100%;flex:none}.demo-plot{min-height:0;flex:1;display:flex;align-items:center}.demo-legend{display:flex;gap:5px 12px;flex-wrap:wrap;font-size:10px}.demo-legend span:before{content:'';display:inline-block;width:12px;height:3px;background:var(--trace);margin-right:4px;vertical-align:middle}.demo-channel .demo-legend{display:none}.demo-channel-note,.demo-chart .fine,.demo-source,.demo-research{font-size:10px;line-height:1.45;color:var(--muted);margin:0}.demo-source-links{display:flex;gap:4px 12px;flex-wrap:wrap;margin-top:8px}.demo-research{display:block;margin-top:5px}.demo-evidence{grid-column:1/-1;grid-row:2;display:flex;flex-direction:row;align-items:baseline;flex-wrap:wrap;gap:8px 24px;padding:12px 14px}.demo-evidence h4{flex:0 0 100%}.demo-evidence .demo-fact{justify-content:flex-start;gap:10px}.demo-evidence .demo-fact span{flex:initial}.demo-evidence .demo-fact b{text-align:left}.demo-evidence .demo-research{margin:0}.demo-fact{display:flex;justify-content:space-between;gap:10px;font-size:12px;line-height:1.4}.demo-fact span{color:var(--muted);flex:0 0 90px}.demo-fact b{font-weight:500;text-align:right}.demo-table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}.demo-table th,.demo-table td{padding:9px 6px;border-bottom:1px solid #29343c;text-align:right;line-height:1.4}.demo-table th{font-size:10px;color:var(--muted);font-weight:500}.demo-table th:first-child,.demo-table td:first-child{text-align:left}.demo-table th:first-child{width:auto}.demo-table tr:last-child td{border-bottom:0}.demo-map{display:block;width:100%;height:180px;object-fit:contain}.demo-disclaimer{font-size:10px;line-height:1.4;color:var(--muted);margin:10px 0 0;min-height:28px}.demo-trace{stroke-dasharray:1;stroke-dashoffset:1;animation:demo-trace .8s .12s forwards}.demo-bar{transform-origin:left;animation:demo-grow .5s .12s both}.demo-answer,.demo-chart{animation:demo-appear .25s .1s both}@keyframes demo-trace{to{stroke-dashoffset:0}}@keyframes demo-appear{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}@keyframes demo-grow{from{transform:scaleX(.01)}to{transform:scaleX(1)}}
@media(max-width:700px){.analysis-demo{padding:14px}.demo-heading{margin-bottom:12px}.demo-section-title{font-size:21px}.demo-play{font-size:14px;min-height:44px}.demo-top{height:48px;margin-bottom:12px;gap:10px}.demo-series-logo{width:64px;height:24px}.demo-context{font-size:12px}.demo-layout,.demo-layout:not(.has-channels){height:auto;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;gap:10px}.demo-copy{grid-column:1;grid-row:1}.demo-chart{grid-column:1;grid-row:2;padding:10px}.demo-evidence{grid-column:1;grid-row:3;padding:10px;gap:6px}.has-channels{grid-template-rows:repeat(4,auto)}.demo-layout{align-items:start}.demo-plot{flex:none}.demo-source-links{margin-top:6px}.demo-evidence{justify-content:flex-start}.demo-disclaimer{height:auto!important;min-height:0!important}.has-channels>.demo-chart{grid-column:1;grid-row:2}.demo-channel{padding:9px;gap:5px}.demo-question{font-size:15px;padding:11px 12px;margin-bottom:12px;line-height:1.5}.demo-answer p{font-size:14px;line-height:1.6}.demo-answer{padding-left:10px}.demo-research{font-size:11px}.demo-table{font-size:12px}.demo-table td,.demo-table th{padding:7px 3px}.demo-table th{font-size:11px}.demo-chart h3,.demo-channel h4,.demo-evidence h4{font-size:13px}.has-channels .demo-chart>.fine{display:none}.demo-chart .fine,.demo-channel-note,.demo-source{font-size:11px;line-height:1.45}.demo-legend{font-size:11px;gap:6px 10px}.demo-map{height:145px}.demo-fact{font-size:12px;gap:8px}.demo-fact span{flex-basis:85px}.demo-disclaimer{font-size:11px;line-height:1.5;height:66px;min-height:66px}}

/* Keep the copy and evidence on a consistent reading edge. */
.demo-question,.demo-answer{box-sizing:border-box;padding-left:13px}
.demo-answer{border-left:0;box-shadow:inset 2px 0 var(--mint)}
.demo-evidence{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 18px;padding:10px 13px}
.demo-evidence h4,.demo-evidence .demo-research{grid-column:1/-1}
.demo-evidence .demo-fact{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;overflow-wrap:anywhere}
.demo-evidence .demo-fact span{flex:auto}.demo-evidence .demo-fact b{text-align:left}
@media(max-width:700px){.demo-question,.demo-answer{padding-left:12px}.demo-evidence{grid-template-columns:minmax(0,1fr)}.demo-evidence .demo-fact{display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px}}

.demo-document{font-size:13px;line-height:1.6}.demo-document p{margin:8px 0}.demo-document blockquote{margin:8px 0;padding:10px 12px;border-left:2px solid var(--mint);background:#142127;overflow-wrap:anywhere}
.demo-layout.has-channels>.demo-channel{align-self:stretch}
@media(max-width:700px){.demo-layout.has-channels>.demo-channel{grid-column:1;grid-row:auto}}
.demo-series-logo[src="/assets/formula-e-official"]{width:104px;height:26px}
.demo-copy>.demo-channel,.demo-copy>.demo-table-evidence{margin-top:12px}
.demo-table-evidence{border:1px solid var(--line);border-radius:12px;background:#091014;padding:10px;min-width:0}
.demo-table-evidence h4{font-size:13px;line-height:1.4;margin:0 0 6px}
/* Shared desktop height is measured from every example; no nested scroll areas. */
@media(min-width:701px){
 .analysis-demo{height:var(--demo-height,520px);box-sizing:border-box;display:flex;flex-direction:column}
 .analysis-demo [data-demo-content]{flex:1;min-height:0;display:flex;flex-direction:column}
 .demo-top{flex:none}
 .demo-layout,.demo-layout:not(.has-channels),.demo-layout.has-channels{flex:none;height:auto;grid-template-rows:auto;align-items:start}
 .demo-layout.has-channels{grid-template-rows:auto auto}
 .demo-copy,.demo-chart,.demo-channel{height:auto;max-height:none;overflow:visible;box-sizing:border-box}
 .demo-disclaimer{flex:none;min-height:28px;margin-top:16px}
 .analysis-demo.demo-measuring{height:auto}
 .analysis-demo.demo-measuring [data-demo-content]{flex:none}
}
@media(prefers-reduced-motion:reduce){.demo-question,.demo-answer,.demo-chart,.demo-bar,.demo-trace{animation:none!important}.demo-trace{stroke-dashoffset:0}}
`;
export function analysisDemo(){return `<div class="analysis-demo-wrap"><div class="demo-heading"><h2 class="demo-section-title">이렇게 물어보세요</h2><button class="demo-play" data-demo-play aria-pressed="true">일시 정지</button></div><section class="analysis-demo" aria-label="AI 분석 이용 예시"><div data-demo-content></div><p class="demo-disclaimer">일정·입문 안내, 라이브 상황을 가정한 질문과 사후분석 예시가 함께 재생됩니다. 실제 실시간 응답 화면은 아니며, 전망은 확정된 결과가 아닙니다.</p><noscript>JavaScript를 켜면 실제 세션 기록에 기반한 질문과 그래프가 자동으로 재생됩니다.</noscript></section></div>`;}
export {demoCases};
export function demoClient(cases){
 const root=document.querySelector('.analysis-demo');if(!root||!cases?.length)return;
 const en=document.documentElement.lang==='en',t=(ko,english)=>en?english:ko,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const content=root.querySelector('[data-demo-content]'),play=root.parentElement.querySelector('[data-demo-play]'),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 // Exclude the previous starting example so a reload really changes it.
 let previous=-1;try{previous=Number(sessionStorage.getItem('kongboda-demo-start')??-1);}catch{}
 const candidates=cases.map((_,i)=>i).filter(i=>i!==previous);
 let index=candidates[Math.floor(Math.random()*candidates.length)]??0,timer=null,playing=!reduced;
 try{sessionStorage.setItem('kongboda-demo-start',String(index));}catch{}
 const weeklyCase=cases.find(c=>c.weekly);
 if(weeklyCase)fetch('/api/race-calendar').then(r=>r.json()).then(data=>{const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);const end=new Date(start);end.setDate(end.getDate()+7);const events=data.events.filter(e=>new Date(e.start+'T00:00:00')<end&&new Date(e.end+'T23:59:59')>=start).slice(0,4);weeklyCase.table.rows=events.map(e=>{const sessions=e.sessions||[],main=sessions.find(s=>/레이스|Race|SS20/.test(s.name))||sessions.at(-1);return [en?e.nameEn:e.name,main?new Date(main.start).toLocaleString(en?'en-GB':'ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):t('세션 시간 확인 중','Session time pending')];});if(!events.length)weeklyCase.table.rows=[[t('공식 일정 확인 중','Checking official schedules'),'—']];weeklyCase.links=events.slice(1).map(e=>({label:en?e.nameEn:e.name,url:e.url}));if(events[0])weeklyCase.sourceUrl=events[0].url;if(cases[index]===weeklyCase)render();}).catch(()=>{weeklyCase.table.rows=[[t('일정 불러오기 실패','Schedule unavailable'),t('잠시 후 다시 확인','Please retry')]];if(cases[index]===weeklyCase)render();});
 const color=(track,i)=>/^#[0-9a-f]{6}$/i.test(track.color||'')?track.color:['#27F4D2','#FF8000','#E8002D','#4781D7'][i%4];
 function chart(c){
  if(c.chart==='line'){
   const points=c.tracks.flatMap(t=>t.points).filter(p=>p.every(Number.isFinite));
   const xmin=c.xMin??Math.min(...points.map(p=>p[0])),xmax=c.xMax??Math.max(...points.map(p=>p[0]));
   let ymin=Math.min(...points.map(p=>p[1])),ymax=Math.max(...points.map(p=>p[1]));const pad=Math.max((ymax-ymin)*.12,.1);ymin-=pad;ymax+=pad;if(c.kind==='brake'){ymin=-.08;ymax=1.08;}
   const width=c.chartWidth??370,right=width-16,plotHeight=c.plotHeight??150,bottom=22+plotHeight;const x=v=>42+(v-xmin)/(xmax-xmin||1)*(right-42),y=v=>bottom-(v-ymin)/(ymax-ymin||1)*plotHeight;
   let shapes='';const ticks=c.kind==='brake'?[0,1]:(plotHeight<=40?[0,1]:[0,1/3,2/3,1]).map(i=>ymin+(ymax-ymin)*i);for(const v of ticks){const yy=y(v);shapes+=`<path d="M42 ${yy}H${right}" stroke="#29343c"/><text x="36" y="${yy+4}" text-anchor="end" fill="#b3c1c8" font-size="12">${v.toFixed(c.yDecimals??1)}</text>`;}
   for(let i=0;i<4;i++){const v=xmin+(xmax-xmin)*i/3;shapes+=`<text x="${x(v)}" y="${bottom+16}" text-anchor="middle" fill="#b3c1c8" font-size="12">${Math.round(v)}</text>`;}
   if(c.kind==='delta'&&ymin<=0&&ymax>=0)shapes+=`<path d="M42 ${y(0)}H${right}" stroke="#82939b" stroke-dasharray="4 4"/>`;
   shapes+=c.tracks.map((tr,i)=>{const valid=tr.points.filter(p=>p.every(Number.isFinite));const plotted=c.kind==='brake'?valid.flatMap((p,j)=>j?[[p[0],valid[j-1][1]],p]:[p]):valid;return `<polyline class="${tr.dashed?'demo-trace-dashed':'demo-trace'}" ${tr.dashed?'stroke-dasharray="5 4"':'pathLength="1"'} fill="none" stroke="${color(tr,i)}" stroke-width="2.2" stroke-linejoin="round" points="${plotted.map(p=>x(p[0])+','+y(p[1])).join(' ')}"/>`;}).join('');
   shapes+=`<text x="42" y="12" fill="#b3c1c8" font-size="12">${esc(t(c.yLabelKo,c.yLabelEn))}</text><text x="${width/2}" y="${bottom+26}" text-anchor="middle" fill="#b3c1c8" font-size="12">${esc(t(c.xLabelKo,c.xLabelEn))}</text>`;
   return `<svg viewBox="0 0 ${width} ${bottom+30}" role="img" aria-label="${esc(t(c.titleKo,c.titleEn))}">${shapes}</svg><div class="demo-legend">${c.tracks.map((tr,i)=>`<span style="--trace:${color(tr,i)}">${esc(tr.name)}${tr.dashed?t(' (점선)',' (dashed)'):''}</span>`).join('')}</div>`;
  }
  if(c.chart==='document')return `<div class="demo-document"><p class="fine">${esc(t(c.excerpt.labelKo,c.excerpt.labelEn))}</p><blockquote lang="de">${esc(c.excerpt.text)}</blockquote><p>${esc(t(c.excerpt.translationKo,c.excerpt.translationEn))}</p><p>${esc(t(c.excerpt.summaryKo,c.excerpt.summaryEn))}</p></div>`;
  if(c.chart==='map')return `<img class="demo-map" src="${esc(c.imageUrl)}" alt="${esc(t(c.titleKo,c.titleEn))}">`;
  if(c.chart==='table')return '';
  const rows=c.values,max=Math.max(...rows.map(r=>r.value)),width=c.chartWidth??370,height=rows.length*40+8;
  const bars=rows.map((r,i)=>`<text x="0" y="${12+i*40}" fill="#dce6e9" font-size="12">${esc(r.label)}</text><rect class="demo-bar" x="0" y="${19+i*40}" width="${r.value/max*(width-80)}" height="10" rx="3" fill="${color(r,i)}"/><text x="${width-70}" y="${29+i*40}" fill="#fff" font-size="12">${esc(r.display??r.value)}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t(c.titleKo,c.titleEn))}">${bars}</svg>`;
 }
 function table(c){if(!c.table)return '';const q=c.table;return `<table class="demo-table"><thead><tr>${t(q.headersKo,q.headersEn).map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.rows.map(row=>`<tr>${row.slice(0,q.headersKo.length).map((cell,i)=>`<td>${esc(i===0&&q.headersEn[0]==='Driver'?String(cell).split(' · ')[0].split(' ').at(-1):i===q.headersKo.length-1&&row.length>q.headersKo.length&&en?row.at(-1):cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}

 function render(){const c=cases[index];try{sessionStorage.setItem('kongboda-demo-start',String(index));}catch{}
  const narrow=matchMedia('(max-width:700px)').matches,hasPanels=!!c.panels?.length,width=Math.max(250,Math.floor(narrow?content.clientWidth-18:(content.clientWidth-12)/2-22));
  const panelHtml=(c.panels||[]).map(panel=>{const xs=c.tracks.flatMap(tr=>tr.points.map(p=>p[0]));return `<section class="demo-channel"><h4>${esc(t(panel.titleKo,panel.titleEn))}</h4>${chart({...panel,chart:'line',chartWidth:width,plotHeight:narrow?48:65,xLabelKo:c.xLabelKo,xLabelEn:c.xLabelEn,xMin:Math.min(...xs),xMax:Math.max(...xs)})}<p class="demo-channel-note">${panel.kind==='brake'?t('0/1 작동 신호 · 압력 아님','On/off signal · not pressure'):t('양수=비교 차량이 느림 · 보간 델타','Positive = comparison slower · interpolated')}</p></section>`;}).join('');
    const links=[{label:t('기록·공식 자료','Records / official source'),url:c.sourceUrl},...(c.links||[])];
  content.innerHTML=`<div class="demo-top"><img class="demo-series-logo" src="${c.logo||(/WEC/i.test(c.series||c.session)?'/assets/wec-official.png':'/assets/f1-official.svg')}" alt="${c.series||'Formula 1'}" width="72" height="25"><p class="demo-context">${esc(c.session)} · ${index+1}/${cases.length}</p></div><div class="demo-layout ${hasPanels?'has-channels':''}"><div class="demo-copy"><div class="demo-question">${esc(t(c.questionKo,c.questionEn))}</div><div class="demo-answer"><p>${esc(t(c.answerKo,c.answerEn))}</p></div>${hasPanels&&c.research?`<a class="demo-research" href="${esc(c.research.url)}" target="_blank" rel="noopener noreferrer">${esc(t(c.research.label,c.research.labelEn))} ↗</a>`:''}</div><div class="demo-chart"><h3>${esc(t(c.titleKo,c.titleEn))}</h3>${chart({...c,chartWidth:width,plotHeight:hasPanels?(narrow?55:105):(narrow?90:170)})}${table(c)}<p class="fine">${esc(t(c.unitKo,c.unitEn))}</p><div class="demo-source-links">${links.map(l=>`<a class="demo-source" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('')}</div>${panelHtml}</div></div>`;

  if(hasPanels){
   const layout=content.querySelector('.demo-layout');
   [...content.querySelectorAll('.demo-channel')].forEach((block,i)=>{
    layout.append(block);
    if(!narrow){block.style.gridColumn=String(i%2+1);block.style.gridRow=String(2+Math.floor(i/2));}
   });
  }
  if(!narrow&&!hasPanels){
   const copy=content.querySelector('.demo-copy'),visual=content.querySelector('.demo-chart');
   const height=el=>el.getBoundingClientRect().height;
   // Move complete, labelled evidence blocks only when it reduces the taller column.
   for(const block of [...visual.querySelectorAll(':scope > .demo-channel')]){
    const before=Math.max(height(copy),height(visual));if(height(visual)-height(copy)<100)break;
    const next=block.nextSibling;copy.append(block);
    if(Math.max(height(copy),height(visual))>before-16)visual.insertBefore(block,next);
   }
   const tab=visual.querySelector(':scope > .demo-table');
   if(tab&&c.chart!=='table'&&height(visual)-height(copy)>140){
    const before=Math.max(height(copy),height(visual)),next=tab.nextSibling;
    const block=document.createElement('section');block.className='demo-table-evidence';
    const heading=document.createElement('h4');heading.textContent=t(c.titleKo,c.titleEn);block.append(heading,tab);
    const caption=document.createElement('p');caption.className='fine';caption.textContent=t(c.unitKo,c.unitEn);block.append(caption);
    const source=visual.querySelector('.demo-source-links');if(source)block.append(source.cloneNode(true));copy.append(block);
    if(Math.max(height(copy),height(visual))>before-16){visual.insertBefore(tab,next);block.remove();}
   }
  }
  if(!narrow&&!hasPanels){
   const copy=content.querySelector('.demo-copy'),visual=content.querySelector('.demo-chart');
   const last=copy.lastElementChild;
   if(last?.matches('.demo-table-evidence,.demo-channel')){
    const gap=visual.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom;
    if((gap < -1 && gap >= -72)||(gap > 1 && gap <= 24)){
     const shorter=gap>0?last:visual;
     shorter.style.minHeight=(shorter.getBoundingClientRect().height+Math.abs(gap))+'px';
    }
   }
  }
  root.classList.toggle('demo-paused',!playing);play.textContent=playing?t('일시 정지','Pause'):t('자동 재생','Auto-play');play.setAttribute('aria-pressed',String(playing));
 }
 const groups={F1:cases.map((c,i)=>/^F1/i.test(c.series||c.session)?i:-1).filter(i=>i>=0),WEC:cases.map((c,i)=>!/^F1/i.test(c.series||c.session)?i:-1).filter(i=>i>=0)};
 const positions={F1:0,WEC:0};
 const startingGroup=/^F1/i.test(cases[index].series||cases[index].session)?'F1':'WEC';positions[startingGroup]=(groups[startingGroup].indexOf(index)+1)%groups[startingGroup].length;
 function schedule(){clearInterval(timer);timer=null;if(playing&&!document.hidden)timer=setInterval(()=>{const target=/^F1/i.test(cases[index].series||cases[index].session)?'WEC':'F1',pool=groups[target];if(pool.length){index=pool[positions[target]%pool.length];positions[target]++;}else index=(index+1)%cases.length;render();},9000);}
 play.onclick=()=>{playing=!playing;root.classList.toggle('demo-paused',!playing);play.textContent=playing?t('일시 정지','Pause'):t('자동 재생','Auto-play');play.setAttribute('aria-pressed',String(playing));schedule();};
 function fitDesktop(){
  if(matchMedia('(max-width:700px)').matches){root.style.removeProperty('--demo-height');render();return;}
  const saved=index;let height=440;root.classList.add('demo-measuring');
  for(let i=0;i<cases.length;i++){index=i;render();height=Math.max(height,Math.ceil(root.getBoundingClientRect().height)+24);}
  index=saved;render();root.style.setProperty('--demo-height',height+'px');root.classList.remove('demo-measuring');
 }
 document.fonts?.ready.then(fitDesktop);
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fitDesktop,120);});document.addEventListener('visibilitychange',schedule);matchMedia('(max-width:700px)').addEventListener('change',fitDesktop);render();fitDesktop();schedule();
}
