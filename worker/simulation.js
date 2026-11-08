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
import {lapsimRace} from './lapsim/race-data.js';
import {lapsimRacingLines} from './lapsim/racing-lines-data.js';
import {lapsimCompounds} from './lapsim/compounds-data.js';
import {lapsimStints} from './lapsim/stint-data.js';
import {lapsimCompoundGap} from './lapsim/compound-gap-data.js';
import {lapsimWecTyres} from './lapsim/wec-tyres-data.js';
import {raceLaps, strategies} from './lapsim/race-pace.js';
import {evolutionCoeffs, evolutionDelta, evolutionCurve} from './lapsim/evolution.js';
import {lineTrack} from './lapsim/racing-line.js';
import {brakeZones} from './lapsim/brakes.js';
import {lapsimBrakes} from './lapsim/brake-data.js';
import {lapsimQsplit} from './lapsim/qsplit-data.js';
import {lapsimCarLines} from './lapsim/car-lines-data.js';

const K = lapsimKernel();
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const trackName = (id, lang) => (NAMES[id] || [lapsimTracks[id]?.name || id, lapsimTracks[id]?.name || id])[lang === 'en' ? 1 : 0];

const T = {
  ko: {
    title: '랩 시뮬레이터', h1: '2026–2028 F1 머신으로 한 바퀴를 계산합니다',
    lead: '실제 예선 랩으로 보정한 물리 모델이 지금의 트랙 형상, 예선 날씨, FIA가 공지한 서킷 변경 사항을 반영해 랩타임과 속도를 계산합니다.',
    track: '트랙', series: '시리즈', car: '규정 · 클래스', compare: '비교', soonShort: '준비 중',
    seriesNames: {f1: 'F1', wec: 'WEC', imsa: 'IMSA GTP', fe: '포뮬러 E', gt3: 'GT3 (GTWC · IGTC · FIA GT 월드컵 (마카오 GP) · DTM)'}, none: '없음', conditions: '조건', real: '실제 예선 조건', manual: '직접 설정',
    lap: '계산된 랩타임', vsPole: '실제 폴', realLap: '실제 랩', wecBest: '실제 예선·하이퍼폴 최고', errRange: '오차 범위(1σ)', conf: {medium: '신뢰도 보통', low: '신뢰도 낮음', 'very-low': '신뢰도 매우 낮음', 'not-fitted': '실측 보정 전'},
    soon: '준비 중: 기타 GT3(IMSA GTD·DTM·SP9), 포뮬러 E Gen4. 같은 보정 규칙을 쓰며 데이터 연결 후 추가됩니다.', sector: '섹터', vmax: '최고 속도', vmin: '최저 속도', energy: '배치 에너지', clip: '배치 상한 속도',
    map: '속도로 칠한 주행 라인', slow: '느림', fast: '빠름', trace: '거리별 속도', km: '거리 (km)',
    air: '공기', airTemp: '기온', trackTemp: '노면 온도', humidity: '습도', pressure: '기압', wind: '풍속', windFrom: '바람 방향',
    motor: '하이브리드 모터', axleFront: '앞 차축', axleRear: '뒤 차축', deployFrom: '{v} 이상에서만 구동', hybridE: '모터 사용 / 회생 (랩당)', soc: {old: '2025년까지 규정: 랩당 모터 배치 4 MJ 한도만 모델에 들어 있습니다 (MGU-H가 채우는 회생은 모델에 없어 배터리 흐름은 그리지 않습니다).', h: '배터리 에너지 (추정)', lead: 'F1·WEC 모두 실제 배터리 충전량(SoC)과 모터 사용 기록은 공개되지 않습니다. 아래는 규정 한도(배터리 사용 폭, 대회별 랩당 회생 한도)와 이 시뮬레이션 랩에서 계산한 추정값입니다.', line: '배터리에 남은 에너지', dep: '모터 배치', rec: '회생 (브레이크)', thr: '회생 (풀 스로틀, 슈퍼 클리핑)', sum: '배치 {d} MJ · 회생 {r} MJ (브레이크 {b} + 풀 스로틀 {t}){cap}', capT: ' · 한도 {c} MJ', ok: '확인: 회생 ≤ 한도 {a} · 랩 안 에너지 변동 {s} MJ ≤ 배터리 사용 폭 {w} MJ {b}', over: '({x} MJ 초과: 이 시뮬레이터는 에너지를 랩 합계로만 맞추기 때문입니다. 실제 차는 이만큼 배치를 줄이거나 순서를 바꿉니다)', start: '예선 랩: 배터리 가득 찬 상태에서 시작 (점선 = 사용 폭 한계)', hyper: '하이퍼카: 랩마다 충전 유지, 가장 낮은 지점을 0으로 둠 · 필요한 배터리 사용 폭 {s} MJ'},
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
    evo: '트랙 에볼루션', evoLead: '세션이 진행되며 고무가 쌓이고, 젖은 노면이 마르고, 타이어가 데워지면서 랩타임이 어떻게 바뀌는지 계산합니다. 기준은 위의 계산된 랩(예선 끝 노면)입니다.',
    evoType: '세션', evoTypes: {practice: '연습', qualifying: '예선'}, evoTyre: '타이어', tyres: {f1: {soft: '소프트{S}', medium: '미디엄{M}', hard: '하드{H}', inter: '인터미디엇', wet: '풀 웻'}, hypercar: {soft: '소프트 (미쉐린)', medium: '미디엄 (미쉐린)', hard: '하드 (미쉐린)', wet: '웻 (미쉐린)'}, lmgt3: {medium: '미디엄 (굿이어)', hard: '하드 (굿이어)', wet: '웻 (굿이어)'}}, tyreQ: ' · 하이퍼폴 지정',
    tyreEvent: '타이어: {y} 이 대회 공급 컴파운드', tyreSeason: '타이어: 이 서킷 대회 기록 없음, 시즌 전체 컴파운드',
    evoComp: '컴파운드 차이 (소프트 대비)', evoCompReal: '{y} 실측: 같은 드라이버 저연료 랩, 트랙 진화 제외', evoCompModel: 'C단계 모델 예측, 검증 오차 ±{e}%', evoCompNone: '실측 없음, 랩 그대로',
    evoEnd: '세션 시각', evoGain: '고무 효과 (끝까지)', evoTau: '포화 시간', evoWet: '시작 노면 젖음', evoDry: '건조 시간', evoWarm: '워밍업 랩',
    evoCurve: '실측 곡선 사용', evoLast: '이 시각의 예상 랩', evoChange: '세션 시작 대비', evoBasis: {track: '이 트랙 실측 곡선', series: '시리즈 평균 (보정)', default: '미보정 기본값'},
    evoErr: '홀드아웃 오차 (트랙 제외)', qs: {h: '구간', win: '시간 (분)', model: '모델 최고 랩', real: '실제 최고 랩', test: 'Q1·Q2 예측 검증 (대회 하나씩 빼고, {n}개 예선): Q1 {a}% · Q2 {b}% 오차. Q3 = 폴 (실측 재현)', none: '이 트랙 실제 구간 기록 없음 (보통 시간표 18·15·12분 사용)'}, secFix: '섹터 보정 (실제 폴 기준)', evoBasisH: '근거', evoChart: '세션 시각별 예상 랩타임', min: '분',
  },
  en: {
    title: 'Lap simulator', h1: 'Simulate a lap in a 2026–2028 F1 car',
    lead: 'A physics model calibrated on real qualifying laps works out lap time and speed on today’s track layout, with qualifying weather and the circuit changes the FIA has announced.',
    track: 'Track', series: 'Series', car: 'Rules · class', compare: 'Compare', soonShort: 'coming soon',
    seriesNames: {f1: 'F1', wec: 'WEC', imsa: 'IMSA GTP', fe: 'Formula E', gt3: 'GT3 (GTWC · IGTC · FIA GT World Cup (Macau GP) · DTM)'}, none: 'None', conditions: 'Conditions', real: 'Real qualifying conditions', manual: 'Set my own',
    lap: 'Simulated lap time', vsPole: 'Real pole', realLap: 'Real lap', wecBest: 'Real qualifying/Hyperpole best', errRange: 'Error range (1σ)', conf: {medium: 'medium confidence', low: 'low confidence', 'very-low': 'very low confidence', 'not-fitted': 'not fitted to real laps'},
    soon: 'Coming soon: other GT3 (IMSA GTD, DTM, SP9) and Formula E Gen4. They use the same calibration rules and are added once their data is connected.', sector: 'Sector', vmax: 'Top speed', vmin: 'Lowest speed', energy: 'Energy deployed', clip: 'Deploy cut-off',
    map: 'Racing line coloured by speed', slow: 'Slow', fast: 'Fast', trace: 'Speed over distance', km: 'Distance (km)',
    air: 'Air', airTemp: 'Air temperature', trackTemp: 'Track temperature', humidity: 'Humidity', pressure: 'Pressure', wind: 'Wind speed', windFrom: 'Wind from',
    motor: 'Hybrid motor', axleFront: 'front axle', axleRear: 'rear axle', deployFrom: 'drives only above {v}', hybridE: 'Motor use / recovery (per lap)', soc: {old: 'Rules up to 2025: only the 4 MJ per-lap deploy limit is modelled (recovery topped up by the MGU-H is not, so no battery flow is drawn).', h: 'Battery energy (estimate)', lead: 'Neither F1 nor WEC publishes the real battery state of charge (SoC) or motor use. This is an estimate from the rule limits (usable battery window, per-event recharge limit per lap) and the simulated lap.', line: 'Energy left in the battery', dep: 'Motor deploy', rec: 'Recovery (braking)', thr: 'Recovery at full throttle (super-clipping)', sum: 'Deploy {d} MJ · recovery {r} MJ (braking {b} + full throttle {t}){cap}', capT: ' · limit {c} MJ', ok: 'Checks: recovery ≤ limit {a} · energy swing within the lap {s} MJ ≤ usable window {w} MJ {b}', over: '({x} MJ over: the simulator balances energy over the whole lap only; a real car deploys this much less or in a different order)', start: 'Qualifying lap: starts with a full battery (dashed = usable window)', hyper: 'Hypercar: charge-sustaining every lap, lowest point set to 0 · battery window needed {s} MJ'},
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
    evo: 'Track evolution', evoLead: 'How lap time changes over a session as rubber goes down, a wet track dries and tyres warm up. The reference is the simulated lap above (track state at the end of qualifying).',
    evoType: 'Session', evoTypes: {practice: 'Practice', qualifying: 'Qualifying'}, evoTyre: 'Tyre', tyres: {f1: {soft: 'Soft{S}', medium: 'Medium{M}', hard: 'Hard{H}', inter: 'Intermediate', wet: 'Full wet'}, hypercar: {soft: 'Soft (Michelin)', medium: 'Medium (Michelin)', hard: 'Hard (Michelin)', wet: 'Wet (Michelin)'}, lmgt3: {medium: 'Medium (Goodyear)', hard: 'Hard (Goodyear)', wet: 'Wet (Goodyear)'}}, tyreQ: ' · Hyperpole tyre',
    tyreEvent: 'Tyres: compounds supplied at this event in {y}', tyreSeason: 'Tyres: no event here, whole-season range',
    evoComp: 'Compound gap (vs soft)', evoCompReal: 'measured {y}: same driver, low fuel, track evolution removed', evoCompModel: 'C-step model, test error ±{e}%', evoCompNone: 'not measured, lap unchanged',
    evoEnd: 'Session minute', evoGain: 'Rubber effect (full)', evoTau: 'Time to saturate', evoWet: 'Wetness at start', evoDry: 'Drying time', evoWarm: 'Warm-up laps',
    evoCurve: 'Use measured curve', evoLast: 'Expected lap at this minute', evoChange: 'vs session start', evoBasis: {track: 'measured curve, this track', series: 'series average (fitted)', default: 'uncalibrated default'},
    evoErr: 'Holdout error (track left out)', qs: {h: 'Segment', win: 'Window (min)', model: 'Model best lap', real: 'Real best lap', test: 'Q1/Q2 check (each event left out, {n} qualifyings): Q1 {a}% · Q2 {b}% error. Q3 = pole (reproduced)', none: 'No real segment times for this track (usual 18/15/12-minute schedule used)'}, secFix: 'Sector correction (real pole)', evoBasisH: 'Basis', evoChart: 'Expected lap time over the session', min: 'min',
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
  const sw = (Math.max(vw, vh) / 110).toFixed(1), L = opts.line;
  let band = '', marks = '';
  if (L) {
    // racing line on the track band: the line replaces the centre path, coloured by the car's speed on it
    const X = p => (p[0] - minX + pad).toFixed(1), Y = p => (maxY - p[1] + pad).toFixed(1), m = L.pts.length;
    band = '<polygon class="ls-band" points="' + L.left.concat(L.right.slice().reverse()).map(p => X(p) + ',' + Y(p)).join(' ') + '"/>';
    let lo2 = Infinity, hi2 = -Infinity; for (const x of L.v) { lo2 = Math.min(lo2, x); hi2 = Math.max(hi2, x); }
    const bk = i => Math.min(5, Math.floor((L.v[i] - lo2) / (hi2 - lo2 + 1e-9) * 6));
    let r = [0], c = bk(0);
    const fl = () => { if (r.length > 1) paths += '<path class="ls-line-seg" d="M' + r.map(i => X(L.pts[i]) + ' ' + Y(L.pts[i])).join('L') + '" stroke="color-mix(in oklab,var(--mint) ' + (c * 20) + '%,var(--sim-slow))"/>'; };
    for (let i = 1; i <= m; i++) { const k = i % m; r.push(k); if (i === m || bk(k) !== c) { fl(); r = [k]; c = bk(k); } }
    marks = L.marks.map(([i, k]) => '<circle class="ls-mk ls-mk-' + k + '" cx="' + X(L.pts[i]) + '" cy="' + Y(L.pts[i]) + '" r="' + (sw * 1.3).toFixed(1) + '" stroke-width="' + (sw * 0.35).toFixed(1) + '"/>').join('');
  } else {
    for (let i = 1; i < n; i++) { run.push(i); const nb = bucket(i); if (nb !== b) { flush(); run = [i]; b = nb; } }
    run.push(0); flush();
  }
  let corners = '';
  for (const c of opts.corners || []) {
    const i = Math.min(n - 1, Math.round(c.s / opts.length * n));
    corners += '<text x="' + px(i) + '" y="' + py(i) + '" dy="' + (-sw * 2.2).toFixed(1) + '" class="ls-corner">' + c.number + (c.letter || '') + '</text>';
  }
  return '<svg class="ls-map" viewBox="0 0 ' + vw.toFixed(0) + ' ' + vh.toFixed(0) + '" role="img" aria-label="' + opts.label + '">' + band + '<g fill="none" stroke-width="' + (L ? sw * 0.75 : sw) + '" stroke-linecap="round" stroke-linejoin="round">' + paths + '</g>' + marks + '<rect x="' + (px(0) - sw * 2) + '" y="' + (py(0) - sw * 2) + '" width="' + (sw * 4) + '" height="' + (sw * 4) + '" class="ls-start"/>' + corners + '<style>.ls-corner{font-size:' + (sw * 3.4).toFixed(1) + 'px}</style></svg>';
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
    compounds: lapsimCompounds?.[id] || {}, wecTyres: lapsimWecTyres?.[id] || {}, line: lineData(id), lineText: LT[lang], qsplit: lapsimQsplit ? {off: lapsimQsplit.offsetPct, test: lapsimQsplit.test, real: lapsimQsplit.tracks?.[id] || null} : null, brakes: lapsimBrakes ? {k: lapsimBrakes.pedalKgPerG, g: lapsimBrakes.gScale, t: lapsimBrakes.timeScale, test: lapsimBrakes.test, real: lapsimBrakes.races?.[id] || null, text: BT[lang]} : null, compoundGap: compoundGap(id), compoundTest: lapsimCompoundGap?.test?.rmsPct ?? null,
    evo: Object.fromEntries(['f1', 'wec'].map(se => [se, Object.fromEntries(['practice', 'qualifying'].map(ty => [ty, evolutionCoeffs(se, id, ty)]))])),
    calibration: {generatedAt: lapsimCalibration?.generatedAt || null, seasons: Object.fromEntries(Object.entries(lapsimCalibration?.seasons || {}).map(([y, s]) => [y, s.tracks?.[id] || null]))}};
  // first render on the server with the same code the browser uses
  const view = computeView(K, data, {carId, compareId: '', mode: 'real', manual: null, active: {}, strength: 1, evo: null}, {renderMap, renderTrace, evolutionDelta, evolutionCurve, lineTrack, brakeZones});
  const options = ids.map(k => `<option value="${esc(k)}"${k === id ? ' selected' : ''}>${esc(trackName(k, lang))}</option>`).join('');
  // cascade: series → rules/class (the car models of that series); series without a model yet are listed as coming soon
  const seriesOf = k => cars[k].series || 'f1', curSeries = seriesOf(carId);
  const carOpts = (sel, only) => data.carOrder.filter(k => !only || seriesOf(k) === only).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(cars[k].label)}</option>`).join('');
  const seriesOpts = SERIES_UI.map(se => { const live = data.carOrder.some(k => seriesOf(k) === se); return `<option value="${se}"${se === curSeries ? ' selected' : ''}${live ? '' : ' disabled'}>${esc(t.seriesNames[se] + (live ? '' : ' · ' + t.soonShort))}</option>`; }).join('');
  const cmpOpts = SERIES_UI.filter(se => data.carOrder.some(k => seriesOf(k) === se)).map(se => `<optgroup label="${esc(t.seriesNames[se])}">${carOpts('', se)}</optgroup>`).join('');
  const evoSlider = (key, label, min, max, step, unit) => `<label class="ls-slider"><span>${esc(label)}</span><input type="range" data-evo="${key}" min="${min}" max="${max}" step="${step}" value="${view.evo[key]}"><output data-evo-out="${key}">${view.evo[key]}</output><span class="ls-unit">${unit}</span></label>`;
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
 <label>${esc(t.series)}<select data-ls="series">${seriesOpts}</select></label>
 <label>${esc(t.car)}<select name="car" data-ls="car">${carOpts(carId, curSeries)}</select></label>
 <label>${esc(t.compare)}<select data-ls="compare"><option value="">${esc(t.none)}</option>${cmpOpts}</select></label>
 <label>${esc(t.conditions)}<select data-ls="mode"><option value="real">${esc(t.real)}</option><option value="manual">${esc(t.manual)}</option>${TRACK_LL[id] ? `<option value="forecast">${esc(FT[lang].opt)}</option>` : ''}</select></label>
 <noscript><button>${esc(t.track)}</button></noscript>
</form>
<section class="ls-stage">
 <figure class="ls-map-wrap">${lineControls(lang, view)}<div class="ls-zoombox" data-ls-zoom><div data-ls="map">${view.mapSvg}</div></div><figcaption><span class="ls-legend" aria-hidden="true"></span><span>${esc(t.slow)}</span><span>${esc(t.fast)}</span><span class="ls-windkey" data-ls="wind">${view.windHtml}</span></figcaption></figure>
 <div class="ls-readout">
  <p class="ls-track" data-no-translate>${esc(trackName(id, lang))}</p>
  <p class="ls-label"><span data-ls="carLabel">${esc(cars[carId].label)}</span> · <span data-ls="carKind">${esc(view.kindLabel)}</span></p>
  <p class="ls-lap" data-ls="lap" data-no-translate>${view.lap}</p>
  <p class="ls-pole" data-ls="pole">${view.poleHtml}</p>
  <dl class="ls-facts" data-ls="facts">${view.factsHtml}</dl>
 </div>
</section>
<section class="panel ls-panel"><h2>${esc(t.trace)}</h2><div class="ls-scroll" data-ls="trace">${view.traceSvg}</div><p class="ls-key" data-ls="key">${view.keyHtml}</p><div data-ls="soc">${view.socHtml}</div></section>
<section class="panel ls-panel ls-brakes"><h2>${esc(BT[lang].h)}</h2><div data-ls="brakes">${view.brakeHtml}</div></section>
<section class="panel ls-panel ls-air"><h2>${esc(t.air)}</h2>
 <dl class="ls-facts ls-air-facts" data-ls="air">${view.airHtml}</dl>
 <div class="ls-forecast" data-ls="forecast" hidden data-ll="${(TRACK_LL[id] || []).join(',')}" data-ft='${esc(JSON.stringify(FT[lang]))}'></div>
 <div class="ls-sliders" data-ls="manual" hidden>${slider('airTempC', t.airTemp, -5, 45, 0.5, '°C')}${slider('trackTempC', t.trackTemp, 5, 65, 0.5, '°C')}${slider('humidityPct', t.humidity, 0, 100, 1, '%')}${slider('pressureHpa', t.pressure, 760, 1040, 1, 'hPa')}${slider('windSpeed', t.wind, 0, 15, 0.1, 'm/s')}${slider('windFromDeg', t.windFrom, 0, 359, 1, '°')}</div>
</section>
<section class="panel ls-panel ls-evo"><h2>${esc(t.evo)}</h2><p>${esc(t.evoLead)}</p>
 <div class="ls-controls ls-evo-sel"><label>${esc(t.evoType)}<select data-evo="type">${['qualifying', 'practice'].map(k => `<option value="${k}">${esc(t.evoTypes[k])}</option>`).join('')}</select></label>
 <label>${esc(t.evoTyre)}<select data-evo="tyre" data-ls="tyre">${view.tyreHtml}</select></label>
 <label class="ls-check"><input type="checkbox" data-evo="useCurve" checked> ${esc(t.evoCurve)}</label></div>
 <div class="ls-sliders">${evoSlider('end', t.evoEnd, 0, 120, 1, t.min)}${evoSlider('gainPct', t.evoGain, 0, 3, 0.05, '%')}${evoSlider('tauMin', t.evoTau, 5, 150, 1, t.min)}${evoSlider('wetStart', t.evoWet, 0, 1, 0.05, '')}${evoSlider('dryMin', t.evoDry, 0, 90, 1, t.min)}${evoSlider('warmupLaps', t.evoWarm, 0, 4, 1, '')}</div>
 <dl class="ls-facts" data-ls="evoFacts">${view.evoFacts}</dl>
 <div class="ls-scroll" data-ls="evoChart">${view.evoSvg}</div><div data-ls="qsplit">${view.qsHtml}</div>
</section>
<section class="panel ls-panel"><h2>${esc(t.fia)}</h2><p>${esc(t.fiaLead)}</p>
 ${changes ? `<p class="fine"><a href="${esc(changes.document.url)}" target="_blank" rel="noopener noreferrer" data-no-translate>${esc(changes.event)} · ${esc(changes.document.title)}</a></p><p class="fine">${esc(fittedYear(id) >= changes.year ? t.inFit(fittedYear(id)) : t.notInFit)}</p><ul class="ls-changes">${changeRows}</ul><label class="ls-slider ls-strength"><span>${esc(t.strength)}</span><input type="range" data-ls="strength" min="0" max="2" step="0.25" value="1"><output data-ls="strengthOut">×1</output></label>` : `<p class="fine">${esc(t.noChanges)}</p>`}
</section>
<section class="panel ls-panel"><h2>${esc(t.calib)}</h2><p>${esc(t.calibLead)}</p>
 ${calRows ? `<div class="output"><table class="ls-table"><thead><tr><th></th><th>${esc(t.vsPole)}</th><th>${esc(t.lap)}</th><th>${esc(t.fitErr)}</th><th>${esc(t.speedRms)}</th></tr></thead><tbody>${calRows}</tbody></table></div>` : `<p class="fine">${esc(t.pendingLead)}</p>`}
 <h3>${esc(t.proj)}</h3><ul class="ls-notes">${projRows}</ul>
</section>
${stintPanel(id, lang)}
${racePanel(id, lang, query.race || null)}
<section class="panel ls-panel"><h2>${esc(t.model)}</h2><ul class="ls-notes"><li>${esc(t.m1)}</li><li>${esc(t.m2)}</li><li>${esc(t.m3)}</li><li>${esc(t.m4)}</li><li>${esc(t.m5)}</li><li>${esc(t.soon)}</li></ul>
 <p class="fine">${esc(t.src)}: <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1</a>, MultiViewer, <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noopener noreferrer">f1-circuits</a>, <a href="https://github.com/f1db/f1db" target="_blank" rel="noopener noreferrer">f1db</a> (CC BY 4.0), <a href="https://github.com/TUMFTM/laptime-simulation" target="_blank" rel="noopener noreferrer">TUMFTM laptime-simulation</a>, FIA Section C Issue 21${data.calibration.generatedAt ? ` · ${esc(t.updated)} <span data-no-translate>${esc(data.calibration.generatedAt)}</span>` : ''}</p>
</section>
<script type="application/json" id="lapsim-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="/assets/lapsim.js?v=${lapsimScriptVersion()}" defer></script>`;
}

// Race pace: expected lap times over the race and the best strategies, from the 2026 pole
// (predicted when the track has not been raced in 2026) and the fitted fuel/tyre/pit factors.
// Racing line texts (the line is drawn on the track map; see lineData and computeView)
const LT = {
  ko: {h: '레이싱 라인', all: '전체', lead: '공개 F1 위치 데이터는 트랙마다 하나의 기준선에 맞춰져 있어 실제 주행 라인을 알 수 없습니다. 그래서 선택한 차로 랩 시뮬레이션을 돌려 트랙 폭 안에서 가장 빠른 라인을 찾습니다. 다운포스·그립·출력·무게가 다르면 라인도 달라지고, 레이스 라인은 연료 무게와 레이스 페이스(타이어·에너지 관리)를 넣어 따로 계산합니다.',
    modes: {q: '예선 라인', r: '레이스 라인'}, zin: '확대', zout: '축소', lineNote: '{car} · {mode} · 최소 곡률 라인보다 {gain} s · 평균 {shift} m 이동', uses: '라인:', raceNote: ' · 연료 +{fuel} kg, 그립 ×{grip} ({basis})', basis: {'race-fit': '실제 레이스 중반 페이스에 맞춤', assumed: 'F1 비율 가정'}, noCar: '이 차의 라인은 아직 계산 전: 최소 곡률 라인',
    edges: {TUM: '트랙 폭: TUM 측정값', 'TUM-widths': '트랙 폭: TUM 측정값 (레이아웃 변경 구간 근사)', assumed: '트랙 폭: 12 m 가정'}, pole: '속도·브레이크·스로틀: {y} 퀄리 폴 랩 실측 ({d}, {t})', nopole: '실측 폴 랩 없음',
    check: 'TUM 최적 라인과의 차이: 평균 {m} m', key: ['브레이크 시작', '최저 속도', '풀 스로틀']},
  en: {h: 'Racing line', all: 'All', lead: 'Public F1 position data is snapped to one reference path per track, so the real driven line is unknown. The lap simulator runs the selected car to find the fastest line inside the track width: different downforce, grip, power and weight give a different line. The race line is worked out separately with fuel weight and race pace (tyres, energy management).',
    modes: {q: 'Qualifying line', r: 'Race line'}, zin: 'Zoom in', zout: 'Zoom out', lineNote: '{car} · {mode} · {gain} s vs the least-curvature line · mean shift {shift} m', uses: 'line of', raceNote: ' · fuel +{fuel} kg, grip ×{grip} ({basis})', basis: {'race-fit': 'fitted to real mid-race pace', assumed: 'F1 ratio assumed'}, noCar: 'line for this car not computed yet: least-curvature line',
    edges: {TUM: 'Track width: TUM measured', 'TUM-widths': 'Track width: TUM measured (approximate where the layout changed)', assumed: 'Track width: 12 m assumed'}, pole: 'Speed, brake, throttle: {y} qualifying pole lap, measured ({d}, {t})', nopole: 'No measured pole lap',
    check: 'Gap to the TUM optimal line: mean {m} m', key: ['Brake start', 'Lowest speed', 'Full throttle']},
};
// Track geometry for the line panel: midline, its normals and each car's line offsets (0.1 m).
function lineData(id) {
  const L = lapsimRacingLines?.tracks?.[id], C = lapsimCarLines?.tracks?.[id];
  if (!L?.line?.length) return null;
  const n = L.line.length, mid = L.left.map((l, i) => [(l[0] + L.right[i][0]) / 2, (l[1] + L.right[i][1]) / 2]);
  const nrm = mid.map((_, i) => { const a = mid[(i - 1 + n) % n], b = mid[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [+(-dy / l).toFixed(4), +(dx / l).toFixed(4)]; });
  const base = L.line.map((p, i) => Math.round(((p[0] - mid[i][0]) * nrm[i][0] + (p[1] - mid[i][1]) * nrm[i][1]) * 10));
  const xs = [...L.left, ...L.right].map(p => p[0]), ys = [...L.left, ...L.right].map(p => p[1]);
  const r1 = p => [+p[0].toFixed(1), +p[1].toFixed(1)];
  return {mid: mid.map(r1), left: L.left.map(r1), right: L.right.map(r1), nrm, base, minX: Math.min(...xs), maxY: Math.max(...ys), pad: 40, cars: C || {}};
}
// Map controls: racing line on/off, qualifying/race line, zoom (+, −, fit; wheel/pinch and drag on the map)
function lineControls(lang, view) {
  const t = LT[lang];
  return `<div class="ls-line-bar"><button type="button" class="pill active" data-line-toggle aria-pressed="true">${esc(t.h)}</button>${['q', 'r'].map(m => `<button type="button" class="pill${m === 'q' ? ' active' : ''}" data-line-mode="${m}">${esc(t.modes[m])}</button>`).join('')}
 <span class="ls-zoom-btns"><button type="button" class="pill" data-zoom="in" aria-label="${esc(t.zin)}">+</button><button type="button" class="pill" data-zoom="out" aria-label="${esc(t.zout)}">−</button><button type="button" class="pill" data-zoom="fit">${esc(t.all)}</button></span></div>
 <p class="fine ls-line-key"><span class="ls-mk-b"></span>${esc(t.key[0])} <span class="ls-mk-a"></span>${esc(t.key[1])} <span class="ls-mk-t"></span>${esc(t.key[2])} · <span data-ls="lineNote">${esc(view.lineNote)}</span></p>`;
}
// Compound gap vs soft (% of lap) per season: the real low-fuel gap measured at that event (reproduced
// exactly), else k(track) × C-steps between the compounds (fitted, leave-one-event-out tested)
function compoundGap(id) {
  const G = lapsimCompoundGap, k = G?.tracks?.[id] ?? G?.kPctPerStep;
  if (!Number.isFinite(k)) return {};
  // hard is built on medium (a measured medium gap plus the model step medium → hard), so hard ≥ medium
  return Object.fromEntries(Object.entries(lapsimCompounds?.[id] || {}).map(([y, cp]) => {
    const C = j => +cp[j].slice(1), m = G.measured?.[id]?.[y] || {};
    const medium = m.MEDIUM ? {pct: m.MEDIUM.pct, basis: 'measured'} : {pct: +(k * (C(2) - C(1))).toFixed(4), basis: 'model'};
    const hard = m.HARD ? {pct: m.HARD.pct, basis: 'measured'} : {pct: +(medium.pct + k * (C(1) - C(0))).toFixed(4), basis: 'model'};
    return [y, {medium, hard}];
  }));
}
// Hypercar stint energy: BoP energy per stint, the real full-stint length and the model's (driveshaft
// energy per lap from the lap simulator × race factor k, tested leave-one-event-out). 2026 BoP is not
// published: its stint energy is estimated from the real stints.
const ST = {
  ko: {h: '하이퍼카 스틴트 에너지', lead: 'WEC 하이퍼카는 한 스틴트(피트 아웃~피트 인)에 드라이브샤프트로 쓸 수 있는 에너지가 BoP로 정해져 있습니다(가상 에너지 탱크). 랩 시뮬레이터로 한 랩에 필요한 구동 에너지를 계산하고, 레이스 페이스 계수로 바꿔 몇 랩을 갈 수 있는지 봅니다.',
    cols: ['제조사', '연도', '스틴트 에너지', '실제 풀 스틴트', '모델 예측', '랩당 에너지'], est: '추정, 2026 BoP 비공개', laps: '랩', test: '모델 검증 (대회 하나씩 빼고 예측): 스틴트 길이 오차 RMS {e}% · {n}개 대회 · 레이스 계수 k = {k}', note: '실제 풀 스틴트: 같은 차가 두 번 이상 달린 가장 긴 그린 플래그 스틴트 (Al Kamel 레이스 타이밍). 2025 BoP: FIA WEC 결정문.'},
  en: {h: 'Hypercar stint energy', lead: 'A WEC Hypercar may deliver only a set amount of energy at the driveshafts per stint (pit-out to pit-in), fixed by the BoP (virtual energy tank). The lap simulator works out the drive energy one lap needs; a race-pace factor turns it into how many laps a stint lasts.',
    cols: ['Manufacturer', 'Year', 'Stint energy', 'Real full stint', 'Model', 'Energy per lap'], est: 'estimated, 2026 BoP not published', laps: 'laps', test: 'Model test (each event left out and predicted): stint length RMS error {e}% · {n} events · race factor k = {k}', note: 'Real full stint: the longest green-flag stint a car ran at least twice (Al Kamel race timing). 2025 BoP: FIA WEC decisions.'},
};
function stintPanel(id, lang) {
  const S = lapsimStints?.tracks?.[id]; if (!S) return '';
  const t = ST[lang], cap = b => ({bmw: 'BMW', aston: 'Aston Martin'})[b] || b[0].toUpperCase() + b.slice(1);
  const rows = Object.entries(S).sort(([a], [b]) => b.localeCompare(a)).flatMap(([y, by]) => Object.entries(by).map(([b, r]) => {
    const model = r.basis === 'bop' ? (r.MJ / (lapsimStints.k * r.simMJ)).toFixed(1) : '–';
    return `<tr><td>${esc(cap(b))}</td><td data-no-translate>${y}</td><td data-no-translate>${r.MJ} MJ${r.basis === 'estimated' ? ` <span class="fine">(${esc(t.est)})</span>` : ''}</td><td data-no-translate>${r.laps} ${esc(t.laps)}</td><td data-no-translate>${model}</td><td data-no-translate>${r.lapMJ.toFixed(2)} MJ</td></tr>`;
  })).join('');
  const T = lapsimStints.test;
  return `<section class="panel ls-panel"><h2>${esc(t.h)}</h2><p>${esc(t.lead)}</p>
 <div class="output"><table class="ls-table"><thead><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
 <p class="fine">${esc(t.test.replace('{e}', T.rmsPct).replace('{n}', T.events).replace('{k}', lapsimStints.k))}</p><p class="fine">${esc(t.note)}</p></section>`;
}
// Brake panel texts
const BT = {
  ko: {h: '브레이크', lead: '시뮬레이션 랩의 제동 구간입니다. 가장 강한 제동 구간을 Brembo가 대회마다 공개하는 실제 수치와 나란히 보여 줍니다 (F1). 하이퍼카는 LMH(앞바퀴 모터 회생)와 LMDh(뒷바퀴 회생)의 차이가 앞뒤 브레이크 부담에 그대로 나타납니다.',
    hardest: '가장 강한 제동', hardestT: '가장 강한 제동 (Brembo 기준 T{t})', model: '모델', brembo: 'Brembo 실측', vFrom: '제동 전 속도', vTo: '제동 후 속도', dist: '제동 거리', time: '제동 시간', g: '감속 (평균)', pedal: '페달 하중', bar: '앞 브레이크 압력 (추정)', zones: '랩당 제동 구간', brakeTime: '랩당 제동 시간',
    axle: {rear: '뒤 차축', front: '앞 차축'}, noRegen: '회생 없음', split: '마찰 브레이크 앞 {f}% · 뒤 {r}% · 모터 회생({ax}) {rk} kWh · 마찰 브레이크 {fk} kWh · 공기 저항이 멈춰 준 몫 {dk} kWh (랩당)',
    test: '검증 (Brembo 공개 수치 {n}개 대회, 대회 하나씩 빼고 예측): 감속 오차 {g}% · 페달 하중 {kg}% · 제동 전 속도 {v}% · 제동 거리 {d}% (이 모델은 압력이 바로 차오른다고 가정해 실제보다 짧게 제동합니다)', assume: '가정: 페달 비 3.5, 마스터 실린더 17.8 mm, 밸런스 = 앞 마찰 비중. 페달 하중 = 감속(g) × Brembo 수치에서 맞춘 kg/g. 실제 압력 데이터는 공개되지 않습니다.'},
  en: {h: 'Brakes', lead: 'Braking zones of the simulated lap. The hardest one is shown next to the real figures Brembo publishes for each race (F1). For Hypercars, LMH (front-axle regen) and LMDh (rear-axle regen) differ directly in how much each axle\'s brakes do.',
    hardest: 'Hardest braking', hardestT: 'Hardest braking (Brembo: T{t})', model: 'Model', brembo: 'Brembo, real', vFrom: 'Speed before', vTo: 'Speed after', dist: 'Braking distance', time: 'Braking time', g: 'Deceleration (mean)', pedal: 'Pedal load', bar: 'Front brake pressure (estimate)', zones: 'Braking zones per lap', brakeTime: 'Braking time per lap',
    axle: {rear: 'rear axle', front: 'front axle'}, noRegen: 'no regen', split: 'Friction brakes front {f}% · rear {r}% · motor regen ({ax}) {rk} kWh · friction brakes {fk} kWh · stopped by air drag {dk} kWh (per lap)',
    test: 'Test (Brembo figures, {n} races, each left out and predicted): deceleration error {g}% · pedal load {kg}% · speed before braking {v}% · braking distance {d}% (the model builds pressure instantly, so it brakes shorter than a real car)', assume: 'Assumed: pedal ratio 3.5, master cylinder 17.8 mm, balance = front friction share. Pedal load = deceleration (g) × kg per g fitted on Brembo figures. Real pressure data is not published.'},
};
// Track coordinates for the weather forecast (circuit centre, about 0.01°)
const TRACK_LL = {sakhir: [26.0325, 50.5106], jeddah: [21.6319, 39.1044], melbourne: [-37.8497, 144.968], suzuka: [34.8431, 136.541], shanghai: [31.3389, 121.22], miami: [25.9581, -80.2389],
  imola: [44.3439, 11.7167], 'monte-carlo': [43.7347, 7.4206], montreal: [45.5, -73.5228], catalunya: [41.57, 2.2611], spielberg: [47.2197, 14.7647], silverstone: [52.0786, -1.0169],
  hungaroring: [47.5789, 19.2486], 'spa-francorchamps': [50.4372, 5.9714], zandvoort: [52.3888, 4.5409], monza: [45.6156, 9.2811], baku: [40.3725, 49.8533], singapore: [1.2914, 103.864],
  austin: [30.1328, -97.6411], 'mexico-city': [19.4042, -99.0907], interlagos: [-23.7036, -46.6997], 'las-vegas': [36.1147, -115.1728], lusail: [25.49, 51.4542],
  'yas-marina-circuit': [24.4672, 54.6031], madring: [40.4636, -3.6146], 'kuala-lumpur': [2.7608, 101.7381]};
const FT = {
  ko: {opt: '예보 (Météo-France)', loading: 'Météo-France 예보 불러오는 중…', hour: '시각 (현지)', rain: '비', fail: '예보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.', k: 0.02,
    note: 'Météo-France의 ARPEGE·AROME 예보(Open-Meteo 제공)입니다. F1·WEC 공식 기상 서비스도 Météo-France입니다. 노면 온도는 예보에 없어 기온 + 일사량 × 0.02 °C/(W/m²)로 추정합니다.'},
  en: {opt: 'Forecast (Météo-France)', loading: 'Loading the Météo-France forecast…', hour: 'Hour (local)', rain: 'rain', fail: 'Could not load the forecast. Try again shortly.', k: 0.02,
    note: 'Météo-France ARPEGE/AROME forecast (served by Open-Meteo); Météo-France is also the official weather service of F1 and WEC. Track temperature is not forecast: estimated as air temperature + solar radiation × 0.02 °C per W/m².'},
};
const SERIES_UI = ['f1', 'wec', 'imsa', 'fe', 'gt3'];
const RT = {
  ko: {h: '레이스 페이스 예측', lead: '연료가 줄고, 타이어가 닳고, 피트 스톱을 하면서 랩타임이 어떻게 바뀌는지 실제 레이스 랩으로 맞춘 값입니다.', strat: '전략', time: '레이스 시간', gap: '차이', laps: '랩', pole: '기준 폴', refTop: '기준 랩 (예선 상위 {n}명 평균)', basis: {pred: '2026 예측', real: '2026 실제'}, test: '이전 시즌만으로 예측한 레이스 페이스 오차', season: '시즌', now: '예측/최근', repro: '이미 열린 레이스 재현 오차 (전 시즌 최대)', chart: '최적 전략의 예상 랩타임', c: {S: '소프트', M: '미디엄', H: '하드'}},
  en: {h: 'Race pace prediction', lead: 'How lap time changes as fuel burns, tyres wear and cars stop, fitted to real race laps.', strat: 'Strategy', time: 'Race time', gap: 'Gap', laps: 'laps', pole: 'Pole used', refTop: 'Reference lap (mean of the best {n} in qualifying)', basis: {pred: '2026 prediction', real: '2026 real'}, test: 'Race-pace error predicted from earlier seasons only', season: 'Season', now: 'Prediction/latest', repro: 'Races already run, reproduction error (largest, all seasons)', chart: 'Expected lap times, best strategy', c: {S: 'Soft', M: 'Medium', H: 'Hard'}},
};
function racePanel(id, lang, raceYear) {
  // a past race (any season) is shown from its own fit, so it reproduces that race
  const past = lapsimRace?.races?.[id] || {}, own = past[raceYear], s26 = lapsimCalibration?.seasons?.[2026];
  const tr = own ? {...lapsimRace.tracks[id], ...own, reproduced: true} : lapsimRace?.tracks?.[id];
  if (!tr || !tr.laps) return '';
  const predicted = s26?.predictions?.[id]?.lap, real = s26?.tracks?.[id]?.position === 1 ? s26.tracks[id].realLap : null;
  // a race already run uses the pole its own fit was made with, so it reproduces that race
  const pole = (tr.reproduced && Number.isFinite(tr.pole) ? tr.pole : null) ?? real ?? predicted ?? s26?.tracks?.[id]?.realLap;
  if (!Number.isFinite(pole)) return '';
  const t = RT[lang], seen = new Set();
  // the model has no order effect between stints, so mirrored strategies tie: keep one of each
  const best = strategies(tr, pole).filter(x => { const k = x.stints.map(([c, n]) => c + n).sort().join(); return !seen.has(k) && seen.add(k); }).slice(0, 4);
  const fmtRace = v => `${Math.floor(v / 3600)}:${String(Math.floor(v % 3600 / 60)).padStart(2, '0')}:${(v % 60).toFixed(1).padStart(4, '0')}`;
  // Pirelli nomination of that race (or of this season's race at this track): HARD, MEDIUM, SOFT
  const cy = lapsimCompounds?.[id] || {}, cn = cy[own ? raceYear : 2026] || null, cOf = c => cn ? ' ' + cn[{H: 0, M: 1, S: 2}[c[0]]] : '';
  const name = st => st.map(([c, n]) => `${t.c[c[0]]}${cOf(c)} ${n}`).join(' → ');
  const rows = best.map((x, i) => `<tr><td>${esc(name(x.stints))}</td><td data-no-translate>${fmtRace(x.total)}</td><td data-no-translate>${i ? '+' + (x.total - best[0].total).toFixed(1) + ' s' : '–'}</td></tr>`).join('');
  const L = raceLaps(tr, pole, best[0].stints.map(([compound, laps]) => ({compound, laps}))).filter(l => !(l.age === 0 && l.lap > 1));
  const W = 640, H = 180, lo = Math.min(...L.map(l => l.time)), hi = Math.max(...L.map(l => l.time)), n = tr.laps;
  const X = l => 30 + (l - 1) / Math.max(1, n - 1) * (W - 40), Y = v => 10 + (hi - v) / Math.max(0.1, hi - lo) * (H - 30);
  const line = L.map(l => `${X(l.lap).toFixed(1)},${Y(l.time).toFixed(1)}`).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t.chart)}" class="ls-race"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2"/><text x="30" y="${H - 4}" font-size="11" fill="currentColor">1</text><text x="${W - 10}" y="${H - 4}" font-size="11" text-anchor="end" fill="currentColor">${n}</text><text x="2" y="14" font-size="11" fill="currentColor">${fmtLap(hi)}</text><text x="2" y="${H - 20}" font-size="11" fill="currentColor">${fmtLap(lo)}</text></svg>`;
  const test = (lapsimRace.test?.rmsPct != null ? `<p class="fine">${esc(t.test)}: <span data-no-translate>${lapsimRace.test.rmsPct.toFixed(2)}% (${lapsimRace.test.races})</span></p>` : '')
    + (tr.reproduced && lapsimRace.reproduction?.maxPct != null ? `<p class="fine">${esc(t.repro)}: <span data-no-translate>${lapsimRace.reproduction.maxPct.toFixed(3)}%</span></p>` : '');
  const years = Object.keys(past).sort(), link = (y, label) => `<a class="pill${(y || null) === (own ? raceYear : null) ? ' active' : ''}" href="/simulation?track=${encodeURIComponent(id)}${y ? '&race=' + y : ''}">${esc(label)}</a>`;
  const pick = years.length ? `<p class="fine">${esc(t.season)}: ${link(null, t.now)} ${years.map(y => link(y, y)).join(' ')}</p>` : '';
  return `<section class="panel ls-panel"><h2>${esc(t.h)}</h2><p>${esc(t.lead)}</p>${pick}
 <p class="fine">${esc(tr.reproduced && lapsimRace.refTop > 1 ? t.refTop.replace('{n}', lapsimRace.refTop) : t.pole)}: <span data-no-translate>${fmtLap(pole)}</span> (${esc(own ? String(raceYear).replace('-2', ' (2)') + ' ' + t.basis.real.replace(/^\d+ /, '') : real || tr.reproduced ? t.basis.real : t.basis.pred)}) · <span data-no-translate>${n}</span> ${esc(t.laps)}</p>
 <div class="output"><table class="ls-table"><thead><tr><th>${esc(t.strat)}</th><th>${esc(t.time)}</th><th>${esc(t.gap)}</th></tr></thead><tbody>${rows}</tbody></table></div>
 <h3>${esc(t.chart)}</h3><div class="ls-scroll">${svg}</div>${test}
</section>`;
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
  const secOf = r => { const i1 = Math.round(d.sectors[0] / d.ds), i2 = Math.round(d.sectors[1] / d.ds); return [r.time[i1], r.time[i2] - r.time[i1], r.lapTime - r.time[i2]]; };
  // sector correction (raced tracks): real pole sectors minus the reference car's sectors in that weather
  const corrOf = c => {
    if (!c.fix || !d.sectors || d.sectors.length !== 2) return null;
    const key = data.id + '|' + c.fix.ref; computeView.fixCache = computeView.fixCache || {};
    if (!computeView.fixCache[key]) {
      const ref = data.cars[c.fix.ref], fw = {};
      for (const k of ['pressureHpa', 'airTempC', 'humidityPct', 'trackTempC', 'windSpeed', 'windFromDeg']) if (Number.isFinite(c.fix.weather && c.fix.weather[k])) fw[k] = c.fix.weather[k];
      const envR = K.conditionsFromWeather(Object.assign({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, fw, {rechargeMJ: data.energy && data.energy.mj != null ? data.energy.mj : undefined}));
      const ss = secOf(K.simulateLap(withGrip(base, ref.grip || 1), ref.car, envR));
      computeView.fixCache[key] = c.fix.real.map((x, i) => x - ss[i]);
    }
    return computeView.fixCache[key];
  };
  const corrected = (c, r) => { const k = corrOf(c), sec = d.sectors && d.sectors.length === 2 ? secOf(r) : null; return k && sec ? {lapTime: r.lapTime + k[0] + k[1] + k[2], sectors: sec.map((x, i) => x + k[i]), corr: k} : {lapTime: r.lapTime, sectors: sec, corr: null}; };
  const raw = run(sel), fixd = corrected(sel, raw);
  const res = Object.assign({}, raw, {lapTime: fixd.lapTime});
  const cmpRaw = state.compareId && data.cars[state.compareId] ? run(data.cars[state.compareId]) : null;
  const cmp = cmpRaw ? Object.assign({}, cmpRaw, {lapTime: corrected(data.cars[state.compareId], cmpRaw).lapTime}) : null;
  const fmt = s => { if (!Number.isFinite(s)) return '–'; const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); };
  const sectors = fixd.sectors;
  const real = data.conds[condKey];
  const sameConditions = state.mode !== 'manual' && !active.length;
  const poleHtml = real && real.realLap && sameConditions && sel.kind === 'calibrated'
    ? (sel.series ? t.wecBest : real.position > 1 ? t.realLap + ' P' + real.position : t.vsPole) + ' <span data-no-translate>' + fmt(real.realLap) + '</span> · <span data-no-translate>' + ((res.lapTime - real.realLap) >= 0 ? '+' : '−') + Math.abs(res.lapTime - real.realLap).toFixed(3) + ' s</span>'
    : (cmp ? data.cars[state.compareId].label + ' <span data-no-translate>' + fmt(cmp.lapTime) + ' · ' + ((res.lapTime - cmp.lapTime) >= 0 ? '+' : '−') + Math.abs(res.lapTime - cmp.lapTime).toFixed(3) + ' s</span>' : '');
  const fact = (k, v) => '<div><dt>' + k + '</dt><dd data-no-translate>' + v + '</dd></div>';
  let factsHtml = '';
  if (sel.unc) factsHtml += fact(t.errRange, (sel.unc.pct ? '±' + (res.lapTime * sel.unc.pct / 100).toFixed(2) + ' s · ' : '') + t.conf[sel.unc.confidence]);
  if (sectors) sectors.forEach((x, i) => { factsHtml += fact(t.sector + ' ' + (i + 1), x.toFixed(3)); });
  if (fixd.corr) factsHtml += fact(t.secFix, fixd.corr.map(x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3)).join(' / ') + ' s');
  factsHtml += fact(t.vmax, Math.round(res.vMaxKph) + ' km/h') + fact(t.vmin, Math.round(res.vMinKph) + ' km/h');
  // LMH vs LMDh: where the hybrid drives and how much energy it moves per lap (total power is BoP-capped)
  if (sel.car.ers?.rule === 'hypercar') { const h = sel.car.ers; factsHtml += fact(t.motor, Math.round(h.eMax / 1000) + ' kW, ' + (h.axle === 'front' ? t.axleFront : t.axleRear) + (h.deployFrom > 0 ? ', ' + t.deployFrom.replace('{v}', Math.round(h.deployFrom * 3.6) + ' km/h') : ''))
    + fact(t.hybridE, (res.energy.deployJ / 1e6).toFixed(2) + ' / ' + (res.energy.regenJ / 1e6).toFixed(2) + ' MJ'); }
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
  // racing line of the selected car on the map (F1 projections use the 2026 line), coloured by its own
  // simulated speed; markers: braking starts, lowest speed of that corner, back to full power
  let line = null, lineNote = '';
  const LD = data.line, LT0 = data.lineText;
  if (LD && state.showLine !== false) {
    const mode = state.lineMode || 'q', key = LD.cars[state.carId] ? state.carId : !sel.series && LD.cars['2026'] ? '2026' : null, cl = key ? LD.cars[key][mode] : null;
    const off = cl ? cl.off : LD.base, n = off.length, P = LD.mid.map((m, i) => [m[0] + LD.nrm[i][0] * off[i] / 10, m[1] + LD.nrm[i][1] * off[i] / 10]);
    const tr = R.lineTrack(K, P.map(p => p[0]), P.map(p => p[1]));
    const car = mode === 'r' && cl ? Object.assign({}, sel.car, {mass: sel.car.mass + cl.fuelKg}) : sel.car;
    tr.mu.fill(sel.grip * (mode === 'r' && cl ? cl.grip : 1));
    const sim = K.simulateLap(tr, car, env), m = sim.v.length, J = i => Math.min(m - 1, Math.round(i * m / n)), v = P.map((_, i) => sim.v[J(i)]), lim = i => sim.limit[J(i)], marks = [];
    // a braking zone counts when it lasts 3+ points and costs 10+ km/h (lift-offs and noise are skipped)
    for (let i = 0, last = -1; i < n; i++) if (lim(i) === 3 && lim((i - 1 + n) % n) !== 3 && i > last) {
      let e = i; while (e - i < n / 4 && lim((e + 1) % n) === 3) e++;
      let a = i, j = i; for (let k = 1; k < n / 3; k++) { j = (i + k) % n; if (v[j] < v[a]) a = j; if (lim(j) === 2 && k > e - i) break; }
      if (e - i < 2 || (v[i] - v[a]) * 3.6 < 10) continue;
      marks.push([i, 'b'], [a, 'a'], [j, 't']); last = j < i ? n : j;
    }
    line = {pts: P, v, marks, left: LD.left, right: LD.right};
    lineNote = cl ? LT0.lineNote.replace('{car}', sel.label + (key !== state.carId ? ' (' + LT0.uses + ' ' + data.cars[key].label + ')' : '')).replace('{mode}', LT0.modes[mode]).replace('{gain}', (cl.gain >= 0 ? '+' : '−') + Math.abs(cl.gain).toFixed(3)).replace('{shift}', cl.shift)
      + (mode === 'r' ? LT0.raceNote.replace('{fuel}', cl.fuelKg).replace('{grip}', cl.grip).replace('{basis}', LT0.basis[cl.basis] || cl.basis) : '') : LT0.noCar;
  }
  const mapSvg = R.renderMap(d.map || {x: [], y: []}, res.v, {corners: d.corners, length: d.length, label: t.map, line});
  // compass arrow pointing where the wind blows to (map north is up)
  const windHtml = env.windSpeed > 0.3 ? '<svg class="ls-compass" width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -8L5 5L0 2L-5 5Z" transform="rotate(' + Math.round((env.windFromDeg + 180) % 360) + ')"/></svg><span>' + t.wind + ' <span data-no-translate>' + env.windSpeed.toFixed(1) + ' m/s</span></span>' : '';
  const series = [{v: res.v.map(x => x * 3.6)}];
  if (cmp) series.push({v: cmp.v.map(x => x * 3.6)});
  const traceSvg = R.renderTrace(d.ds, series, {sectors: d.sectors || [], label: t.trace, km: t.km});
  // brakes of the simulated lap: zones, the hardest one next to Brembo's published figures, regen split
  let brakeHtml = '';
  const BD = data.brakes;
  if (BD) {
    const T = BD.text, b = R.brakeZones(track, sel.car, env, res.v, res.limit, {pedalPerG: BD.k});
    const real = !sel.series && BD.real ? BD.real[sel.year] || BD.real[2026] || null : null, rh = real && real.real;
    // the zone ending nearest Brembo's corner when there is one, else the hardest
    const cs = real && (d.corners || []).find(c => String(c.number) === String(real.turn)), L = d.length || b.zones.length;
    const dist = z0 => cs ? Math.min(Math.abs(z0.end * track.ds - cs.s), L - Math.abs(z0.end * track.ds - cs.s)) : -z0.meanG;
    const z = b.zones.slice().sort((x, y) => dist(x) - dist(y))[0];
    const cell = (m, r, u, d = 0) => '<td data-no-translate>' + (Number.isFinite(m) ? m.toFixed(d) + ' ' + u : '–') + '</td><td data-no-translate>' + (Number.isFinite(r) ? r + ' ' + u : '–') + '</td>';
    const rowsH = z ? [[T.vFrom, z.vFrom, rh?.vFrom, 'km/h'], [T.vTo, z.vTo, rh?.vTo, 'km/h'], [T.dist, z.distM, rh?.distM, 'm'], [T.time, z.timeS, rh?.timeS, 's', 2], [T.g, z.meanG, rh?.decelG, 'g', 1], [T.pedal, z.pedalKg, rh?.pedalKg, 'kg'], [T.bar, z.bar, null, 'bar']].map(([l, m, r, u, d]) => '<tr><td>' + l + '</td>' + cell(m, r, u, d) + '</tr>').join('') : '';
    const lapRows = '<tr><td>' + T.zones + '</td>' + cell(b.zones.length, real?.lap?.zones, '') + '</tr><tr><td>' + T.brakeTime + '</td>' + cell(b.brakingTime * BD.t, real?.lap?.brakingTimeS, 's', 1) + '</tr>';
    const E = b.energy, ax = b.regenAxle ? T.axle[b.regenAxle] : T.noRegen;
    brakeHtml = '<p class="fine">' + T.lead + '</p><div class="output"><table class="ls-table"><thead><tr><th>' + (z && real ? T.hardestT.replace('{t}', real.turn) : T.hardest) + '</th><th>' + T.model + '</th><th>' + T.brembo + (real ? ' ' + sel.year : '') + '</th></tr></thead><tbody>' + rowsH + lapRows + '</tbody></table></div>'
      + '<p class="fine">' + T.split.replace('{f}', E.frontPct.toFixed(0)).replace('{r}', (100 - E.frontPct).toFixed(0)).replace('{ax}', ax).replace('{rk}', E.regenKWh.toFixed(2)).replace('{fk}', E.frictionKWh.toFixed(2)).replace('{dk}', E.dragKWh.toFixed(2)) + '</p>'
      + '<p class="fine">' + T.test.replace('{g}', BD.test.decelG.rmsPct).replace('{kg}', BD.test.pedalKg.rmsPct).replace('{v}', BD.test.vFrom.rmsPct).replace('{d}', BD.test.distM.rmsPct).replace('{n}', BD.test.decelG.n) + '</p><p class="fine">' + T.assume + '</p>';
  }
  // battery estimate along the lap: recovery capped at the per-lap limit, battery clamped to its window
  let socHtml = '';
  const F = res.flow;
  if (F && F.rule !== 'f1-2026' && F.rule !== 'hypercar') socHtml = '<h3>' + t.soc.h + '</h3><p class="fine">' + t.soc.old + '</p>';
  else if (F) {
    const T = t.soc, n = F.dep.length, W = 1000, H = 150, L0 = 48, top = 12, B = 26, win = F.soc, cap = F.recharge ?? Infinity;
    // net energy along the lap (no clamping, so a profile the battery window cannot hold is shown, not hidden)
    let cum = 0, got = 0, mn = 0, mx = 0; const c = [], sumB = F.brk.reduce((a, x) => a + x, 0), sumT = F.thr.reduce((a, x) => a + x, 0);
    for (let i = 0; i < n; i++) { let r = F.brk[i] + F.thr[i]; if (got + r > cap) r = Math.max(0, cap - got); got += r; cum += r - F.dep[i]; c.push(cum); mn = Math.min(mn, cum); mx = Math.max(mx, cum); }
    // F1 qualifying lap: starts full; Hypercar (charge-sustaining race lap): lowest point at 0
    const s0 = F.rule === 'hypercar' ? -mn : win, s = c.map(e => s0 + e), swing = mx - mn, top0 = Math.max(win, s0 + mx), bot0 = Math.min(0, s0 + mn);
    const x = i => (L0 + i / n * (W - L0 - 8)).toFixed(1), y = e => (top + (1 - (e - bot0) / (top0 - bot0)) * (H - top - B)).toFixed(1), pk = Math.max(...F.dep, ...F.brk.map((b, i) => b + F.thr[i]), 1);
    const bars = F.dep.map((e, i) => e > 0 ? '<rect x="' + x(i) + '" y="' + (H - B + 4) + '" width="' + ((W - L0) / n + 0.5).toFixed(1) + '" height="8" fill="#e5484d" opacity="' + (0.25 + 0.75 * e / pk).toFixed(2) + '"/>' : (F.brk[i] + F.thr[i] > 0 ? '<rect x="' + x(i) + '" y="' + (H - B + 4) + '" width="' + ((W - L0) / n + 0.5).toFixed(1) + '" height="8" fill="' + (F.thr[i] > F.brk[i] ? '#f5a524' : '#30a46c') + '" opacity="' + (0.25 + 0.75 * (F.brk[i] + F.thr[i]) / pk).toFixed(2) + '"/>' : '')).join('');
    const svg = '<svg class="ls-soc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + T.h + '"><text x="4" y="' + (+y(win) + 4) + '" font-size="12" fill="currentColor">' + (win / 1e6).toFixed(1) + ' MJ</text><text x="4" y="' + (+y(0) + 4) + '" font-size="12" fill="currentColor">0</text><line x1="' + L0 + '" x2="' + (W - 8) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="currentColor" opacity=".2"/>' + (F.rule === 'hypercar' ? '' : '<line x1="' + L0 + '" x2="' + (W - 8) + '" y1="' + y(win) + '" y2="' + y(win) + '" stroke="currentColor" opacity=".35" stroke-dasharray="6 4"/>') + '<polyline fill="none" stroke="var(--mint)" stroke-width="2.4" points="' + s.map((e, i) => x(i) + ',' + y(e)).join(' ') + '"/>' + bars + '</svg>';
    const M = v => (v / 1e6).toFixed(2), recUsed = Math.min(sumB + sumT, cap);
    socHtml = '<h3>' + T.h + '</h3><p class="fine">' + T.lead + '</p><div class="ls-scroll">' + svg + '</div><p class="ls-key"><span class="ls-key-0"></span>' + T.line + ' <span class="ls-sw" style="background:#e5484d"></span>' + T.dep + ' <span class="ls-sw" style="background:#30a46c"></span>' + T.rec + (sumT > 0 ? ' <span class="ls-sw" style="background:#f5a524"></span>' + T.thr : '') + '</p>'
      + '<p class="fine">' + T.sum.replace('{d}', M(F.dep.reduce((a, x) => a + x, 0))).replace('{r}', M(recUsed)).replace('{b}', M(sumB)).replace('{t}', M(sumT)).replace('{cap}', Number.isFinite(cap) ? T.capT.replace('{c}', M(cap)) : '')
      + ' · ' + (F.rule === 'hypercar' ? T.hyper.replace('{s}', M(swing)) : T.start) + '</p>' + (F.rule === 'hypercar' ? '' : '<p class="fine">' + T.ok.replace('{a}', recUsed <= cap + 1 ? '✓' : '✗').replace('{w}', M(win)).replace('{s}', M(swing)).replace('{b}', swing <= win + 1e4 ? '✓' : '✗ ' + T.over.replace('{x}', M(swing - win))) + '</p>');
  }
  const keyHtml = '<span class="ls-key-0"></span>' + sel.label + (cmp ? ' <span class="ls-key-1"></span>' + data.cars[state.compareId].label : '');
  // Track evolution: lap over the session from the simulated lap (= end-of-qualifying track state)
  const se = sel.series === 'wec' ? 'wec' : 'f1', ev = Object.assign({type: 'qualifying', tyre: 'slick', useCurve: true}, state.evo || {});
  // tyres the selected car's series really has (no intermediate in WEC); F1 slick named by the race's Pirelli C-numbers
  const ts = sel.series ? (sel.cls === 'lmgt3' ? 'lmgt3' : 'hypercar') : 'f1';
  // WEC: only the slicks Michelin/Goodyear supplied at this event (season of the car, else the latest held here)
  const wy = sel.series ? (data.wecTyres[sel.year] ? sel.year : Object.keys(data.wecTyres).pop()) : null, we = wy ? data.wecTyres[wy][ts] : null;
  const tyres = we ? Object.fromEntries(Object.entries(t.tyres[ts]).filter(([k]) => k === 'wet' || we.dry.includes(k)).map(([k, v]) => [k, v + (we.q === k ? t.tyreQ : '')]))
    : sel.series && ts === 'lmgt3' ? {medium: t.tyres.lmgt3.medium, wet: t.tyres.lmgt3.wet} : t.tyres[ts];
  const tyreNote = sel.series ? (we ? t.tyreEvent.replace('{y}', wy) : t.tyreSeason) : '';
  if (!tyres[ev.tyre]) ev.tyre = Object.keys(tyres)[0];
  const cy = data.compounds[sel.year] ? sel.year : data.compounds[2026] ? 2026 : Object.keys(data.compounds).pop(), cs = data.compounds[cy], cn = {S: 2, M: 1, H: 0};
  const tyreHtml = Object.keys(tyres).map(k => '<option value="' + k + '"' + (k === ev.tyre ? ' selected' : '') + '>' + tyres[k].replace(/\{([SMH])\}/, (_, c) => cs ? ' ' + cs[cn[c]] + (String(cy) !== String(sel.year) ? ' (' + cy + ')' : '') : '') + '</option>').join('');
  // dry compound: the simulated lap is a soft-tyre pole lap; F1 adds the gap fitted on this track's real race laps
  const dry = ev.tyre !== 'inter' && ev.tyre !== 'wet', cg = ts === 'f1' && dry ? data.compoundGap?.[cy]?.[ev.tyre] : null, gapS = cg ? res.lapTime * cg.pct / 100 : null;
  const coef = data.evo[se][ev.type], qc = data.evo[se].qualifying;
  const endOf = c => c.curve ? c.curve[c.curve.length - 1][0] : (se === 'wec' ? (c === qc ? 20 : 90) : 60);
  const P = Object.assign({}, coef, {session: ev.type, tyre: dry ? 'slick' : ev.tyre, useCurve: ev.useCurve && !!coef.curve, wetStart: 0, dryMin: 20, warmupLaps: 0}, ev.over || {});
  const evo = {end: ev.over && Number.isFinite(ev.over.end) ? ev.over.end : endOf(coef), gainPct: +(+P.gainPct).toFixed(2), tauMin: Math.round(P.tauMin), wetStart: P.wetStart, dryMin: P.dryMin, warmupLaps: P.warmupLaps};
  const lap0 = res.lapTime / (1 + R.evolutionDelta(Object.assign({}, qc, {session: 'qualifying', useCurve: !!qc.curve}), endOf(qc), Infinity));
  const curve = R.evolutionCurve(lap0, P, {to: Math.max(evo.end, 1), step: Math.max(0.5, evo.end / 60)});
  if (gapS) { curve.points = curve.points.map(p => ({...p, lap: p.lap + gapS})); curve.last = curve.points.at(-1); }
  const first = curve.points[0].lap, last = curve.last.lap;
  const evoFacts = (tyreNote ? fact(t.evoTyre, tyreNote.replace(/^[^:]+: /, '')) : '') + fact(t.evoLast, fmt(last)) + fact(t.evoChange, (last - first >= 0 ? '+' : '−') + Math.abs(last - first).toFixed(3) + ' s')
    + (dry && ev.tyre !== 'soft' ? fact(t.evoComp, gapS != null ? (gapS >= 0 ? '+' : '−') + Math.abs(gapS).toFixed(3) + ' s (' + (cg.basis === 'measured' ? t.evoCompReal.replace('{y}', cy) : t.evoCompModel.replace('{e}', data.compoundTest)) + ')' : t.evoCompNone) : '')
    + fact(t.evoBasisH, P.useCurve ? t.evoBasis.track : coef.calibrated ? t.evoBasis.series : t.evoBasis.default)
    + (coef.holdoutPct != null ? fact(t.evoErr, '±' + (last * coef.holdoutPct / 100).toFixed(2) + ' s') : '');
  const ew = 640, eh = 200, lo = Math.min(...curve.points.map(p => p.lap)), hi = Math.max(...curve.points.map(p => p.lap));
  const ex = m => 44 + m / Math.max(1, evo.end) * (ew - 56), ey = v => 12 + (hi - v) / Math.max(0.05, hi - lo) * (eh - 40);
  // F1 qualifying split: Q1/Q2/Q3 windows (latest real session here, else the usual schedule), the model's
  // best lap at the end of each (curve + fitted segment offset) and the real segment bests
  let qsHtml = '', qsBands = '';
  const QS = data.qsplit;
  if (QS && se === 'f1' && ev.type === 'qualifying') {
    const yr = QS.real ? Object.keys(QS.real).sort().pop() : null, R0 = yr ? QS.real[yr] : null, seg = R0 ? R0.seg : [[0, 18], [25, 40], [48, 60]];
    const at = m => 1 + R.evolutionDelta(P, m, Infinity), q3 = at(seg[2][1]), model = seg.map(([, b], k) => res.lapTime * (at(b) / q3 + (k < 2 ? QS.off[k] / 100 : 0)));
    qsBands = seg.map(([a, b], k) => '<rect x="' + ex(Math.min(a, evo.end)).toFixed(1) + '" y="12" width="' + Math.max(0, ex(Math.min(b, evo.end)) - ex(Math.min(a, evo.end))).toFixed(1) + '" height="' + (eh - 40) + '" fill="var(--mint)" opacity=".07"/><text x="' + ex(Math.min(a, evo.end)).toFixed(1) + '" y="24" font-size="11" fill="currentColor">Q' + (k + 1) + '</text>').join('');
    qsHtml = '<div class="output"><table class="ls-table"><thead><tr><th>' + t.qs.h + '</th><th>' + t.qs.win + '</th><th>' + t.qs.model + '</th><th>' + t.qs.real + (yr ? ' ' + yr : '') + '</th></tr></thead><tbody>'
      + seg.map(([a, b], k) => '<tr><td>Q' + (k + 1) + '</td><td data-no-translate>' + a.toFixed(0) + '–' + b.toFixed(0) + '</td><td data-no-translate>' + fmt(model[k]) + '</td><td data-no-translate>' + (R0 ? fmt(R0.best[k]) : '–') + '</td></tr>').join('') + '</tbody></table></div>'
      + '<p class="fine">' + (R0 ? '' : t.qs.none + ' · ') + t.qs.test.replace('{n}', QS.test.events).replace('{a}', QS.test.q1RmsPct).replace('{b}', QS.test.q2RmsPct) + '</p>';
  }
  const evoSvg = '<svg class="ls-race" viewBox="0 0 ' + ew + ' ' + eh + '" role="img" aria-label="' + t.evoChart + '">' + qsBands + '<polyline fill="none" stroke="currentColor" stroke-width="2" points="' + curve.points.map(p => ex(p.minute).toFixed(1) + ',' + ey(p.lap).toFixed(1)).join(' ') + '"/>'
    + '<text x="2" y="16" font-size="11" fill="currentColor">' + fmt(hi) + '</text><text x="2" y="' + (eh - 28) + '" font-size="11" fill="currentColor">' + fmt(lo) + '</text>'
    + '<text x="44" y="' + (eh - 6) + '" font-size="11" fill="currentColor">0</text><text x="' + (ew - 12) + '" y="' + (eh - 6) + '" font-size="11" text-anchor="end" fill="currentColor">' + evo.end + ' ' + t.min + '</text></svg>';
  return {lineNote, lap: fmt(res.lapTime), poleHtml, factsHtml, airHtml, kindLabel, mapSvg, traceSvg, keyHtml, windHtml, weather: w, evo, evoFacts, evoSvg, qsHtml, socHtml, brakeHtml, tyreHtml};
}

// Browser controller
function lapsimClient(K, computeView, renderMap, renderTrace, evolutionDelta, evolutionCurve, lineTrack, brakeZones) {
  const el = document.getElementById('lapsim-data'); if (!el) return;
  const R = {renderMap, renderTrace, evolutionDelta, evolutionCurve, lineTrack, brakeZones};
  document.querySelectorAll('[data-line-mode]').forEach(b => b.addEventListener('click', () => {
    state.lineMode = b.dataset.lineMode; state.showLine = true; document.querySelectorAll('[data-line-mode]').forEach(o => o.classList.toggle('active', o === b));
    const tg = document.querySelector('[data-line-toggle]'); if (tg) { tg.classList.add('active'); tg.setAttribute('aria-pressed', 'true'); } update();
  }));
  const tg = document.querySelector('[data-line-toggle]');
  if (tg) tg.addEventListener('click', () => { state.showLine = state.showLine === false; tg.classList.toggle('active', state.showLine); tg.setAttribute('aria-pressed', String(state.showLine)); update(); });
  // zoom and pan the map: transform on the inner box, so the svg itself (and its overlay) is untouched
  const box = document.querySelector('[data-ls-zoom]'), inner = box && box.firstElementChild, Z = {k: 1, x: 0, y: 0};
  const apply = () => { Z.k = Math.min(8, Math.max(1, Z.k)); const w = box.clientWidth, h = box.clientHeight; Z.x = Math.min(0, Math.max(w - w * Z.k, Z.x)); Z.y = Math.min(0, Math.max(h - h * Z.k, Z.y)); inner.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.k + ')'; box.classList.toggle('is-zoomed', Z.k > 1); reZoom(); };
  // keep line width, markers and labels readable while zoomed (the map is redrawn on every change)
  function reZoom() { if (!box) return; box.style.setProperty('--inv', String(1 / Z.k)); inner.querySelectorAll('svg.ls-map>g').forEach(g => { g.style.strokeWidth = (Number(g.getAttribute('stroke-width')) / Math.pow(Z.k, 0.8)).toFixed(2); }); }
  const zoomAt = (f, cx, cy) => { Z.x = cx - (cx - Z.x) * f; Z.y = cy - (cy - Z.y) * f; Z.k *= f; if (Z.k <= 1) { Z.k = 1; Z.x = 0; Z.y = 0; } apply(); };
  if (box) {
    document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => { const w = box.clientWidth / 2, h = box.clientHeight / 2; if (b.dataset.zoom === 'fit') { Z.k = 1; Z.x = 0; Z.y = 0; apply(); } else zoomAt(b.dataset.zoom === 'in' ? 1.6 : 1 / 1.6, w, h); }));
    box.addEventListener('wheel', e => { if (!e.ctrlKey && Z.k === 1) return; e.preventDefault(); const r = box.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); }, {passive: false});
    const pts = new Map(); let pinch = 0;
    box.addEventListener('pointerdown', e => { if (Z.k === 1 && e.pointerType === 'mouse') return; pts.set(e.pointerId, [e.clientX, e.clientY]); box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]); if (pinch) { const r = box.getBoundingClientRect(); zoomAt(d / pinch, (a[0] + c[0]) / 2 - r.left, (a[1] + c[1]) / 2 - r.top); } pinch = d; return; }
      if (Z.k > 1) { Z.x += dx; Z.y += dy; apply(); e.preventDefault(); }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  }
  const data = JSON.parse(el.textContent);
  const q = s => document.querySelector('[data-ls="' + s + '"]');
  const yearKey = data.conds['2026'] ? '2026' : Object.keys(data.conds)[0];
  const state = {carId: data.carId, compareId: '', mode: 'real', manual: Object.assign({pressureHpa: 1013, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, data.conds[yearKey] || {}), active: {}, strength: 1, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}};
  const sliders = document.querySelectorAll('[data-cond]');
  const syncSliders = () => sliders.forEach(s => { const k = s.dataset.cond, v = state.manual[k]; if (Number.isFinite(v)) s.value = v; const o = document.querySelector('[data-out="' + k + '"]'); if (o) o.textContent = Number(s.value).toFixed(s.step < 1 ? 1 : 0); });
  let pending = false;
  const update = () => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const v = computeView(K, data, state, R);
      q('lap').textContent = v.lap; q('pole').innerHTML = v.poleHtml; q('facts').innerHTML = v.factsHtml; q('air').innerHTML = v.airHtml;
      q('map').innerHTML = v.mapSvg; reZoom(); q('trace').innerHTML = v.traceSvg; q('soc').innerHTML = v.socHtml; q('brakes').innerHTML = v.brakeHtml; q('key').innerHTML = v.keyHtml; q('wind').innerHTML = v.windHtml;
      q('carLabel').textContent = data.cars[state.carId].label; q('carKind').textContent = v.kindLabel;
      if (q('lineNote')) q('lineNote').textContent = v.lineNote;
      q('evoFacts').innerHTML = v.evoFacts; q('evoChart').innerHTML = v.evoSvg; q('qsplit').innerHTML = v.qsHtml; q('tyre').innerHTML = v.tyreHtml;
      document.querySelectorAll('[data-evo-out]').forEach(o => { const k = o.dataset.evoOut; o.textContent = v.evo[k]; const i = document.querySelector('input[data-evo="' + k + '"]'); if (i && document.activeElement !== i) i.value = v.evo[k]; });
    });
  };
  q('series').addEventListener('change', e => {
    const se = e.target.value, ids = data.carOrder.filter(k => (data.cars[k].series || 'f1') === se);
    q('car').innerHTML = ids.map(k => '<option value="' + k + '">' + data.cars[k].label + '</option>').join('');
    q('car').value = ids[0]; q('car').dispatchEvent(new Event('change'));
  });
  q('car').addEventListener('change', e => { state.carId = e.target.value; const u = new URL(location.href); u.searchParams.set('car', state.carId); history.replaceState(null, '', u); update(); });
  q('compare').addEventListener('change', e => { state.compareId = e.target.value; update(); });
  // Météo-France forecast (ARPEGE/AROME through Open-Meteo): pick an hour, its weather fills the sliders
  const fc = q('forecast'), FT = fc && fc.dataset.ft ? JSON.parse(fc.dataset.ft) : null;
  const forecast = async () => {
    const [lat, lon] = fc.dataset.ll.split(','); fc.hidden = false; fc.textContent = FT.loading; const det = fc.closest('details'); if (det) det.open = true;
    try {
      const r = await fetch('https://api.open-meteo.com/v1/meteofrance?latitude=' + lat + '&longitude=' + lon + '&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,shortwave_radiation,precipitation&wind_speed_unit=ms&forecast_days=4&timezone=auto');
      const j = await r.json(), H = j.hourly; if (!H || !H.time) throw Error('no data');
      const now = Date.now(), idx = H.time.map((x, i) => i).filter(i => new Date(H.time[i] + 'Z').getTime() - (j.utc_offset_seconds || 0) * 1000 >= now - 3600e3);
      fc.innerHTML = '<label>' + FT.hour + ' <select data-fc-hour>' + idx.map(i => '<option value="' + i + '">' + H.time[i].replace('T', ' ') + (H.precipitation[i] > 0.1 ? ' · ' + FT.rain + ' ' + H.precipitation[i] + ' mm' : '') + '</option>').join('') + '</select></label><p class="fine">' + FT.note + '</p>';
      const pick = i => { Object.assign(state.manual, {airTempC: H.temperature_2m[i], humidityPct: H.relative_humidity_2m[i], pressureHpa: H.surface_pressure[i], windSpeed: H.wind_speed_10m[i], windFromDeg: H.wind_direction_10m[i], trackTempC: Math.round((H.temperature_2m[i] + FT.k * (H.shortwave_radiation[i] || 0)) * 2) / 2}); syncSliders(); update(); };
      fc.querySelector('[data-fc-hour]').addEventListener('change', e => pick(+e.target.value)); pick(idx[0]);
    } catch (err) { fc.textContent = FT.fail; }
  };
  q('mode').addEventListener('change', e => { state.mode = e.target.value === 'forecast' ? 'manual' : e.target.value; if (fc) fc.hidden = e.target.value !== 'forecast'; if (e.target.value === 'forecast') { q('manual').hidden = false; forecast(); return; } q('manual').hidden = state.mode !== 'manual'; if (state.mode === 'manual') { const c = data.cars[state.carId], real = data.conds[c.series ? state.carId : String(c.year)]; if (real) Object.assign(state.manual, real); syncSliders(); } update(); });
  sliders.forEach(s => s.addEventListener('input', () => { state.manual[s.dataset.cond] = Number(s.value); syncSliders(); update(); }));
  document.querySelectorAll('[data-change]').forEach(c => c.addEventListener('change', () => { state.active[c.dataset.change] = c.checked; update(); }));
  const st = q('strength'); if (st) st.addEventListener('input', () => { state.strength = Number(st.value); q('strengthOut').textContent = '×' + state.strength; update(); });
  // track evolution: moving rubber sliders switches from the measured curve to the formula
  document.querySelectorAll('[data-evo]').forEach(i => i.addEventListener(i.type === 'range' ? 'input' : 'change', () => {
    const k = i.dataset.evo, e = state.evo;
    if (k === 'type' || k === 'tyre') { e[k] = i.value; if (k === 'type') e.over = {}; }
    else if (k === 'useCurve') e.useCurve = i.checked;
    else { e.over[k] = Number(i.value); if (k === 'gainPct' || k === 'tauMin') { e.useCurve = false; const c = document.querySelector('[data-evo="useCurve"]'); if (c) c.checked = false; } }
    update();
  }));
  syncSliders();
}

let scriptText = null;
export function lapsimScript() {
  if (!scriptText) scriptText = '(()=>{const K=(' + lapsimKernel.toString() + ')();const renderMap=' + renderMap.toString() + ';const renderTrace=' + renderTrace.toString() + ';const evolutionDelta=' + evolutionDelta.toString() + ';const evolutionCurve=' + evolutionCurve.toString() + ';const lineTrack=' + lineTrack.toString() + ';const brakeZones=' + brakeZones.toString() + ';const computeView=' + computeView.toString() + ';(' + lapsimClient.toString() + ')(K,computeView,renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones);})();';
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
.ls-key{font-size:13px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ls-key span{display:inline-block;width:22px;height:3px;border-radius:2px}.ls-key-0{background:var(--mint)}.ls-sw{display:inline-block;width:14px;height:8px;border-radius:2px;margin-left:8px}.ls-soc{width:100%;height:auto}.ls-key-1{background:var(--sim-slow)}
.ls-sliders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px}.ls-slider{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,2fr) 52px 36px;align-items:center;gap:10px;min-width:0}.ls-slider input{min-height:32px;padding:0;accent-color:var(--mint);border:0;background:none}.ls-slider output{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}.ls-unit{font-size:12px;color:var(--muted)}
.ls-strength{max-width:520px;grid-template-columns:minmax(110px,1fr) minmax(0,2fr) 52px}
.ls-changes{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ls-change label{display:flex;gap:12px;align-items:flex-start;color:var(--text);font-size:14px;min-width:0}.ls-change input{width:20px;height:20px;min-height:0;margin-top:2px;accent-color:var(--mint)}.ls-change small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.ls-change.is-info label{color:var(--muted)}.ls-dot{width:20px;flex:0 0 20px;text-align:center}.ls-dot::before{content:'·'}
.ls-table td,.ls-table th{white-space:nowrap}.ls-notes{margin:0;padding-left:20px;display:grid;gap:10px;line-height:1.7;color:var(--muted);max-width:80ch}.ls-panel h3{font-size:18px;margin-top:6px}

.ls-zoombox{overflow:hidden;position:relative;touch-action:pan-y;border-radius:12px}.ls-zoombox.is-zoomed{touch-action:none;cursor:grab}.ls-zoombox>div{transform-origin:0 0;will-change:transform}.ls-line-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}.ls-zoom-btns{margin-left:auto;display:inline-flex;gap:6px}.ls-map .ls-mk{stroke:#fff;transform-box:fill-box;transform-origin:center;scale:var(--inv,1)}.ls-zoombox text{transform-box:fill-box;transform-origin:center;scale:var(--inv,1)}.ls-map .ls-band{fill:color-mix(in oklab,var(--muted) 18%,transparent);stroke:none}
.ls-mk-b{fill:#e5484d}.ls-mk-a{fill:#f5a524}.ls-mk-t{fill:#30a46c}.ls-line-key [class^=ls-mk]{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 10px;vertical-align:middle}.ls-line-key [class^=ls-mk]:first-child{margin-left:0}.ls-line-key .ls-mk-b{background:#e5484d}.ls-line-key .ls-mk-a{background:#f5a524}.ls-line-key .ls-mk-t{background:#30a46c}
.ls-evo .ls-controls{grid-template-columns:repeat(3,minmax(0,1fr));margin:12px 0 16px}.ls-check{display:flex;align-items:center;gap:8px;align-self:end;min-height:40px}.ls-check input{width:20px;height:20px;min-height:0;accent-color:var(--mint)}.ls-evo .ls-facts{margin-top:16px}
@media(max-width:900px){.ls-stage{grid-template-columns:1fr;gap:24px}.ls-hero h1{font-size:32px}.ls-controls{grid-template-columns:1fr 1fr}.ls-air-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.ls-sliders{grid-template-columns:1fr}}
@media(max-width:520px){.ls-controls{grid-template-columns:1fr}.ls-facts{grid-template-columns:1fr 1fr}.ls-slider{grid-template-columns:1fr 52px 36px}.ls-slider>span:first-child{grid-column:1/-1}}`;
