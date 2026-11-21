// /setup — setup simulator page: per car and circuit, which set-up knobs exist (from the rules),
// where the circuit pushes each one (lap simulation + published data), and what the press reported.
import {setupPlan, setupTracks, F1_TEAMS, HYPERCARS, GT3_MODELS, LMP2, AERO_RANGE, MARGINAL_LD, PHASE} from './lapsim/setup-plan.js';
import {HYPERCAR_PRESS, SM_SOURCE, ALTITUDE_NOTE} from './lapsim/setup-evidence.js';
import {lapsimAllTracks} from './lapsim/tracks.js';
import {trackLabel, trackOrder} from './simulator-controls.js';
import {carViews, drawingCss} from './setup-drawing.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const F1R = 'https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_09_-_2026-10-01.pdf';
const F1C = 'https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_21_-_2026-10-19.pdf';
const LMP2R = 'https://www.fia.com/system/files/documents/2026_lmp2-2017_wmsc_2025.12.10_published_2025.12.11_clean_version_-_v2.1.pdf#page=30';
const LMH = 'https://www.fia.com/system/files/documents/2026_lmh_technical_regs_2025.10.16_published_2025.10.17_clean_version_0.pdf';
const LMDH = 'https://www.fia.com/system/files/documents/lmdh-technical-regulations-2025.10.16-blackline.pdf';
const WECS = 'https://www.fia.com/system/files/documents/2026_fia_world_endurance_championship_sporting_regulations_clean_v1.2wmsc.pdf';

// Knobs: name, what it changes, what the rules allow, the two ends of the scale. [ko, en]
const KNOBS = {
  aero: {
    name: ['공력 레벨(윙)', 'Aero level (wing)'],
    f1: {what: ['리어윙 사양·플랩 각과 앞날개 플랩으로 다운포스와 드래그를 맞춤. 2026년엔 스트레이트 모드 구간에서 앞뒤 날개가 눕는다(C3.10.10·C3.11.6).', 'Rear-wing spec and flap angle plus front-wing flap set downforce and drag. In 2026 both wings flatten in straight-mode zones (C3.10.10, C3.11.6).'],
      rule: ['예선 첫 출발부터 결승까지 파르크 페르메: 앞날개 말고는 공력 구성 변경 불가(B3.5.3·B3.5.7). 다른 디자인 윙 교체 승인은 시즌 6회까지(B3.5.5).', 'Parc fermé from the first run in qualifying to the race: no aero change except the front wing (B3.5.3, B3.5.7); a different wing design may be approved six times a season (B3.5.5).'], src: F1R},
    hypercar: {what: ['차체는 하나만 홈롤로게이션되고, 조절 가능한 공력 장치는 하나(보통 리어윙 각)뿐. 어느 위치에서도 공력 성능 창 안에 있어야 함(LMH 3.4.1).', 'Only one bodywork is homologated and only one adjustable aero device (usually the rear-wing angle); every setting must stay in the aero window (LMH 3.4.1).'],
      rule: ['주행 중 공기 흐름을 바꾸는 장치 금지. 창의 위치는 BoP가 보정.', 'No device may change airflow while moving; BoP corrects where a car sits in the window.'], src: LMH},
    gt3: {what: ['홈롤로게이션된 GT3 차체에서 리어윙 각을 허용 범위 안에서 조절. 무게·출력 곡선·스틴트 에너지는 BoP가 정함.', 'Homologated GT3 bodywork; the rear-wing angle is set inside its allowed range. Weight, power curve and stint energy come from BoP.'],
      rule: ['BoP 표: 차종별 출력 곡선(P 번호), 200km/h 이후 출력 보정, 최소 무게, 스틴트 최대 에너지.', 'BoP table: per-car power curve (P number), power change above 200 km/h, minimum weight, maximum stint energy.']},
    lmp2: {what: ['오레카 07 단일 차체. 리어윙 각과 거니로 다운포스를 맞춤(르망은 저다운포스 사양).', 'Single Oreca 07 body; downforce is set with the rear-wing angle and gurney (Le Mans uses the low-downforce spec).'],
      rule: ['LMP2는 스펙 차량에 가까워 셋업 차이가 성적 차이의 큰 몫. ABS 금지(LMP2 기술규정 14.5).', 'LMP2 is close to a spec car, so set-up is a large share of the gap. ABS is banned (LMP2 TR 14.5).'], src: LMP2R},
    ends: [['저다운포스', 'Low downforce'], ['고다운포스', 'High downforce']]},
  rideHeight: {name: ['차고·레이크', 'Ride height & rake'],
    what: ['앞뒤 차고. 바닥 다운포스를 키우려면 낮게, 연석·범프와 바닥 긁힘(플랭크 마모)을 피하려면 높게.', 'Front/rear ride height: low for floor downforce, high for kerbs, bumps and plank wear.'],
    rule: {f1: ['주행 중 서스펜션 조정 금지, 예선 전 서스펜션 셋업 시트 제출(B3.5.2).', 'No suspension adjustment while moving; suspension set-up sheet before qualifying (B3.5.2).'], hypercar: ['자유롭게 조정 가능(차고에 따른 공력 변화가 성능의 핵심 — PMW).', 'Free to set; how aero changes with ride height is where performance hides (PMW).'],
      gt3: ['자유롭게 조정 가능. 최저 지상고 검사 대상.', 'Free to set; minimum ground clearance is checked.'], lmp2: ['자유롭게 조정 가능. 스키드 블록 마모 검사.', 'Free to set; skid-block wear is checked.']},
    ends: [['낮게', 'Low'], ['높게', 'High']]},
  springs: {name: ['스프링·히브 강성', 'Springs & heave'], what: ['고속 코너가 많으면 단단하게(공력 플랫폼 유지), 느린 코너·범프가 많으면 부드럽게(기계적 그립).', 'Stiff for fast corners (aero platform), soft for slow corners and bumps (mechanical grip).'], ends: [['부드럽게', 'Soft'], ['단단하게', 'Stiff']]},
  rollBalance: {name: ['앞뒤 롤 강성(안티롤바)', 'Roll-stiffness balance (anti-roll bars)'], what: ['앞을 부드럽게 하면 느린 코너에서 잘 돌고, 앞을 단단하게 하면 고속에서 안정적.', 'Softer front = rotation in slow corners; stiffer front = stability at speed.'], ends: [['회전성', 'Rotation'], ['안정성', 'Stability']]},
  dampers: {name: ['댐퍼(범프·리바운드)', 'Dampers (bump/rebound)'], what: ['연석을 많이 타고 노면이 거칠면 부드럽게, 매끈한 고속 서킷은 단단하게 해 차체 자세를 묶음.', 'Soft for kerbs and rough surfaces, firm on smooth fast tracks to hold the platform.'], ends: [['연석·범프 흡수', 'Kerb compliance'], ['플랫폼 제어', 'Platform control']]},
  camber: {name: ['타이어 공기압·캠버', 'Tyre pressure & camber'],
    what: ['캠버(바퀴 기울기)가 크면 코너 그립↑·직선 마모↑. 공기압이 낮으면 접지↑, 너무 낮으면 구조 손상.', 'More camber = more cornering grip but more wear on straights; lower pressure = more contact patch, too low risks the carcass.'],
    rule: {f1: ['피렐리가 대회마다 최소 시작 공기압·캠버 한도를 정하고 FIA가 검사(B6.1.3 a).', 'Pirelli sets minimum starting pressures and camber limits per event; FIA checks them (B6.1.3 a).'],
      hypercar: ['미쉐린 단일 공급(6.5.2), 기준 공기압·캠버를 위원회 결정으로 제시(6.5.7). 타이어 가열 일체 금지(6.5.6).', 'Single Michelin supply (6.5.2); reference pressures and cambers by Committee decision (6.5.7); any tyre heating is banned (6.5.6).'],
      gt3: ['클래스별 단일 타이어 공급. 타이어 가열 금지(WEC 6.5.6).', 'One tyre supplier per class; tyre heating is banned (WEC 6.5.6).'], lmp2: ['클래스별 단일 타이어 공급. 타이어 가열 금지(WEC 6.5.6).', 'One tyre supplier per class; tyre heating is banned (WEC 6.5.6).']},
    ends: {f1: [['낮은 공기압', 'Low pressure'], ['높은 공기압', 'High pressure']], hypercar: [['캠버 적게', 'Less camber'], ['캠버 많이', 'More camber']], gt3: [['캠버 적게', 'Less camber'], ['캠버 많이', 'More camber']], lmp2: [['캠버 적게', 'Less camber'], ['캠버 많이', 'More camber']]}},
  brakeCooling: {name: ['브레이크 냉각(덕트)', 'Brake cooling (ducts)'], what: ['급제동이 잦고 덥거나 공기가 희박하면 덕트를 키움. 덕트가 크면 공력 손실.', 'Bigger ducts for frequent heavy braking, heat or thin air; bigger ducts cost aero.'], ends: [['작게(공력)', 'Small (aero)'], ['크게(냉각)', 'Large (cooling)']]},
  diff: {name: ['디퍼렌셜', 'Differential'], what: ['느린 코너 탈출이 많으면 잠김을 키워 트랙션, 고속 코너 위주면 열어 회전성.', 'More locking for traction out of slow corners; more open for rotation in fast ones.'], ends: [['열림', 'Open'], ['잠김', 'Locked']]},
  tc: {name: ['트랙션 컨트롤 맵', 'Traction-control map'], what: ['하이퍼카(LMH·LMDh 9.3)와 LMGT3(8.1)는 트랙션 컨트롤 허용. 느린 탈출이 많을수록 개입을 늘림.', 'Hypercars (LMH and LMDh 9.3) and LMGT3 (8.1) may use traction control; more intervention where slow exits dominate.'], src: LMH, ends: [['개입 적게', 'Less'], ['개입 많이', 'More']]},
};
const WHY = {
  aero: ['물리 시뮬레이션: 다운포스↔드래그를 바꿔 가며 한 바퀴를 돌려 가장 빠른 지점', 'Physics: the fastest point when trading downforce for drag over a lap'],
  rideHeight: ['노면 범프·연석 정보와 고속 코너 비율', 'Surface bumps/kerbs and the share of fast corners'],
  springs: ['고속·저속 코너 비율, 최고 속도, 노면', 'Fast vs slow corner share, top speed, surface'],
  rollBalance: ['고속·저속 코너 비율', 'Fast vs slow corner share'],
  dampers: ['연석·범프, 고속 코너 비율', 'Kerbs/bumps and fast-corner share'],
  camber: ['고속 코너·코너링 비율과 제동 비율', 'Fast-corner and cornering share vs braking share'],
  pirelli: ['피렐리 2026 공식 처방(시즌 범위 대비 위치)', 'Pirelli 2026 prescription (position in the season range)'],
  brakeCooling: ['랩 중 제동 시간 비율', 'Share of the lap spent braking'],
  brembo: ['제동 시간 비율 + 브렘보 제동 난이도 지수', 'Braking share + Brembo braking-difficulty index'],
  diff: ['트랙션 제한 구간과 느린 코너 비율', 'Traction-limited share and slow corners'],
  tc: ['트랙션 제한 구간과 느린 코너 비율', 'Traction-limited share and slow corners'],
};

const gauge = (p, ends, L, press) => `<div class="su-gauge" role="img" aria-label="${esc(ends[0][L] + ' ↔ ' + ends[1][L] + ': ' + Math.round(p * 100) + '/100')}"><span class="su-end">${esc(ends[0][L])}</span><span class="su-bar"><i style="left:${(p * 100).toFixed(0)}%"></i>${press != null ? `<b title="press" style="left:${(press * 100).toFixed(0)}%"></b>` : ''}</span><span class="su-end">${esc(ends[1][L])}</span></div>`;
const fmt = (x, d = 0) => Number.isFinite(x) ? x.toFixed(d) : '–';
const pct = x => Math.round(x * 100) + '%';

export const setupCss = drawingCss + `.su-cond-in{position:absolute;opacity:0}.su-conds{display:flex;gap:8px;margin:0 0 12px}.su-conds label{min-height:40px;padding:0 16px;border:1px solid var(--line);border-radius:999px;display:inline-flex;align-items:center;cursor:pointer;font-weight:700;color:var(--muted)}
.su-pane{display:none}#su-dry:checked~.su-conds label[for=su-dry],#su-wet:checked~.su-conds label[for=su-wet]{border-color:var(--mint);color:var(--text);box-shadow:inset 0 0 0 1px var(--mint)}#su-dry:checked~.su-pane-dry,#su-wet:checked~.su-pane-wet{display:block}#su-dry:focus-visible~.su-conds label[for=su-dry],#su-wet:focus-visible~.su-conds label[for=su-wet]{outline:2px solid var(--mint)}
.su-form{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 20px}.su-form label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--muted);min-width:200px;flex:1}
.su-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 4px}.su-grid div{border:1px solid var(--line);border-radius:12px;padding:10px 12px}.su-grid b{display:block;font-size:20px;font-variant-numeric:tabular-nums}.su-grid span{font-size:13px;color:var(--muted)}
.su-knob{border-top:1px solid var(--line);padding:14px 0}.su-knob h3{margin:0 0 4px;font-size:17px}.su-knob p{margin:4px 0;font-size:14px}.su-knob .fine{color:var(--muted);font-size:13px}
.su-gauge{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:13px}.su-end{color:var(--muted);min-width:76px}.su-end:last-child{text-align:right}.su-bar{position:relative;flex:1;height:8px;border-radius:999px;background:var(--line)}
.su-bar i{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--mint)}.su-bar b{position:absolute;top:50%;width:4px;height:18px;margin:-9px 0 0 -2px;background:var(--text);opacity:.7}
.su-legend{font-size:13px;color:var(--muted)}.su-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--mint);margin-right:4px}.su-legend b{display:inline-block;width:3px;height:12px;background:var(--text);opacity:.7;margin:0 4px 0 10px;vertical-align:middle}
.su-src{font-size:13px;color:var(--muted)}.su-src a{color:inherit}
@media(max-width:700px){.su-end{min-width:56px}}`;

export function setupPage(query = {}, lang = 'ko', live = null) {
  const L = lang === 'en' ? 1 : 0, t = (ko, en) => L ? en : ko;
  const kind = ['hypercar', 'gt3', 'lmp2'].includes(query.series) ? query.series : 'f1', vk = kind === 'f1' ? 'f1' : 'hypercar'; // vk: drawing and shared prototype/GT texts
  const tracks = setupTracks(kind), ids = trackOrder(Object.fromEntries(Object.keys(tracks).map(k => [k, lapsimAllTracks[k]])));
  const id = ids.includes(query.track) ? query.track : (ids.includes('monza') ? 'monza' : ids[0]);
  const models = kind === 'f1' ? F1_TEAMS.map(([k, n, pu]) => ({key: k, label: `${n} (${pu} PU)`})) : kind === 'gt3' ? GT3_MODELS.map(m => ({key: m.key, label: m.name}))
    : kind === 'lmp2' ? [{key: LMP2.key, label: LMP2.name}] : HYPERCARS.map(m => ({key: m.key, label: `${m.name} · ${m.cls.toUpperCase()}`}));
  const car = models.some(m => m.key === query.car) ? query.car : models[0].key;
  const carId = (kind === 'f1' ? 'f1-2026:' : kind === 'gt3' ? 'gt3:' : kind === 'lmp2' ? 'lmp2:' : 'hyper:') + car;
  // qualifying vs race set-up: prototypes and GT3 (F1: parc fermé, one set-up); live = latest session of this event (setup-live.js)
  const phase = kind !== 'f1' && query.phase === 'race' ? 'race' : 'quali', liveHere = live && (query.track || 'monza') === id ? live : null;
  const plan = setupPlan(id, carId, {phase, live: liveHere}), wetPlan = plan && setupPlan(id, carId, {wet: true, phase, live: liveHere});
  const opt = (v, label, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label)}</option>`;
  const form = `<form class="su-form" method="get" action="/setup" data-no-translate>
<label>${t('종목', 'Series')}<select name="series" onchange="if(this.form.car)this.form.car.value='';this.form.submit()">${opt('f1-2025', 'F1 2025', query.series === 'f1-2025' ? 'f1-2025' : kind)}${opt('f1', 'F1 2026', query.series === 'f1-2025' ? '' : kind)}${opt('hypercar', t('하이퍼카 LMH·LMDh', 'Hypercar LMH/LMDh'), kind)}${opt('gt3', t('GT3 (차종별)', 'GT3 (per model)'), kind)}${opt('lmp2', 'LMP2 Oreca 07 Gibson', kind)}</select></label>
<label>${t('차량', 'Car')}<select name="car" onchange="this.form.submit()">${models.map(m => opt(m.key, m.label, car)).join('')}</select></label>
<label>${t('서킷', 'Circuit')}<select name="track" onchange="this.form.submit()">${ids.map(k => opt(k, trackLabel(k, lapsimAllTracks[k]) + (tracks[k].length ? ' · ' + tracks[k].join('/') : ''), id)).join('')}</select></label>
${kind === 'f1' ? '' : `<label>${t('셋업', 'Set-up')}<select name="phase" onchange="this.form.submit()">${opt('quali', t('예선 셋업', 'Qualifying set-up'), phase)}${opt('race', t('결승 셋업', 'Race set-up'), phase)}</select></label>`}
<noscript><button class="button" type="submit">${t('보기', 'Show')}</button></noscript></form>`;
  const hero = `<section class="hero"><h1>${t('셋업 시뮬레이터', 'Setup simulator')}</h1><p class="lead">${t('차량과 서킷을 고르면, 규정상 어디를 조절할 수 있는지와 이 서킷이 각 셋업을 어느 쪽으로 미는지 보여 줍니다. 공력 레벨은 물리 시뮬레이션으로 계산하고, 타이어·브레이크는 공식 자료를, 나머지는 시뮬레이션이 읽은 서킷 특성으로 추정합니다.', 'Pick a car and a circuit to see which set-up knobs the rules allow and which way this circuit pushes each one. Aero level comes from the physics simulation, tyres and brakes from official data, the rest is estimated from the circuit the simulation reads.')}</p><p class="fine"><a href="/simulation?track=${esc(id)}">${t('같은 서킷 랩타임 시뮬레이션 →', 'Lap-time simulation for this circuit →')}</a></p></section>`;
  // F1 2025: UI only for now (owner 2026-11-15); the 2025 setup model comes later
  if (query.series === 'f1-2025') return hero + `<section class="panel">${form.split('</label>').filter(x => !/name="(car|track)"/.test(x)).join('</label>')}</section><section class="panel"><h2>F1 2025</h2>${carViews('f1-2025', () => null, L)}<p class="fine">${t('2025 F1 셋업 계산은 준비 중입니다. 곧 추가됩니다.', '2025 F1 set-up results are coming soon.')}</p></section>`;
  if (!plan) return hero + `<section class="panel">${form}<p>${t('이 조합은 아직 계산할 수 없습니다.', 'This combination cannot be computed yet.')}</p></section>`;
  const d = plan.demands, ev = plan.evidence || {}, model = plan.model;
  const alt = ALTITUDE_NOTE[id];
  const facts = [[fmt(d.vMax) + (d.vMax >= plan.vCapKph - 1 ? '*' : ''), t('최고 속도 km/h', 'top speed km/h')], [pct(d.fullPower), t('풀스로틀 구간', 'full throttle')], [pct(d.brakeTimeShare), t('제동 시간', 'time braking')],
    [`${d.slow}/${d.corners - d.slow - d.fast}/${d.fast}`, t('저속/중속/고속 코너', 'slow/medium/fast corners')], [String(d.heavyBrakes), t('급제동(100km/h↓)', 'heavy stops (−100 km/h)')], [fmt(d.elevation) + ' m', t('고저차', 'elevation range')],
    ...(kind === 'f1' && ev.sm != null ? [[String(ev.sm) + (ev.smEstimated ? '*' : ''), t(ev.smEstimated ? '스트레이트 모드 구간 (*추정)' : '스트레이트 모드 구간 (FIA)', ev.smEstimated ? 'straight-mode zones (*estimated)' : 'straight-mode zones (FIA)')],
      [ev.overtake === 'off' ? t('안 씀', 'not used') : ev.overtake === 'all' ? t('랩 전체', 'whole lap') : ev.overtake === 'none' ? t('표준 곡선이 빠름', 'standard curve faster') : ev.overtake, t('오버테이크 곡선 사용(예선)', 'Overtake curve use (qualifying)')]] : []),
    ...(ev.rear ? [[Math.round(ev.rear.share * 1000) / 10 + '%', ev.rear.source === 'iracing' ? t(`뒤축 무게 배분 · 모델(아이레이싱), 세션 ${ev.rear.n}개`, `rear weight share · model (iRacing), ${ev.rear.n} sessions`) : t('뒤축 무게 배분 · 추정(엔진 배치)', 'rear weight share · assumed (engine layout)')]] : []),
    ...(ev.bop ? [[`${ev.bop.kg} kg · ${ev.bop.kW != null ? ev.bop.kW + ' kW' : 'P' + ev.bop.curve}`, t(`BoP ${ev.bop.fun ? '(재미로, 가상)' : '추정'} ${ev.bop.event}`, `BoP ${ev.bop.fun ? '(just for fun)' : 'estimate'} ${ev.bop.event}`)]].concat(ev.bop.spec && ev.bop.spec !== 'base' ? [[ev.bop.spec, t('사양', 'spec')]] : []) : []), ...(alt ? [[alt + '%', t('공기 밀도(해수면 대비)', 'air density vs sea level')]] : [])]
    .map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');
  const summary = `<section class="panel"><h2>${esc(trackLabel(id, lapsimAllTracks[id]))} · ${esc(models.find(m => m.key === car).label)}</h2>
<p class="fine">${t('물리 모델이 이 차로 한 바퀴를 돌며 읽은 서킷 특성(실제 세션 날씨)', 'Circuit as the physics model reads it over one lap with this car (real session weather)')}</p><div class="su-grid">${facts}</div>
<p class="fine">${esc(t(`데이터: ${plan.basis.kind === 'learned' ? `실제 경기 ${plan.basis.events ?? 0}개에서 학습` : plan.basis.kind === 'calibrated' ? `${plan.basis.year} 시즌 보정` : '규정·제원 기반 추정(학습 전)'}${plan.basis.session ? ` · 이 서킷 실제 랩: ${plan.basis.session}` : ' · 이 서킷 실제 경기 없음(가상)'}. 실제 경기가 끝날 때마다 학습 데이터가 갱신되어 셋업 추정도 함께 바뀝니다.`, `Data: ${plan.basis.kind === 'learned' ? `learned from ${plan.basis.events ?? 0} real events` : plan.basis.kind === 'calibrated' ? `${plan.basis.year} season calibration` : 'rules and spec estimate (not learned yet)'}${plan.basis.session ? ` · real lap here: ${plan.basis.session}` : ' · no real race here (virtual)'}. The learned data refits after every real race, so these estimates move with it.`))}</p>
${kind === 'hypercar' && model ? `<p class="fine">${esc(t(`섀시 ${model.chassis} · 하이브리드 ${model.hybrid === 'front' ? '앞바퀴 모터(BoP 속도 이상에서만 구동, 약 190km/h)' : model.hybrid === 'rear' ? '뒷바퀴 표준 모터 50kW(속도 제한 없음)' : '없음'} · ${model.series}`, `Chassis ${model.chassis} · hybrid ${model.hybrid === 'front' ? 'front motor (drives only above the BoP speed, about 190 km/h)' : model.hybrid === 'rear' ? 'spec 50 kW rear motor (any speed)' : 'none'} · ${model.series}`))}${model.hybrid === 'front' ? esc(t(` — 이 서킷은 랩의 ${pct(d.above190)}가 190km/h 이상이라 4륜 구동 구간이 그만큼.`, ` — ${pct(d.above190)} of this lap is above 190 km/h, so that is where it gets 4WD.`)) : ''}</p>` : ''}
${kind === 'f1' && plan.energy ? `<p class="fine">${esc(t(`에너지: 이 대회 랩당 회수 한도 ${plan.energy.mj} MJ(${plan.energy.status === 'official' ? 'FIA 문서' : '추정'}), 제동만으로 회수 가능한 양(모델) 약 ${fmt(d.regenMJ, 1)} MJ`, `Energy: per-lap recharge limit ${plan.energy.mj} MJ (${plan.energy.status === 'official' ? 'FIA document' : 'estimate'}); braking alone could recover about ${fmt(d.regenMJ, 1)} MJ (model)`))}</p>` : ''}</section>`;
  const knobsFor = plan => { const ev = plan.evidence || {};
  const knobOrder = ['aero', 'rideHeight', 'springs', 'rollBalance', 'dampers', 'camber', 'brakeCooling', 'diff', ...(kind === 'f1' ? [] : ['tc'])];
  const knobs = knobOrder.map(k => {
    const K = KNOBS[k], v = plan.knobs[k]; if (!v) return '';
    const what = (K[kind]?.what || K[vk]?.what || K.what)[L], rule = K[kind]?.rule || K.rule?.[kind] || K[vk]?.rule || K.rule?.[vk], ends = Array.isArray(K.ends) ? K.ends : K.ends[kind] || K.ends[vk];
    let extra = '', press = null;
    if (k === 'aero') {
      press = ev.press?.level ?? null;
      extra = `<p>${esc(t(`시즌 평균 공력(보정 기준) 대비 최적점이 ${fmt(plan.aero.pts[5].lap - plan.aero.lap, 3)}초 빠름 · 양 끝 차이: 저다운포스 ${fmt(plan.aero.low.lap - plan.aero.lap, 3)}초 / 고다운포스 ${fmt(plan.aero.high.lap - plan.aero.lap, 3)}초 · 최고속 ${fmt(plan.aero.low.vMax)}~${fmt(plan.aero.high.vMax)} km/h${plan.aero.low.vMax >= plan.vCapKph - 1 ? ' (저다운포스 쪽은 모델 속도 상한)' : ''}`, `Best point is ${fmt(plan.aero.pts[5].lap - plan.aero.lap, 3)} s faster than the season-average aero (calibrated) · ends: low ${fmt(plan.aero.low.lap - plan.aero.lap, 3)} s / high ${fmt(plan.aero.high.lap - plan.aero.lap, 3)} s · top speed ${fmt(plan.aero.low.vMax)}–${fmt(plan.aero.high.vMax)} km/h${plan.aero.low.vMax >= plan.vCapKph - 1 ? ' (low end at the model speed cap)' : ''}`))}</p>`
        + (ev.press ? `<p class="fine">${esc(t('언론 보도: ', 'Press: ') + ev.press[L ? 'en' : 'ko'])}${ev.press.url ? ` <a href="${esc(ev.press.url)}" target="_blank" rel="noopener">↗</a>` : ''}</p>` : '')
        + `<p class="fine">${esc(t(`가정: 윙으로 바꿀 수 있는 다운포스 폭 ±${AERO_RANGE[kind] * 50}%, 추가 다운포스의 효율(L/D) ${MARGINAL_LD}. 실제 트랩 속도로 보정하기 전 값입니다.`, `Assumed: wing range ±${AERO_RANGE[kind] * 50}% downforce at a marginal L/D of ${MARGINAL_LD}, until fitted from trap speeds.`))}</p>`;
    }
    const pz = ev.pirelli && (plan.wet ? {...ev.pirelli.i, c: t('인터미디어트', 'Intermediate')} : ev.pirelli);
    if (k === 'camber' && pz) extra = `<p>${esc(t(`피렐리 처방(${pz.c}): 최소 시작 공기압 앞 ${pz.p[0]} / 뒤 ${pz.p[1]} psi, 캠버 한도 앞 ${pz.cam[0]}° / 뒤 ${pz.cam[1]}°`, `Pirelli prescription (${pz.c}): minimum starting pressure front ${pz.p[0]} / rear ${pz.p[1]} psi, camber limit front ${pz.cam[0]}° / rear ${pz.cam[1]}°`))} <a href="${esc(ev.pirelli.url)}" target="_blank" rel="noopener">FIA ↗</a></p>`;
    if (k === 'camber' && kind === 'f1' && !ev.pirelli) extra = `<p class="fine">${esc(t('2026 피렐리 처방이 아직 공개되지 않은 대회입니다.', 'No 2026 Pirelli prescription published for this event yet.'))}</p>`;
    if (k === 'brakeCooling' && ev.brembo) extra = `<p class="fine">${esc(t(`브렘보 제동 난이도 ${ev.brembo.i}/5 (${ev.brembo.y})`, `Brembo braking difficulty ${ev.brembo.i}/5 (${ev.brembo.y})`))} <a href="${esc(ev.brembo.url)}" target="_blank" rel="noopener">↗</a></p>`;
    if (k === 'rideHeight' && plan.surface) { const bs = plan.surface.bumpySource, kr = plan.surface.kerbs ?? 0.5; extra = `<p class="fine">${esc(t(`노면: 범프 ${Math.round(plan.surface.bumpy * 5)}/5${bs === 'iracing' ? ' (iRacing 레이저 스캔에서 학습)' : bs ? ' (공개 정보 + iRacing 학습)' : ''}, 연석 사용 ${Math.round(kr * 5)}/5${plan.surface.street ? ' (시가지)' : ''}`, `Surface: bumps ${Math.round(plan.surface.bumpy * 5)}/5${bs === 'iracing' ? ' (learned from iRacing laser scans)' : bs ? ' (public notes + iRacing)' : ''}, kerb use ${Math.round(kr * 5)}/5${plan.surface.street ? ' (street)' : ''}`))}</p>`; }
    const src = K[kind]?.src || K[vk]?.src || K.src;
    return `<div class="su-knob"><h3>${esc(K.name[L])}</h3>${gauge(v.p, ends, L, press)}<p>${esc(what)}</p>${extra}${rule ? `<p class="fine">${esc(t('규정: ', 'Rules: ') + rule[L])}${src ? ` <a href="${esc(src)}" target="_blank" rel="noopener">↗</a>` : ''}</p>` : ''}<p class="fine">${esc(t('근거: ', 'Basis: ') + WHY[v.why][L])}</p></div>`;
  }).join('');
  return knobs; };
  const legend = `<p class="su-legend"><i></i>${t('시뮬레이터 추정', 'simulator estimate')}${kind === 'f1' ? `<b></b>${t('언론 보도(있을 때)', 'press report (when known)')}` : ''}</p>`;
  const rules = kind === 'f1'
    ? [[t('파르크 페르메', 'Parc fermé'), t('예선(스프린트 예선) 첫 출발부터 결승(스프린트) 시작까지 셋업·부품 변경 금지. 어기면 피트레인 출발(B3.5.1·B3.5.3). 그래서 금요일 FP에서 예선과 결승을 동시에 만족하는 셋업을 찾아야 함.', 'From the first run in (sprint) qualifying to the start of the race (sprint) no set-up or part changes; breach = pit-lane start (B3.5.1, B3.5.3). Friday practice must find one set-up for both qualifying and race.'), F1R],
      [t('액티브 에어로', 'Active aero'), t('FIA가 대회마다 스트레이트 모드 구간을 지정(F1이 안 가는 서킷은 추정). 모나코는 0개라 액티브 에어로 없이 달림. 젖은 노면은 로우그립 컨디션: Alt 구간에서 앞날개만 펴짐(B7.1.2 b), 그래서 젖은 셋업은 다운포스를 더 씀. 예선은 마이애미부터 랩 전체 오버테이크 곡선, 에너지가 모자라면 쓸 곳을 고름(C5.2.8, C5.12).', 'The FIA names straight-mode zones per event (estimated where F1 does not race); Monaco has none, so no active aero there. A wet track means Low Grip Conditions: only the front wing opens, in the Alt zones (B7.1.2 b), so the wet set-up carries more downforce. Qualifying uses the Overtake curve on the whole lap from Miami on; with too little energy the team picks where (C5.2.8, C5.12).'), SM_SOURCE],
      [t('기어비·PU', 'Gearing & PU'), t('PU 모드와 에너지 배치는 대회마다 정해지는 회수 한도 안에서 조절(2026 MGU-K 350kW).', 'PU modes and energy deployment are tuned within the per-event recharge limit (2026 MGU-K 350 kW).'), F1C]]
    : [[t('예선→결승', 'Qualifying → race'), t('WEC 스포팅 규정에서 F1 같은 예선→결승 셋업 봉인 조항은 찾지 못했고, 파르크 페르메는 결승 후에 적용(15.1.3). 하이퍼폴 타이어는 하이퍼폴에만 사용(6.5.4).', 'We found no F1-style qualifying-to-race set-up freeze in the WEC sporting rules; parc fermé applies after the finish (15.1.3). Hyperpole tyres are for Hyperpole only (6.5.4).'), WECS],
      [t('타이어', 'Tyres'), t('건조 타이어 수량 제한: FP 12개, 하이퍼폴 4개, 결승 6h 18개·8h 26개·10h 32개(6.5.4). 워머 금지라 차고·캠버·공기압으로 워밍업을 해결해야 함.', 'Dry-tyre limits: practice 12, Hyperpole 4, race 18 (6 h) / 26 (8 h) / 32 (10 h) (6.5.4). No warmers, so warm-up must come from set-up.'), WECS],
      [t('하이브리드·BoP', 'Hybrid & BoP'), t('LMH는 앞바퀴 모터(최대 200kW, BoP 속도 이상), LMDh는 뒷바퀴 표준 모터(50kW). 출력·무게·스틴트당 에너지는 BoP가 정함.', 'LMH: front motor (up to 200 kW, above the BoP speed); LMDh: spec rear motor (50 kW). Power, weight and energy per stint are set by BoP.'), LMDH]].map(r => kind === 'gt3' && r[0] === t('하이브리드·BoP', 'Hybrid & BoP') ? [t('BoP', 'BoP'), t('하이브리드 없음. 차종별 출력 곡선·무게·스틴트 에너지를 BoP가 정하고, 이 페이지의 BoP 값은 BoP 시뮬레이터의 추정치.', 'No hybrid. BoP sets each car\'s power curve, weight and stint energy; the BoP shown here is the BoP simulator estimate.'), LMDH]
      : kind === 'lmp2' && r[0] === t('하이브리드·BoP', 'Hybrid & BoP') ? [t('스펙 차량', 'Spec car'), t('오레카 07 섀시와 깁슨 GK428 V8 단일 사양, 하이브리드·BoP 없음. 르망은 ACO가 출력을 따로 정함.', 'Single Oreca 07 chassis and Gibson GK428 V8, no hybrid, no BoP. At Le Mans the ACO sets its own power level.'), LMP2R] : r);
  const rulesHtml = `<section class="panel"><h2>${t('규정이 정한 테두리', 'What the rules fix')}</h2>${rules.map(([h, p, u]) => `<div class="su-knob"><h3>${esc(h)}</h3><p>${esc(p)} <a href="${esc(u)}" target="_blank" rel="noopener">↗</a></p></div>`).join('')}
${kind === 'hypercar' ? `<h3>${t('언론·전문지 보도', 'Press and trade reports')}</h3><ul>${HYPERCAR_PRESS.map(n => `<li>${esc(L ? n.en : n.ko)} <a href="${esc(n.url)}" target="_blank" rel="noopener">↗</a></li>`).join('')}</ul>` : ''}</section>`;
  const note = `<p class="su-src">${t('셋업 값은 팀이 공개하지 않습니다. 이 페이지의 위치는 물리 시뮬레이션과 공개 자료로 만든 방향 추정이며, 실제 숫자(스프링 N/mm 등)가 아닙니다. 공기 밀도는 Wolfram 표준 대기로 교차 확인했습니다.', 'Teams do not publish set-ups. Positions here are direction estimates from the physics simulation and public data, not real numbers (spring rates etc.). Air density was cross-checked with Wolfram standard-atmosphere data.')}</p>`;
  const third = (k, p) => { const K = KNOBS[k], ends = Array.isArray(K.ends) ? K.ends : K.ends[kind] || K.ends[vk]; return (p < 0.34 ? ends[0][L] : p > 0.66 ? ends[1][L] : t('중간', 'Mid')) + ' ' + Math.round(p * 100); };
  const SRC = {f1: t('F1 그랑프리', 'F1 Grand Prix'), wec: t('하이퍼카 레이스(WEC·IMSA)', 'Hypercar race (WEC/IMSA)'), other: t('이 서킷의 다른 레이스', 'another race at this track'), assumed: t('그럴듯한 기본 조건(실제 경기 기록 없음)', 'plausible default (no real race record)'), live: t('이번 대회 최신 세션', 'latest session of this event')};
  const pane = (p, cls) => {
    const ev = p.evidence || {}, wx = p.weather, pz = ev.pirelli && (p.wet ? ev.pirelli.i : ev.pirelli);
    const value = (k, lk) => { const v = p.knobs[k]; if (!v) return null;
      if ((lk === 'tyreF' || lk === 'tyreR') && pz) { const i = lk === 'tyreF' ? 0 : 1; return `${pz.cam[i]}° · ≥${pz.p[i]} psi`; }
      return third(k, v.p); };
    const wline = `<p class="fine">${esc(t('날씨 기준: ', 'Weather basis: ') + SRC[p.source.src] + (p.source.src === 'live' ? ` · ${p.source.session}` : (p.source.year ? ` ${p.source.year}` : '') + t(' 베스트 랩 세션', ' best-lap session')) + ` · ${t('기온', 'air')} ${fmt(wx.airTempC)}°C · ${t('노면', 'track')} ${fmt(wx.trackTempC)}°C · ${t('습도', 'humidity')} ${fmt(wx.humidityPct)}% · ${fmt(wx.pressureHpa)} hPa`)}</p>`
      + (p.wet ? `<p class="fine">${esc(t('웻: 같은 날씨에서 노면만 젖었다고 보고 인터미디어트 그립을 드라이의 75%로 가정(웻 세션 학습 전). 기계 셋업은 부드럽게·높게, 트랙션 컨트롤 더, 디퍼렌셜은 더 열고, 브레이크 냉각은 줄이는 방향.', 'Wet: same weather with a wet surface; intermediate grip assumed at 75 % of dry until wet sessions are learned. Mechanical set-up goes softer and higher, more TC, a more open diff and less brake cooling.'))}</p>` : '')
      + `<p class="fine">${esc(t(`예상 랩타임 ${fmt(p.aero.lap, 2)}초 (공력 레벨 ${Math.round(p.aero.s * 100)}/100)`, `Estimated lap ${fmt(p.aero.lap, 2)} s (aero level ${Math.round(p.aero.s * 100)}/100)`))}</p>`;
    return `<div class="su-pane su-pane-${cls}">${wline}${carViews(vk, value, L)}${legend}${knobsFor(p)}</div>`;
  };
  const phaseNote = kind === 'f1' ? '' : `<p class="fine">${esc(phase === 'race'
    ? t(`결승 셋업: 스틴트 평균 연료 +${PHASE.raceFuelKg[kind]}kg, 마모된 타이어(그립 ${Math.round((1 - PHASE.raceGrip) * 1000) / 10}%↓)를 가정하고, 롱런 경험칙(캠버 줄이고, 브레이크 냉각·트랙션 컨트롤 늘림)을 더함(가정값, 스틴트 데이터 학습 전).`, `Race set-up: mean stint fuel +${PHASE.raceFuelKg[kind]} kg and worn tyres (${Math.round((1 - PHASE.raceGrip) * 1000) / 10}% less grip) assumed, plus long-run rules of thumb (less camber, more brake cooling and traction control). Assumed until fitted from stint data.`)
    : t('예선 셋업: 적은 연료, 새 타이어.', 'Qualifying set-up: low fuel, new tyres.'))}</p>
<p class="fine">${esc(t('예선과 결승 사이 셋업 변경: WEC·IMSA 가능(WEC는 결승 후 파르크 페르메 15.1.3, IMSA는 선택된 차만 예선 후 임파운드). ELMS(10.2.5)·GT 월드 챌린지·DTM은 예선 후 파르크 페르메라 결승 셋업 = 예선 셋업.', 'Set-up changes between qualifying and race: allowed in WEC and IMSA (WEC parc fermé only after the race, 15.1.3; IMSA impounds only selected cars after qualifying). ELMS (10.2.5), GT World Challenge and DTM put cars in parc fermé after qualifying, so their race set-up is the qualifying set-up.'))}</p>`;
  const liveNote = plan.source?.src === 'live' ? `<p class="fine">${esc(t(`이번 대회 진행 중: 최신 세션(${plan.source.session}) 실제 날씨로 다시 계산했습니다. FP·예선·결승이 끝날 때마다 갱신됩니다.`, `Event in progress: recomputed with the real weather of the latest session (${plan.source.session}). Updates after every practice, qualifying and race session.`))}</p>` : '';
  const conds = `<section class="panel"><h2>${t('셋업 방향', 'Set-up direction')}</h2>${phaseNote}${liveNote}<input class="su-cond-in" type="radio" name="su-cond" id="su-dry" checked><input class="su-cond-in" type="radio" name="su-cond" id="su-wet">
<div class="su-conds"><label for="su-dry">${t('드라이', 'Dry')}</label><label for="su-wet">${t('웻', 'Wet')}</label></div>${pane(plan, 'dry')}${wetPlan ? pane(wetPlan, 'wet') : ''}</section>`;
  return `${hero}<section class="panel">${form}</section>${summary}${conds}${rulesHtml}${note}`;
}
