export const raceResultsCss=`
.race-results-controls [hidden]{display:none}
.race-results-panel{min-width:0}.race-results-panel .section-head{margin:0}.race-results-controls{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:14px;margin:20px 0}.race-results-controls label{display:grid;gap:8px;min-width:0}.race-results-controls select{width:100%;min-width:0}.race-results-table{width:100%;table-layout:fixed;font-size:14px}.race-results-table th,.race-results-table td{padding:13px 8px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}.race-results-table th:first-child{width:44px}.race-results-table .race-gap-column{width:94px}.race-results-table .race-strategy-column{width:34%}.race-results-table .race-stop-column{width:65px}.race-results-table .race-pit-time-column{width:104px}.race-results-table td small{display:block;margin-top:5px;color:var(--muted);font-size:11px;line-height:1.5}.race-results-table .race-gap{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.race-results-table .participant{align-items:flex-start;min-width:0}.race-results-table .participant-text{min-width:0;overflow-wrap:anywhere}.race-results-source{display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;margin-top:16px}.race-results-source a[hidden]{display:none}.race-tyres{display:flex;gap:3px;flex-wrap:wrap;align-items:baseline;font-variant-numeric:tabular-nums;line-height:1.8}.race-tyre{font-weight:400;white-space:nowrap}.race-tyre.new-tyre{font-weight:800}.race-tyre.unknown-tyre{font-style:italic;text-decoration:underline dotted}.race-tyre.tyre-S{color:#ff6874}.race-tyre.tyre-M{color:#f5d85b}.race-tyre.tyre-H{color:#f5f5f5}.race-tyre.tyre-I{color:#66d18b}.race-tyre.tyre-W{color:#74b9ff}.race-tyre.tyre-U{color:var(--muted)}.race-tyre-separator{color:var(--muted)}.race-results-legend{font-size:12px;line-height:1.7;color:var(--muted);margin:14px 0}.race-mobile-detail{display:none}
@media(min-width:701px){.race-results-f1 .race-results-table th:nth-child(2){width:30%}.race-results-f1 .race-results-table .race-strategy-column{width:auto}}
@media(max-width:700px){.race-results-controls{grid-template-columns:1fr;gap:12px}.race-results-table{font-size:13px}.race-results-table th,.race-results-table td{padding:12px 4px}.race-results-table th:first-child{width:40px;white-space:nowrap}.race-results-table .race-gap-column{width:78px}.race-results-table .race-desktop-detail{display:none}.race-results-table .race-mobile-detail{display:block;margin-top:8px}.race-results-table .team-logo-slot{display:flex;width:30px;min-width:30px;height:28px}.race-results-table .team-logo-slot .team-logo{width:28px;height:24px}.race-results-table .participant{gap:6px}.race-results-table .race-gap-column{width:70px}.race-results-table td small{font-size:12px}.race-results-legend,.race-results-source{font-size:12px}.race-results-table .race-tyres{font-size:13px}.race-results-panel{padding:20px}}
`;
export function raceResultsSection(series){
 if(!['f1','wec'].includes(series))return '';
 return `<section class="panel race-results-panel race-results-${series}" data-race-results="${series}" aria-labelledby="race-results-title"><div class="section-head"><h2 id="race-results-title">레이스별 순위</h2><span class="fine" data-result-season></span></div><div class="race-results-controls"><label>레이스<select data-result-event aria-label="레이스" disabled></select></label><label data-result-class-label ${series==='f1'?'hidden':''}>클래스<select data-result-class aria-label="클래스" disabled></select></label></div><p class="fine" data-result-status role="status" aria-live="polite">레이스 결과를 불러오는 중…</p><div data-result-table></div><p class="race-results-legend" data-result-legend></p><div class="race-results-source"><a data-result-source hidden target="_blank" rel="noopener noreferrer">결과 출처 ↗</a><a data-result-detail-source hidden target="_blank" rel="noopener noreferrer">전략 출처 ↗</a><button type="button" data-result-retry hidden>다시 불러오기</button></div></section>`;
}
export function raceResultsClient(teamLogoFor,gtTeamLogoFor,koreanStandingName,standingsKoreanNames){
 const root=document.querySelector('[data-race-results]');if(!root)return;
 const en=document.documentElement.lang==='en',t=(ko,eng)=>en?eng:ko,series=root.dataset.raceResults;
 const localName=v=>en?String(v??''):koreanStandingName(v,standingsKoreanNames);
 const $=s=>root.querySelector(s),event=$('[data-result-event]'),category=$('[data-result-class]'),status=$('[data-result-status]'),target=$('[data-result-table]'),retry=$('[data-result-retry]'),source=$('[data-result-source]'),detailSource=$('[data-result-detail-source]');
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const formatTime=value=>{if(!Number.isFinite(value)||value<0)return '—';const ms=Math.round(value*1000),minutes=Math.floor(ms/60000),seconds=(ms%60000/1000).toFixed(3).padStart(6,'0');return minutes+':'+seconds;};
 function gapLabel(value){if(value==='Leader')return t('리더','Leader');return String(value||'—').replace(/\+(\d+) laps?/i,(_,n)=>'+'+n+t('랩',Number(n)===1?' lap':' laps'));}
 function tyres(stints){
  if(!Array.isArray(stints)||!stints.length)return node('span','—');
  const box=node('span',undefined,'race-tyres');
  for(const [i,stint] of stints.entries()){
   if(i)box.append(node('span','/','race-tyre-separator'));
   const code=({SOFT:'S',MEDIUM:'M',HARD:'H',INTERMEDIATE:'I',WET:'W'})[stint.compound]||'U';
   const label='('+code+')'+String(stint.laps).padStart(2,'0')+(stint.fresh===null?'?':'');
   const span=node('span',label,'race-tyre tyre-'+code+(stint.fresh===true?' new-tyre':stint.fresh===null?' unknown-tyre':''));
   span.title=stint.compound+' · '+stint.laps+t('랩 · ',' laps · ')+(stint.fresh===true?t('새 타이어','New tyre'):stint.fresh===false?t('헌 타이어','Used tyre'):t('새 타이어 여부 미확인','Freshness not verified'));
   span.setAttribute('aria-label',span.title);box.append(span);
  }
  return box;
 }
 function pitSummary(row){return t('피트 ','Pit visits ')+(row.pit_stops??'—')+' · '+t('총 시간 ','Total time ')+formatTime(row.pit_time_seconds);}
 function safeLink(link,url){try{const u=new URL(url);if(u.protocol!=='https:')throw Error();link.href=u.href;link.hidden=false;}catch{link.hidden=true;}}
 let seq=0,controller=null,timer=null,loading=false,lastLoaded=0,lastVerified=0;
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(document.visibilityState!=='hidden')load(true);},300000);}
 async function load(background=false){
  const id=++seq;controller?.abort();controller=new AbortController();loading=true;clearTimeout(timer);retry.hidden=true;
  const selected=event.value,cls=category.value;const q=new URLSearchParams({series});if(selected)q.set('event',selected);if(series==='wec'&&cls)q.set('category',cls);
  target.setAttribute('aria-busy','true');if(!background){status.textContent=t('레이스 결과를 불러오는 중…','Loading race results…');target.replaceChildren();source.hidden=true;detailSource.hidden=true;}
  try{
   const {response:r,data}=await publicJsonRequest('/api/race-results?'+q,{cache:'no-store',signal:controller.signal,timeoutMs:45000});if(id!==seq)return;if(!r.ok)throw Error();
   event.replaceChildren(...data.events.map(e=>new Option((e.round?'R'+e.round+' · ':'')+localName(e.name),e.id)));event.disabled=!data.events.length;if(data.selected_event)event.value=data.selected_event;
   $('[data-result-season]').textContent=data.season+' SEASON';
   if(data.empty){target.replaceChildren();status.textContent=t('공식 레이스 결과가 아직 없습니다.','No published race results yet.');schedule();return;}
   if(series==='wec'){category.replaceChildren(...data.categories.map(c=>new Option(c.label,c.id)));category.value=data.selected_category;category.disabled=false;}
   const table=node('table',undefined,'race-results-table');const caption=table.createCaption();caption.className='sr-only';caption.textContent=localName(data.event)+' · '+(category.value||'F1')+' · '+t('레이스 결과','Race results');
   const head=table.createTHead().insertRow();const labels=[[t('순위','Pos.'),''],[t(series==='f1'?'드라이버 / 팀':'차량 / 팀','Entrant / Team'),''],[t('리더 갭','Leader gap'),'race-gap-column'],...(series==='f1'?[[t('타이어 전략','Tyre strategy'),'race-strategy-column race-desktop-detail']]:[[t('피트 수','Pit visits'),'race-stop-column race-desktop-detail'],[t('총 피트 시간','Total pit time'),'race-pit-time-column race-desktop-detail']])];
   for(const [text,cls] of labels){const th=node('th',text,cls);th.scope='col';head.append(th);}
   const body=table.createTBody();
   for(const row of data.rows){
    const tr=body.insertRow();tr.insertCell().textContent=row.position??'—';const name=tr.insertCell(),participant=node('div',undefined,'participant');
    const logo=series==='f1'?teamLogoFor('f1','drivers',row):gtTeamLogoFor('wec',data.selected_category,row)||teamLogoFor('wec',data.selected_category,row);
    if(logo){const mark=node('span',undefined,'team-color-mark');mark.setAttribute('aria-hidden','true');const colors={mclaren:'#ff9d42',ferrari:'#ff6974',mercedes:'#50dfc1',redbull:'#92b6ff',williams:'#8db5ff',alpine:'#f3a4d7',astonmartin:'#66c9a4',haas:'#e0e7eb',audi:'#ff8c8c',cadillac:'#d4c6ff',toyota:'#ff8b8b',bmw:'#93bfff',porsche:'#d4c6a2'};const wecColors={genesis:'#ff7a1a',peugeot:'#b5e61d',alpine:'#3b82f6',astonmartin:'#00806f',cadillac:'#d4a72c',toyota:'#ffffff'};const color=(series==='wec'&&wecColors[logo])||colors[logo]||'#a8bac5';mark.style.setProperty('--team-color',color);if(color==='#ffffff')mark.classList.add('team-color-light');participant.append(mark);}
    const label=node('div',localName(series==='f1'?row.name:'#'+row.number+' '+row.name),'participant-text');label.setAttribute('data-no-translate','');
    label.append(node('small',series==='f1'?[row.number,localName(row.team)].filter(Boolean).join(' · '):localName(row.team)));
    if(series==='wec'&&row.drivers)label.append(node('small',localName(row.drivers)));
    const mobile=node('div',undefined,'race-mobile-detail');mobile.append(series==='f1'?tyres(row.stints):node('span',pitSummary(row)));label.append(mobile);participant.append(label);name.append(participant);
    const gap=tr.insertCell();gap.className='race-gap';gap.textContent=gapLabel(row.gap);
    if(row.status&&!/^(Finished|Classified|\+\d+ Laps?)$/i.test(row.status)&&row.gap!==row.status)gap.append(node('small',row.status));
    if(series==='f1'){const cell=tr.insertCell();cell.className='race-desktop-detail';cell.append(tyres(row.stints));}
    else{for(const value of [row.pit_stops??'—',formatTime(row.pit_time_seconds)]){const cell=tr.insertCell();cell.className='race-desktop-detail';cell.textContent=value;}}
   }
   target.replaceChildren(table);
   if(data.rows.length>10){let expanded=false;const more=node('button',undefined,'standings-more');more.type='button';const update=()=>{[...body.rows].forEach((r,i)=>r.hidden=!expanded&&i>=10);more.textContent=expanded?t('접기','Show less'):t('더보기','Show all')+' ('+data.rows.length+')';more.setAttribute('aria-expanded',String(expanded));};more.onclick=()=>{expanded=!expanded;update();};update();target.append(more);}
   safeLink(source,data.source);safeLink(detailSource,series==='f1'?data.strategy_source:data.pit_source);detailSource.textContent=series==='f1'?t('타이어 기록 · FastF1 / TracingInsights ↗','Tyre records · FastF1 / TracingInsights ↗'):t('피트 기록 출처 ↗','Pit records source ↗');
   $('[data-result-legend]').textContent=series==='f1'?t('S 소프트 · M 미디엄 · H 하드 · I 인터미디어트 · W 웨트. 굵게: 새 타이어 · 보통: 헌 타이어 · ?: 상태 미확인. 숫자는 이 레이스에서 해당 스틴트로 완주한 랩 수입니다. —: 기록 미확인.','S Soft · M Medium · H Hard · I Intermediate · W Wet. Bold: new · regular: used · ?: freshness unknown. Numbers show laps completed in each race stint. —: data unavailable.')+(data.strategy_state!=='available'?t(' 일부 타이어 기록 확인 중.',' Some tyre records are unavailable.'):''):t('갭은 선택한 클래스 리더 기준입니다. 피트 수는 기록된 피트 방문이며, 시간은 공식 PIT_TIME 합계로 피트레인 주행·작업·페널티 시간이 포함될 수 있습니다. 미완료 방문 또는 누락 기록이 있으면 총 시간은 —로 표시합니다.','Gaps are to the selected class leader. Pit visits count recorded visits; total time sums official PIT_TIME and may include lane transit, service and penalties. Incomplete visits or missing records show —.');
   status.textContent=localName(data.event)+' · '+data.provider+(data.classification==='PROVISIONAL'?t(' · 잠정',' · Provisional'):'')+' · '+t('조회 ','Retrieved ')+new Date(data.retrieved_at).toLocaleString(en?'en-GB':'ko-KR');if(data.stale){status.textContent+=t(' · 갱신 실패 · 24시간 이내 이전 확인 결과',' · Refresh failed · last verified result, under 24 hours old');retry.hidden=false;}lastLoaded=Date.now();lastVerified=lastLoaded-(Number(data.cache_age_seconds)||0)*1000;schedule();
  }catch(e){if(id!==seq||e.name==='AbortError')return;if(lastVerified&&Date.now()-lastVerified>=86400000){target.replaceChildren();source.hidden=true;detailSource.hidden=true;}status.textContent=background&&target.querySelector('table')?t('최신 결과 확인 실패 · 이전 조회 결과 표시 중','Refresh failed · showing the previous result'):t('레이스 결과를 불러오지 못했습니다. 다시 시도해 주세요.','Could not load race results. Please retry.');retry.hidden=false;schedule();}
  finally{if(id===seq){target.removeAttribute('aria-busy');loading=false;}}
 }
 event.addEventListener('change',()=>{category.value='';load();});category.addEventListener('change',()=>load());retry.addEventListener('click',()=>load());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!loading&&Date.now()-lastLoaded>=300000)load(true);});load();
}
