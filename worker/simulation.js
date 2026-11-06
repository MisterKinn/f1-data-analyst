// Lap simulator page. Data comes from worker/sim-data.js, generated offline by
// scripts/sim/generate_laptime_sim.py with TUMFTM laptime-simulation (LGPL-3.0).
import {simMeta,simTracks} from './sim-data.js';

const NAMES={Austin:['COTA (오스틴)','COTA (Austin)'],Budapest:['헝가로링','Hungaroring'],Catalunya:['바르셀로나-카탈루냐','Barcelona-Catalunya'],Hockenheim:['호켄하임','Hockenheim'],Melbourne:['앨버트 파크','Albert Park'],MexicoCity:['멕시코시티','Mexico City'],Montreal:['몬트리올','Montreal'],Monza:['몬자','Monza'],Sakhir:['바레인 (사키르)','Bahrain (Sakhir)'],SaoPaulo:['인터라고스','Interlagos'],Sepang:['세팡','Sepang'],Shanghai:['상하이','Shanghai'],Silverstone:['실버스톤','Silverstone'],Sochi:['소치','Sochi'],Spa:['스파-프랑코르샹','Spa-Francorchamps'],Spielberg:['레드불링','Red Bull Ring'],Suzuka:['스즈카','Suzuka'],YasMarina:['야스 마리나','Yas Marina'],Zandvoort:['잔드보르트','Zandvoort']};

const T={
 ko:{title:'랩 시뮬레이터',h1:'한 바퀴를 계산해서, 랩타임이 어디서 갈리는지 봅니다',lead:'물리 모델이 F1 머신으로 트랙을 한 바퀴 돕니다. 어디서 빠르고 느린지, 무게·출력·노면 그립이 랩타임을 얼마나 바꾸는지 직접 바꿔 보세요.',track:'트랙',show:'보기',lap:'계산된 랩타임',s:'구간',vmax:'최고 속도',vmin:'최저 속도',full:'최고 속도 근처 구간',map:'속도로 칠한 주행 라인. 진할수록 빠릅니다.',slow:'느림',fast:'빠름',trace:'거리별 속도',km:'거리 (km)',whatif:'바꿔 보기',whatifLead:'값을 움직이면 모델이 계산한 민감도로 랩타임 변화를 바로 추정합니다.',mass:'무게',power:'엔진 출력',grip:'노면 그립',reset:'처음 값으로',delta:'랩타임 변화',newLap:'예상 랩타임',faster:'빨라짐',slower:'느려짐',same:'변화 없음',read:'이 트랙 읽는 법',model:'이 계산의 범위',m1:'TUM(뮌헨공대) 자동차공학연구소가 공개한 준정상상태 랩 시뮬레이션을 수정 없이 사용했습니다.',m2:'차량은 TUM의 범용 하이브리드 F1 모델(2019년 규정 무렵)입니다. 2026년 차나 실제 팀 데이터가 아닙니다.',m3:'주행 라인은 TUM의 최소 곡률 라인 최적화로 만든 것이고, 트랙 형상은 2017년 무렵 기준입니다. 이후 바뀐 레이아웃은 반영되지 않았습니다.',m4:'그립은 측정값이 아니라 모델의 마찰 계수를 늘리고 줄인 시나리오입니다. 바꿔 보기 결과는 선형 근사라서 큰 값일수록 오차가 커집니다.',m5:'구간 1~3은 계산용으로 나눈 거리 구간이라 공식 섹터와 다를 수 있습니다. 절대 랩타임보다 차이와 경향을 보는 데 쓰세요.',src:'원본 도구',gen:'계산일'},
 en:{title:'Lap simulator',h1:'Simulate one lap and see where the lap time is won',lead:'A physics model drives an F1 car around the track. See where it is fast or slow, and change weight, power and track grip to see how the lap time moves.',track:'Track',show:'Show',lap:'Simulated lap time',s:'Part',vmax:'Top speed',vmin:'Lowest speed',full:'Share near top speed',map:'Racing line coloured by speed. Stronger colour means faster.',slow:'Slow',fast:'Fast',trace:'Speed over distance',km:'Distance (km)',whatif:'Try a change',whatifLead:'Move a value and the model’s sensitivities estimate the lap-time change straight away.',mass:'Weight',power:'Engine power',grip:'Track grip',reset:'Reset values',delta:'Lap-time change',newLap:'Estimated lap time',faster:'faster',slower:'slower',same:'no change',read:'How to read this track',model:'What this calculation covers',m1:'It uses the quasi-steady-state lap simulation published by TUM (Technical University of Munich), unmodified.',m2:'The car is TUM’s generic hybrid F1 model (about 2019 rules). It is not a 2026 car and not team data.',m3:'The racing line comes from TUM’s minimum-curvature optimisation, and track shapes date from about 2017. Later layout changes are not included.',m4:'Grip is a scenario that scales the model’s friction, not a measured value. Try-a-change results are a linear estimate, so large changes are less accurate.',m5:'Parts 1–3 are distance splits for the calculation and may differ from official sectors. Use it for differences and trends rather than absolute lap times.',src:'Source tools',gen:'Calculated'},
};

const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtLap=s=>{const m=Math.floor(s/60);return (m?m+':':'')+(s-m*60).toFixed(3).padStart(m?6:5,'0');};
const name=(k,lang)=>(NAMES[k]||[k,k])[lang==='en'?1:0];
export const simTrackKeys=Object.keys(simTracks).filter(k=>NAMES[k]);

function mapSvg(d,lang){
 const xs=d.x,ys=d.y,n=xs.length,minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const w=maxX-minX,h=maxY-minY,pad=Math.max(w,h)*0.09,vw=w+pad*2,vh=h+pad*2;
 const px=i=>(xs[i]-minX+pad).toFixed(1),py=i=>(maxY-ys[i]+pad).toFixed(1);
 const lo=d.vmin,hi=d.vmax,bucket=i=>Math.min(5,Math.floor((d.speed[i]-lo)/(hi-lo+1e-9)*6));
 let paths='',run=[0],b=bucket(0);
 const flush=()=>{if(run.length>1)paths+=`<path d="M${run.map(i=>px(i)+' '+py(i)).join('L')}" stroke="color-mix(in oklab,var(--mint) ${b*20}%,var(--sim-slow))"/>`;};
 for(let i=1;i<n;i++){run.push(i);const nb=bucket(i);if(nb!==b){flush();run=[i];b=nb;}}
 run.push(0);flush();
 const at=dist=>{let i=0;while(i<n-1&&d.distance[i]<dist)i++;return i;};
 const sw=(Math.max(vw,vh)/120).toFixed(1);
 const marks=d.sectorBounds.map((s,k)=>{const i=at(s);return `<circle cx="${px(i)}" cy="${py(i)}" r="${sw*1.6}" class="sim-sector-dot"/><text x="${px(i)}" y="${py(i)}" dy="${-sw*3}" class="sim-map-label">${k+2}</text>`;}).join('');
 return `<svg class="sim-map" viewBox="0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}" role="img" aria-label="${esc(T[lang].map)}"><g fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><rect x="${(+px(0)-sw*2.2).toFixed(1)}" y="${(+py(0)-sw*2.2).toFixed(1)}" width="${(sw*4.4).toFixed(1)}" height="${(sw*4.4).toFixed(1)}" class="sim-start"/>${marks}<style>.sim-map-label{font-size:${(sw*3.6).toFixed(1)}px}</style></svg>`;
}

function traceSvg(d,lang){
 const W=1000,H=260,L=46,B=28,top=10,len=d.length,lo=Math.floor(d.vmin/50)*50,hi=Math.ceil(d.vmax/50)*50;
 const x=s=>(L+(s/len)*(W-L-8)).toFixed(1),y=v=>(top+(1-(v-lo)/(hi-lo))*(H-top-B)).toFixed(1);
 const line=d.distance.map((s,i)=>(i?'L':'M')+x(s)+' '+y(d.speed[i])).join('');
 const bounds=[0,...d.sectorBounds,len];
 const bands=bounds.slice(0,3).map((s,k)=>`<rect x="${x(s)}" y="${top}" width="${(x(bounds[k+1])-x(s)).toFixed(1)}" height="${H-top-B}" class="${k%2?'sim-band-b':'sim-band-a'}"/><text x="${((+x(s)+ +x(bounds[k+1]))/2).toFixed(1)}" y="${top+16}" class="sim-axis" text-anchor="middle">${k+1}</text>`).join('');
 const grid=[];for(let v=lo;v<=hi;v+=50)grid.push(`<line x1="${L}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}" class="sim-grid"/><text x="${L-6}" y="${y(v)}" dy="4" class="sim-axis" text-anchor="end">${v}</text>`);
 const ticks=[];for(let k=0;k<=len/1000;k++)ticks.push(`<text x="${x(k*1000)}" y="${H-8}" class="sim-axis" text-anchor="middle">${k}</text>`);
 return `<svg class="sim-trace" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T[lang].trace)}">${bands}${grid.join('')}${ticks.join('')}<path d="${line}" class="sim-line"/><text x="${W-8}" y="${H-8}" class="sim-axis" text-anchor="end">${esc(T[lang].km)}</text><text x="${L+6}" y="${top+16}" class="sim-axis">km/h</text></svg>`;
}

function reading(d,lang){
 const s=d.sensitivity,g=s.grip3pctBySector.map(r=>r.reduce((a,b)=>a+b,0)),best=g.indexOf(Math.min(...g));
 const massVsPower=Math.abs(s.mass10kg)/Math.max(1e-6,Math.abs(s.power10kW));
 const f=v=>Math.abs(v).toFixed(2);
 if(lang==='en')return [
  `Carrying 10 kg more costs about ${f(s.mass10kg)} s per lap, and 10 kW more power gains about ${f(s.power10kW)} s.`,
  massVsPower>1.2?'Here weight matters more than power, so the lap is decided in braking and corner exits.':massVsPower<0.8?'Here power matters more than weight, so the long full-throttle sections decide the lap.':'Weight and power matter about equally here.',
  `Extra grip helps most in part ${best+1}: 3% more grip there saves about ${f(g[best])} s. A resurfaced section in that part would show up first.`];
 return [
  `무게가 10kg 늘면 한 바퀴에 약 ${f(s.mass10kg)}초 느려지고, 출력이 10kW 늘면 약 ${f(s.power10kW)}초 빨라집니다.`,
  massVsPower>1.2?'이 트랙은 출력보다 무게에 더 민감합니다. 제동과 코너 탈출에서 랩이 갈립니다.':massVsPower<0.8?'이 트랙은 무게보다 출력에 더 민감합니다. 긴 풀스로틀 구간에서 랩이 갈립니다.':'이 트랙은 무게와 출력의 영향이 비슷합니다.',
  `그립이 가장 크게 효과를 보는 곳은 구간 ${best+1}입니다. 여기 그립이 3% 오르면 약 ${f(g[best])}초가 줄어듭니다. 이 구간에 재포장된 곳이 있다면 가장 먼저 차이가 드러납니다.`];
}

export function simulationPage(trackKey,lang='ko'){
 const t=T[lang==='en'?'en':'ko'];lang=lang==='en'?'en':'ko';
 const key=simTrackKeys.includes(trackKey)?trackKey:(simTrackKeys.includes('Monza')?'Monza':simTrackKeys[0]);
 if(!key)return `<section class="hero"><h1>${esc(t.title)}</h1></section>`;
 const d=simTracks[key],s=d.sensitivity;
 const gripRows=s.grip3pctBySector.map(r=>r.reduce((a,b)=>a+b,0).toFixed(4)).join(',');
 const slider=(id,label,min,max,step,unit)=>`<label class="sim-slider"><span>${esc(label)}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="0" aria-describedby="${id}-out"><output id="${id}-out" for="${id}">0 ${unit}</output></label>`;
 const options=simTrackKeys.slice().sort((a,b)=>name(a,lang).localeCompare(name(b,lang),lang)).map(k=>`<option value="${k}" ${k===key?'selected':''}>${esc(name(k,lang))}</option>`).join('');
 return `<style>${simCss}</style><section class="hero sim-hero"><h1>${esc(t.h1)}</h1><p class="lead">${esc(t.lead)}</p></section>
<form class="sim-pick" method="get" action="/simulation"><label>${esc(t.track)}<select name="track" data-no-translate onchange="this.form.submit()">${options}</select></label><noscript><button>${esc(t.show)}</button></noscript></form>
<section class="sim-stage" aria-label="${esc(name(key,lang))}"><figure class="sim-map-wrap">${mapSvg(d,lang)}<figcaption><span class="sim-legend" aria-hidden="true"></span><span>${esc(t.slow)}</span><span>${esc(t.fast)}</span></figcaption></figure>
<div class="sim-readout"><p class="sim-track" data-no-translate>${esc(name(key,lang))}</p><p class="sim-label">${esc(t.lap)}</p><p class="sim-lap" data-no-translate>${fmtLap(d.lapTime)}</p><dl class="sim-facts">${d.sectors.map((v,k)=>`<div><dt>${esc(t.s)} ${k+1} <span data-no-translate>(${([0,...d.sectorBounds][k]/1000).toFixed(1)}–${([...d.sectorBounds,d.length][k]/1000).toFixed(1)} km)</span></dt><dd data-no-translate>${v.toFixed(3)}</dd></div>`).join('')}<div><dt>${esc(t.vmax)}</dt><dd data-no-translate>${Math.round(d.vmax)} km/h</dd></div><div><dt>${esc(t.vmin)}</dt><dd data-no-translate>${Math.round(d.vmin)} km/h</dd></div><div><dt>${esc(t.full)}</dt><dd data-no-translate>${Math.round(d.fullThrottleShare*100)}%</dd></div></dl></div></section>
<section class="panel sim-trace-panel"><h2>${esc(t.trace)}</h2><div class="sim-trace-scroll">${traceSvg(d,lang)}</div></section>
<section class="panel sim-whatif" id="sim-whatif" data-base="${d.lapTime}" data-mass="${s.mass10kg}" data-power="${s.power10kW}" data-grip="${gripRows}"><div><h2>${esc(t.whatif)}</h2><p>${esc(t.whatifLead)}</p></div><div class="sim-whatif-grid"><div class="sim-sliders">${slider('sim-mass',t.mass,-30,30,5,'kg')}${slider('sim-power',t.power,-30,30,5,'kW')}${[1,2,3].map(k=>slider('sim-grip'+k,`${t.grip} · ${t.s} ${k}`,-5,5,1,'%')).join('')}<button type="button" id="sim-reset" class="small-button">${esc(t.reset)}</button></div><div class="sim-result" aria-live="polite"><p class="sim-label">${esc(t.delta)}</p><p class="sim-delta" id="sim-delta" data-no-translate>±0.000 s</p><p class="sim-dir" id="sim-dir" data-faster="${esc(t.faster)}" data-slower="${esc(t.slower)}" data-same="${esc(t.same)}">${esc(t.same)}</p><p class="sim-label">${esc(t.newLap)}</p><p class="sim-new" id="sim-new" data-no-translate>${fmtLap(d.lapTime)}</p></div></div></section>
<section class="panel sim-read"><h2>${esc(t.read)}</h2><ul>${reading(d,lang).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
<section class="panel sim-model"><h2>${esc(t.model)}</h2><ul><li>${esc(t.m1)}</li><li>${esc(t.m2)}</li><li>${esc(t.m3)}</li><li>${esc(t.m4)}</li><li>${esc(t.m5)}</li></ul><p class="fine">${esc(t.src)}: <a href="https://github.com/TUMFTM/laptime-simulation" target="_blank" rel="noopener noreferrer">TUMFTM/laptime-simulation</a>, <a href="https://github.com/TUMFTM/global_racetrajectory_optimization" target="_blank" rel="noopener noreferrer">global_racetrajectory_optimization</a>, <a href="https://github.com/TUMFTM/racetrack-database" target="_blank" rel="noopener noreferrer">racetrack-database</a> (LGPL-3.0) · ${esc(t.gen)} <span data-no-translate>${esc(simMeta.generatedAt)}</span></p></section>
<script>(${simClient.toString()})()</script>`;
}

// Browser script: linear estimate from the precomputed sensitivities.
function simClient(){
 const box=document.getElementById('sim-whatif');if(!box)return;
 const base=+box.dataset.base,m=+box.dataset.mass,p=+box.dataset.power,g=box.dataset.grip.split(',').map(Number);
 const ids=['sim-mass','sim-power','sim-grip1','sim-grip2','sim-grip3'],units=['kg','kW','%','%','%'];
 const el=id=>document.getElementById(id),fmt=s=>{const mm=Math.floor(s/60);return (mm?mm+':':'')+(s-mm*60).toFixed(3).padStart(mm?6:5,'0');};
 const update=()=>{
  const v=ids.map(id=>+el(id).value);
  ids.forEach((id,i)=>{el(id+'-out').textContent=(v[i]>0?'+':'')+v[i]+' '+units[i];});
  const d=v[0]/10*m+v[1]/10*p+v[2]/3*g[0]+v[3]/3*g[1]+v[4]/3*g[2];
  el('sim-delta').textContent=(d>0.0005?'+':d<-0.0005?'−':'±')+Math.abs(d).toFixed(3)+' s';
  const dir=el('sim-dir');dir.textContent=d<-0.0005?dir.dataset.faster:d>0.0005?dir.dataset.slower:dir.dataset.same;
  box.dataset.trend=d<-0.0005?'faster':d>0.0005?'slower':'same';
  el('sim-new').textContent=fmt(base+d);
 };
 ids.forEach(id=>el(id).addEventListener('input',update));
 el('sim-reset').addEventListener('click',()=>{ids.forEach(id=>{el(id).value=0;});update();});
}

const simCss=`:root{--sim-slow:#ffa94d}:root[data-theme="light"]{--sim-slow:#245d9c}@media(prefers-color-scheme:light){:root:not([data-theme]){--sim-slow:#245d9c}}.sim-trace-scroll{overflow-x:auto}.sim-hero h1{font-size:44px;max-width:22ch}.sim-pick{display:flex;max-width:360px}.sim-stage{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr);gap:40px;align-items:center}.sim-map-wrap{margin:0;display:grid;gap:12px}.sim-map{width:100%;height:auto;max-height:520px}.sim-start{fill:var(--text)}.sim-sector-dot{fill:var(--bg);stroke:var(--text);stroke-width:2}.sim-map-label{fill:var(--muted);font-weight:700;text-anchor:middle}.sim-map-wrap figcaption{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}.sim-legend{order:1;width:120px;height:8px;border-radius:4px;background:linear-gradient(90deg,var(--sim-slow),var(--mint))}.sim-map-wrap figcaption span:last-child{order:2}.sim-readout{display:grid;gap:6px;align-content:center}.sim-track{font-size:20px;font-weight:700;color:var(--text)}.sim-label{font-size:13px;color:var(--muted)}.sim-lap{font-size:clamp(56px,7vw,88px);line-height:1;font-weight:800;letter-spacing:-2px;color:var(--mint);font-variant-numeric:tabular-nums;margin-bottom:18px}.sim-facts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px 20px;margin:0;padding-top:18px;border-top:1px solid var(--line)}.sim-facts dt{font-size:12px;color:var(--muted)}.sim-facts dd{margin:4px 0 0;font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}.sim-trace{width:100%;height:auto}.sim-line{fill:none;stroke:var(--mint);stroke-width:2.5;stroke-linejoin:round}.sim-grid{stroke:var(--line);stroke-width:1}.sim-axis{fill:var(--muted);font-size:13px}.sim-band-a{fill:transparent}.sim-band-b{fill:var(--text);opacity:.04}.sim-whatif-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(220px,1fr);gap:32px;align-items:start}.sim-sliders{display:grid;gap:14px}.sim-slider{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,2fr) 64px;align-items:center;gap:12px;min-width:0}.sim-slider input{min-height:32px;padding:0;accent-color:var(--mint);border:0;background:none}.sim-slider output{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}#sim-reset{justify-self:start}.sim-result{display:grid;gap:4px;padding:20px;border-radius:12px;background:var(--bg)}.sim-delta{font-size:44px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--text)}.sim-whatif[data-trend=faster] .sim-delta{color:var(--mint)}.sim-dir{margin-bottom:12px;color:var(--text)}.sim-new{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text)}.sim-read ul,.sim-model ul{margin:0;padding-left:20px;display:grid;gap:10px;line-height:1.7;color:var(--muted);max-width:75ch}.sim-read li{color:var(--text)}@media(max-width:900px){.sim-stage,.sim-whatif-grid{grid-template-columns:1fr;gap:24px}.sim-hero h1{font-size:32px}}@media(max-width:520px){.sim-trace{min-width:640px}.sim-slider{grid-template-columns:1fr 64px}.sim-slider span{grid-column:1/-1}.sim-facts{grid-template-columns:1fr 1fr}.sim-delta{font-size:36px}}`;
