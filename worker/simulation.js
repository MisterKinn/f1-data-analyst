// /simulation — lap simulator page. The physics runs in worker/lapsim/kernel.js on the server
// (first render) and in the browser (every change), so sliders answer instantly.
import {lapsimKernel} from './lapsim/kernel.js';
import {lapsimTracks} from './lapsim/tracks-data.js';
import {lapsimCalibration} from './lapsim/calibration-data.js';
import {RULE_CHANGES} from './lapsim/cars.js';
import {SERIES} from './lapsim/series.js';
import {carsFor as scenarioCars, realConditions, latestChanges, fittedYear, CAR_ORDER} from './lapsim/scenario.js';
import {TRACK_NAMES as NAMES} from './lapsim/names.js';
import {energyLimit} from './lapsim/energy-limits.js';

const K = lapsimKernel();
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const trackName = (id, lang) => (NAMES[id] || [lapsimTracks[id]?.name || id, lapsimTracks[id]?.name || id])[lang === 'en' ? 1 : 0];

const T = {
  ko: {
    title: '랩 시뮬레이터', h1: '2026–2028 F1 머신으로 한 바퀴를 계산합니다',
    lead: '실제 예선 랩으로 보정한 물리 모델이 지금의 트랙 형상, 예선 날씨, FIA가 공지한 서킷 변경 사항을 반영해 랩타임과 속도를 계산합니다.',
    track: '트랙', car: '머신', compare: '비교', none: '없음', conditions: '조건', real: '실제 예선 조건', manual: '직접 설정',
    lap: '계산된 랩타임', vsPole: '실제 폴', realLap: '실제 랩', wecBest: '실제 예선·하이퍼폴 최고', errRange: '오차 범위(1σ)', conf: {medium: '신뢰도 보통', low: '신뢰도 낮음', 'very-low': '신뢰도 매우 낮음', 'not-fitted': '실측 보정 전'},
    soon: '준비 중: 기타 GT3(IMSA GTD·DTM·SP9), 포뮬러 E Gen4. 같은 보정 규칙을 쓰며 데이터 연결 후 추가됩니다.', sector: '섹터', vmax: '최고 속도', vmin: '최저 속도', energy: '배치 에너지', clip: '배치 상한 속도',
    map: '속도로 칠한 주행 라인', slow: '느림', fast: '빠름', trace: '거리별 속도', km: '거리 (km)',
    air: '공기', airTemp: '기온', trackTemp: '노면 온도', humidity: '습도', pressure: '기압', wind: '풍속', windFrom: '바람 방향',
    recharge: '퀄리 회생 한도', energy_official: 'FIA PU 문서', energy_provisional: 'FIA 잠정값, 보도 기준', energy_estimated: '추정', density: '공기 밀도', seaLevel: '해수면 표준 대비', ice: '엔진 출력', grip: '타이어 그립', mainStraight: '메인 스트레이트',
    headwind: '맞바람', tailwind: '뒷바람', calm: '무풍', fia: 'FIA 서킷 변경 사항', fiaLead: '레이스 디렉터 노트의 “Changes to the circuit” 목록입니다. 랩에 영향을 주는 항목은 켜고 끌 수 있으며, 효과 크기는 가정값입니다.',
    inFit: y => `${y}년 실제 랩으로 머신을 보정할 때 이미 반영된 변경 사항입니다. 켜면 효과가 한 번 더 더해집니다.`, notInFit: '아직 보정에 쓴 실제 랩에는 없는 변경 사항입니다. 켜서 효과를 미리 계산해 보세요.',
    strength: '효과 크기', apply: '적용', noLap: '랩타임 영향 없음', noChanges: '이 트랙의 공지된 변경 사항이 아직 없습니다.',
    calib: '보정과 예측', calibLead: '실제 폴 랩의 속도 기록과 랩타임에 맞춰 머신 값을 찾았습니다.', fitErr: '랩타임 오차', speedRms: '속도 오차(RMS)',
    proj: '2027–2028 예측', projRules: '확정된 파워유닛 규정 변경', projDev: '규정 주기 2·3년 차의 역대 개발 속도',
    model: '이 계산의 범위', pending: '데이터 준비 중', pendingLead: '트랙과 보정 데이터를 만드는 중입니다. 잠시 후 다시 확인해 주세요.',
    calibrated: '실측 보정', prior: '규정값 기반', projected: '예측',
    m1: '트랙 형상은 OpenF1의 예선 차량 위치(여러 드라이버의 베스트 랩)로 만든 실제 주행 라인입니다. 코너 번호는 공식 위치, 방위는 실제 지도와 맞췄습니다.',
    m2: '2019 기준 머신은 TUM(뮌헨공대)이 공개한 범용 F1 모델이고, 2025·2026 머신은 실제 폴 랩에 맞춰 보정했습니다.',
    m3: '2026년 규정: MGU-K 350kW(290km/h 이상에서 감소, 345km/h에서 0), 배터리 사용 폭 4MJ, 랩당 회생 최대 8.5MJ (Section C 5.2, Issue 21). 퀄리파잉 회생 한도는 FIA가 서킷별로 정한 값(5–9MJ, 언론 보도 기준)을 씁니다.',
    m4: '노면 온도에 따른 그립, 고도에 따른 엔진 출력 감소, FIA 변경 사항의 효과는 가정값입니다. 측정값처럼 읽지 마세요.',
    m5: '준정상상태 모델이라 변속, 타이어 온도 변화, 차 사이 간섭, 풀스로틀 중 회생(슈퍼 클리핑)은 계산하지 않습니다. 절대값보다 차이와 경향을 보는 데 쓰세요.',
    src: '자료', updated: '보정일',
  },
  en: {
    title: 'Lap simulator', h1: 'Simulate a lap in a 2026–2028 F1 car',
    lead: 'A physics model calibrated on real qualifying laps works out lap time and speed on today’s track layout, with qualifying weather and the circuit changes the FIA has announced.',
    track: 'Track', car: 'Car', compare: 'Compare', none: 'None', conditions: 'Conditions', real: 'Real qualifying conditions', manual: 'Set my own',
    lap: 'Simulated lap time', vsPole: 'Real pole', realLap: 'Real lap', wecBest: 'Real qualifying/Hyperpole best', errRange: 'Error range (1σ)', conf: {medium: 'medium confidence', low: 'low confidence', 'very-low': 'very low confidence', 'not-fitted': 'not fitted to real laps'},
    soon: 'Coming soon: other GT3 (IMSA GTD, DTM, SP9) and Formula E Gen4. They use the same calibration rules and are added once their data is connected.', sector: 'Sector', vmax: 'Top speed', vmin: 'Lowest speed', energy: 'Energy deployed', clip: 'Deploy cut-off',
    map: 'Racing line coloured by speed', slow: 'Slow', fast: 'Fast', trace: 'Speed over distance', km: 'Distance (km)',
    air: 'Air', airTemp: 'Air temperature', trackTemp: 'Track temperature', humidity: 'Humidity', pressure: 'Pressure', wind: 'Wind speed', windFrom: 'Wind from',
    recharge: 'Qualifying recharge limit', energy_official: 'FIA PU document', energy_provisional: 'FIA provisional, press', energy_estimated: 'estimated', density: 'Air density', seaLevel: 'vs standard sea level', ice: 'Engine power', grip: 'Tyre grip', mainStraight: 'Main straight',
    headwind: 'headwind', tailwind: 'tailwind', calm: 'calm', fia: 'FIA circuit changes', fiaLead: 'The “Changes to the circuit” list from the race director’s notes. Items that affect the lap can be switched on or off; their size is an assumption.',
    inFit: y => `These changes were already in the real ${y} lap the cars were fitted to; switching them on adds them a second time.`, notInFit: 'These changes are not in the real laps used for fitting yet: switch them on to estimate their effect.',
    strength: 'Effect size', apply: 'Apply', noLap: 'No lap-time effect', noChanges: 'No announced changes for this track yet.',
    calib: 'Calibration and projection', calibLead: 'Car values were fitted to the speed trace and lap time of real pole laps.', fitErr: 'Lap-time error', speedRms: 'Speed error (RMS)',
    proj: '2027–2028 projection', projRules: 'Ratified power-unit rule changes', projDev: 'Historical development in years 2 and 3 of a rules cycle',
    model: 'What this calculation covers', pending: 'Data in preparation', pendingLead: 'Track and calibration data are being built. Please check back shortly.',
    calibrated: 'Fitted to real laps', prior: 'From the regulations', projected: 'Projection',
    m1: 'Track shapes are the real driving line built from OpenF1 car positions in qualifying (several drivers’ best laps). Corners use official positions; headings are aligned to real maps.',
    m2: 'The 2019 base car is TUM’s published generic F1 model; the 2025 and 2026 cars are fitted to real pole laps.',
    m3: '2026 rules: MGU-K 350 kW (reduced above 290 km/h, zero at 345 km/h), 4 MJ battery window, up to 8.5 MJ recharge per lap (Section C 5.2, Issue 21). Qualifying uses the per-circuit recharge limit the FIA sets (5–9 MJ, from press reports).',
    m4: 'Grip versus track temperature, engine power loss with altitude and the effect of FIA changes are assumptions, not measurements.',
    m5: 'A quasi-steady-state model ignores gear shifts, tyre temperature, car-to-car effects and harvesting at full throttle (super-clipping). Use it for differences and trends rather than absolute times.',
    src: 'Sources', updated: 'Calibrated',
  },
};

function fmtLap(s) { if (!Number.isFinite(s)) return '–'; const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); }

// Cars offered on the page, with the per-track grip factor from calibration
function carsFor(id, lang) {
  const t = T[lang], label = {base2019: lang === 'en' ? '2019 base (TUM)' : '2019 기준 (TUM)', 2027: `2027 (${t.projected})`, 2028: `2028 (${t.projected})`};
  const wec = c => `WEC ${SERIES.wec.classes[c.cls].label[lang]} ${c.year}`;
  return Object.fromEntries(Object.entries(scenarioCars(id)).map(([k, c]) => [k, {...c, label: c.series ? wec(c) : label[k] || k}]));
}

// --- Rendering (shared with the browser; must only use its arguments) ---
function renderMap(map, v, opts) {
  const xs = map.x, ys = map.y, n = xs.length;
  if (!n) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]); minY = Math.min(minY, ys[i]); maxY = Math.max(maxY, ys[i]); }
  const w = maxX - minX, h = maxY - minY, pad = Math.max(w, h) * 0.08, vw = w + 2 * pad, vh = h + 2 * pad;
  const px = i => (xs[i] - minX + pad).toFixed(1), py = i => (maxY - ys[i] + pad).toFixed(1);
  const vAt = i => v[Math.min(v.length - 1, Math.round(i * v.length / n))];
  let lo = Infinity, hi = -Infinity; for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const bucket = i => Math.min(5, Math.floor((vAt(i) - lo) / (hi - lo + 1e-9) * 6));
  let paths = '', run = [0], b = bucket(0);
  const flush = () => { if (run.length > 1) paths += '<path d="M' + run.map(i => px(i) + ' ' + py(i)).join('L') + '" stroke="color-mix(in oklab,var(--mint) ' + (b * 20) + '%,var(--sim-slow))"/>'; };
  for (let i = 1; i < n; i++) { run.push(i); const nb = bucket(i); if (nb !== b) { flush(); run = [i]; b = nb; } }
  run.push(0); flush();
  const sw = (Math.max(vw, vh) / 110).toFixed(1);
  let corners = '';
  for (const c of opts.corners || []) {
    const i = Math.min(n - 1, Math.round(c.s / opts.length * n));
    corners += '<text x="' + px(i) + '" y="' + py(i) + '" dy="' + (-sw * 2.2).toFixed(1) + '" class="ls-corner">' + c.number + (c.letter || '') + '</text>';
  }
  return '<svg class="ls-map" viewBox="0 0 ' + vw.toFixed(0) + ' ' + vh.toFixed(0) + '" role="img" aria-label="' + opts.label + '"><g fill="none" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' + paths + '</g><rect x="' + (px(0) - sw * 2) + '" y="' + (py(0) - sw * 2) + '" width="' + (sw * 4) + '" height="' + (sw * 4) + '" class="ls-start"/>' + corners + '<style>.ls-corner{font-size:' + (sw * 3.4).toFixed(1) + 'px}</style></svg>';
}

function renderTrace(ds, series, opts) {
  const W = 1000, H = 280, L = 48, B = 30, top = 12, n = series[0].v.length, len = n * ds;
  let lo = Infinity, hi = -Infinity;
  for (const s of series) for (const x of s.v) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  lo = Math.floor(lo / 50) * 50; hi = Math.ceil(hi / 50) * 50;
  const x = d => (L + d / len * (W - L - 8)).toFixed(1), y = v => (top + (1 - (v - lo) / (hi - lo)) * (H - top - B)).toFixed(1);
  let grid = '';
  for (let v = lo; v <= hi; v += 50) grid += '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="ls-grid"/><text x="' + (L - 6) + '" y="' + y(v) + '" dy="4" text-anchor="end" class="ls-axis">' + v + '</text>';
  for (let k = 0; k <= len / 1000; k++) grid += '<text x="' + x(k * 1000) + '" y="' + (H - 8) + '" text-anchor="middle" class="ls-axis">' + k + '</text>';
  for (const sb of opts.sectors || []) grid += '<line x1="' + x(sb) + '" x2="' + x(sb) + '" y1="' + top + '" y2="' + (H - B) + '" class="ls-sector"/>';
  let lines = '';
  series.forEach((s, j) => {
    let d = '';
    for (let i = 0; i < n; i++) d += (i ? 'L' : 'M') + x(i * ds) + ' ' + y(s.v[i]);
    lines += '<path d="' + d + '" class="ls-line ls-line-' + j + '"/>';
  });
  return '<svg class="ls-trace" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + opts.label + '">' + grid + lines + '<text x="' + (W - 8) + '" y="' + (H - 8) + '" text-anchor="end" class="ls-axis">' + opts.km + '</text><text x="' + (L + 6) + '" y="' + (top + 14) + '" class="ls-axis">km/h</text></svg>';
}

// --- Page ---
export function simulationPage(query = {}, lang = 'ko', liveEnergy = null) {
  lang = lang === 'en' ? 'en' : 'ko';
  const t = T[lang], ids = Object.keys(lapsimTracks).sort((a, b) => trackName(a, lang).localeCompare(trackName(b, lang), lang));
  if (!ids.length) return `<section class="hero ls-hero"><h1>${esc(t.h1)}</h1><p class="lead">${esc(t.pending)} · ${esc(t.pendingLead)}</p></section>`;
  const id = ids.includes(query.track) ? query.track : (ids.includes('monza') ? 'monza' : ids[0]);
  const td = lapsimTracks[id], cars = carsFor(id, lang), conds = realConditions(id);
  const carId = cars[query.car] ? query.car : '2026';
  const changes = latestChanges(id);
  const data = {lang, t, id, track: td, cars, carOrder: CAR_ORDER, carId, conds, changes, energy: (liveEnergy && (query.track || 'monza') === id ? liveEnergy : energyLimit(id, 2026)),
    calibration: {generatedAt: lapsimCalibration?.generatedAt || null, seasons: Object.fromEntries(Object.entries(lapsimCalibration?.seasons || {}).map(([y, s]) => [y, s.tracks?.[id] || null]))}};
  // first render on the server with the same code the browser uses
  const view = computeView(K, data, {carId, compareId: '', mode: 'real', manual: null, active: {}, strength: 1}, {renderMap, renderTrace});
  const options = ids.map(k => `<option value="${esc(k)}"${k === id ? ' selected' : ''}>${esc(trackName(k, lang))}</option>`).join('');
  const carOpts = sel => data.carOrder.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(cars[k].label)}</option>`).join('');
  const slider = (key, label, min, max, step, unit) => `<label class="ls-slider"><span>${esc(label)}</span><input type="range" data-cond="${key}" min="${min}" max="${max}" step="${step}"><output data-out="${key}"></output><span class="ls-unit">${unit}</span></label>`;
  const changeRows = changes?.changes?.length ? changes.changes.map((c, i) => `<li class="ls-change${c.affectsLap ? '' : ' is-info'}"><label>${c.affectsLap ? `<input type="checkbox" data-change="${i}">` : '<span class="ls-dot" aria-hidden="true"></span>'}<span><span class="ls-change-text" data-no-translate lang="en">${esc(c.text)}</span><small>${esc(c.affectsLap ? (lang === 'en' ? c.effect.en : c.effect.ko) : t.noLap)}</small></span></label></li>`).join('') : '';
  const s = data.calibration.seasons;
  const calRows = ['2025', '2026'].filter(y => s[y]).map(y => `<tr><td>${y}</td><td data-no-translate>${fmtLap(s[y].realLap)}${s[y].position > 1 ? ` (P${s[y].position})` : ''}</td><td data-no-translate>${fmtLap(s[y].simLap)}</td><td data-no-translate>${s[y].errorSec > 0 ? '+' : ''}${s[y].errorSec.toFixed(3)} s</td><td data-no-translate>${s[y].rmsKph} km/h</td></tr>`).join('');
  const proj = lapsimCalibration?.projections || {};
  const projRows = [2027, 2028].map(y => proj[y] ? `<li><strong>${y}</strong> — ${esc(t.projRules)}: ${esc(RULE_CHANGES[y].note[lang])} (${proj[y].rulesEffectPct > 0 ? '+' : ''}${proj[y].rulesEffectPct}%). ${esc(t.projDev)}: ${proj[y].developmentTargetPct}% (${proj[y].bandPct[0]} … ${proj[y].bandPct[1]}%).</li>` : `<li><strong>${y}</strong> — ${esc(t.projRules)}: ${esc(RULE_CHANGES[y].note[lang])}</li>`).join('');
  return `<style>${CSS}</style>
<section class="hero ls-hero"><h1>${esc(t.h1)}</h1><p class="lead">${esc(t.lead)}</p></section>
<form class="ls-controls" method="get" action="/simulation">
 <label>${esc(t.track)}<select name="track" data-no-translate onchange="this.form.submit()">${options}</select></label>
 <label>${esc(t.car)}<select name="car" data-ls="car">${carOpts(carId)}</select></label>
 <label>${esc(t.compare)}<select data-ls="compare"><option value="">${esc(t.none)}</option>${carOpts('')}</select></label>
 <label>${esc(t.conditions)}<select data-ls="mode"><option value="real">${esc(t.real)}</option><option value="manual">${esc(t.manual)}</option></select></label>
 <noscript><button>${esc(t.track)}</button></noscript>
</form>
<section class="ls-stage">
 <figure class="ls-map-wrap"><div data-ls="map">${view.mapSvg}</div><figcaption><span class="ls-legend" aria-hidden="true"></span><span>${esc(t.slow)}</span><span>${esc(t.fast)}</span><span class="ls-windkey" data-ls="wind">${view.windHtml}</span></figcaption></figure>
 <div class="ls-readout">
  <p class="ls-track" data-no-translate>${esc(trackName(id, lang))}</p>
  <p class="ls-label"><span data-ls="carLabel">${esc(cars[carId].label)}</span> · <span data-ls="carKind">${esc(view.kindLabel)}</span></p>
  <p class="ls-lap" data-ls="lap" data-no-translate>${view.lap}</p>
  <p class="ls-pole" data-ls="pole">${view.poleHtml}</p>
  <dl class="ls-facts" data-ls="facts">${view.factsHtml}</dl>
 </div>
</section>
<section class="panel ls-panel"><h2>${esc(t.trace)}</h2><div class="ls-scroll" data-ls="trace">${view.traceSvg}</div><p class="ls-key" data-ls="key">${view.keyHtml}</p></section>
<section class="panel ls-panel ls-air"><h2>${esc(t.air)}</h2>
 <dl class="ls-facts ls-air-facts" data-ls="air">${view.airHtml}</dl>
 <div class="ls-sliders" data-ls="manual" hidden>${slider('airTempC', t.airTemp, -5, 45, 0.5, '°C')}${slider('trackTempC', t.trackTemp, 5, 65, 0.5, '°C')}${slider('humidityPct', t.humidity, 0, 100, 1, '%')}${slider('pressureHpa', t.pressure, 760, 1040, 1, 'hPa')}${slider('windSpeed', t.wind, 0, 15, 0.1, 'm/s')}${slider('windFromDeg', t.windFrom, 0, 359, 1, '°')}</div>
</section>
<section class="panel ls-panel"><h2>${esc(t.fia)}</h2><p>${esc(t.fiaLead)}</p>
 ${changes ? `<p class="fine"><a href="${esc(changes.document.url)}" target="_blank" rel="noopener noreferrer" data-no-translate>${esc(changes.event)} · ${esc(changes.document.title)}</a></p><p class="fine">${esc(fittedYear(id) >= changes.year ? t.inFit(fittedYear(id)) : t.notInFit)}</p><ul class="ls-changes">${changeRows}</ul><label class="ls-slider ls-strength"><span>${esc(t.strength)}</span><input type="range" data-ls="strength" min="0" max="2" step="0.25" value="1"><output data-ls="strengthOut">×1</output></label>` : `<p class="fine">${esc(t.noChanges)}</p>`}
</section>
<section class="panel ls-panel"><h2>${esc(t.calib)}</h2><p>${esc(t.calibLead)}</p>
 ${calRows ? `<div class="output"><table class="ls-table"><thead><tr><th></th><th>${esc(t.vsPole)}</th><th>${esc(t.lap)}</th><th>${esc(t.fitErr)}</th><th>${esc(t.speedRms)}</th></tr></thead><tbody>${calRows}</tbody></table></div>` : `<p class="fine">${esc(t.pendingLead)}</p>`}
 <h3>${esc(t.proj)}</h3><ul class="ls-notes">${projRows}</ul>
</section>
<section class="panel ls-panel"><h2>${esc(t.model)}</h2><ul class="ls-notes"><li>${esc(t.m1)}</li><li>${esc(t.m2)}</li><li>${esc(t.m3)}</li><li>${esc(t.m4)}</li><li>${esc(t.m5)}</li><li>${esc(t.soon)}</li></ul>
 <p class="fine">${esc(t.src)}: <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1</a>, MultiViewer, <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noopener noreferrer">f1-circuits</a>, <a href="https://github.com/f1db/f1db" target="_blank" rel="noopener noreferrer">f1db</a> (CC BY 4.0), <a href="https://github.com/TUMFTM/laptime-simulation" target="_blank" rel="noopener noreferrer">TUMFTM laptime-simulation</a>, FIA Section C Issue 21${data.calibration.generatedAt ? ` · ${esc(t.updated)} <span data-no-translate>${esc(data.calibration.generatedAt)}</span>` : ''}</p>
</section>
<script type="application/json" id="lapsim-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="/assets/lapsim.js?v=${lapsimScriptVersion()}" defer></script>`;
}

// One computation for a given UI state. Used on the server and (as source text) in the browser.
function computeView(K, data, state, R) {
  const t = data.t, d = data.track;
  if (!computeView.cache || computeView.cache.id !== data.id) computeView.cache = {id: data.id, base: K.trackFromData(d)};
  const base = computeView.cache.base;
  const sel = data.cars[state.carId];
  // conditions: real (season of the selected car, else 2026) or manual
  const condKey = sel.series ? state.carId : String(sel.year);
  const yearKey = data.conds[condKey] ? condKey : (data.conds['2026'] ? '2026' : Object.keys(data.conds)[0]);
  const w = Object.assign({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0},
    Object.fromEntries(Object.entries(state.mode === 'manual' && state.manual ? state.manual : (data.conds[yearKey] || {})).filter(([, v]) => Number.isFinite(v))));
  // per-event ERS recharge limit for 2026+ cars (ignored by older rule sets)
  const env = K.conditionsFromWeather({...w, rechargeMJ: data.energy?.mj ?? undefined});
  // FIA changes switched on by the user
  let track = base;
  const active = (data.changes?.changes || []).filter((c, i) => state.active[i]);
  if (active.length) track = K.applyTrackChanges(base, active, d.corners || [], {strength: state.strength}).track;
  const withGrip = (tr, g) => { const n = tr.kappa.length, mu = new Float64Array(n); for (let i = 0; i < n; i++) mu[i] = g * tr.mu[i]; return {...tr, mu}; };
  const run = c => K.simulateLap(withGrip(track, c.grip || 1), c.car, env);
  const res = run(sel);
  const cmp = state.compareId && data.cars[state.compareId] ? run(data.cars[state.compareId]) : null;
  const fmt = s => { if (!Number.isFinite(s)) return '–'; const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); };
  const sectors = d.sectors && d.sectors.length === 2 ? (() => { const i1 = Math.round(d.sectors[0] / d.ds), i2 = Math.round(d.sectors[1] / d.ds); return [res.time[i1], res.time[i2] - res.time[i1], res.lapTime - res.time[i2]]; })() : null;
  const real = data.conds[condKey];
  const sameConditions = state.mode !== 'manual' && !active.length;
  const poleHtml = real && real.realLap && sameConditions && sel.kind === 'calibrated'
    ? (sel.series ? t.wecBest : real.position > 1 ? t.realLap + ' P' + real.position : t.vsPole) + ' <span data-no-translate>' + fmt(real.realLap) + '</span> · <span data-no-translate>' + ((res.lapTime - real.realLap) >= 0 ? '+' : '−') + Math.abs(res.lapTime - real.realLap).toFixed(3) + ' s</span>'
    : (cmp ? data.cars[state.compareId].label + ' <span data-no-translate>' + fmt(cmp.lapTime) + ' · ' + ((res.lapTime - cmp.lapTime) >= 0 ? '+' : '−') + Math.abs(res.lapTime - cmp.lapTime).toFixed(3) + ' s</span>' : '');
  const fact = (k, v) => '<div><dt>' + k + '</dt><dd data-no-translate>' + v + '</dd></div>';
  let factsHtml = '';
  if (sel.unc) factsHtml += fact(t.errRange, (sel.unc.pct ? '±' + (res.lapTime * sel.unc.pct / 100).toFixed(2) + ' s · ' : '') + t.conf[sel.unc.confidence]);
  if (sectors) sectors.forEach((x, i) => { factsHtml += fact(t.sector + ' ' + (i + 1), x.toFixed(3)); });
  factsHtml += fact(t.vmax, Math.round(res.vMaxKph) + ' km/h') + fact(t.vmin, Math.round(res.vMinKph) + ' km/h');
  if (sel.car.ers?.pMax) factsHtml += fact(t.energy, (res.energy.deployJ / 1e6).toFixed(1) + ' / ' + (res.energy.budgetJ / 1e6).toFixed(1) + ' MJ') + fact(t.clip, res.energy.cutoffKph ? Math.round(res.energy.cutoffKph) + ' km/h' : '–');
  // wind on the main straight (the straight the lap starts on)
  let windTxt = t.calm;
  if (env.windSpeed > 0.3 && base.heading) {
    const tw = K.tailwind(base.heading[2], env.windSpeed, env.windFromDeg);
    windTxt = Math.abs(tw) < 0.3 ? t.calm : (tw > 0 ? t.tailwind : t.headwind) + ' ' + Math.abs(tw).toFixed(1) + ' m/s';
  }
  const pct = x => (x >= 1 ? '+' : '−') + Math.abs((x - 1) * 100).toFixed(1) + '%';
  const airHtml = fact(t.airTemp, w.airTempC.toFixed(1) + ' °C') + fact(t.trackTemp, w.trackTempC.toFixed(1) + ' °C') + fact(t.humidity, Math.round(w.humidityPct) + '%')
    + fact(t.pressure, Math.round(w.pressureHpa) + ' hPa') + fact(t.density, env.rho.toFixed(3) + ' kg/m³ (' + pct(env.rho / 1.225) + ' ' + t.seaLevel + ')')
    + fact(t.ice, pct(env.iceFactor)) + fact(t.grip, pct(env.grip)) + fact(t.mainStraight, windTxt)
    + (data.energy && sel.car.ers?.rule === 'f1-2026' ? fact(t.recharge, data.energy.mj + ' MJ (' + (t['energy_' + data.energy.status] || data.energy.status) + ')') : '');
  const kindLabel = sel.kind === 'calibrated' ? t.calibrated : sel.kind === 'projected' ? t.projected : sel.kind === 'prior' ? t.prior : 'TUM';
  const mapSvg = R.renderMap(d.map || {x: [], y: []}, res.v, {corners: d.corners, length: d.length, label: t.map});
  // compass arrow pointing where the wind blows to (map north is up)
  const windHtml = env.windSpeed > 0.3 ? '<svg class="ls-compass" width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -8L5 5L0 2L-5 5Z" transform="rotate(' + Math.round((env.windFromDeg + 180) % 360) + ')"/></svg><span>' + t.wind + ' <span data-no-translate>' + env.windSpeed.toFixed(1) + ' m/s</span></span>' : '';
  const series = [{v: res.v.map(x => x * 3.6)}];
  if (cmp) series.push({v: cmp.v.map(x => x * 3.6)});
  const traceSvg = R.renderTrace(d.ds, series, {sectors: d.sectors || [], label: t.trace, km: t.km});
  const keyHtml = '<span class="ls-key-0"></span>' + sel.label + (cmp ? ' <span class="ls-key-1"></span>' + data.cars[state.compareId].label : '');
  return {lap: fmt(res.lapTime), poleHtml, factsHtml, airHtml, kindLabel, mapSvg, traceSvg, keyHtml, windHtml, weather: w};
}

// Browser controller
function lapsimClient(K, computeView, renderMap, renderTrace) {
  const el = document.getElementById('lapsim-data'); if (!el) return;
  const R = {renderMap, renderTrace};
  const data = JSON.parse(el.textContent);
  const q = s => document.querySelector('[data-ls="' + s + '"]');
  const yearKey = data.conds['2026'] ? '2026' : Object.keys(data.conds)[0];
  const state = {carId: data.carId, compareId: '', mode: 'real', manual: Object.assign({pressureHpa: 1013, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, data.conds[yearKey] || {}), active: {}, strength: 1};
  const sliders = document.querySelectorAll('[data-cond]');
  const syncSliders = () => sliders.forEach(s => { const k = s.dataset.cond, v = state.manual[k]; if (Number.isFinite(v)) s.value = v; const o = document.querySelector('[data-out="' + k + '"]'); if (o) o.textContent = Number(s.value).toFixed(s.step < 1 ? 1 : 0); });
  let pending = false;
  const update = () => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const v = computeView(K, data, state, R);
      q('lap').textContent = v.lap; q('pole').innerHTML = v.poleHtml; q('facts').innerHTML = v.factsHtml; q('air').innerHTML = v.airHtml;
      q('map').innerHTML = v.mapSvg; q('trace').innerHTML = v.traceSvg; q('key').innerHTML = v.keyHtml; q('wind').innerHTML = v.windHtml;
      q('carLabel').textContent = data.cars[state.carId].label; q('carKind').textContent = v.kindLabel;
    });
  };
  q('car').addEventListener('change', e => { state.carId = e.target.value; const u = new URL(location.href); u.searchParams.set('car', state.carId); history.replaceState(null, '', u); update(); });
  q('compare').addEventListener('change', e => { state.compareId = e.target.value; update(); });
  q('mode').addEventListener('change', e => { state.mode = e.target.value; q('manual').hidden = state.mode !== 'manual'; if (state.mode === 'manual') { const c = data.cars[state.carId], real = data.conds[c.series ? state.carId : String(c.year)]; if (real) Object.assign(state.manual, real); syncSliders(); } update(); });
  sliders.forEach(s => s.addEventListener('input', () => { state.manual[s.dataset.cond] = Number(s.value); syncSliders(); update(); }));
  document.querySelectorAll('[data-change]').forEach(c => c.addEventListener('change', () => { state.active[c.dataset.change] = c.checked; update(); }));
  const st = q('strength'); if (st) st.addEventListener('input', () => { state.strength = Number(st.value); q('strengthOut').textContent = '×' + state.strength; update(); });
  syncSliders();
}

let scriptText = null;
export function lapsimScript() {
  if (!scriptText) scriptText = '(()=>{const K=(' + lapsimKernel.toString() + ')();const renderMap=' + renderMap.toString() + ';const renderTrace=' + renderTrace.toString() + ';const computeView=' + computeView.toString() + ';(' + lapsimClient.toString() + ')(K,computeView,renderMap,renderTrace);})();';
  return scriptText;
}
export function lapsimScriptVersion() {
  const text = lapsimScript(); let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

const CSS = `:root{--sim-slow:#ffa94d}:root[data-theme="light"]{--sim-slow:#245d9c}@media(prefers-color-scheme:light){:root:not([data-theme]){--sim-slow:#245d9c}}
.ls-hero h1{font-size:44px;max-width:20ch}.ls-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.ls-controls label{min-width:0}.ls-controls select{width:100%}
.ls-stage{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,1fr);gap:40px;align-items:center}.ls-map-wrap{margin:0;display:grid;gap:12px}.ls-map{width:100%;height:auto;max-height:540px;color:var(--text)}
.ls-start{fill:var(--text)}.ls-corner{fill:var(--muted);text-anchor:middle;font-weight:600}
.ls-map-wrap figcaption{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}.ls-legend{order:1;width:120px;height:8px;border-radius:4px;background:linear-gradient(90deg,var(--sim-slow),var(--mint))}.ls-map-wrap figcaption>span:nth-child(3){order:2}.ls-windkey{order:3;margin-left:auto;display:inline-flex;align-items:center;gap:6px}.ls-compass{fill:var(--text)}
.ls-readout{display:grid;gap:6px;align-content:center}.ls-track{font-size:20px;font-weight:700;color:var(--text)}.ls-label{font-size:13px;color:var(--muted)}
.ls-lap{font-size:clamp(56px,7vw,88px);line-height:1;font-weight:800;letter-spacing:-2px;color:var(--mint);font-variant-numeric:tabular-nums}.ls-pole{min-height:1.6em;font-size:14px;color:var(--text);margin-bottom:12px}
.ls-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 18px;margin:0;padding-top:16px;border-top:1px solid var(--line)}.ls-facts dt{font-size:12px;color:var(--muted)}.ls-facts dd{margin:4px 0 0;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text)}
.ls-air-facts{grid-template-columns:repeat(4,minmax(0,1fr));border-top:0;padding-top:0}
.ls-scroll{overflow-x:auto}.ls-trace{width:100%;height:auto;min-width:560px}.ls-grid{stroke:var(--line)}.ls-sector{stroke:var(--muted);stroke-dasharray:4 4;opacity:.6}.ls-axis{fill:var(--muted);font-size:13px}
.ls-line{fill:none;stroke-width:2.4;stroke-linejoin:round}.ls-line-0{stroke:var(--mint)}.ls-line-1{stroke:var(--sim-slow);stroke-dasharray:6 4}
.ls-key{font-size:13px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ls-key span{display:inline-block;width:22px;height:3px;border-radius:2px}.ls-key-0{background:var(--mint)}.ls-key-1{background:var(--sim-slow)}
.ls-sliders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px}.ls-slider{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,2fr) 52px 36px;align-items:center;gap:10px;min-width:0}.ls-slider input{min-height:32px;padding:0;accent-color:var(--mint);border:0;background:none}.ls-slider output{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}.ls-unit{font-size:12px;color:var(--muted)}
.ls-strength{max-width:520px;grid-template-columns:minmax(110px,1fr) minmax(0,2fr) 52px}
.ls-changes{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ls-change label{display:flex;gap:12px;align-items:flex-start;color:var(--text);font-size:14px;min-width:0}.ls-change input{width:20px;height:20px;min-height:0;margin-top:2px;accent-color:var(--mint)}.ls-change small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.ls-change.is-info label{color:var(--muted)}.ls-dot{width:20px;flex:0 0 20px;text-align:center}.ls-dot::before{content:'·'}
.ls-table td,.ls-table th{white-space:nowrap}.ls-notes{margin:0;padding-left:20px;display:grid;gap:10px;line-height:1.7;color:var(--muted);max-width:80ch}.ls-panel h3{font-size:18px;margin-top:6px}
@media(max-width:900px){.ls-stage{grid-template-columns:1fr;gap:24px}.ls-hero h1{font-size:32px}.ls-controls{grid-template-columns:1fr 1fr}.ls-air-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.ls-sliders{grid-template-columns:1fr}}
@media(max-width:520px){.ls-controls{grid-template-columns:1fr}.ls-facts{grid-template-columns:1fr 1fr}.ls-slider{grid-template-columns:1fr 52px 36px}.ls-slider>span:first-child{grid-column:1/-1}}`;
