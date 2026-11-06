// The card's third section adapts to the session: qualifying shows sector-by-sector best-lap
// gaps and who owns each sector; practice separates quali sims from long runs; races compare
// recent green-flag laps with the car ahead. Built only from observed laps (lap_archive records
// and published best laps); anything not observed is named, never estimated.
const ms=t=>{const m=String(t??'').match(/^(?:(\d+):)?(\d{1,3})\.(\d{3})$/);return m?Number(m[1]||0)*60000+Number(m[2])*1000+Number(m[3]):null;};
const fmt=v=>{if(v==null)return '—';const m=Math.floor(v/60000),s=((v%60000)/1000).toFixed(3);return m?`${m}:${s.padStart(6,'0')}`:s;};
const delta=v=>`${v>=0?'+':'-'}${(Math.abs(v)/1000).toFixed(3)}`;
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const S=['S1','S2','S3'];

export function sessionKind(name=''){
 const n=String(name).toLowerCase();
 if(/sprint (qualifying|shootout)|qualifying|퀄리|예선|hyperpole|하이퍼폴/.test(n))return 'qualifying';
 if(/practice|^fp\d|연습|프랙티스/.test(n))return 'practice';
 if(/race|sprint|레이스|스프린트/.test(n))return 'race';
 return 'other';
}
export const ANALYSIS_TITLE={qualifying:'퀄리파잉 페이스',practice:'프랙티스 분석',race:'레이스 페이스',other:'페이스'};

const bestParts=archive=>Object.keys(archive?.best_laps||{}).filter(k=>/^Q\d$/.test(k)).sort();
const complete=r=>r?.status==='complete'&&r.sectors&&S.every(k=>ms(r.sectors[k])!=null)&&ms(r.lap_time)!=null;

// Qualifying: current part's verified best laps, sector owners, favourite's loss by sector, cut line.
function qualifying(ctx){
 const {archive,codes,mine,partHint}=ctx, parts=bestParts(archive), part=partHint&&archive?.best_laps?.[partHint]?partHint:parts.at(-1)||'session';
 const saved=Object.values(archive?.best_laps?.[part]||{});
 const rows=(saved.length?saved:ctx.rows.map(r=>({driver_number:r.number,driver:r.code,lap_time:r.best_lap,status:'unavailable'}))).filter(r=>ms(r.lap_time)!=null).sort((a,b)=>ms(a.lap_time)-ms(b.lap_time));
 if(!rows.length)return {lines:['이 파트 최고 랩 기록 없음'],note:null};
 const lines=[], p1=rows[0], code=r=>codes[r.driver_number]||r.driver||r.driver_number;
 lines.push(`${part} 상위: ${rows.slice(0,3).map((r,i)=>i?`${code(r)} ${delta(ms(r.lap_time)-ms(p1.lap_time))}`:`${code(r)} ${r.lap_time}`).join(' · ')}`);
 const full=rows.filter(complete);
 if(full.length>=2){
  const owners=S.map(k=>{const b=full.slice().sort((x,y)=>ms(x.sectors[k])-ms(y.sectors[k]))[0];return `${k} ${code(b)} ${b.sectors[k]}`;});
  lines.push(`섹터 1위: ${owners.join(' · ')}`);
 }
 for(const n of mine){
  const r=rows.find(x=>x.driver_number===n);if(!r){lines.push(`${codes[n]||n}: ${part} 기록 없음`);continue;}
  const pos=rows.indexOf(r)+1, gap=ms(r.lap_time)-ms(p1.lap_time);
  let text=`${code(r)} P${pos} ${pos>1?delta(gap):r.lap_time}`;
  if(pos>1&&complete(r)&&complete(p1)){const d=S.map(k=>ms(r.sectors[k])-ms(p1.sectors[k]));const worst=d.indexOf(Math.max(...d));text+=` (${S.map((k,i)=>`${k} ${delta(d[i])}`).join(', ')}) ${S[worst]} 최대 손실`;}
  else if(pos>1)text+=' (섹터 미확인)';
  const cut={Q1:15,Q2:10}[part];
  if(cut&&rows.length>cut){const edge=rows[cut-1],out=rows[cut];text+=pos<=cut?` · 탈락선 여유 ${delta(ms(out.lap_time)-ms(r.lap_time)).replace('+','')}`:` · 통과선까지 ${delta(ms(r.lap_time)-ms(edge.lap_time))}`;}
  lines.push(text);
 }
 return {lines,note:'코너별 비교는 텔레메트리 버튼'};
}

// Practice: quali sims = best lap on a fresh soft; long runs = 4+ consecutive green laps
// within 107% of the driver's best. Each compared against rivals doing the same kind of run.
function practice(ctx){
 const {archive,codes,mine,recs}=ctx, lines=[];
 const best=Object.values(archive?.best_laps?.session||{}).filter(r=>ms(r.lap_time)!=null);
 const sims=best.filter(r=>/soft/i.test(r.tyre?.compound||'')).sort((a,b)=>ms(a.lap_time)-ms(b.lap_time));
 if(sims.length){
  const ref=sims[0];
  lines.push(`퀄리 시뮬(소프트): ${sims.slice(0,3).map((r,i)=>`${codes[r.driver_number]||r.driver} ${i?delta(ms(r.lap_time)-ms(ref.lap_time)):r.lap_time}`).join(' · ')}`);
  for(const n of mine){const r=sims.find(x=>x.driver_number===n);if(!r)continue;const pos=sims.indexOf(r)+1;if(pos<=3)continue;
   let t=`${codes[n]} 소프트 ${pos}위 ${delta(ms(r.lap_time)-ms(ref.lap_time))}`;
   if(complete(r)&&complete(ref)){const d=S.map(k=>ms(r.sectors[k])-ms(ref.sectors[k]));t+=` (${S.map((k,i)=>`${k} ${delta(d[i])}`).join(', ')})`;}
   lines.push(t);}
 }else lines.push('소프트 퀄리 시뮬 아직 없음');
 const runs=longRuns(recs);
 if(runs.length){
  runs.sort((a,b)=>a.avg-b.avg);
  lines.push(`롱런 평균: ${runs.slice(0,3).map(r=>`${codes[r.driver]||r.driver} ${fmt(Math.round(r.avg))} ×${r.laps}`).join(' · ')}`);
  for(const n of mine){const r=runs.find(x=>x.driver===n);if(r&&runs.indexOf(r)>2)lines.push(`${codes[n]} 롱런 ${fmt(Math.round(r.avg))} ×${r.laps} (${delta(r.avg-runs[0].avg)} vs ${codes[runs[0].driver]})${r.trend!=null?` · 추세 ${delta(r.trend)}/랩`:''}`);}
 }else lines.push('4랩+ 롱런 아직 없음');
 lines.push('연료·엔진 모드 비공개 → 참고용');
 return {lines,note:null};
}

function longRuns(recs){
 const by={};for(const r of recs)(by[r.driver_number]??=[]).push(r);
 const out=[];
 for(const [driver,laps] of Object.entries(by)){
  const sorted=laps.filter(r=>r.lap_time_ms).sort((a,b)=>String(a.completed_at).localeCompare(String(b.completed_at)));
  if(!sorted.length)continue;
  const floor=Math.min(...sorted.map(r=>r.lap_time_ms))*1.07;
  let run=[];const runs=[];
  for(const r of sorted){const ok=!r.in_pit_at_completion&&['1',null,undefined].includes(r.track_status_at_completion)&&r.lap_time_ms<=floor;
   if(ok&&(!run.length||r.lap_number==null||run.at(-1).lap_number==null||r.lap_number===run.at(-1).lap_number+1))run.push(r);else{if(run.length>=4)runs.push(run);run=ok?[r]:[];}}
  if(run.length>=4)runs.push(run);
  const last=runs.at(-1);if(!last)continue;
  const t=last.map(r=>r.lap_time_ms);
  out.push({driver,laps:t.length,avg:avg(t),trend:t.length>=4?(t.at(-1)-t[0])/(t.length-1):null});
 }
 return out;
}

// Race: favourite's recent green laps against the car ahead and the leader over the same window.
function race(ctx){
 const {codes,mine,recs,rows}=ctx, lines=[];
 const recent=n=>recs.filter(r=>r.driver_number===n&&!r.in_pit_at_completion&&['1',null,undefined].includes(r.track_status_at_completion)).sort((a,b)=>String(a.completed_at).localeCompare(String(b.completed_at))).slice(-5).map(r=>r.lap_time_ms).filter(Boolean);
 const lead=rows[0];
 if(lead){const l=recent(lead.number);if(l.length>=3)lines.push(`선두 ${lead.code} 최근 ${l.length}랩 ${fmt(Math.round(avg(l)))}`);}
 for(const n of mine){
  const me=rows.find(r=>r.number===n);if(!me)continue;
  const ahead=rows.find(r=>r.position===me.position-1), m=recent(n);
  if(m.length<3){lines.push(`${me.code} P${me.position}: 그린 랩 부족`);continue;}
  let t=`${me.code} P${me.position} 최근 ${m.length}랩 ${fmt(Math.round(avg(m)))}`;
  if(ahead){const a=recent(ahead.number);if(a.length>=3){const d=avg(m)-avg(a);t+=` · 앞차 ${ahead.code}${me.interval?`(${me.interval})`:''} 대비 ${delta(d)}/랩 → ${d<0?'추격 중':'멀어짐'}`;}}
  if(me.compound)t+=` · ${me.compound} ${me.tyre_laps??'?'}랩`;
  lines.push(t);
 }
 if(!lines.length)lines.push('그린 랩 부족 · 판단 보류');
 return {lines,note:'SC·피트 랩 제외'};
}

export function buildSessionAnalysis({sessionName,live,snapshot,rows,mine}){
 const kind=sessionKind(sessionName), title=ANALYSIS_TITLE[kind];
 if(!live)return {kind,title,lines:['라이브 타이밍 없음 · 판단 보류'],note:null};
 const archive=snapshot?.lap_archive||null, recs=Array.isArray(archive?.records)?archive.records:[];
 const codes=Object.fromEntries(rows.map(r=>[r.number,r.code]));
 const partNo=Number(snapshot?.topics?.TimingData?.SessionPart);
 const ctx={archive,recs,rows,codes,mine,partHint:Number.isInteger(partNo)&&partNo>0?`Q${partNo}`:null};
 const r=kind==='qualifying'?qualifying(ctx):kind==='practice'?practice(ctx):kind==='race'?race(ctx):race(ctx);
 if(!archive)r.lines.push('랩별 섹터 기록 없음 · 공개 최고 랩만 사용');
 return {kind,title,...r};
}
