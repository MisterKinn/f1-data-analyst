// /simulation — lap simulator page. The physics runs in worker/lapsim/kernel.js on the server
// (first render) and in the browser (every change), so sliders answer instantly.
import {lapsimKernel, powertrain} from './lapsim/kernel.js';
import {lapChannels} from './lapsim/channels.js';
import {lapsimAllTracks as lapsimTracks} from './lapsim/tracks.js';
import {lapsimCalibration} from './lapsim/calibration-data.js';
import {RULE_CHANGES} from './lapsim/cars.js';
import {SERIES} from './lapsim/series.js';
import {carsFor as scenarioCars, realConditions, latestChanges, fittedYear, CAR_ORDER, raceRecords} from './lapsim/scenario.js';
import {TRACK_NAMES as NAMES} from './lapsim/names.js';
import {energyLimit} from './lapsim/energy-limits.js';
import {lapsimRace} from './lapsim/race-data.js';
import {lapsimRacingLines} from './lapsim/racing-lines-data.js';
import {lapsimTrackWidths} from './lapsim/track-widths.js';
import {lapsimCompounds} from './lapsim/compounds-data.js';
import {lapsimStints} from './lapsim/stint-data.js';
import {lapsimCompoundGap} from './lapsim/compound-gap-data.js';
import {lapsimWecTyres} from './lapsim/wec-tyres-data.js';
import {raceLaps, strategies} from './lapsim/race-pace.js';
import {evolutionCoeffs, evolutionDelta, evolutionCurve} from './lapsim/evolution.js';
import {lineTrack, blendLine, blendOff, minCurvatureLine} from './lapsim/racing-line.js';
import {TRACK_LL} from './lapsim/track-coords.js';
import {lapsimTrackTemp} from './lapsim/tracktemp-data.js';
import {brakeZones} from './lapsim/brakes.js';
import {lapsimBrakes} from './lapsim/brake-data.js';
import {lapsimQsplit} from './lapsim/qsplit-data.js';
import {lapsimCarLines} from './lapsim/car-lines-data.js';
import {lapsimPuDocs} from './lapsim/pu-docs-data.js';
import {lapsimPuEst} from './lapsim/pu-est-data.js';
import {lapsimDriverLines} from './lapsim/driver-lines-data.js';
import {trackLabel, trackOrder, evoPairs, carEvent} from './simulator-controls.js';
import {lapsimTrackNorth} from './lapsim/track-north-data.js';
import {lapsimTrackView} from './lapsim/track-view-data.js';
import {lapsimF1Zones} from './lapsim/f1-zones-data.js';
import {SURFACE_ERAS} from './lapsim/surface.js';
import {ZONES_ON, DRS_ONLY, PU_QUALI} from './lapsim/zones.js';
import {lapsimStartLines} from './lapsim/start-lines.js';

const K = lapsimKernel();
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const trackName = (id, lang) => (NAMES[id] || [lapsimTracks[id]?.name || id, lapsimTracks[id]?.name || id])[lang === 'en' ? 1 : 0];

const T = {
  ko: {
    title: '랩 시뮬레이터', h1: '2026–2028 F1 머신으로 한 바퀴를 계산합니다',
    lead: '실제 예선 랩으로 보정한 물리 모델이 지금의 트랙 형상, 예선 날씨, FIA가 공지한 서킷 변경 사항을 반영해 랩타임과 속도를 계산합니다.',
    track: '트랙', series: '시리즈', car: '규정 · 클래스', spec: '대회별 스펙', evoNone: '이 차는 Evo 데이터가 없습니다', eventFor: '이 차의 대회: {n} ({a} – {b}) · 세션 날씨: {y} 시즌', compare: '비교', soonShort: '준비 중',
    seriesNames: {f1: 'F1', wec: 'Hypercar/GTP', fe: '포뮬러 E', gt3: 'GT3 (차종별)'}, none: '없음', realAero: '실제 {y} 예선: {s}', realAeroParts: {low: '로우그립 컨디션 (Alt SM 존, 부분 작동)', otOff: '오버테이크 꺼짐', drsOff: 'DRS 꺼짐'}, conditions: '조건', sm: 'SM 존', smOpt: {normal: '기본', alt: 'Alt (로우그립)', off: '끔'}, ot: '오버테이크', drs: 'DRS', onOff: ['켬', '끔'], real: '실제 예선 조건', manual: '직접 설정',
    lap: '계산된 랩타임', vsPole: '실제 폴', realLap: '실제 랩', wecBest: '실제 최고 랩', raceBest: '실제 레이스 최고 랩', errRange: '오차 범위(1σ)', conf: {medium: '신뢰도 보통', low: '신뢰도 낮음', 'very-low': '신뢰도 매우 낮음', 'not-fitted': '실측 보정 전'},
    soon: '준비 중: 기타 GT3(IMSA GTD·DTM·SP9), 포뮬러 E Gen4. 같은 보정 규칙을 쓰며 데이터 연결 후 추가됩니다.', sector: '섹터', vmax: '최고 속도', vmin: '최저 속도', energy: '배치 에너지', clip: '배치 상한 속도',
    map: '속도로 칠한 주행 라인', slow: '느림', fast: '빠름', trace: '거리별 텔레메트리', tel: {motor: '모터 출력 (kW, + 배치 / − 회생, 점선 = 규정 상한)', puChart: {h: 'MGU-K DC 출력 맵 (C5.2.8)', x: '차 속도 (km/h)', std: 'Base – Standard', ot: 'Base – Overtake', alt: 'Alt 1 (스프린트·레이스 음영 구간)', thisLap: '이 랩', late: '마이애미부터: 예선·프랙티스는 랩 전체 Base – Overtake, 스프린트·레이스는 주요 추월 구간에서 Standard/Overtake, 음영 구간은 Alt 1.', early: '1–3라운드 규정: 오버테이크는 1초 안에서 따라갈 때만 (FIA 문서에 예선 줄 없음), 그 밖에는 Base – Standard.', est: '추정 문서: 마이애미부터의 규정을 적용.'}, puEst: '파워유닛 정보 추정 (FIA 문서 없음: 2026 FIA 문서 20개에서 배운 레이스 디렉터 규칙, 마이애미부터의 규정):', puEarly: 'FIA 파워유닛 정보 (R{r}, 마이애미 전 규정): 어디서나 기본 곡선(최대 350 kW).', puLate: 'FIA 파워유닛 정보 (R{r}, 마이애미부터 바뀐 규정): 레이스·스프린트는 주요 가속 구간에서 350 kW, 음영 구간에서는 대체 곡선(Alt 1, 약 250 kW). 예선은 랩 전체에서 오버테이크 곡선(Base – Overtake)을 쓸 수 있습니다.', puDoc: '회생 한도 예선 {q} MJ · 레이스 {race} MJ, 출력 제한 거리 {d} m, 출력 감소율 {rate} kW/s, Alt 1 구간: {alt}.', puSpeed: '높은 속도 기준 구간: {s}.', soc: '배터리 에너지 (SoC, MJ: 배치·회생 모델)', short: {motor: '모터', soc: 'SoC', speed: '속도', delta: '시간 차', throttle: '스로틀', brake: '브레이크', gear: '기어', rpm: 'rpm', steer: '조향'}, hover: '그래프 위에 마우스를 올리거나 터치하면 그 지점의 값이 모든 채널에 표시됩니다.', delta: '시간 차 (s, + = {car} 쪽이 뒤짐)', throttle: '스로틀 (%)', risk: '드라이버의 페달·핸들 떨림은 사람처럼 만든 모델입니다: 브레이크는 순간적으로 밟아 살짝 넘쳤다가 미세하게 조절하고, 잠김 직전에 잠깐 풀었다 다시 밟고, 코너 안쪽까지 끌며 놓습니다. 스로틀은 천천히 열고 빠르게 닫으며, 트랙션 한계에서 흔들리고 가끔 잠깐 뗍니다. 속도 그래프의 붉은 띠는 그립을 잃기 쉬운 구간(크레스트에서 줄어드는 하중, 내리막 제동, 뒷바람에 줄어드는 다운포스, 최근 FIA 공지의 새 포장·범프 보수 구간, 타이어 온도 창 밖의 노면 온도, 비)이며, 이곳에서 떨림이 커집니다.', speed: '속도 (km/h)', brake: '브레이크 압력 (앞 라인, bar)', gear: '기어', rpm: '엔진 회전수 (rpm)', steer: '스티어링 휠 각도 (°, + = 왼쪽)', note: '브레이크 압력은 감속도·브레이크 밸런스·패드 마찰계수·디스크와 캘리퍼 크기(클래스별 추정값)로, 기어와 회전수는 엔진 곡선과 기어비에서 출력이 가장 큰 기어로, 스티어링은 라인 곡률·휠베이스·조향비·언더스티어 경사로 계산합니다. 한계 근처의 작은 수정 조향은 고정 시드로 만든 모델 값입니다. 모두 실측 텔레메트리가 아닌 시뮬레이션입니다.', shifts: '변속 {n}회'}, km: '거리 (km)',
    air: '공기', airTemp: '기온', trackTemp: '노면 온도', humidity: '습도', pressure: '기압', wind: '풍속', windFrom: '바람 방향',
    motor: '하이브리드 모터', axleFront: '앞 차축', axleRear: '뒤 차축', deployFrom: '{v} 이상에서만 구동', hybridE: '모터 사용 / 회생 (랩당)', soc: {old: '2025년까지 규정: 랩당 모터 배치 4 MJ 한도만 모델에 들어 있습니다 (MGU-H가 채우는 회생은 모델에 없어 배터리 흐름은 그리지 않습니다).', h: '배터리 에너지 (추정)', lead: 'F1·WEC 모두 실제 배터리 충전량(SoC)과 모터 사용 기록은 공개되지 않습니다. 아래는 규정 한도(배터리 사용 폭, 대회별 랩당 회생 한도)와 이 시뮬레이션 랩에서 계산한 추정값입니다.', line: '배터리에 남은 에너지', dep: '모터 배치', rec: '회생 (브레이크)', thr: '회생 (풀 스로틀, 슈퍼 클리핑)', sum: '배치 {d} MJ · 회생 {r} MJ (브레이크 {b} + 풀 스로틀 {t}){cap}', capT: ' · 한도 {c} MJ', ok: '확인: 회생 ≤ 한도 {a} · 랩 안 에너지 변동 {s} MJ ≤ 배터리 사용 폭 {w} MJ {b}', over: '({x} MJ 초과: 이 시뮬레이터는 에너지를 랩 합계로만 맞추기 때문입니다. 실제 차는 이만큼 배치를 줄이거나 순서를 바꿉니다)', start: '예선 랩: 배터리 가득 찬 상태에서 시작 (점선 = 사용 폭 한계)', hyper: '하이퍼카: 랩마다 충전 유지, 가장 낮은 지점을 0으로 둠 · 필요한 배터리 사용 폭 {s} MJ'},
    recharge: '퀄리 회생 한도', energy_official: 'FIA PU 문서', energy_provisional: 'FIA 잠정값, 보도 기준', energy_estimated: '추정', density: '공기 밀도', seaLevel: '해수면 표준 대비', ice: '엔진 출력', grip: '타이어 그립', mainStraight: '메인 스트레이트',
    headwind: '맞바람', tailwind: '뒷바람', calm: '무풍', fia: 'FIA 서킷 변경 사항', fiaLead: '레이스 디렉터 노트의 “Changes to the circuit” 목록입니다. 랩에 영향을 주는 항목은 켜고 끌 수 있으며, 효과 크기는 가정값입니다.',
    inFit: y => `${y}년 실제 랩으로 머신을 보정할 때 이미 반영된 변경 사항입니다. 켜면 효과가 한 번 더 더해집니다.`, notInFit: '아직 보정에 쓴 실제 랩에는 없는 변경 사항입니다. 켜서 효과를 미리 계산해 보세요.',
    strength: '효과 크기', apply: '적용', noLap: '랩타임 영향 없음', noChanges: '이 트랙의 공지된 변경 사항이 아직 없습니다.',
    calib: '보정과 예측', calibLead: '실제 폴 랩의 속도 기록과 랩타임에 맞춰 머신 값을 찾았습니다.', fitErr: '랩타임 오차', speedRms: '속도 오차(RMS)',
    proj: '2027–2028 예측', projRules: '확정된 파워유닛 규정 변경', projDev: '규정 주기 2·3년 차의 역대 개발 속도',
    model: '이 계산의 범위', pending: '데이터 준비 중', pendingLead: '트랙과 보정 데이터를 만드는 중입니다. 잠시 후 다시 확인해 주세요.',
    calibrated: '실측 보정', learned: '실제 랩으로 학습', prior: '규정값 기반', projected: '예측',
    m1: '트랙 형상은 OpenF1의 예선 차량 위치(여러 드라이버의 베스트 랩)로 만든 실제 주행 라인입니다. 코너 번호는 공식 위치, 방위는 실제 지도와 맞췄습니다.',
    m2: '2025·2026 머신은 실제 폴 랩에 맞춰 보정했습니다 (계산 방법은 TUM(뮌헨공대)이 공개한 랩 시뮬레이션 방식).',
    m3: '2026년 규정: MGU-K 350kW(290km/h 이상에서 감소, 345km/h에서 0), 배터리 사용 폭 4MJ, 랩당 회생 최대 8.5MJ (Section C 5.2, Issue 21). 퀄리파잉 회생 한도는 FIA가 서킷별로 정한 값(5–9MJ, 언론 보도 기준)을 씁니다.',
    m4: '노면 온도에 따른 그립, 고도에 따른 엔진 출력 감소, FIA 변경 사항의 효과는 가정값입니다. 측정값처럼 읽지 마세요.',
    m5: '준정상상태 모델이라 변속, 타이어 온도 변화, 차 사이 간섭은 계산하지 않습니다. 2026년 이후 차량은 제동 회생과 함께, 타이어가 다 쓰지 못하는 엔진 출력으로 하는 회생을 계산하고, 직선 끝 풀스로틀 회생(슈퍼 클리핑)은 랩이 더 빨라질 때만 씁니다. 절대값보다 차이와 경향을 보는 데 쓰세요.',
    src: '자료', updated: '보정일',
    evo: '트랙 에볼루션', evoLead: '세션이 진행되며 고무가 쌓이고, 젖은 노면이 마르고, 타이어가 데워지면서 랩타임이 어떻게 바뀌는지 계산합니다. 기준은 위의 계산된 랩(예선 끝 노면)입니다.',
    evoType: '세션', evoTypes: {practice: '연습', qualifying: '예선'}, evoTyre: '타이어', tyres: {f1: {soft: '소프트{S}', medium: '미디엄{M}', hard: '하드{H}', inter: '인터미디엇', wet: '풀 웻'}, hypercar: {soft: '소프트 (미쉐린)', medium: '미디엄 (미쉐린)', hard: '하드 (미쉐린)', wet: '웻 (미쉐린)'}, lmgt3: {medium: '미디엄 (굿이어)', hard: '하드 (굿이어)', wet: '웻 (굿이어)'}, pirelli: {medium: '드라이 (피렐리 P Zero)', wet: '웻 (피렐리 Cinturato)'}, michelinGt: {medium: '드라이 (미쉐린)', wet: '웻 (미쉐린)'}, hankook: {medium: '올웨더 (한국타이어 iON Race)'}, feMichelin: {medium: '올웨더 (미쉐린 Pilot Sport EV)'}, bridgestone: {medium: '드라이 (브리지스톤)', wet: '웻 (브리지스톤)'}}, tyreQ: ' · 하이퍼폴 지정',
    tyreEvent: '타이어: {y} 이 대회 공급 컴파운드', tyreSeason: '타이어: 이 서킷 대회 기록 없음, 시즌 전체 컴파운드',
    evoComp: '컴파운드 차이 (소프트 대비)', evoCompReal: '{y} 실측: 같은 드라이버 저연료 랩, 트랙 진화 제외', evoCompModel: 'C단계 모델 예측, 검증 오차 ±{e}%', evoCompNone: '실측 없음, 랩 그대로',
    evoEnd: '세션 시각', evoGain: '고무 효과 (끝까지)', evoTau: '포화 시간', evoWet: '시작 노면 젖음', evoDry: '건조 시간', evoWarm: '워밍업 랩',
    evoCurve: '실측 곡선 사용', evoLast: '이 시각의 예상 랩', evoChange: '세션 시작 대비', evoBasis: {track: '이 트랙 실측 곡선', series: '시리즈 평균 (보정)', default: '미보정 기본값'},
    evoErr: '홀드아웃 오차 (트랙 제외)', qs: {h: '구간', win: '시간 (분)', model: '모델 최고 랩', real: '실제 최고 랩', test: 'Q1·Q2 예측 검증 (대회 하나씩 빼고, {n}개 예선): Q1 {a}% · Q2 {b}% 오차. Q3 = 폴 (실측 재현)', none: '이 트랙 실제 구간 기록 없음 (보통 시간표 18·15·12분 사용)', repro: '이미 열린 {y} 예선: 구간 최고 랩을 실측으로 재현합니다. 보정 전 모델: {raw}'}, secFix: '섹터 보정 (실제 폴 기준)', evoBasisH: '근거', evoChart: '세션 시각별 예상 랩타임', min: '분',
  },
  en: {
    title: 'Lap simulator', h1: 'Simulate a lap in a 2026–2028 F1 car',
    lead: 'A physics model calibrated on real qualifying laps works out lap time and speed on today’s track layout, with qualifying weather and the circuit changes the FIA has announced.',
    track: 'Track', series: 'Series', car: 'Rules · class', spec: 'Series spec', evoNone: 'No Evo data for this car', eventFor: 'Event for this car: {n} ({a} – {b}) · session weather: {y} season', compare: 'Compare', soonShort: 'coming soon',
    seriesNames: {f1: 'F1', wec: 'Hypercar/GTP', fe: 'Formula E', gt3: 'GT3 (by car model)'}, none: 'None', realAero: 'Real {y} qualifying: {s}', realAeroParts: {low: 'Low Grip Conditions (Alt SM zones, partial activation)', otOff: 'Overtake disabled', drsOff: 'DRS disabled'}, conditions: 'Conditions', sm: 'SM zones', smOpt: {normal: 'Normal', alt: 'Alt (low grip)', off: 'Off'}, ot: 'Overtake', drs: 'DRS', onOff: ['On', 'Off'], real: 'Real qualifying conditions', manual: 'Set my own',
    lap: 'Simulated lap time', vsPole: 'Real pole', realLap: 'Real lap', wecBest: 'Real best lap', raceBest: 'Real fastest race lap', errRange: 'Error range (1σ)', conf: {medium: 'medium confidence', low: 'low confidence', 'very-low': 'very low confidence', 'not-fitted': 'not fitted to real laps'},
    soon: 'Formula E: Gen2, Gen3 and Gen3 Evo are learned from Al Kamel laps; Gen4 is a prior from the 2026-27 regulations until its first laps.', sector: 'Sector', vmax: 'Top speed', vmin: 'Lowest speed', energy: 'Energy deployed', clip: 'Deploy cut-off',
    map: 'Racing line coloured by speed', slow: 'Slow', fast: 'Fast', trace: 'Telemetry over distance', tel: {motor: 'Motor power (kW, + deploy / − recovery, dashed = regulation cap)', puChart: {h: 'MGU-K DC power map (C5.2.8)', x: 'Car speed (km/h)', std: 'Base – Standard', ot: 'Base – Overtake', alt: 'Alt 1 (shaded Sprint/Race sectors)', thisLap: 'this lap', late: 'From Miami on: practice and qualifying use Base – Overtake on the whole lap; Sprint and Race use Standard/Overtake in the main overtaking zones and Alt 1 in the shaded sectors.', early: 'Rounds 1–3 rules: Overtake only when within 1 s (no qualifying row in the FIA document), otherwise Base – Standard.', est: 'Estimated document: rules from Miami on.'}, puEst: 'Estimated Power Unit Information (no FIA document: race-director rule learned from the 20 FIA 2026 documents, rules from Miami on):', puEarly: 'FIA Power Unit Information (R{r}, rules before Miami): the base curve everywhere (up to 350 kW).', puLate: 'FIA Power Unit Information (R{r}, rules from Miami on): in Sprint and Race 350 kW in the key acceleration zones and the alternative curve (Alt 1, about 250 kW) in the shaded sectors. Qualifying may use the Overtake curve (Base – Overtake) on the whole lap.', puDoc: 'Recharge limit qualifying {q} MJ · race {race} MJ, power-limited distance {d} m, power reduction rate {rate} kW/s, Alt 1 sectors: {alt}.', puSpeed: 'Sectors with a higher speed threshold: {s}.', soc: 'Battery energy (SoC, MJ: deploy and recovery model)', short: {motor: 'Motor', soc: 'SoC', speed: 'Speed', delta: 'Delta', throttle: 'Throttle', brake: 'Brake', gear: 'Gear', rpm: 'rpm', steer: 'Steer'}, hover: 'Hover or touch a chart to read every channel at that point.', delta: 'Time delta (s, + = {car} behind)', throttle: 'Throttle (%)', risk: 'The pedal and steering wobble is a model of a human driver: the brake is stabbed, overshoots a little and is then modulated, eased for a moment where a wheel would lock and trailed off into the corner; the throttle is squeezed on and snapped off, shakes at the traction limit and is sometimes lifted for a moment. Red bands on the speed chart are where grip is easy to lose (load lost over a crest, braking downhill, downforce lost to a tailwind, fresh asphalt or patched bumps in the latest FIA notes, a track outside the tyre temperature window, rain); the corrections grow there.', speed: 'Speed (km/h)', brake: 'Brake pressure (front line, bar)', gear: 'Gear', rpm: 'Engine speed (rpm)', steer: 'Steering wheel angle (°, + = left)', note: 'Brake pressure comes from the deceleration, brake balance, pad friction and disc and caliper size (estimates per class); gear and rpm from the engine curve and the gear ratios (the gear with the most power); steering from the line curvature, wheelbase, steering ratio and understeer gradient. The small corrections near the grip limit are a model with a fixed seed. All channels are simulated, not measured.', shifts: '{n} gear changes'}, km: 'Distance (km)',
    air: 'Air', airTemp: 'Air temperature', trackTemp: 'Track temperature', humidity: 'Humidity', pressure: 'Pressure', wind: 'Wind speed', windFrom: 'Wind from',
    motor: 'Hybrid motor', axleFront: 'front axle', axleRear: 'rear axle', deployFrom: 'drives only above {v}', hybridE: 'Motor use / recovery (per lap)', soc: {old: 'Rules up to 2025: only the 4 MJ per-lap deploy limit is modelled (recovery topped up by the MGU-H is not, so no battery flow is drawn).', h: 'Battery energy (estimate)', lead: 'Neither F1 nor WEC publishes the real battery state of charge (SoC) or motor use. This is an estimate from the rule limits (usable battery window, per-event recharge limit per lap) and the simulated lap.', line: 'Energy left in the battery', dep: 'Motor deploy', rec: 'Recovery (braking)', thr: 'Recovery at full throttle (super-clipping)', sum: 'Deploy {d} MJ · recovery {r} MJ (braking {b} + full throttle {t}){cap}', capT: ' · limit {c} MJ', ok: 'Checks: recovery ≤ limit {a} · energy swing within the lap {s} MJ ≤ usable window {w} MJ {b}', over: '({x} MJ over: the simulator balances energy over the whole lap only; a real car deploys this much less or in a different order)', start: 'Qualifying lap: starts with a full battery (dashed = usable window)', hyper: 'Hypercar: charge-sustaining every lap, lowest point set to 0 · battery window needed {s} MJ'},
    recharge: 'Qualifying recharge limit', energy_official: 'FIA PU document', energy_provisional: 'FIA provisional, press', energy_estimated: 'estimated', density: 'Air density', seaLevel: 'vs standard sea level', ice: 'Engine power', grip: 'Tyre grip', mainStraight: 'Main straight',
    headwind: 'headwind', tailwind: 'tailwind', calm: 'calm', fia: 'FIA circuit changes', fiaLead: 'The “Changes to the circuit” list from the race director’s notes. Items that affect the lap can be switched on or off; their size is an assumption.',
    inFit: y => `These changes were already in the real ${y} lap the cars were fitted to; switching them on adds them a second time.`, notInFit: 'These changes are not in the real laps used for fitting yet: switch them on to estimate their effect.',
    strength: 'Effect size', apply: 'Apply', noLap: 'No lap-time effect', noChanges: 'No announced changes for this track yet.',
    calib: 'Calibration and projection', calibLead: 'Car values were fitted to the speed trace and lap time of real pole laps.', fitErr: 'Lap-time error', speedRms: 'Speed error (RMS)',
    proj: '2027–2028 projection', projRules: 'Ratified power-unit rule changes', projDev: 'Historical development in years 2 and 3 of a rules cycle',
    model: 'What this calculation covers', pending: 'Data in preparation', pendingLead: 'Track and calibration data are being built. Please check back shortly.',
    calibrated: 'Fitted to real laps', learned: 'Learned from real laps', prior: 'From the regulations', projected: 'Projection',
    m1: 'Track shapes are the real driving line built from OpenF1 car positions in qualifying (several drivers’ best laps). Corners use official positions; headings are aligned to real maps.',
    m2: 'The 2025 and 2026 cars are fitted to real pole laps (the method follows TUM’s published lap simulation).',
    m3: '2026 rules: MGU-K 350 kW (reduced above 290 km/h, zero at 345 km/h), 4 MJ battery window, up to 8.5 MJ recharge per lap (Section C 5.2, Issue 21). Qualifying uses the per-circuit recharge limit the FIA sets (5–9 MJ, from press reports).',
    m4: 'Grip versus track temperature, engine power loss with altitude and the effect of FIA changes are assumptions, not measurements.',
    m5: 'A quasi-steady-state model ignores gear shifts, tyre temperature and car-to-car effects. For cars from 2026 it counts recovery under braking and from engine power the tyres cannot use, and it harvests at full throttle at the end of straights (super-clipping) only when that makes the lap faster. Use it for differences and trends rather than absolute times.',
    src: 'Sources', updated: 'Calibrated',
    evo: 'Track evolution', evoLead: 'How lap time changes over a session as rubber goes down, a wet track dries and tyres warm up. The reference is the simulated lap above (track state at the end of qualifying).',
    evoType: 'Session', evoTypes: {practice: 'Practice', qualifying: 'Qualifying'}, evoTyre: 'Tyre', tyres: {f1: {soft: 'Soft{S}', medium: 'Medium{M}', hard: 'Hard{H}', inter: 'Intermediate', wet: 'Full wet'}, hypercar: {soft: 'Soft (Michelin)', medium: 'Medium (Michelin)', hard: 'Hard (Michelin)', wet: 'Wet (Michelin)'}, lmgt3: {medium: 'Medium (Goodyear)', hard: 'Hard (Goodyear)', wet: 'Wet (Goodyear)'}, pirelli: {medium: 'Dry (Pirelli P Zero)', wet: 'Wet (Pirelli Cinturato)'}, michelinGt: {medium: 'Dry (Michelin)', wet: 'Wet (Michelin)'}, hankook: {medium: 'All-weather (Hankook iON Race)'}, feMichelin: {medium: 'All-weather (Michelin Pilot Sport EV)'}, bridgestone: {medium: 'Dry (Bridgestone)', wet: 'Wet (Bridgestone)'}}, tyreQ: ' · Hyperpole tyre',
    tyreEvent: 'Tyres: compounds supplied at this event in {y}', tyreSeason: 'Tyres: no event here, whole-season range',
    evoComp: 'Compound gap (vs soft)', evoCompReal: 'measured {y}: same driver, low fuel, track evolution removed', evoCompModel: 'C-step model, test error ±{e}%', evoCompNone: 'not measured, lap unchanged',
    evoEnd: 'Session minute', evoGain: 'Rubber effect (full)', evoTau: 'Time to saturate', evoWet: 'Wetness at start', evoDry: 'Drying time', evoWarm: 'Warm-up laps',
    evoCurve: 'Use measured curve', evoLast: 'Expected lap at this minute', evoChange: 'vs session start', evoBasis: {track: 'measured curve, this track', series: 'series average (fitted)', default: 'uncalibrated default'},
    evoErr: 'Holdout error (track left out)', qs: {h: 'Segment', win: 'Window (min)', model: 'Model best lap', real: 'Real best lap', test: 'Q1/Q2 check (each event left out, {n} qualifyings): Q1 {a}% · Q2 {b}% error. Q3 = pole (reproduced)', none: 'No real segment times for this track (usual 18/15/12-minute schedule used)', repro: 'Qualifying already run ({y}): segment bests reproduce the real ones. Model before correction: {raw}'}, secFix: 'Sector correction (real pole)', evoBasisH: 'Basis', evoChart: 'Expected lap time over the session', min: 'min',
  },
};

function fmtLap(s) { if (!Number.isFinite(s)) return '–'; const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); }

// Cars offered on the page, with the per-track grip factor from calibration
function carsFor(id, lang) {
  const t = T[lang], label = {base2019: lang === 'en' ? '2019 base (TUM)' : '2019 기준 (TUM)', 2027: `2027 (${t.projected})`, 2028: `2028 (${t.projected})`};
  const wec = c => `WEC ${SERIES.wec.classes[c.cls].label[lang]} ${c.year}`;
  // provisional series cars (IMSA, GT3 series) are tool-only until their pages exist
  // owner 2026-11-16: the 2019 TUM base car is off the page (the connector's tool keeps it)
  return Object.fromEntries(Object.entries(scenarioCars(id)).filter(([k, c]) => c.kind !== 'proxy' && k !== 'base2019').map(([k, c]) => [k, {...c, label: c.label || (c.series === 'wec' ? wec(c) : label[k] || k)}]));
}

// --- Rendering (shared with the browser; must only use its arguments) ---
function renderMap(map, v, opts) {
  // view rotation (owner 2026-11-15): degrees counter-clockwise, applied to every point, so labels stay upright
  const ra = (opts.rot || 0) * Math.PI / 180, rc = Math.cos(ra), rs = Math.sin(ra), R2 = p => [p[0] * rc - p[1] * rs, p[0] * rs + p[1] * rc];
  const xs = ra ? map.x.map((x, i) => x * rc - map.y[i] * rs) : map.x, ys = ra ? map.x.map((x, i) => x * rs + map.y[i] * rc) : map.y, n = xs.length;
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
  const sw = (Math.max(vw, vh) / 110).toFixed(1), L = opts.line && ra ? Object.assign({}, opts.line, {pts: opts.line.pts.map(R2), left: opts.line.left.map(R2), right: opts.line.right.map(R2)}) : opts.line;
  let band = '', marks = '';
  if (L) {
    // racing line on the track band: the line replaces the centre path, coloured by the car's speed on it
    const X = p => (p[0] - minX + pad).toFixed(1), Y = p => (maxY - p[1] + pad).toFixed(1), m = L.pts.length;
    band = '<polygon class="ls-band" points="' + L.left.concat(L.right.slice().reverse()).map(p => X(p) + ',' + Y(p)).join(' ') + '"/>';
    for (const [f0, f1] of L.surf || []) { const k = L.left.length, a = Math.round(f0 * k), b = Math.round(f1 * k) + (f1 < f0 ? k : 0), lt = [], rt = [];
      for (let i = a; i <= b; i++) { lt.push(L.left[i % k]); rt.push(L.right[i % k]); }
      band += '<polygon class="ls-surf" points="' + lt.concat(rt.reverse()).map(p => X(p) + ',' + Y(p)).join(' ') + '"/>'; }
    for (const [side, a, b] of L.kerbs || []) { const E = side === 'L' ? L.left : L.right, k = E.length, pts = []; for (let i = a; i <= b; i++) pts.push(E[((i % k) + k) % k]);
      // owner 2026-11-16: kerbs at their real size (map units are metres, about 1.5 m wide), so they scale with the track when zoomed out
      const d = 'M' + pts.map(p => X(p) + ' ' + Y(p)).join('L'); band += '<path class="ls-kerb-w" d="' + d + '"/><path class="ls-kerb" d="' + d + '"/>'; }
    let lo2 = Infinity, hi2 = -Infinity; for (const x of L.v) { lo2 = Math.min(lo2, x); hi2 = Math.max(hi2, x); }
    const bk = i => Math.min(5, Math.floor((L.v[i] - lo2) / (hi2 - lo2 + 1e-9) * 6));
    let r = [0], c = bk(0);
    const fl = () => { if (r.length > 1) paths += '<path class="ls-line-seg" d="M' + r.map(i => X(L.pts[i]) + ' ' + Y(L.pts[i])).join('L') + '" stroke="color-mix(in oklab,var(--mint) ' + (c * 20) + '%,var(--sim-slow))"/>'; };
    for (let i = 1; i <= m; i++) { const k = i % m; r.push(k); if (i === m || bk(k) !== c) { fl(); r = [k]; c = bk(k); } }
    // braking / apex / full-throttle dots removed (owner 2026-11-15: too busy)
  } else {
    for (let i = 1; i < n; i++) { run.push(i); const nb = bucket(i); if (nb !== b) { flush(); run = [i]; b = nb; } }
    run.push(0); flush();
  }
  // F1 overtaking zones (owner 2026-11-15): a band just outside the track for each DRS / Straight Mode zone, with its number at the
  // start; detection (D) and activation (A) points as small marks. Positions are lap distances (m) placed on the map by share of the lap.
  let zones = '';
  if (opts.zones && ((opts.zones.list || []).length || (opts.zones.marks || []).length)) {
    let area = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += xs[i] * ys[j] - xs[j] * ys[i]; }
    // owner 2026-11-16: bands follow the track outline (centre and edges of the drawn track band), not the wobbly driven line
    const E = L && L.left && L.right && L.left.length === L.right.length ? L : null, m2 = E ? E.left.length : n;
    const cx = E ? E.left.map((p, i) => (p[0] + E.right[i][0]) / 2) : xs, cy = E ? E.left.map((p, i) => (p[1] + E.right[i][1]) / 2) : ys, hw = E ? E.left.map((p, i) => Math.hypot(p[0] - E.right[i][0], p[1] - E.right[i][1]) / 2) : null;
    let area2 = 0; if (E) for (let i = 0; i < m2; i++) { const j = (i + 1) % m2; area2 += cx[i] * cy[j] - cx[j] * cy[i]; }
    const out = (E ? area2 : area) > 0 ? -1 : 1, off = sw * 2.3, idx = s0 => ((Math.round(s0 / opts.length * m2) % m2) + m2) % m2, nn = m2;
    const at = (i, k) => { const p = (i - 2 + nn) % nn, q = (i + 2) % nn, tx = cx[q] - cx[p], ty = cy[q] - cy[p], l = Math.hypot(tx, ty) || 1, o = (hw ? hw[i] : 0) + off * k; return [cx[i] + out * -ty / l * o, cy[i] + out * tx / l * o]; };
    const P = ([x, y]) => (x - minX + pad).toFixed(1) + ' ' + (maxY - y + pad).toFixed(1);
    const zBoxes = [];
    for (const z of opts.zones.list) {
      const a = idx(z.from), b = idx(z.to), pts = []; for (let i = a, g = 0; g <= nn; g++, i = (i + 1) % nn) { pts.push(at(i, 1)); if (i === b) break; }
      if (pts.length < 2) continue;
      // zone and OT labels never overlap each other: step further out until the box is free
      let k = 2.2, lab = at(a, k), fz = sw * 2.4, bx = () => { const [x, y] = P(lab).split(' ').map(Number), hw = z.label.length * fz * 0.32; return [x - hw, y - fz * 0.6, x + hw, y + fz * 0.6]; };
      while (k < 8 && zBoxes.some(o => !(bx()[2] < o[0] || bx()[0] > o[2] || bx()[3] < o[1] || bx()[1] > o[3]))) { k += 1.4; lab = at(a, k); }
      zBoxes.push(bx());
      zones += '<path class="ls-zone ls-zone-' + opts.zones.kind + '" d="M' + pts.map(P).join('L') + '" stroke-width="' + (sw * 0.4).toFixed(1) + '"/><text class="ls-zone-t" x="' + P(lab).split(' ')[0] + '" y="' + P(lab).split(' ')[1] + '" font-size="' + (sw * 2.4).toFixed(1) + '">' + z.label + '</text>';
    }
    // a mark crosses the whole track (both edges plus a little), from the centre line
    const across = (i, dd) => { const p = (i - 2 + nn) % nn, q = (i + 2) % nn, tx = cx[q] - cx[p], ty = cy[q] - cy[p], l = Math.hypot(tx, ty) || 1; return [cx[i] + out * -ty / l * dd, cy[i] + out * tx / l * dd]; }, half = i => (hw ? hw[i] : 0) + off * 0.565;
    for (const m of opts.zones.marks || []) { const k = idx(m.s), a = P(across(k, -half(k))).split(' '), b = P(across(k, half(k))).split(' '), fm = sw * 2, hw = m.label.length * fm * 0.32; let o = 2.7, r = P(at(k, o)).split(' ').map(Number);
      const box = () => [r[0] - hw, r[1] - fm * 0.6, r[0] + hw, r[1] + fm * 0.6], busy = () => zBoxes.some(q => !(box()[2] < q[0] || box()[0] > q[2] || box()[3] < q[1] || box()[1] > q[3]));
      while (o < 9 && busy()) { o += 1.3; r = P(at(k, o)).split(' ').map(Number); } zBoxes.push(box());
      zones += '<line class="ls-zone-m ls-zone-m-' + m.kind + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke-width="' + (sw * 0.2).toFixed(1) + '"/><text class="ls-zone-mt ls-zone-mt-' + m.kind + '" x="' + r[0] + '" y="' + r[1] + '" font-size="' + (sw * 2).toFixed(1) + '">' + m.label + '</text>'; }
  }
  let corners = '', i0 = Math.round((opts.start || 0) * n) % n;
  for (const c of opts.corners || []) {
    const i = Math.min(n - 1, Math.round(c.s / opts.length * n));
    corners += '<text x="' + px(i) + '" y="' + py(i) + '" dy="' + (-sw * 2.2).toFixed(1) + '" class="ls-corner">' + c.number + (c.letter || '') + '</text>';
  }
  return '<svg class="ls-map" viewBox="0 0 ' + vw.toFixed(0) + ' ' + vh.toFixed(0) + '" role="img" aria-label="' + opts.label + '">' + band + '<g fill="none" stroke-width="' + (L ? sw * 0.45 : sw) + '" stroke-linecap="round" stroke-linejoin="round">' + paths + '</g>' + zones + marks + '<rect x="' + (px(i0) - sw * 2) + '" y="' + (py(i0) - sw * 2) + '" width="' + (sw * 4) + '" height="' + (sw * 4) + '" class="ls-start"/>' + corners + '<style>.ls-corner{font-size:' + (sw * 3.4).toFixed(1) + 'px}</style></svg>';
}

function renderTrace(ds, series, opts) {
  // every stacked chart uses the same width and left margin, so the distance axis lines up; corners marked T1, T2, ...
  const W = 1000, H = opts.h || 280, L = 48, B = 30, top = opts.corners ? 24 : 12, n = series[0].v.length, len = n * ds;
  let st = opts.step || 50;
  let lo = Infinity, hi = -Infinity;
  for (const s of series) for (const x of s.v) if (Number.isFinite(x)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  if (opts.lo != null) lo = Math.min(lo, opts.lo);
  while ((hi - lo) / st > 7) st *= 2; // at most about 7 grid lines, so the labels stay readable
  lo = Math.floor(lo / st) * st; hi = Math.max(lo + st, Math.ceil(hi / st) * st);
  const x = d => (L + d / len * (W - L - 8)).toFixed(1), y = v => (top + (1 - (v - lo) / (hi - lo)) * (H - top - B)).toFixed(1);
  let grid = '';
  for (let v = lo; v <= hi; v += st) grid += '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="ls-grid"/><text x="' + (L - 6) + '" y="' + y(v) + '" dy="4" text-anchor="end" class="ls-axis">' + v + '</text>';
  for (let k = 0; k <= len / 1000; k++) grid += '<text x="' + x(k * 1000) + '" y="' + (H - 8) + '" text-anchor="middle" class="ls-axis">' + k + '</text>';
  for (const sb of opts.sectors || []) grid += '<line x1="' + x(sb) + '" x2="' + x(sb) + '" y1="' + top + '" y2="' + (H - B) + '" class="ls-sector"/>';
  for (const [a, b] of opts.bands || []) grid += '<rect x="' + x(a) + '" y="' + top + '" width="' + Math.max(1, x(b) - x(a)).toFixed(1) + '" height="' + (H - top - B) + '" class="' + (opts.bandCls || 'ls-risk') + '"/>';
  let lastTag = -99; // a tag closer than 26 units to the previous one is left out (the dashed line stays)
  for (const c of opts.corners || []) { grid += '<line x1="' + x(c.s) + '" x2="' + x(c.s) + '" y1="' + (top - 4) + '" y2="' + (H - B) + '" class="ls-cline"/>'; if (+x(c.s) - lastTag >= 26) { grid += '<text x="' + x(c.s) + '" y="' + (top - 8) + '" text-anchor="middle" class="ls-axis ls-ctag">T' + c.number + (c.letter || '') + '</text>'; lastTag = +x(c.s); } }
  let lines = '';
  series.forEach((s, j) => {
    let d = '';
    for (let i = 0; i < n; i++) if (!i || i === n - 1 || s.v[i] !== s.v[i - 1] || s.v[i] !== s.v[i + 1]) d += (i ? 'L' : 'M') + x(i * ds) + ' ' + y(s.v[i]); // flat runs: ends only
    lines += '<path d="' + d + '" class="ls-line ' + (s.cls || 'ls-line-' + j) + '"/>';
  });
  return '<svg class="ls-trace" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + opts.label + '">' + grid + lines + '<line class="ls-cursor" x1="-9" x2="-9" y1="' + top + '" y2="' + (H - B) + '"/>' + '<text x="' + (W - 8) + '" y="' + (H - 8) + '" text-anchor="end" class="ls-axis">' + opts.km + '</text><text x="' + (L + 6) + '" y="' + (top + 14) + '" class="ls-axis">' + (opts.unit ?? 'km/h') + '</text></svg>';
}

// Surface (owner 2026-11-15, task J): resurfaced or ground sections from the latest FIA Race Director notes, drawn on the map as shares of
// the lap; circuits without notes show their full-lap resurfacing year when known (surface.js)
function surfaceOf(id, td, ch) {
  const items = (ch?.changes || []).filter(c => c.type === 'resurfacing' || c.type === 'bump_removal'), placed = items.filter(c => c.range);
  const L = td.length, ap = placed.length ? K.applyTrackChanges(K.trackFromData(td), placed.map(c => ({...c, affectsLap: true, effect: {kind: 'grip', factor: 1}})), td.corners || []).applied : [];
  const spans = ap.flatMap(a => (a.spans || []).map(([x, y]) => [+(x / L).toFixed(4), +(Math.max(y, x + 30) / L).toFixed(4)]));
  return items.length || SURFACE_ERAS[id] ? {year: items.length ? ch.year : null, n: items.length, spans, era: SURFACE_ERAS[id] || null} : null;
}
// --- Page ---
export function simulationPage(query = {}, lang = 'ko', liveEnergy = null) {
  lang = lang === 'en' ? 'en' : 'ko';
  const t = T[lang], ids = trackOrder(lapsimTracks);
  if (!ids.length) return `<section class="hero ls-hero"><h1>${esc(t.h1)}</h1><p class="lead">${esc(t.pending)} · ${esc(t.pendingLead)}</p></section>`;
  const id = ids.includes(query.track) ? query.track : (ids.includes('monza') ? 'monza' : ids[0]);
  // corner numbers on every map (owner 2026-11-15): the track's own official numbers, else MultiViewer's official numbers placed on
  // this map, else numbers found from the curvature (marked as estimated)
  const td0 = lapsimTracks[id], view0 = lapsimTrackView?.[id], ownC = td0.corners?.length ? td0.corners : view0?.corners?.length ? view0.corners : null;
  const td = ownC === td0.corners ? td0 : {...td0, corners: ownC || autoCorners(td0), cornersEstimated: !ownC}, cars = carsFor(id, lang), conds = realConditions(id), CAR_ORDER_P = CAR_ORDER.filter(k => cars[k]);
  // Evo kit: listed as a tick box beside its base car (only when the data has that Evo entry)
  const evoOf = evoPairs(cars, CAR_ORDER_P), evoKeys = new Set(Object.values(evoOf));
  // GT3 (owner 2026-11-15): car model first, then the series spec (BoP body: SRO GT3, IMSA GTD, WEC LMGT3, DTM), then the kit (newest by default)
  const fam = gt3Families(cars, CAR_ORDER_P);
  const askedCar = cars[query.car] ? query.car : '2026', ac = cars[askedCar], fl = ac.series === 'gt3' && fam[ac.base]?.[ac.cls];
  const carId = fl ? (query.evo === '0' ? askedCar : fl.at(-1)) : query.evo !== '0' && evoOf[askedCar] ? evoOf[askedCar] : askedCar; // a car with an Evo kit opens on its newest spec unless evo=0
  const baseId = Object.keys(evoOf).find(k => evoOf[k] === carId) || carId;
  // event this car races at here (calendar data) with the season of its session weather; absent = nothing shown
  const events = Object.fromEntries(CAR_ORDER_P.filter(k => cars[k]).map(k => [k, carEvent(id, k, cars[k], conds)]).filter(([, e]) => e)
    .map(([k, e]) => [k, t.eventFor.replace('{n}', lang === 'en' ? e.nameEn : e.name).replace('{a}', e.start).replace('{b}', e.end).replace('{y}', e.weatherYear)]));
  const changes = latestChanges(id);
  const data = {startAlt: lapsimStartLines[id] || null, driverLines: lapsimDriverLines?.tracks?.[id] || null, pu: lapsimPuDocs?.events?.[id] || lapsimPuEst?.tracks?.[id] || null, lang, t, id, track: td, cars, carOrder: CAR_ORDER_P, carId, evoOf, fam, bodyLabel: BODY_LABEL, events, conds, raceRec: raceRecords(id), changes, energy: (liveEnergy && (query.track || 'monza') === id ? liveEnergy : energyLimit(id, 2026)),
    compounds: lapsimCompounds?.[id] || {}, wecTyres: lapsimWecTyres?.[id] || {}, line: lineData(id), lineText: LT[lang], qsplit: lapsimQsplit ? {off: lapsimQsplit.offsetPct, test: lapsimQsplit.test, real: lapsimQsplit.tracks?.[id] || null} : null, brakes: lapsimBrakes ? {ramp: lapsimBrakes.rampS ?? 0, k: lapsimBrakes.pedalKgPerG, g: lapsimBrakes.gScale, t: lapsimBrakes.timeScale, test: lapsimBrakes.test, real: lapsimBrakes.races?.[id] || null, text: BT[lang]} : null, compoundGap: compoundGap(id), compoundTest: lapsimCompoundGap?.test?.rmsPct ?? null,
    evo: Object.fromEntries(['f1', 'wec'].map(se => [se, Object.fromEntries(['practice', 'qualifying'].map(ty => [ty, evolutionCoeffs(se, id, ty)]))])),
    zones: lapsimF1Zones?.tracks?.[id] || null, zonesOn: ZONES_ON ? (DRS_ONLY ? 'drs' : 'all') : '', puQuali: PU_QUALI, puRamp: !!lapsimCalibration?.puRamp, otChoice: lapsimCalibration?.otChoice?.[id] ?? null, surface: surfaceOf(id, td, changes), mapRot0: Number.isFinite(view0?.openDeg) ? view0.openDeg : landscapeRot(td.map, lapsimTrackNorth?.[id], VIEW[id], td.corners, td.length), cornersEstimated: !!td.cornersEstimated, north: lapsimTrackNorth?.[id] || null, ui: UI[lang],
    calibration: {generatedAt: lapsimCalibration?.generatedAt || null, seasons: Object.fromEntries(Object.entries(lapsimCalibration?.seasons || {}).map(([y, s]) => [y, s.tracks?.[id] || null]))}};
  // first render on the server with the same code the browser uses
  const view = computeView(K, data, {carId, compareId: '', mode: 'real', manual: null, active: {}, strength: 1, evo: null}, {renderMap, renderTrace, evolutionDelta, evolutionCurve, lineTrack, brakeZones, lapChannels});
  const options = ids.map(k => `<option value="${esc(k)}"${k === id ? ' selected' : ''}>${esc(trackLabel(k, lapsimTracks[k]))}</option>`).join('');
  // cascade: series → rules/class (the car models of that series); series without a model yet are listed as coming soon
  const seriesOf = k => cars[k].series || 'f1', curSeries = seriesOf(carId);
  const carOpts = (sel, only, noEvo) => only === 'gt3' && noEvo ? famOpts(fam, cars, cars[sel]?.base) : data.carOrder.filter(k => k !== 'wec-lmgt3' && (!only || seriesOf(k) === only) && !(noEvo && evoKeys.has(k))).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(cars[k].label)}</option>`).join('');
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
 <label>${esc(t.car)}<select name="car" data-ls="car">${carOpts(baseId, curSeries, true)}</select></label>
 <label data-ls="specWrap"${fl ? '' : ' hidden'}>${esc(t.spec)}<select data-ls="spec">${fl ? specOpts(fam[cars[carId].base], cars[carId].cls) : ''}</select></label>
 <label class="ls-check"><input type="checkbox" name="evo" value="1" data-ls="evo"${fl ? (fl.length > 1 ? (carId === fl.at(-1) ? ' checked' : '') : ' disabled') : evoOf[baseId] ? (carId !== baseId ? ' checked' : '') : ' disabled'}><span data-no-translate>Evo</span><small data-no-translate data-ls="evoHint">${esc(evoOf[baseId] ? '' : t.evoNone)}</small></label>
 <label class="ls-cmp-only">${esc(UI[lang].cmp1)}<select data-ls="compare"><option value="">${esc(t.none)}</option>${cmpOpts}</select></label>
 <label class="ls-cmp-only">${esc(UI[lang].cmp2)}<select data-ls="compare2"><option value="">${esc(t.none)}</option>${cmpOpts}</select></label>
 <label>${esc(t.conditions)}<select data-ls="mode"><option value="real">${esc(t.real)}</option><option value="manual">${esc(t.manual)}</option>${TRACK_LL[id] ? `<option value="forecast">${esc(FT[lang].opt)}</option>` : ''}</select></label>
 <label data-ls="smWrap" hidden>${esc(t.sm)}<select data-ls="sm">${['normal', 'alt', 'off'].map(k => `<option value="${k}">${esc(t.smOpt[k])}</option>`).join('')}</select></label>
 <label data-ls="otWrap" hidden>${esc(t.ot)}<select data-ls="ot"><option value="1">${esc(t.onOff[0])}</option><option value="0">${esc(t.onOff[1])}</option></select></label>
 <label data-ls="drsWrap" hidden>${esc(t.drs)}<select data-ls="drs"><option value="1">${esc(t.onOff[0])}</option><option value="0">${esc(t.onOff[1])}</option></select></label>
 <noscript><button>${esc(t.track)}</button></noscript>
</form>
<p class="fine ls-event" data-no-translate data-ls="event"${events[carId] ? '' : ' hidden'}>${esc(events[carId] || '')}</p>
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
<section class="panel ls-panel ls-cmp-panel ls-cmp-only"><div class="ls-panel-head"><h2>${esc(UI[lang].cmpH)}</h2><button type="button" class="pill" data-ls="cmpCsv">${esc(UI[lang].csv)}</button></div><div class="output" data-ls="cmpTable"></div><p class="fine">${esc(UI[lang].cmpNote)}</p></section>
<section class="panel ls-panel ls-tel"><div class="ls-panel-head"><h2>${esc(t.trace)}</h2><span class="ls-export"><button type="button" class="pill" data-ls="telPng">${esc(UI[lang].png)}</button> <button type="button" class="pill" data-ls="telCsv">${esc(UI[lang].csv)}</button></span></div><div class="ls-chans" data-ls="chans" role="group" aria-label="${esc(UI[lang].chans)}"></div><div class="ls-scroll" data-ls="trace">${view.traceSvg}</div><p class="ls-key" data-ls="key">${view.keyHtml}</p><div data-ls="soc">${view.socHtml}</div></section>
<section class="panel ls-panel ls-brakes"><h2>${esc(BT[lang].h)}</h2><div data-ls="brakes">${view.brakeHtml}</div></section>
<section class="panel ls-panel ls-air"><h2>${esc(t.air)}</h2>
 <dl class="ls-facts ls-air-facts" data-ls="air">${view.airHtml}</dl>
 <div class="ls-forecast" data-ls="forecast" hidden data-ll="${(TRACK_LL[id] || []).join(',')}" data-ft='${esc(JSON.stringify(lapsimTrackTemp ? {...FT[lang], k: lapsimTrackTemp.k, a: lapsimTrackTemp.a, note: FT[lang].noteFit.replace('{a}', lapsimTrackTemp.a.toFixed(1)).replace('{k}', lapsimTrackTemp.k.toFixed(4)).replace('{e}', lapsimTrackTemp.test.rmsC).replace('{n}', lapsimTrackTemp.test.events)} : FT[lang]))}'></div>
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
// Page texts added 2026-11-15: compare tab, telemetry channels and export, map rotation and compass
const UI = {
  ko: {cmp1: '비교 차 1', cmp2: '비교 차 2', cmpH: '랩 비교', csv: 'CSV 내보내기', png: '이미지 저장 (PNG)', chans: '보여 줄 텔레메트리', cmpNote: '갭은 선택한 차 기준입니다. 섹터는 실제 섹터 경계가 있는 트랙에서만 나옵니다.',
    move: '{c} 순서 옮기기 (끌거나 ← →)', zoneNote: {drs: '바깥 띠: {y} DRS 존, D = 감지 지점 ({doc})', sm: '바깥 띠: {y} 스트레이트 모드 존, OT D/A = 오버테이크 감지·작동 지점 ({doc})'}, cols: ['차', '랩타임', '갭', '섹터 1', '섹터 2', '섹터 3', '최고 속도', '최저 속도'], rotL: '왼쪽으로 돌리기', rotR: '오른쪽으로 돌리기', reset: '처음 보기로 돌아가기 (나침반: 실제 북쪽)', noNorth: '이 트랙은 실제 북쪽 방향 자료가 없습니다', dist: '거리 (m)', cap: '규정 상한'},
  en: {cmp1: 'Compare car 1', cmp2: 'Compare car 2', cmpH: 'Lap comparison', csv: 'Export CSV', png: 'Save image (PNG)', chans: 'Telemetry to show', cmpNote: 'Gaps are to the selected car. Sectors show only on tracks with real sector lines.',
    move: 'Move {c} (drag, or ← →)', zoneNote: {drs: 'outer band: {y} DRS zones, D = detection point ({doc})', sm: 'outer band: {y} Straight Mode zones, OT D/A = overtake detection/activation ({doc})'}, cols: ['Car', 'Lap', 'Gap', 'Sector 1', 'Sector 2', 'Sector 3', 'Top speed', 'Lowest speed'], rotL: 'Rotate left', rotR: 'Rotate right', reset: 'Back to the first view (compass: true north)', noNorth: 'No true-north data for this track', dist: 'Distance (m)', cap: 'regulation cap'},
};
// The map opens turned so the track uses the width (owner 2026-11-15: Monza, Jeddah, Fuji were drawn tall; "the long straight parallel
// to the top or bottom of the page"): the longest straight is laid horizontal; of the two ways round, the one nearer true north up
// (north unknown: the one with the start nearer the bottom). Degrees, counter-clockwise.
// Owner's opening views (2026-11-15). straight: [corner, corner] laid horizontal on that side of the picture; left/right: corners
// put on a horizontal line; longest: the longest straight on that side (back: not the start-line straight); deg: a fixed turn.
export const VIEW = {
  fuji: {longest: 'top'}, monza: {longest: 'bottom'}, interlagos: {straight: [3, 4], side: 'bottom'}, sakhir: {straight: [10, 11], side: 'bottom'}, 'sakhir-outer': {longest: 'bottom'},
  silverstone: {left: 15, right: 9}, suzuka: {deg: 0}, portimao: {longest: 'bottom', back: true},
};
export function landscapeRot(map, north, spec, corners, length) {
  const X = map?.x, Y = map?.y, n = X?.length || 0; if (n < 8) return 0;
  if (spec && Number.isFinite(spec.deg)) return spec.deg;
  const at = num => { const c = (corners || []).find(k => k.number === num && !k.letter) || (corners || []).find(k => k.number === num); return c ? Math.min(n - 1, Math.round(c.s / length * n)) : null; };
  const turnY = (deg, i) => { const t = deg * Math.PI / 180; return X[i] * Math.sin(t) + Y[i] * Math.cos(t); };
  const meanY = deg => { let a = 0; for (let i = 0; i < n; i++) a += turnY(deg, i); return a / n; };
  const sided = (i, j, side) => { const ang = -Math.atan2(Y[j] - Y[i], X[j] - X[i]) * 180 / Math.PI, alt = ang + 180, lineY = d => (turnY(d, i) + turnY(d, j)) / 2;
    const up = d => meanY(d) > lineY(d); return ((side === 'bottom') === up(ang) ? ang : alt + 360) % 360; }; // bottom: the rest of the lap above the line (y up)
  if (spec && spec.left != null && at(spec.left) != null && at(spec.right) != null) { const i = at(spec.left), j = at(spec.right); return -Math.atan2(Y[j] - Y[i], X[j] - X[i]) * 180 / Math.PI; }
  if (spec && spec.straight && at(spec.straight[0]) != null && at(spec.straight[1]) != null) return sided(at(spec.straight[0]), at(spec.straight[1]), spec.side);
  const hd = i => Math.atan2(Y[(i + 1) % n] - Y[i], X[(i + 1) % n] - X[i]), dA = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  let best = {len: -1, ang: 0};
  for (let i = 0; i < n; i++) {
    let len = 0, j = i;
    // a straight: every step within 4° of the chord from its start
    for (let k = 0; k < n - 1; k++) { const q = (i + k) % n, ch = Math.atan2(Y[(q + 1) % n] - Y[i], X[(q + 1) % n] - X[i]); if (k > 0 && dA(hd(q), ch) > 4 * Math.PI / 180) break; j = (q + 1) % n; }
    len = Math.hypot(X[j] - X[i], Y[j] - Y[i]);
    const hasStart = j < i || i === 0; // back: a straight other than the one through the start line
    if (len > best.len && !(spec && spec.back && hasStart)) best = {len, i, j, ang: Math.atan2(Y[j] - Y[i], X[j] - X[i])};
  }
  const aspect = deg => { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { const x = X[i] * c - Y[i] * s, y = X[i] * s + Y[i] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return (x1 - x0) / (y1 - y0); };
  if (spec && spec.longest) return sided(best.i, best.j, spec.longest === 'top' ? 'top' : 'bottom');
  let a = -best.ang * 180 / Math.PI; const norm = x => ((x % 360) + 540) % 360 - 180;
  // a track whose longest straight does not give a wide picture (Sebring): the widest turn instead
  let wide = a; for (let d = -90; d < 90; d++) if (aspect(d) > aspect(wide)) wide = d;
  if (aspect(a) < 1.4 && aspect(wide) > aspect(a) * 1.2) a = wide;
  const b = norm(a + 180); a = norm(a);
  if (north && !north.mirror) return Math.abs(norm(north.deg - a)) <= Math.abs(norm(north.deg - b)) ? a : b; // needle closer to straight up
  const yStart = r => { const t = r * Math.PI / 180; return X[0] * Math.sin(t) + Y[0] * Math.cos(t); }, cy = r => { const t = r * Math.PI / 180; let s = 0; for (let i = 0; i < n; i++) s += X[i] * Math.sin(t) + Y[i] * Math.cos(t); return s / n; };
  return yStart(a) - cy(a) <= yStart(b) - cy(b) ? a : b;
}
// Corners from the curvature, for tracks without official numbers: a turn is a run where the radius stays under 300 m (smoothed over
// about 30 m) and the heading changes by 20° or more; a change of direction starts a new turn (chicanes count twice, as official
// numbering usually does). Numbered from the start line. Shown as estimated.
export function autoCorners(t) {
  const k = t.kappa, n = k?.length || 0, ds = t.ds; if (n < 20) return [];
  const w = Math.max(1, Math.round(15 / ds)), sm = new Float64Array(n);
  for (let i = 0; i < n; i++) { let a = 0; for (let j = -w; j <= w; j++) a += k[(i + j + n) % n]; sm[i] = a / (2 * w + 1) / 1e5; }
  const lim = 1 / 300, out = []; let i0 = -1;
  // start in a straight part so no turn is cut by the line
  let st = 0; while (st < n && Math.abs(sm[st]) >= lim) st++;
  for (let q = 0; q <= n; q++) {
    const i = (st + q) % n, on = q < n && Math.abs(sm[i]) >= lim, sameSign = i0 >= 0 && Math.sign(sm[i]) === Math.sign(sm[i0]);
    if (i0 >= 0 && (!on || !sameSign)) {
      let turn = 0, apex = i0, best = 0; for (let j = i0; j !== i; j = (j + 1) % n) { turn += sm[j] * ds; if (Math.abs(sm[j]) > best) { best = Math.abs(sm[j]); apex = j; } }
      if (Math.abs(turn) >= 20 * Math.PI / 180) out.push(apex);
      i0 = -1;
    }
    if (on && i0 < 0) i0 = i;
  }
  return out.map(a => Math.round(a * ds)).sort((a, b) => a - b).map((s0, j) => ({number: j + 1, letter: '', s: s0}));
}
// Compass needle: N up when deg = 0, turned clockwise by deg; no north data: a plain reset mark
function compassSvg(deg) {
  if (deg == null) return '<svg class="ls-needle" width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M-4 0a4 4 0 1 0 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  return '<svg class="ls-needle" width="24" height="24" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="none" stroke="currentColor" stroke-width="1" opacity=".45"/><g transform="rotate(' + Math.round(deg) + ')"><text y="-5.2" text-anchor="middle" font-size="5.5" font-weight="700" fill="#e5484d">N</text><path d="M0 -4L3 0H-3Z" fill="#e5484d"/><path d="M0 9L3 0H-3Z" fill="currentColor" opacity=".55"/></g><circle r="1.6" fill="currentColor"/></svg>';
}
// Racing line texts (the line is drawn on the track map; see lineData and computeView)
const LT = {
  ko: {h: '레이싱 라인', all: '전체', lead: '공개 F1 위치 데이터는 트랙마다 하나의 기준선에 맞춰져 있어 실제 주행 라인을 알 수 없습니다. 그래서 선택한 차로 랩 시뮬레이션을 돌려 트랙 폭 안에서 가장 빠른 라인을 찾습니다. 다운포스·그립·출력·무게가 다르면 라인도 달라지고, 레이스 라인은 연료 무게와 레이스 페이스(타이어·에너지 관리)를 넣어 따로 계산합니다.',
    modes: {q: '예선 라인', r: '레이스 라인'}, lineShow: '주행 라인', zin: '확대', zout: '축소', lineNote: '{car} · {mode} · 최소 곡률 라인보다 {gain} s · 평균 {shift} m 이동', uses: '라인:', raceNote: ' · 연료 +{fuel} kg, 그립 ×{grip} ({basis})', basis: {'race-fit': '실제 레이스 중반 페이스에 맞춤', assumed: 'F1 비율 가정'}, noCar: '최소 곡률 라인 (차별 라인은 브라우저에서 계산)', carLine: '차 기준 라인', driver: '드라이버 라인', driverNote: '{d} 라인 ({y} 예선 최고 랩의 속도 기록으로 추정, 실제 주행 위치 아님): 코너 최저 속도 오차, 전체 드라이버 라인 {a}% → 이 드라이버 {b}%', driverNoteEnd: '{d} 라인 ({s} 예선 최고 랩의 섹터 기록으로 추정, 실제 주행 위치 아님): 섹터 시간 오차, 전체 드라이버 라인 {a}% → 이 드라이버 {b}%', driverTest: ', 맞추는 데 쓰지 않은 다른 랩 {a}% → {b}%', blendNote: '{car} 전용 라인: 랩 시뮬레이션으로 고른 최단 거리·최소 곡률 라인 혼합 (최소 곡률 비중 평균 {e}%)', noRace: '이 차는 레이스 라인 보정이 없어 예선 라인과 같습니다',
    kerbs: '연석: 추정 (에이펙스 안쪽, 탈출 바깥쪽)', surf: '노면: {y} 재포장·연마 {n}곳 (FIA 레이스 디렉터 노트, 밝은 구간)', surfEra: '노면: {y} 전면 재포장', edges: {TUM: '트랙 폭: TUM 측정값', 'TUM-widths': '트랙 폭: TUM 측정값 (레이아웃 변경 구간 근사)', assumed: '트랙 폭: 12 m 가정', stated: '트랙 폭: {m} m (서킷 공식 수치)', map: '트랙 폭: {m} m (지도 데이터)'}, pole: '속도·브레이크·스로틀: {y} 퀄리 폴 랩 실측 ({d}, {t})', nopole: '실측 폴 랩 없음',
    check: 'TUM 최적 라인과의 차이: 평균 {m} m', key: ['브레이크 시작', '최저 속도', '풀 스로틀']},
  en: {h: 'Racing line', all: 'All', lead: 'Public F1 position data is snapped to one reference path per track, so the real driven line is unknown. The lap simulator runs the selected car to find the fastest line inside the track width: different downforce, grip, power and weight give a different line. The race line is worked out separately with fuel weight and race pace (tyres, energy management).',
    modes: {q: 'Qualifying line', r: 'Race line'}, lineShow: 'Racing line', zin: 'Zoom in', zout: 'Zoom out', lineNote: '{car} · {mode} · {gain} s vs the least-curvature line · mean shift {shift} m', uses: 'line of', raceNote: ' · fuel +{fuel} kg, grip ×{grip} ({basis})', basis: {'race-fit': 'fitted to real mid-race pace', assumed: 'F1 ratio assumed'}, noCar: 'least-curvature line (the car\'s own line is computed in the browser)', carLine: 'Car line', driver: 'Driver line', driverNote: '{d} line (estimated from the speed trace of the {y} best qualifying lap, not a measured position): corner minimum speed error, field line {a}% → this driver {b}%', driverNoteEnd: '{d} line (estimated from the sector times of the {s} best qualifying lap, not a measured position): sector time error, field line {a}% → this driver {b}%', driverTest: ', on another lap not used in the fit {a}% → {b}%', blendNote: '{car} line: blend of the shortest and the least-curvature line chosen by the lap simulation (least-curvature share {e}% on average)', noRace: 'no race fit for this car, so the race line equals the qualifying line',
    kerbs: 'Kerbs: estimated (inside at the apex, outside at the exit)', surf: 'Surface: {n} resurfaced or ground sections in {y} (FIA Race Director notes, lighter band)', surfEra: 'Surface: whole lap resurfaced in {y}', edges: {TUM: 'Track width: TUM measured', 'TUM-widths': 'Track width: TUM measured (approximate where the layout changed)', assumed: 'Track width: 12 m assumed', stated: 'Track width: {m} m (circuit figure)', map: 'Track width: {m} m (map data)'}, pole: 'Speed, brake, throttle: {y} qualifying pole lap, measured ({d}, {t})', nopole: 'No measured pole lap',
    check: 'Gap to the TUM optimal line: mean {m} m', key: ['Brake start', 'Lowest speed', 'Full throttle']},
};
// Track geometry for the line panel: midline, its normals, the least-curvature (base) and shortest-path (sp) offsets (0.1 m) and each
// car's precomputed line. Every track has one (owner 2026-11-15): tracks without TUM edges use the map line as the midline and an
// width from track-widths.js, the map data or 12 m assumed (1 m kept free for the car on each side). Computed once per track and kept.
const LINE_CACHE = new Map();
// Savitzky-Golay 7-point quadratic, two passes, on a closed polyline: removes the wobble of points stored to the metre
// (owner 2026-11-15: no wrinkled edges) and keeps the shape of real corners (Monaco hairpin, Montreal chicane checked)
const SG7 = [-2, 3, 6, 7, 6, 3, -2].map(v => v / 21);
const smoothClosed = P => { let a = P; for (let p = 0; p < 2; p++) { const n = a.length, b = a; a = b.map((q, i) => q.map((_, c) => SG7.reduce((s, w, k) => s + w * b[(i + k - 3 + n) % n][c], 0))); } return a; };
export function lineData(id) {
  if (LINE_CACHE.has(id)) return LINE_CACHE.get(id);
  const L = lapsimRacingLines?.tracks?.[id], C = lapsimCarLines?.tracks?.[id], r1 = p => [+p[0].toFixed(1), +p[1].toFixed(1)];
  const normals = mid => mid.map((_, i, a) => { const n = a.length, p = a[(i - 1 + n) % n], q = a[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [+(-dy / l).toFixed(4), +(dx / l).toFixed(4)]; });
  // Width where no TUM edges exist (task H): the circuit's own figure, else the map's width, else 12 m assumed
  const wS = lapsimTrackWidths[id]?.m, wM = lapsimTracks[id]?.quality?.widthM, widthM = wS ?? wM ?? 12;
  let mid, left, right, nrm, base, half, edges;
  if (L?.line?.length) {
    mid = smoothClosed(L.left.map((l, i) => [(l[0] + L.right[i][0]) / 2, (l[1] + L.right[i][1]) / 2])); nrm = normals(mid); edges = L.edges;
    const own = edges === 'assumed' && wS, hw = own ? mid.map(() => wS / 2) : smoothClosed(L.left.map((l, i) => [Math.hypot(l[0] - L.right[i][0], l[1] - L.right[i][1]) / 2])).map(v => v[0]), line = smoothClosed(L.line);
    if (own) edges = 'stated';
    left = mid.map((p, i) => [p[0] + nrm[i][0] * hw[i], p[1] + nrm[i][1] * hw[i]]); right = mid.map((p, i) => [p[0] - nrm[i][0] * hw[i], p[1] - nrm[i][1] * hw[i]]);
    half = hw.map(h => Math.max(0.5, h - 1));
    base = line.map((p, i) => Math.round(Math.max(-half[i], Math.min(half[i], (p[0] - mid[i][0]) * nrm[i][0] + (p[1] - mid[i][1]) * nrm[i][1])) * 10));
  } else {
    const m = lapsimTracks[id]?.map; if (!m?.x?.length) { LINE_CACHE.set(id, null); return null; }
    const h = widthM / 2; edges = wS ? 'stated' : wM ? 'map' : 'assumed';
    mid = smoothClosed(m.x.map((x, i) => [x, m.y[i]])); nrm = normals(mid); half = mid.map(() => Math.max(0.5, h - 1));
    left = mid.map((p, i) => [p[0] + nrm[i][0] * h, p[1] + nrm[i][1] * h]); right = mid.map((p, i) => [p[0] - nrm[i][0] * h, p[1] - nrm[i][1] * h]);
    base = minCurvatureLine(mid.map(p => p[0]), mid.map(p => p[1]), half).offset.map(v => Math.round(v * 10));
  }
  const sp = minCurvatureLine(mid.map(p => p[0]), mid.map(p => p[1]), half, {order: 2}).offset.map(v => Math.round(v * 10));
  const xs = [...left, ...right].map(p => p[0]), ys = [...left, ...right].map(p => p[1]);
  const out = {mid: mid.map(r1), left: left.map(r1), right: right.map(r1), nrm, base, sp, edges, widthM, minX: Math.min(...xs), maxY: Math.max(...ys), pad: 40, cars: C || {}};
  LINE_CACHE.set(id, out); return out;
}
// Map controls: racing line on/off, qualifying/race line, zoom (+, −, fit; wheel/pinch and drag on the map)
function lineControls(lang, view) {
  const t = LT[lang];
  const u = UI[lang];
  return `<div class="ls-line-bar">${['q', 'r'].map(m => `<button type="button" class="pill${m === 'q' ? ' active' : ''}" data-line-mode="${m}">${esc(t.modes[m])}</button>`).join('')}<button type="button" class="pill active" data-line-toggle aria-pressed="true">${esc(t.lineShow)}</button>
 <label class="ls-driver" data-ls="driverWrap"${view.driverOpts ? '' : ' hidden'}><select data-ls="driver" aria-label="${esc(t.driver)}">${view.driverOpts}</select></label> <span class="ls-zoom-btns"><button type="button" class="pill ls-icon" data-rot="-15" aria-label="${esc(u.rotL)}" title="${esc(u.rotL)}">⟲</button><button type="button" class="pill ls-icon" data-rot="15" aria-label="${esc(u.rotR)}" title="${esc(u.rotR)}">⟳</button><button type="button" class="pill ls-icon ls-compass-btn" data-compass aria-label="${esc(u.reset)}" title="${esc(u.reset)}">${compassSvg(view.compassDeg)}</button><button type="button" class="pill ls-icon" data-zoom="in" aria-label="${esc(t.zin)}">+</button><button type="button" class="pill ls-icon" data-zoom="out" aria-label="${esc(t.zout)}">−</button><button type="button" class="pill" data-zoom="fit">${esc(t.all)}</button></span></div>
 <p class="fine ls-line-key"><span data-ls="lineNote">${esc(view.lineNote)}</span></p>`;
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
    cols: ['제조사', '연도', '스틴트 에너지', '실제 풀 스틴트', '모델 예측', '랩당 에너지'], est: '추정, 2026 BoP 비공개', estLow: '추정 신뢰 낮음: 차 1대뿐이거나 세이프티카·FCY로 스틴트가 짧아진 레이스', laps: '랩', test: '모델 검증 (대회 하나씩 빼고 예측): 스틴트 길이 오차 RMS {e}% · {n}개 대회 · 레이스 계수 k = {k}', unseen: '처음 보는 시즌으로 검증 ({y}, 모델 학습에 안 쓴 {n}개 대회 · {r}개 행, Timing71 스틴트 + FIA BoP): 스틴트 길이 오차 RMS {e}%', note: '실제 풀 스틴트: 같은 차가 두 번 이상 달린 가장 긴 그린 플래그 스틴트 (Al Kamel 레이스 타이밍). 2025 BoP: FIA WEC 결정문.'},
  en: {h: 'Hypercar stint energy', lead: 'A WEC Hypercar may deliver only a set amount of energy at the driveshafts per stint (pit-out to pit-in), fixed by the BoP (virtual energy tank). The lap simulator works out the drive energy one lap needs; a race-pace factor turns it into how many laps a stint lasts.',
    cols: ['Manufacturer', 'Year', 'Stint energy', 'Real full stint', 'Model', 'Energy per lap'], est: 'estimated, 2026 BoP not published', estLow: 'low-confidence estimate: one car only, or stints cut short by safety car/FCY', laps: 'laps', test: 'Model test (each event left out and predicted): stint length RMS error {e}% · {n} events · race factor k = {k}', unseen: 'Unseen-season test ({y}, {n} events · {r} rows never used in the fit, Timing71 stints + FIA BoP): stint length RMS error {e}%', note: 'Real full stint: the longest green-flag stint a car ran at least twice (Al Kamel race timing). 2025 BoP: FIA WEC decisions.'},
};
function stintPanel(id, lang) {
  const S = lapsimStints?.tracks?.[id]; if (!S) return '';
  const t = ST[lang], cap = b => ({bmw: 'BMW', aston: 'Aston Martin'})[b] || b[0].toUpperCase() + b.slice(1);
  const rows = Object.entries(S).sort(([a], [b]) => b.localeCompare(a)).flatMap(([y, by]) => Object.entries(by).map(([b, r]) => {
    const model = r.basis === 'bop' ? (r.MJ / (lapsimStints.k * r.simMJ)).toFixed(1) : '–';
    return `<tr><td>${esc(cap(b))}</td><td data-no-translate>${y}</td><td data-no-translate>${r.MJ}${r.plusMinusMJ ? ' ± ' + r.plusMinusMJ : ''} MJ${r.basis === 'estimated' ? ` <span class="fine">(${esc(r.confidence === 'low' ? t.estLow : t.est)})</span>` : ''}</td><td data-no-translate>${r.laps} ${esc(t.laps)}</td><td data-no-translate>${model}</td><td data-no-translate>${r.lapMJ.toFixed(2)} MJ</td></tr>`;
  })).join('');
  const T = lapsimStints.test;
  return `<section class="panel ls-panel"><h2>${esc(t.h)}</h2><p>${esc(t.lead)}</p>
 <div class="output"><table class="ls-table"><thead><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
 <p class="fine">${esc(t.test.replace('{e}', T.rmsPct).replace('{n}', T.events).replace('{k}', lapsimStints.k))}</p>${T.unseen ? `<p class="fine">${esc(t.unseen.replace('{y}', T.unseen.year).replace('{n}', T.unseen.events).replace('{r}', T.unseen.rows).replace('{e}', T.unseen.rmsPct))}</p>` : ''}<p class="fine">${esc(t.note)}</p></section>`;
}
// Brake panel texts
const BT = {
  ko: {h: '브레이크', lead: '시뮬레이션 랩의 제동 구간입니다. 가장 강한 제동 구간을 Brembo가 대회마다 공개하는 실제 수치와 나란히 보여 줍니다 (F1). 하이퍼카는 LMH(앞바퀴 모터 회생)와 LMDh(뒷바퀴 회생)의 차이가 앞뒤 브레이크 부담에 그대로 나타납니다.',
    hardest: '가장 강한 제동', hardestT: '가장 강한 제동 (Brembo 기준 T{t})', model: '모델', brembo: 'Brembo 실측', vFrom: '제동 전 속도', vTo: '제동 후 속도', dist: '제동 거리', time: '제동 시간', g: '감속 (평균)', pedal: '페달 하중', bar: '앞 브레이크 압력 (추정)', zones: '랩당 제동 구간', brakeTime: '랩당 제동 시간',
    axle: {rear: '뒤 차축', front: '앞 차축'}, noRegen: '회생 없음', split: '마찰 브레이크 앞 {f}% · 뒤 {r}% · 모터 회생({ax}) {rk} kWh · 마찰 브레이크 {fk} kWh · 공기 저항이 멈춰 준 몫 {dk} kWh (랩당)',
    test: '검증 (Brembo 공개 수치 {n}개 대회, 대회 하나씩 빼고 예측): 감속 오차 {g}% · 페달 하중 {kg}% · 제동 전 속도 {v}% · 제동 거리 {d}% · 랩당 제동 시간 {t}% (브레이크 압력이 차오르는 시간 {r}초를 Brembo 수치로 맞춰 반영)', assume: '가정: 페달 비 3.5, 마스터 실린더 17.8 mm, 밸런스 = 앞 마찰 비중. 페달 하중 = 감속(g) × Brembo 수치에서 맞춘 kg/g. 실제 압력 데이터는 공개되지 않습니다.', repro: '이미 열린 {y} 대회: 모델 값을 Brembo 수치에 맞춰 보정해 그대로 재현합니다. 보정 전 모델: {raw}'},
  en: {h: 'Brakes', lead: 'Braking zones of the simulated lap. The hardest one is shown next to the real figures Brembo publishes for each race (F1). For Hypercars, LMH (front-axle regen) and LMDh (rear-axle regen) differ directly in how much each axle\'s brakes do.',
    hardest: 'Hardest braking', hardestT: 'Hardest braking (Brembo: T{t})', model: 'Model', brembo: 'Brembo, real', vFrom: 'Speed before', vTo: 'Speed after', dist: 'Braking distance', time: 'Braking time', g: 'Deceleration (mean)', pedal: 'Pedal load', bar: 'Front brake pressure (estimate)', zones: 'Braking zones per lap', brakeTime: 'Braking time per lap',
    axle: {rear: 'rear axle', front: 'front axle'}, noRegen: 'no regen', split: 'Friction brakes front {f}% · rear {r}% · motor regen ({ax}) {rk} kWh · friction brakes {fk} kWh · stopped by air drag {dk} kWh (per lap)',
    test: 'Test (Brembo figures, {n} races, each left out and predicted): deceleration error {g}% · pedal load {kg}% · speed before braking {v}% · braking distance {d}% · braking time per lap {t}% (an effective pressure build-up of {r} s, fitted on the Brembo figures, is included)', assume: 'Assumed: pedal ratio 3.5, master cylinder 17.8 mm, balance = front friction share. Pedal load = deceleration (g) × kg per g fitted on Brembo figures. Real pressure data is not published.', repro: 'Race already run ({y}): the model values are corrected to Brembo’s figures, so they reproduce exactly. Model before correction: {raw}'},
};
const FT = {
  ko: {opt: '예보 (Météo-France)', loading: 'Météo-France 예보 불러오는 중…', hour: '시각 (현지)', rain: '비', fail: '예보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.', k: 0.02,
    note: 'Météo-France의 ARPEGE·AROME 예보(Open-Meteo 제공)입니다. F1·WEC 공식 기상 서비스도 Météo-France입니다. 노면 온도는 예보에 없어 기온 + 일사량 × 0.02 °C/(W/m²)로 추정합니다.',
    noteFit: 'Météo-France의 ARPEGE·AROME 예보(Open-Meteo 제공)입니다. F1·WEC 공식 기상 서비스도 Météo-France입니다. 노면 온도 = 기온 + {a} °C + 일사량 × {k} °C/(W/m²): 실제 세션 기상({n}개 대회)에 맞춘 값, 대회 하나씩 빼고 예측한 오차 ±{e} °C.'},
  en: {opt: 'Forecast (Météo-France)', loading: 'Loading the Météo-France forecast…', hour: 'Hour (local)', rain: 'rain', fail: 'Could not load the forecast. Try again shortly.', k: 0.02,
    note: 'Météo-France ARPEGE/AROME forecast (served by Open-Meteo); Météo-France is also the official weather service of F1 and WEC. Track temperature is not forecast: estimated as air temperature + solar radiation × 0.02 °C per W/m².',
    noteFit: 'Météo-France ARPEGE/AROME forecast (served by Open-Meteo); Météo-France is also the official weather service of F1 and WEC. Track temperature = air + {a} °C + solar radiation × {k} °C per W/m², fitted on real session weather ({n} events), error ±{e} °C with each event left out.'},
};
const SERIES_UI = ['f1', 'wec', 'fe', 'gt3']; // owner 2026-11-15: no IMSA tab; the WEC tab is Hypercar/GTP (LMH and LMDh, WEC and IMSA records)
// GT3 car model -> series spec (BoP body) -> kits oldest to newest. Spec order: SRO GT3 first (owner 2026-11-15).
const BODY_ORDER = ['gt3-sro', 'gt3-imsa', 'gt3-aco', 'gt3-dtm'], BODY_LABEL = {'gt3-sro': 'SRO GT3', 'gt3-imsa': 'IMSA GTD', 'gt3-aco': 'WEC LMGT3', 'gt3-dtm': 'DTM'};
const kitOf = c => c.evo === 'evo2' ? 2 : c.evo ? 1 : 0;
export function gt3Families(cars, order) {
  const fam = {}; for (const k of order) { const c = cars[k]; if (c?.series === 'gt3' && c.base) ((fam[c.base] ||= {})[c.cls] ||= []).push(k); }
  for (const f of Object.values(fam)) for (const l of Object.values(f)) l.sort((a, b) => kitOf(cars[a]) - kitOf(cars[b]));
  return fam;
}
const specOf = f => BODY_ORDER.filter(b => f[b]);
const specOpts = (f, sel) => specOf(f).map(b => `<option value="${b}"${b === sel ? ' selected' : ''}>${BODY_LABEL[b]}</option>`).join('');
const famOpts = (fam, cars, sel) => Object.keys(fam).sort((a, b) => a.localeCompare(b, 'en')).map(base => `<option value="${fam[base][specOf(fam[base])[0]].at(-1)}"${base === sel ? ' selected' : ''}>${esc(base)}</option>`).join('');
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
  const t = data.t, sel = data.cars[state.carId], d0 = data.track;
  // series start line (owner 2026-11-15): a non-F1 car on a track whose other series start elsewhere (Silverstone: National Pits Straight)
  // runs the same lap from that line; F1 sectors do not apply there. Map, racing line and corner labels on the map stay as drawn.
  const kS = sel.series && data.startAlt ? Math.round(data.startAlt.m / d0.ds) % d0.kappa.length : 0, offS = kS * d0.ds, LS = d0.kappa.length * d0.ds;
  const rot = a => a ? a.slice(kS).concat(a.slice(0, kS)) : a;
  const d = kS ? Object.assign({}, d0, {kappa: rot(d0.kappa), grade: rot(d0.grade), heading: rot(d0.heading), aeroZones: undefined, sectors: [],
    corners: (d0.corners || []).map(c => Object.assign({}, c, {s: Math.round((c.s - offS + LS) % LS)})).sort((a, b) => a.s - b.s)}) : d0;
  if (!computeView.cache || computeView.cache.id !== data.id + ':' + kS) computeView.cache = {id: data.id + ':' + kS, base: K.trackFromData(d)};
  const base = computeView.cache.base;
  // F1 low-drag zones of the car's season (worker/lapsim/zones.js; on when the F1 fit used them): DRS to 2025, Straight Mode from 2026
  // F1 low-drag zones of the car's season (worker/lapsim/zones.js; on when the F1 fit used them): DRS to 2025, Straight Mode from 2026.
  // Options (owner 2026-11-16): SM Normal / Alt (low-grip activation of the FIA map; n/a = zone off; no column = 50 m later) / Off,
  // Overtake on (C5.2.8 ii power curve) / off, DRS on / off. Defaults Normal, OT on, DRS on.
  // newest zone set of the car's year or earlier (2027/2028 FIA notes apply to that year only, owner 2026-11-16)
  const slotOf = y => y < 2026 ? '2025' : String(Math.max(2026, ...Object.keys(data.zones || {}).map(Number).filter(k => k >= 2026 && k <= y)));
  const zl = (c, m) => { const sl = slotOf(c.year), z = data.zones && data.zones[sl], L = d.kappa.length * d.ds; if (!z || !z.zones) return null;
    if (sl === '2025' ? !m.drs : m.sm === 'off') return [];
    return m.sm === 'alt' && sl === '2026' ? z.zones.filter(q => q.low !== null).map(q => [q.low != null ? q.low : (q.from + 50) % L, q.to]) : z.zones.map(q => [q.from, q.to]); };
  // fit setup: FIA zones when the F1 fit used them (zonesOn), else the kernel's own straights; no Overtake (the real laps it was fit on)
  const zt0 = (tr, c) => { if (c.series || !c.year || kS || !data.zonesOn || (data.zonesOn === 'drs' && c.year >= 2026)) return tr; const zs = zl(c, {sm: 'normal', drs: true}); return zs ? lowOf(tr, c, zs) : tr; };
  const zt = (tr, c) => { const t = zt0(tr, c), k = data.puQuali && !c.series && c.year && !kS && otWhole(c) ? data.otChoice : null; if (k == null || k === 'none') return t;
    if (k === 'all') return Object.assign({}, t, {otOn: true}); const zs = zl(c, {sm: 'normal', drs: true}) || [], z = zs[k]; if (!z) return t; const n = d.kappa.length, L = n * d.ds, o = new Uint8Array(n), i0 = Math.round(z[0] / d.ds), len = Math.round((((z[1] - z[0]) % L) + L) % L / d.ds); for (let q = 0; q <= len; q++) o[(i0 + q) % n] = 1; return Object.assign({}, t, {otOn: o}); };
  // Low Grip zones allow only partial activation (front wing in Straight Mode, rear flap in Corner Mode; B7.1.2 b). The front wing's share
  // of the low-drag change is not published: 0.3 is an estimate (the rear flap carries most of the drag drop)
  const PARTIAL = 0.3;
  const lowOf = (tr, c, zs, frac) => { const key = 'low:' + c.year + ':' + (frac || 1) + ':' + JSON.stringify(zs);
    if (!computeView.cache[key]) { const a = zs.length ? K.trackFromData(Object.assign({}, d, {aeroZones: zs}), {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length);
      computeView.cache[key] = frac && frac !== 1 ? Float32Array.from(a, x => x * frac) : a; }
    return Object.assign({}, tr, {aeroLow: computeView.cache[key]}); };
  // options: always the FIA zones of the chosen set (Overtake: C5.2.8 ii power curve); the lap is scaled so the default options give the fitted lap
  const optOf = c => c.year >= 2026 ? {sm: state.sm || 'normal', ot: state.ot !== false, drs: true} : {sm: 'normal', ot: false, drs: state.drs !== false};
  const ot = (tr, c, m) => c.year >= 2026 && m.ot ? Object.assign({}, tr, {otOn: true}) : tr;
  const optTrack = (tr, c, m) => { const zs = zl(c, m); return ot(zs ? lowOf(tr, c, zs, m.sm === 'alt' && c.year >= 2026 ? PARTIAL : 1) : tr, c, m); };
  const optScale = (tr, c, sim, tag, simF) => {
    const W = computeView.cache.sc || (computeView.cache.sc = new WeakMap()), per = W.get(c.car) || (W.set(c.car, {}), W.get(c.car));
    const key = (c.grip || 1) + ':' + (tag || JSON.stringify(env)) + ':' + (tr === base ? 'b' : 't') + ':' + (data.changes?.changes || []).map((x, i) => state.active[i] ? 1 : 0).join('') + state.strength;
    if (!(key in per)) per[key] = (simF || sim)(zt(tr, c)).lapTime / simOpt(tr, c, c.year >= 2026 ? {sm: 'normal', ot: true} : {drs: true}, sim, tag).lapTime; return per[key]; };
  const f1Opt = c => !c.series && c.year && !kS;
  // the options the real qualifying of this car's season ran with (race control, f1-zones-data.js real), else none
  const realOpt = c => { if (!f1Opt(c) || !data.zones) return null; const z = data.zones[slotOf(c.year)], q = z && z.real; if (!q || z.year !== c.year) return null;
    const m = c.year >= 2026 ? {sm: q.grip === 'low' ? 'alt' : 'normal', ot: q.ot !== 'off', drs: true} : {sm: 'normal', ot: false, drs: q.drs !== 'off'};
    return (c.year >= 2026 ? m.sm === 'normal' && m.ot : m.drs) ? null : m; };
  // the reference lap of a correction: in the real session's zone set, scaled like the options
  const refSim = (tr, ref, envR) => { const sim = x => K.simulateLap(withGrip(x, ref.grip || 1), ref.car, envR), m = realOpt(ref); if (!m) return sim(zt(tr, ref));
    const r = simOpt(tr, ref, m, sim, JSON.stringify(envR)), f = optScale(tr, ref, sim, JSON.stringify(envR)); r.lapTime *= f; for (let i = 0; i < r.time.length; i++) r.time[i] *= f; return r; };
  // Overtake is the driver's choice: on a lap where the greedy deployment of the extra power costs energy later, the driver leaves it off
  // Overtake is the driver's choice of where to use it: the whole lap, one straight (each run of the low-drag zones), or not at all, whichever is
  // fastest (the qualifying energy is the same, so on energy-limited laps the extra power only pays on the straight where it is used best)
  // 2026 qualifying curve (FIA PU documents): round 4 on and 2027+, whole lap on Base – Overtake; rounds 1–3 Base – Standard, Overtake where it pays
  const otWhole = c => c.year >= 2026 && !(c.year === 2026 && data.pu && data.pu.round <= 3);
  const simOpt = (tr, c, m, sim, tag) => { const t0 = optTrack(tr, c, Object.assign({}, m, {ot: false})); if (!(m.ot && c.year >= 2026)) return sim(t0);
    const zs = zl(c, {sm: 'normal', drs: true}) || [], n = d.kappa.length, L = n * d.ds;
    const use = k => k === 'none' ? t0 : Object.assign({}, t0, {otOn: k === 'all' ? true : (() => { const [a, b] = zs[k], o = new Uint8Array(n), i0 = Math.round(a / d.ds), len = Math.round((((b - a) % L) + L) % L / d.ds); for (let q = 0; q <= len; q++) o[(i0 + q) % n] = 1; return o; })()});
    // the choice is cached (same car, conditions, track state and options), so later updates run one lap
    const W = computeView.cache.ot || (computeView.cache.ot = new WeakMap()), per = W.get(c.car) || (W.set(c.car, {}), W.get(c.car));
    const key = (tag || JSON.stringify(env)) + ':' + (tr === base ? 'b' : 't') + ':' + JSON.stringify(m) + ':' + (c.grip || 1) + ':' + (data.changes?.changes || []).map((x, i) => state.active[i] ? 1 : 0).join('') + state.strength;
    if (per[key] != null) return sim(use(per[key]));
    let best = null, bk = null; for (const k of ['none', 'all', ...zs.map((_, i) => i)]) { const r = sim(use(k)); if (!best || r.lapTime < best.lapTime) { best = r; bk = k; } }
    per[key] = bk; return best; };
  // conditions: real (season of the selected car, else 2026) or manual
  const condKey = sel.series ? state.carId : String(sel.year);
  const yearKey = data.conds[condKey] ? condKey : (data.conds['2026'] ? '2026' : Object.keys(data.conds)[0]);
  const w = Object.assign({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0},
    Object.fromEntries(Object.entries(state.mode === 'manual' && state.manual ? state.manual : (data.conds[yearKey] || {})).filter(([, v]) => Number.isFinite(v))));
  // per-event ERS recharge limit for 2026+ cars (ignored by older rule sets)
  const env = K.conditionsFromWeather({...w, rechargeMJ: data.energy?.mj ?? undefined});
  // C5.12 power-reduction rule of this event's PU document (rate, large-cut and speed sectors scaled to this track), else the round-4 default
  // 100 kW/s (owner 2026-11-16). The shown lap time stays on the fit (which runs without it) until the fit includes it (calibration puRamp).
  const PUd = data.pu, pk = PUd && PUd.centrelineKm ? d.kappa.length * d.ds / (PUd.centrelineKm * 1000) : 1, scS = z => Object.assign({}, z, {from: z.from * pk, to: z.to * pk});
  const envP = Object.assign({}, env, {puRamp: {rateKWs: (PUd && PUd.rampKWs) || 100, bigCut: ((PUd && PUd.bigCut) || []).map(scS), speed: ((PUd && PUd.speed) || []).map(scS)}});
  // FIA changes switched on by the user
  let track = base;
  const active = (data.changes?.changes || []).filter((c, i) => state.active[i]);
  if (active.length) track = K.applyTrackChanges(base, active, d.corners || [], {strength: state.strength}).track;
  const withGrip = (tr, g) => { const n = tr.kappa.length, mu = new Float64Array(n); for (let i = 0; i < n; i++) mu[i] = g * tr.mu[i]; return {...tr, mu}; };
  // learned lap-time factor (GT3 car models, class cars on tracks learned from real laps): lap and sector times scale
  const run = c => { const sim = tr => { const r = K.simulateLap(withGrip(tr, c.grip || 1), c.car, envP); r.trk = tr; return r; }, simFit = tr => K.simulateLap(withGrip(tr, c.grip || 1), c.car, data.puRamp ? envP : env), r = f1Opt(c) ? simOpt(track, c, optOf(c), sim) : sim(zt(track, c)), f = (c.timeScale || 1) * (f1Opt(c) ? optScale(track, c, sim, null, simFit) : 1); if (f !== 1) { r.lapTime *= f; for (let i = 0; i < r.time.length; i++) r.time[i] *= f; } return r; };
  const secOf = r => { const i1 = Math.round(d.sectors[0] / d.ds), i2 = Math.round(d.sectors[1] / d.ds); return [r.time[i1], r.time[i2] - r.time[i1], r.lapTime - r.time[i2]]; };
  // sector correction (raced tracks): real pole sectors minus the reference car's sectors in that weather
  const corrOf = c => {
    if (!c.fix) return null;
    // lap-only correction (raced session with a real lap but no sector lines on this track: Le Mans, IMSA tracks, …):
    // real lap minus the reference car's lap in that session's weather, a number (same rule as the tool, tool.js corrOf)
    if (c.fix.lap != null) {
      const keyL = data.id + '|lap|' + c.fix.ref; computeView.fixCache = computeView.fixCache || {};
      if (computeView.fixCache[keyL] == null) {
        const ref = data.cars[c.fix.ref], fw = {};
        for (const k of ['pressureHpa', 'airTempC', 'humidityPct', 'trackTempC', 'windSpeed', 'windFromDeg']) if (Number.isFinite(c.fix.weather && c.fix.weather[k])) fw[k] = c.fix.weather[k];
        const envR = K.conditionsFromWeather(Object.assign({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, fw));
        computeView.fixCache[keyL] = c.fix.lap - refSim(base, ref, envR).lapTime * (ref.timeScale || 1);
      }
      return computeView.fixCache[keyL];
    }
    if (!c.fix.real || !d.sectors || d.sectors.length !== 2) return null;
    const key = data.id + '|' + c.fix.ref; computeView.fixCache = computeView.fixCache || {};
    if (!computeView.fixCache[key]) {
      const ref = data.cars[c.fix.ref], fw = {};
      for (const k of ['pressureHpa', 'airTempC', 'humidityPct', 'trackTempC', 'windSpeed', 'windFromDeg']) if (Number.isFinite(c.fix.weather && c.fix.weather[k])) fw[k] = c.fix.weather[k];
      const envR = K.conditionsFromWeather(Object.assign({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, fw, {rechargeMJ: data.energy && data.energy.mj != null ? data.energy.mj : undefined}));
      const ss = secOf(refSim(base, ref, envR));
      computeView.fixCache[key] = c.fix.real.map((x, i) => x - ss[i]);
    }
    return computeView.fixCache[key];
  };
  const corrected = (c, r) => { const k = corrOf(c), sec = d.sectors && d.sectors.length === 2 ? secOf(r) : null;
    if (typeof k === 'number') return {lapTime: r.lapTime + k, sectors: sec ? sec.map(x => x + k * x / r.lapTime) : null, corr: [k]}; // lap correction spread by sector share
    return k && sec ? {lapTime: r.lapTime + k[0] + k[1] + k[2], sectors: sec.map((x, i) => x + k[i]), corr: k} : {lapTime: r.lapTime, sectors: sec, corr: null}; };
  const raw = run(sel), fixd = corrected(sel, raw);
  const res = Object.assign({}, raw, {lapTime: fixd.lapTime});
  // compared cars (compare tab, owner 2026-11-15): up to two more cars overlaid on the selected one
  const cmpIds = (state.compareIds || (state.compareId ? [state.compareId] : [])).filter((k, j, a) => k && data.cars[k] && a.indexOf(k) === j).slice(0, 2);
  const cmpRaws = cmpIds.map(k => run(data.cars[k])), cmpFix = cmpRaws.map((r, j) => corrected(data.cars[cmpIds[j]], r));
  const cmps = cmpRaws.map((r, j) => Object.assign({}, r, {lapTime: cmpFix[j].lapTime}));
  const cmpRaw = cmpRaws[0] || null, cmp = cmps[0] || null;
  const fmt = s => { if (!Number.isFinite(s)) return '–'; const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); };
  const sectors = fixd.sectors;
  const real = data.conds[condKey];
  const sameConditions = state.mode !== 'manual' && !active.length;
  const poleHtml = real && real.realLap && sameConditions && (sel.kind === 'calibrated' || sel.kind === 'learned')
    ? (sel.series ? t.wecBest : real.position > 1 ? t.realLap + ' P' + real.position : t.vsPole) + ' <span data-no-translate>' + fmt(real.realLap) + '</span> · <span data-no-translate>' + ((res.lapTime - real.realLap) >= 0 ? '+' : '−') + Math.abs(res.lapTime - real.realLap).toFixed(3) + ' s</span>' + (sel.series && real.event ? ' · <span data-no-translate>' + real.event + (real.manufacturer ? ' · ' + real.manufacturer : '') + '</span>' : '')
    : (cmp ? data.cars[cmpIds[0]].label + ' <span data-no-translate>' + fmt(cmp.lapTime) + ' · ' + ((res.lapTime - cmp.lapTime) >= 0 ? '+' : '−') + Math.abs(res.lapTime - cmp.lapTime).toFixed(3) + ' s</span>' : '');
  // fastest real race lap of this car here (a car + track that really raced shows it; owner rule 2026-11-14)
  const rr = data.raceRec && data.raceRec[condKey], raceHtml = rr ? '<br>' + t.raceBest + ' <span data-no-translate>' + fmt(rr.lap) + '</span> · <span data-no-translate>' + rr.year + ' ' + rr.who + '</span>' : '';
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
  const kindLabel = sel.learned ? t.learned : sel.kind === 'calibrated' ? t.calibrated : sel.kind === 'projected' ? t.projected : sel.kind === 'prior' ? t.prior : 'TUM';
  // racing line of the selected car on the map (F1 projections use the 2026 line), coloured by its own
  // simulated speed; markers: braking starts, lowest speed of that corner, back to full power
  let line = null, lineNote = '', driverOpts = '';
  const LD = data.line, LT0 = data.lineText;
  if (LD && state.showLine !== false) {
    // a precomputed line of this exact car (SPSA on measured edges) first; otherwise this car's own blend of the shortest and the
    // least-curvature line, found by the lap kernel (blendLine, browser only and cached; the server draws the least-curvature line)
    const mode = state.lineMode || 'q', cl = LD.cars[state.carId] ? LD.cars[state.carId][mode] : null, n = LD.base.length;
    let off = cl ? cl.off : LD.base, bl = null;
    // F1: a driver's own line, estimated from that driver's speed trace (scripts/sim/driver-lines.mjs), when one is picked
    // every series has driver lines (owner 2026-11-15): F1 per season; endurance per class (LMH, LMDh, GT3), GT3 drivers of this car's make
    const DLT = data.driverLines || {}, bucket = !sel.series ? null : sel.cls === 'lmh' ? 'lmh' : sel.cls === 'lmdh' || sel.cls === 'gtp' ? 'lmdh' : sel.series === 'fe' ? 'fe-' + sel.cls : 'gt3';
    let DLy = !sel.series ? DLT.f1 && DLT.f1[String(sel.year)] : bucket && DLT.end && DLT.end[bucket];
    if (DLy && bucket === 'gt3' && sel.base) { const mk = String(sel.base).split(' ')[0].toLowerCase(), own = Object.entries(DLy.drivers).filter(([, r]) => String(r.manufacturer || '').toLowerCase().startsWith(mk)); if (own.length) DLy = {drivers: Object.fromEntries(own)}; }
    const dl = DLy && state.driver ? DLy.drivers[state.driver] : null;
    if (dl) off = R.blendOff(LD.base.map(x => x / 10), LD.sp.map(x => x / 10), dl.w).map(x => x * 10);
    else if (!cl && R.blendLine) {
      // the line is searched once per car (weather moves it far less than the car)
      const bk = data.id + '|' + state.carId; computeView.blend = computeView.blend || {};
      bl = computeView.blend[bk] = computeView.blend[bk] || R.blendLine(K, [LD.mid.map(p => p[0]), LD.mid.map(p => p[1])], LD.nrm, LD.base.map(x => x / 10), LD.sp.map(x => x / 10), sel.car, env, (sel.grip || 1) / Math.pow(sel.timeScale || 1, 2)); // a model's learned pace (time scale) counts as grip for its line
      off = bl.off.map(x => x * 10);
    }
    const P = LD.mid.map((m, i) => [m[0] + LD.nrm[i][0] * off[i] / 10, m[1] + LD.nrm[i][1] * off[i] / 10]);
    const tr = R.lineTrack(K, P.map(p => p[0]), P.map(p => p[1]));
    const car = mode === 'r' && cl ? Object.assign({}, sel.car, {mass: sel.car.mass + cl.fuelKg}) : sel.car;
    tr.mu.fill((sel.grip || 1) * (mode === 'r' && cl ? cl.grip : 1));
    const sim = K.simulateLap(tr, car, env), m = sim.v.length, J = i => Math.min(m - 1, Math.round(i * m / n)), v = P.map((_, i) => sim.v[J(i)]), lim = i => sim.limit[J(i)], marks = [];
    // a braking zone counts when it lasts 3+ points and costs 10+ km/h (lift-offs and noise are skipped)
    for (let i = 0, last = -1; i < n; i++) if (lim(i) === 3 && lim((i - 1 + n) % n) !== 3 && i > last) {
      let e = i; while (e - i < n / 4 && lim((e + 1) % n) === 3) e++;
      let a = i, j = i; for (let k = 1; k < n / 3; k++) { j = (i + k) % n; if (v[j] < v[a]) a = j; if (lim(j) === 2 && k > e - i) break; }
      if (e - i < 2 || (v[i] - v[a]) * 3.6 < 10) continue;
      marks.push([i, 'b'], [a, 'a'], [j, 't']); last = j < i ? n : j;
    }
    // kerbs (owner 2026-11-15, estimated where OpenStreetMap has none): inside at each apex (±20 m), outside at the corner exit (±25 m
    // around the full-throttle point); the inside is the side the line turns to there
    const dsp = (tr.length || n * 5) / n, kerbs = [];
    for (let q = 0; q + 2 < marks.length; q += 3) { const a = marks[q + 1][0], t = marks[q + 2][0], p0 = P[(a - 2 + n) % n], p1 = P[a], p2 = P[(a + 2) % n];
      const left = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]) > 0, w = k => Math.round(k / dsp);
      kerbs.push([left ? 'L' : 'R', a - w(20), a + w(20)], [left ? 'R' : 'L', t - w(25), t + w(25)]); }
    line = {pts: P, v, marks, kerbs, surf: data.surface?.spans || [], left: LD.left, right: LD.right};
    const edge = (LT0.edges[LD.edges] || '').replace('{m}', LD.widthM);
    const dname = (k, r) => (r.name || k) + (r.name && !sel.series ? ' (' + k + ')' : '') + (r.team ? ' · ' + r.team : r.manufacturer ? ' · ' + r.manufacturer : '');
    driverOpts = DLy ? '<option value="">' + LT0.carLine + '</option>' + Object.entries(DLy.drivers).sort((a, b) => String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]))).map(([k, r]) => '<option value="' + k + '"' + (k === state.driver ? ' selected' : '') + '>' + dname(k, r) + '</option>').join('') : '';
    lineNote = dl ? (sel.series ? LT0.driverNoteEnd.replace('{s}', String(dl.series || '').toUpperCase() + ' ' + (dl.season || '')) : LT0.driverNote.replace('{y}', sel.year)).replace('{d}', dl.name || state.driver).replace('{a}', dl.fit[0]).replace('{b}', dl.fit[1]) + (dl.test ? LT0.driverTest.replace('{a}', dl.test[0]).replace('{b}', dl.test[1]) : '') : cl ? LT0.lineNote.replace('{car}', sel.label).replace('{mode}', LT0.modes[mode]).replace('{gain}', (cl.gain >= 0 ? '+' : '−') + Math.abs(cl.gain).toFixed(3)).replace('{shift}', cl.shift)
      + (mode === 'r' ? LT0.raceNote.replace('{fuel}', cl.fuelKg).replace('{grip}', cl.grip).replace('{basis}', LT0.basis[cl.basis] || cl.basis) : '')
      : (bl ? LT0.blendNote.replace('{car}', sel.label).replace('{e}', Math.round(bl.e * 100)) + (mode === 'r' ? ' · ' + LT0.noRace : '') : LT0.noCar);
    const sf = data.surface, surfNote = sf ? (sf.n ? LT0.surf.replace('{y}', sf.year).replace('{n}', sf.n) : LT0.surfEra.replace('{y}', sf.era)) : '';
    lineNote += (edge ? ' · ' + edge : '') + (line.kerbs.length ? ' · ' + LT0.kerbs : '') + (surfNote ? ' · ' + surfNote : '');
  }
  // F1 zones (owner 2026-11-15): 2026–2028 cars show the 2026 Straight Mode zones and overtake detection/activation (2027 documents
  // replace them once published); a 2025 car shows the 2025 DRS zones, or those of the last year F1 raced here; other cars none
  const ZD = data.zones, zy = !sel.series && ZD ? (sel.year >= 2025 ? ZD[slotOf(sel.year)] : null) : null;
  // the chosen options (owner 2026-11-16): Alt draws the low-grip zones (n/a ones left out), Off or DRS off draws none, Overtake off hides OT marks
  const om = zy ? optOf(sel) : null, LZ = d0.kappa.length * d0.ds;
  const zlist = !zy ? [] : (zy.kind === 'drs' ? !om.drs : om.sm === 'off') ? [] : om.sm === 'alt' && zy.kind !== 'drs' ? zy.zones.filter(z => z.low !== null).map(z => Object.assign({}, z, {from: z.low != null ? z.low : (z.from + 50) % LZ})) : zy.zones;
  const zoneOpts = zy ? {kind: zy.kind, list: zlist.map(z => ({from: z.from, to: z.to, label: (zy.kind === 'drs' ? 'DRS' : 'SM') + (zy.zones.length > 1 ? ' ' + z.n : '')})),
    marks: (zy.marks || []).filter(m => zy.kind === 'drs' || om.ot).map(m => ({s: m.s, kind: m.kind, label: m.label}))} : null;
  const rq = zy && zy.real, rqp = rq ? [rq.grip === 'low' ? t.realAeroParts.low : '', rq.ot === 'off' ? t.realAeroParts.otOff : '', rq.drs === 'off' ? t.realAeroParts.drsOff : ''].filter(Boolean) : [];
  const zoneNote = zy ? ' · ' + (data.ui.zoneNote[zy.kind] || '').replace('{y}', zy.year).replace('{doc}', zy.doc || '') + (rqp.length ? ' · ' + t.realAero.replace('{y}', zy.year).replace('{s}', rqp.join(', ')) : '') : '';
  const mapOpts = {zones: zoneOpts, corners: d0.corners, length: d.length, label: t.map, line, start: kS / d0.kappa.length, rot: Number.isFinite(state.mapRot) ? state.mapRot : (data.mapRot0 || 0)};
  // compass: the map frame turned by north.deg (counter-clockwise) is true east-north; the needle turns clockwise on screen
  const compassDeg = data.north && !data.north.mirror ? ((data.north.deg - mapOpts.rot) % 360 + 360) % 360 : null;
  const mapSvg = R.renderMap(d.map || {x: [], y: []}, kS ? res.v.slice(res.v.length - kS).concat(res.v.slice(0, res.v.length - kS)) : res.v, mapOpts);
  // compass arrow pointing where the wind blows to (map north is up)
  const windHtml = env.windSpeed > 0.3 ? '<svg class="ls-compass" width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -8L5 5L0 2L-5 5Z" transform="rotate(' + Math.round((env.windFromDeg + 180) % 360) + ')"/></svg><span>' + t.wind + ' <span data-no-translate>' + env.windSpeed.toFixed(1) + ' m/s</span></span>' : '';
  // stacked telemetry, laid out like a team data sheet: one distance axis, corners marked, the compared car overlaid, a time-delta
  // lane, and (browser) one cursor across every lane with the values at that point. Grip-loss zones are shaded on the speed lane.
  const clsOf = c => !c.series ? 'f1' : c.series === 'fe' ? 'fe' : c.cls === 'lmh' || c.cls === 'lmdh' || c.cls === 'gtp' ? 'hyper' : 'gt3';
  // surface named in the latest FIA notes: fresh asphalt (green, little rubber) and patched bumps are where grip goes first
  const nP = track.kappa.length, surface = new Array(nP).fill(0);
  for (const c of data.changes?.changes || []) {
    if (c.type !== 'resurfacing' && c.type !== 'bump_removal') continue;
    const w0 = c.range && K.windowFor(c.range.from, d.corners || []), w1 = c.range && K.windowFor(c.range.to, d.corners || []) || w0;
    if (!w0) { if (c.type === 'resurfacing') surface.fill(0.15); continue; }
    for (let x = w0[0]; x <= w1[1]; x += d.ds) surface[(Math.round(x / d.ds) % nP + nP) % nP] = 0.25;
  }
  const chOf = (c, r, key) => R.lapChannels(r && r.trk || track, c.car, env, r, {cls: clsOf(c), seed: data.id + '|' + key, surface, wet: state.mode !== 'manual' && !!(data.conds[condKey] && data.conds[condKey].rain)});
  const ch = [chOf(sel, raw, state.carId)].concat(cmpRaws.map((r, j) => chOf(data.cars[cmpIds[j]], r, cmpIds[j])));
  const tag = arr => arr.map((v, j) => v ? {v, cls: 'ls-line-' + j} : null).filter(Boolean); // keeps each car's colour when one has no channel
  const TL = t.tel, cOpt = (unit, step, h, lo, more) => Object.assign({sectors: d.sectors || [], corners: d.corners || [], label: unit, km: t.km, unit, step, h, lo}, more);
  const bands = []; ch[0].risk.forEach((x, i) => { if (x >= 0.2) { const last = bands[bands.length - 1]; if (last && i * d.ds - last[1] <= d.ds * 1.5) last[1] = (i + 1) * d.ds; else bands.push([i * d.ds, (i + 1) * d.ds]); } });
  const series = tag([res.v].concat(cmps.map(c => c.v)).map(v => v.map(x => x * 3.6)));
  // battery energy along the lap (J; recovery capped at the per-lap limit, no clamping, so a profile the battery window cannot hold
  // is shown, not hidden). F1 qualifying lap: starts full; Hypercar (charge-sustaining race lap): lowest point at 0
  const socOf = F => { const cap = F.recharge ?? Infinity; let cum = 0, got = 0, mn = 0, mx = 0; const c = [];
    for (let i = 0; i < F.dep.length; i++) { let r = F.brk[i] + F.thr[i]; if (got + r > cap) r = Math.max(0, cap - got); got += r; cum += r - F.dep[i]; c.push(cum); mn = Math.min(mn, cum); mx = Math.max(mx, cum); }
    const s0 = F.rule === 'hypercar' ? -mn : F.soc; return {s: c.map(e => s0 + e), s0, mn, mx}; };
  const hyb = r => r && r.flow && (r.flow.rule === 'f1-2026' || r.flow.rule === 'hypercar') ? socOf(r.flow).s.map(e => +(e / 1e6).toFixed(3)) : null;
  const socLane = tag([hyb(raw)].concat(cmpRaws.map(hyb)));
  // motor (MGU-K / hybrid) power along the lap from the kernel's energy flow: deploy +, recovery −, with the regulation cap of the
  // selected car dashed (F1 2026: the speed taper of Art. C5.2.8, the qualifying curve; F1 before 2026: 120 kW; Hypercar: the BoP motor
  // power above its deploy speed). F1 2026: the event's FIA Power Unit Information shades the sectors where the race uses the
  // alternative curve (Alt 1, from Miami on) and is summarised under the lane. Display only: the kernel is not changed.
  const motorOf = r => { const F = r && r.flow; if (!F) return null; const n = F.dep.length; return F.dep.map((e, i) => { const j = (i + 1) % n, dt = d.ds / Math.max((r.v[i] + r.v[j]) / 2, 1); return Math.round((e - F.brk[i] - F.thr[i]) / dt / 1000); }); };
  const ersSel = sel.car.ers || {}, otU = raw.trk && raw.trk.otOn, capOf = (v, i) => ersSel.rule === 'f1-2026' ? K.erskLimitW('f1-2026', v, ersSel.pMax, otU === true || !!(otU && otU[i])) / 1000 : ersSel.rule === 'hypercar' ? (v >= (ersSel.deployFrom || 0) ? (ersSel.eMax || 0) / 1000 : 0) : (ersSel.pMax || 0) / 1000;
  const motorLane = tag([motorOf(raw)].concat(cmpRaws.map(motorOf)));
  if (motorLane.length) motorLane.push({v: raw.v.map((v, i) => Math.round(capOf(v, i))), cls: 'ls-cap'});
  const PU = ersSel.rule === 'f1-2026' ? data.pu : null, puK = PU && PU.centrelineKm ? (d.length || nP * d.ds) / (PU.centrelineKm * 1000) : 1, altBands = PU && (PU.est || PU.round > 3) ? (PU.alt || []).filter(z => !z.qOnly).map(z => [z.from * puK, z.to * puK]) : []; // FIA lap distances are on the FIA centreline
  const puNote = !PU ? '' : (PU.est ? TL.puEst : (PU.round <= 3 ? TL.puEarly : TL.puLate).replace('{r}', PU.round)) + ' ' + TL.puDoc.replace('{q}', PU.qualiMJ ?? '–').replace('{race}', PU.raceMJ ?? '–').replace('{d}', PU.powerLimitedDistanceM ?? '–').replace('{rate}', PU.rampKWs ?? '–').replace('{alt}', (PU.alt || []).filter(z => !z.qOnly).map(z => z.sector + ' ' + z.from + '–' + z.to + ' m').join(', ') || '–') + (PU.speed && PU.speed.length ? ' ' + TL.puSpeed.replace('{s}', PU.speed.map(z => z.sector + ' ' + z.from + '–' + z.to + ' m ≥ ' + z.kph + ' km/h').join(', ')) : '') + (PU.document ? ' <a href="' + PU.document.url + '" target="_blank" rel="noopener noreferrer">' + PU.document.title + '</a>' : '');
  // motor DC power map of this event (owner 2026-11-16), like the FIA's: Base – Standard, Base – Overtake, Alt 1 where the document has race
  // sectors; the curve this lap uses is bold. Cap of the car's own rules (2027+: its pMax)
  const puChart = (() => { if (!PU) return ''; const C = TL.puChart, pm = (ersSel.pMax || 350e3) / 1000, W = 520, H = 210, L0 = 44, B = 30, x0 = 220, x1 = 360, y1 = 400;
    const X = v => (L0 + (v - x0) / (x1 - x0) * (W - L0 - 10)).toFixed(1), Y = p => (8 + (1 - p / y1) * (H - 8 - B)).toFixed(1);
    const std = v => Math.max(0, Math.min(pm, v < 340 ? 1800 - 5 * v : v < 345 ? 6900 - 20 * v : 0)), ot = v => Math.max(0, Math.min(pm, v < 355 ? 7100 - 20 * v : 0)), alt = v => v < 310 ? Math.min(250, pm) : std(v);
    const early = !PU.est && PU.round <= 3, useOt = state.ot !== false && !early, curves = [['std', C.std, std, '#1f4e79', ''], ['ot', C.ot, ot, '#1f4e79', '6 4']].concat(altBands.length ? [['alt', C.alt, alt, '#3aa0d8', '']] : []);
    const path = f => { let d = ''; for (let v = x0; v <= x1; v += 1) d += (v === x0 ? 'M' : 'L') + X(v) + ' ' + Y(f(v)); return d; };
    const grid = [0, 100, 200, 300, 400].map(p => '<line x1="' + L0 + '" x2="' + (W - 10) + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="currentColor" stroke-opacity=".12"/><text x="' + (L0 - 6) + '" y="' + (+Y(p) + 4) + '" font-size="11" text-anchor="end" fill="currentColor">' + p + '</text>').join('')
      + [220, 240, 260, 280, 300, 320, 340, 360].map(v => '<text x="' + X(v) + '" y="' + (H - B + 16) + '" font-size="11" text-anchor="middle" fill="currentColor">' + v + '</text>').join('');
    const used = useOt ? 'ot' : 'std', lines = curves.map(([k, , f, col, dash]) => '<path d="' + path(f) + '" fill="none" stroke="' + col + '" stroke-width="' + (k === used ? 3 : 1.5) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' opacity="' + (k === used ? 1 : 0.6) + '"/>').join('');
    const key = curves.map(([k, lab, , col, dash]) => '<span class="ls-pu-key"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="' + col + '" stroke-width="' + (k === used ? 3 : 1.5) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>' + lab + (k === used ? ' · ' + C.thisLap : '') + '</span>').join(' ');
    return '<h3 class="ls-ch-h">' + C.h + '</h3><svg class="ls-pu-map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + C.h + '">' + grid + lines + '<text x="' + ((L0 + W) / 2) + '" y="' + (H - 2) + '" font-size="11" text-anchor="middle" fill="currentColor">' + C.x + '</text></svg><p class="fine">' + key + '</p><p class="fine">' + (early ? C.early : PU.est ? C.est : C.late) + '</p>'; })();
  const delta = cmpRaws.length ? cmpRaws.map((r, j) => ({v: raw.time.map((x, i) => +(x - r.time[i]).toFixed(3)), cls: 'ls-line-' + (j + 1)})) : null;
  const lanes = [['speed', TL.speed, 'km/h', d.ds, series.map(x => x.v), cOpt('km/h', 50, 230, null, {bands})]]
    .concat(delta ? [['delta', TL.delta.replace('{car}', sel.label), 's', d.ds, delta, cOpt('s', 0.5, 140)]] : [])
    .concat(motorLane.length ? [['motor', TL.motor, 'kW', d.ds, motorLane, cOpt('kW', 50, 160, null, {bands: altBands, bandCls: 'ls-alt'})]] : [])
    .concat(socLane.length ? [['soc', TL.soc, 'MJ', d.ds, socLane, cOpt('MJ', 0.5, 140, 0)]] : [])
    .concat([['throttle', TL.throttle, '%', d.ds / 2, tag(ch.map(c => c.throttleHuman)), cOpt('%', 25, 130, 0)], ['brake', TL.brake, 'bar', d.ds / 2, tag(ch.map(c => c.brakeHuman)), cOpt('bar', 25, 150, 0)]])
    .concat(ch[0].gear ? [['gear', TL.gear + ' · ' + TL.shifts.replace('{n}', ch[0].shifts.length), '', d.ds, tag(ch.map(c => c.gear)), cOpt('', 1, 130, 0)], ['rpm', TL.rpm, 'rpm', d.ds, tag(ch.map(c => c.rpm)), cOpt('rpm', 2000, 150)]] : [])
    .concat([['steer', TL.steer, '°', d.ds, tag(ch.map(c => c.steerDeg)), cOpt('°', 45, 170)]]);
  // each lane in its own box, so the channel tick boxes can hide it (owner 2026-11-15)
  const traceSvg = '<div class="ls-cursor-read" data-ls="cursor">' + TL.hover + '</div>' + lanes.map(([key, title, , ds, ser, o]) => '<div class="ls-lane" data-lane="' + key + '"><h3 class="ls-ch-h">' + title + '</h3>' + R.renderTrace(ds, ser.map(v => Array.isArray(v) ? {v} : v), o) + '</div>').join('')
    + (puNote ? '<p class="fine">' + puNote + '</p>' : '') + puChart + '<p class="fine">' + TL.note + ' ' + TL.risk + '</p>';
  // telemetry for the cursor read-out and the CSV export: each series keeps its car (index into cars) or 'cap' (regulation limit)
  const carIdx = s0 => { const m = /ls-line-(\d)/.exec(s0.cls || ''); return m ? +m[1] : s0.cls === 'ls-cap' ? 'cap' : 0; };
  const tel = {len: nP * d.ds, cars: [sel.label].concat(cmpIds.map(k => data.cars[k].label)), lanes: lanes.map(([key, title, unit, ds, ser]) => ({key, title, name: TL.short[key], unit, ds, ser: ser.map(v => Array.isArray(v) ? {v, car: 0} : {v: v.v, car: carIdx(v)})}))};
  // compare table: lap, gap, sectors and speeds of every car, also exported as CSV
  const allIds = [state.carId].concat(cmpIds), allRes = [{r: res, f: fixd}].concat(cmps.map((c, j) => ({r: c, f: cmpFix[j]})));
  const cmpRows = allIds.map((k, j) => { const {r, f} = allRes[j]; return {car: data.cars[k].label, lap: r.lapTime, gap: r.lapTime - res.lapTime, sectors: f.sectors, vmax: r.vMaxKph, vmin: r.vMinKph}; });
  // brakes of the simulated lap: zones, the hardest one next to Brembo's published figures, regen split
  let brakeHtml = '';
  const BD = data.brakes;
  if (BD) {
    const T = BD.text, b = R.brakeZones(track, sel.car, env, res.v, res.limit, {pedalPerG: BD.k, rampS: BD.ramp, minDropKph: 30});
    const real = !sel.series && BD.real ? BD.real[sel.year] || BD.real[2026] || null : null, rh = real && real.real;
    // the zone ending nearest Brembo's corner when there is one, else the hardest
    const cs = real && (d.corners || []).find(c => String(c.number) === String(real.turn)), L = d.length || b.zones.length;
    const dist = z0 => cs ? Math.min(Math.abs(z0.end * track.ds - cs.s), L - Math.abs(z0.end * track.ds - cs.s)) : -z0.meanG;
    let z = b.zones.slice().sort((x, y) => dist(x) - dist(y))[0];
    const cell = (m, r, u, d = 0) => '<td data-no-translate>' + (Number.isFinite(m) ? m.toFixed(d) + ' ' + u : '–') + '</td><td data-no-translate>' + (Number.isFinite(r) ? r + ' ' + u : '–') + '</td>';
    // race already run in this car's season: model values corrected to Brembo's figures (raw kept in the note)
    const bRepro = z && real && BD.real[sel.year] === real ? {vFrom: z.vFrom, vTo: z.vTo, distM: z.distM, timeS: z.timeS, meanG: z.meanG, pedalKg: z.pedalKg, zones: b.zones.length, brakingTime: b.brakingTime} : null;
    if (bRepro) { const m = {vFrom: 'vFrom', vTo: 'vTo', distM: 'distM', timeS: 'timeS', meanG: 'decelG', pedalKg: 'pedalKg'}; z = {...z}; for (const [a, r] of Object.entries(m)) if (Number.isFinite(rh?.[r])) z[a] = rh[r]; }
    const nZones = bRepro && Number.isFinite(real?.lap?.zones) ? real.lap.zones : b.zones.length, bTime = bRepro && Number.isFinite(real?.lap?.brakingTimeS) ? real.lap.brakingTimeS : b.brakingTime;
    const rowsH = z ? [[T.vFrom, z.vFrom, rh?.vFrom, 'km/h'], [T.vTo, z.vTo, rh?.vTo, 'km/h'], [T.dist, z.distM, rh?.distM, 'm'], [T.time, z.timeS, rh?.timeS, 's', 2], [T.g, z.meanG, rh?.decelG, 'g', 1], [T.pedal, z.pedalKg, rh?.pedalKg, 'kg'], [T.bar, z.bar, null, 'bar']].map(([l, m, r, u, d]) => '<tr><td>' + l + '</td>' + cell(m, r, u, d) + '</tr>').join('') : '';
    const lapRows = '<tr><td>' + T.zones + '</td>' + cell(nZones, real?.lap?.zones, '') + '</tr><tr><td>' + T.brakeTime + '</td>' + cell(bTime, real?.lap?.brakingTimeS, 's', 1) + '</tr>';
    const E = b.energy, ax = b.regenAxle ? T.axle[b.regenAxle] : T.noRegen;
    brakeHtml = '<p class="fine">' + T.lead + '</p><div class="output"><table class="ls-table"><thead><tr><th>' + (z && real ? T.hardestT.replace('{t}', real.turn) : T.hardest) + '</th><th>' + T.model + '</th><th>' + T.brembo + (real ? ' ' + sel.year : '') + '</th></tr></thead><tbody>' + rowsH + lapRows + '</tbody></table></div>'
      + (bRepro ? '<p class="fine">' + T.repro.replace('{y}', sel.year).replace('{raw}', [bRepro.vFrom.toFixed(0) + '→' + bRepro.vTo.toFixed(0) + ' km/h', bRepro.distM.toFixed(0) + ' m', bRepro.meanG.toFixed(1) + ' g', bRepro.pedalKg.toFixed(0) + ' kg', bRepro.zones + ' / ' + bRepro.brakingTime.toFixed(1) + ' s'].join(' · ')) + '</p>' : '')
      + '<p class="fine">' + T.split.replace('{f}', E.frontPct.toFixed(0)).replace('{r}', (100 - E.frontPct).toFixed(0)).replace('{ax}', ax).replace('{rk}', E.regenKWh.toFixed(2)).replace('{fk}', E.frictionKWh.toFixed(2)).replace('{dk}', E.dragKWh.toFixed(2)) + '</p>'
      + '<p class="fine">' + T.test.replace('{g}', BD.test.decelG.rmsPct).replace('{kg}', BD.test.pedalKg.rmsPct).replace('{v}', BD.test.vFrom.rmsPct).replace('{t}', (BD.test.lapTimeRampS || BD.test.brakingTimeS).rmsPct).replace('{d}', (BD.test.distRampM || BD.test.distM).rmsPct).replace('{r}', BD.ramp).replace('{n}', BD.test.decelG.n) + '</p><p class="fine">' + T.assume + '</p>';
  }
  // battery estimate along the lap: recovery capped at the per-lap limit, battery clamped to its window
  let socHtml = '';
  const F = res.flow;
  if (F && F.rule !== 'f1-2026' && F.rule !== 'hypercar') socHtml = '<h3>' + t.soc.h + '</h3><p class="fine">' + t.soc.old + '</p>';
  else if (F) {
    const T = t.soc, n = F.dep.length, W = 1000, H = 150, L0 = 48, top = 12, B = 26, win = F.soc, cap = F.recharge ?? Infinity;
    // net energy along the lap (no clamping, so a profile the battery window cannot hold is shown, not hidden)
    const sumB = F.brk.reduce((a, x) => a + x, 0), sumT = F.thr.reduce((a, x) => a + x, 0), {s, s0, mn, mx} = socOf(F), swing = mx - mn, top0 = Math.max(win, s0 + mx), bot0 = Math.min(0, s0 + mn);
    const x = i => (L0 + i / n * (W - L0 - 8)).toFixed(1), y = e => (top + (1 - (e - bot0) / (top0 - bot0)) * (H - top - B)).toFixed(1), pk = Math.max(...F.dep, ...F.brk.map((b, i) => b + F.thr[i]), 1);
    const bars = F.dep.map((e, i) => e > 0 ? '<rect x="' + x(i) + '" y="' + (H - B + 4) + '" width="' + ((W - L0) / n + 0.5).toFixed(1) + '" height="8" fill="#e5484d" opacity="' + (0.25 + 0.75 * e / pk).toFixed(2) + '"/>' : (F.brk[i] + F.thr[i] > 0 ? '<rect x="' + x(i) + '" y="' + (H - B + 4) + '" width="' + ((W - L0) / n + 0.5).toFixed(1) + '" height="8" fill="' + (F.thr[i] > F.brk[i] ? '#f5a524' : '#30a46c') + '" opacity="' + (0.25 + 0.75 * (F.brk[i] + F.thr[i]) / pk).toFixed(2) + '"/>' : '')).join('');
    const svg = '<svg class="ls-soc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + T.h + '"><text x="4" y="' + (+y(win) + 4) + '" font-size="12" fill="currentColor">' + (win / 1e6).toFixed(1) + ' MJ</text><text x="4" y="' + (+y(0) + 4) + '" font-size="12" fill="currentColor">0</text><line x1="' + L0 + '" x2="' + (W - 8) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="currentColor" opacity=".2"/>' + (F.rule === 'hypercar' ? '' : '<line x1="' + L0 + '" x2="' + (W - 8) + '" y1="' + y(win) + '" y2="' + y(win) + '" stroke="currentColor" opacity=".35" stroke-dasharray="6 4"/>') + '<polyline fill="none" stroke="var(--mint)" stroke-width="2.4" points="' + s.map((e, i) => x(i) + ',' + y(e)).join(' ') + '"/>' + bars + '</svg>';
    const M = v => (v / 1e6).toFixed(2), recUsed = Math.min(sumB + sumT, cap);
    socHtml = '<h3>' + T.h + '</h3><p class="fine">' + T.lead + '</p><div class="ls-scroll">' + svg + '</div><p class="ls-key"><span class="ls-key-0"></span>' + T.line + ' <span class="ls-sw" style="background:#e5484d"></span>' + T.dep + ' <span class="ls-sw" style="background:#30a46c"></span>' + T.rec + (sumT > 0 ? ' <span class="ls-sw" style="background:#f5a524"></span>' + T.thr : '') + '</p>'
      + '<p class="fine">' + T.sum.replace('{d}', M(F.dep.reduce((a, x) => a + x, 0))).replace('{r}', M(recUsed)).replace('{b}', M(sumB)).replace('{t}', M(sumT)).replace('{cap}', Number.isFinite(cap) ? T.capT.replace('{c}', M(cap)) : '')
      + ' · ' + (F.rule === 'hypercar' ? T.hyper.replace('{s}', M(swing)) : T.start) + '</p>' + (F.rule === 'hypercar' ? '' : '<p class="fine">' + T.ok.replace('{a}', recUsed <= cap + 1 ? '✓' : '✗').replace('{w}', M(win)).replace('{s}', M(swing)).replace('{b}', swing <= win + 1e4 ? '✓' : '✗ ' + T.over.replace('{x}', M(swing - win))) + '</p>');
  }
  const keyHtml = '<span class="ls-key-0"></span>' + sel.label + cmpIds.map((k, j) => ' <span class="ls-key-' + (j + 1) + '"></span>' + data.cars[k].label).join('');
  // Track evolution: lap over the session from the simulated lap (= end-of-qualifying track state)
  const se = sel.series ? 'wec' : 'f1', ev = Object.assign({type: 'qualifying', tyre: 'slick', useCurve: true}, state.evo || {}); // closed-wheel and FE: the endurance evolution curves
  // tyres the selected car's series really has (no intermediate in WEC); F1 slick named by the race's Pirelli C-numbers
  // supplier by series (owner 2026-11-15): WEC/ELMS/Asian LMS LMGT3 Goodyear, SRO GT World Challenge and DTM Pirelli, IMSA GTD Michelin,
  // Formula E Gen2 Michelin, Gen3 and Gen3 Evo Hankook, Gen4 Bridgestone; Hypercar Michelin
  const ts = !sel.series ? 'f1' : sel.cls === 'lmgt3' || sel.cls === 'gt3-aco' ? 'lmgt3' : sel.cls === 'gt3-sro' || sel.cls === 'gt3-dtm' ? 'pirelli' : sel.cls === 'gt3-imsa' ? 'michelinGt'
    : sel.series === 'fe' ? (sel.cls === 'gen2' ? 'feMichelin' : sel.cls === 'gen4' ? 'bridgestone' : 'hankook') : 'hypercar';
  // WEC: only the slicks Michelin/Goodyear supplied at this event (season of the car, else the latest held here)
  const wy = ts === 'hypercar' || ts === 'lmgt3' ? (data.wecTyres[sel.year] ? sel.year : Object.keys(data.wecTyres).pop()) : null, we = wy ? data.wecTyres[wy][ts] : null;
  const tyres = we ? Object.fromEntries(Object.entries(t.tyres[ts]).filter(([k]) => k === 'wet' || we.dry.includes(k)).map(([k, v]) => [k, v + (we.q === k ? t.tyreQ : '')]))
    : sel.series && ts === 'lmgt3' ? {medium: t.tyres.lmgt3.medium, wet: t.tyres.lmgt3.wet} : t.tyres[ts];
  const tyreNote = ts === 'hypercar' || ts === 'lmgt3' ? (we ? t.tyreEvent.replace('{y}', wy) : t.tyreSeason) : '';
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
    // the car's own season when that qualifying is in the data (reproduced), else the latest real session here
    const yr = QS.real ? (QS.real[sel.year] ? String(sel.year) : Object.keys(QS.real).sort().pop()) : null, R0 = yr ? QS.real[yr] : null, seg = R0 ? R0.seg : [[0, 18], [25, 40], [48, 60]];
    const at = m => 1 + R.evolutionDelta(P, m, Infinity), q3 = at(seg[2][1]), model = seg.map(([, b], k) => res.lapTime * (at(b) / q3 + (k < 2 ? QS.off[k] / 100 : 0)));
    qsBands = seg.map(([a, b], k) => '<rect x="' + ex(Math.min(a, evo.end)).toFixed(1) + '" y="12" width="' + Math.max(0, ex(Math.min(b, evo.end)) - ex(Math.min(a, evo.end))).toFixed(1) + '" height="' + (eh - 40) + '" fill="var(--mint)" opacity=".07"/><text x="' + ex(Math.min(a, evo.end)).toFixed(1) + '" y="24" font-size="11" fill="currentColor">Q' + (k + 1) + '</text>').join('');
    // raced session of this car's season: each segment best reproduces the real one (raw model kept in the note)
    const qsRepro = R0 && String(yr) === String(sel.year) && !sel.series && R0.best.every(Number.isFinite) ? model.slice() : null;
    if (qsRepro) for (let k = 0; k < 3; k++) model[k] = R0.best[k];
    qsHtml = '<div class="output"><table class="ls-table"><thead><tr><th>' + t.qs.h + '</th><th>' + t.qs.win + '</th><th>' + t.qs.model + '</th><th>' + t.qs.real + (yr ? ' ' + yr : '') + '</th></tr></thead><tbody>'
      + seg.map(([a, b], k) => '<tr><td>Q' + (k + 1) + '</td><td data-no-translate>' + a.toFixed(0) + '–' + b.toFixed(0) + '</td><td data-no-translate>' + fmt(model[k]) + '</td><td data-no-translate>' + (R0 ? fmt(R0.best[k]) : '–') + '</td></tr>').join('') + '</tbody></table></div>'
      + (qsRepro ? '<p class="fine">' + t.qs.repro.replace('{y}', yr).replace('{raw}', qsRepro.map(fmt).join(' / ')) + '</p>' : '')
      + '<p class="fine">' + (R0 ? '' : t.qs.none + ' · ') + t.qs.test.replace('{n}', QS.test.events).replace('{a}', QS.test.q1RmsPct).replace('{b}', QS.test.q2RmsPct) + '</p>';
  }
  const evoSvg = '<svg class="ls-race" viewBox="0 0 ' + ew + ' ' + eh + '" role="img" aria-label="' + t.evoChart + '">' + qsBands + '<polyline fill="none" stroke="currentColor" stroke-width="2" points="' + curve.points.map(p => ex(p.minute).toFixed(1) + ',' + ey(p.lap).toFixed(1)).join(' ') + '"/>'
    + '<text x="2" y="16" font-size="11" fill="currentColor">' + fmt(hi) + '</text><text x="2" y="' + (eh - 28) + '" font-size="11" fill="currentColor">' + fmt(lo) + '</text>'
    + '<text x="44" y="' + (eh - 6) + '" font-size="11" fill="currentColor">0</text><text x="' + (ew - 12) + '" y="' + (eh - 6) + '" font-size="11" text-anchor="end" fill="currentColor">' + evo.end + ' ' + t.min + '</text></svg>';
  lineNote += zoneNote;
  return {compassDeg, cmpRows, mapArgs: [d.map || {x: [], y: []}, res.v, mapOpts], driverOpts, tel, lineNote, lap: fmt(res.lapTime), poleHtml: poleHtml + raceHtml, factsHtml, airHtml, kindLabel, mapSvg, traceSvg, keyHtml, windHtml, weather: w, evo, evoFacts, evoSvg, qsHtml, socHtml, brakeHtml, tyreHtml};
}

// Browser controller
function lapsimClient(K, computeView, renderMap, renderTrace, evolutionDelta, evolutionCurve, lineTrack, brakeZones, lapChannels, blendLine, blendOff) {
  const el = document.getElementById('lapsim-data'); if (!el) return;
  const R = {renderMap, renderTrace, evolutionDelta, evolutionCurve, lineTrack, brakeZones, lapChannels, blendLine, blendOff};
  document.querySelectorAll('[data-line-mode]').forEach(b => b.addEventListener('click', () => {
    state.lineMode = b.dataset.lineMode; state.showLine = true; document.querySelectorAll('[data-line-mode]').forEach(o => o.classList.toggle('active', o === b));
    setLine(true); update();
  }));
  // racing line on/off (owner 2026-11-15): hides only the speed-coloured line, the track stays; kept in this browser
  const tg = document.querySelector('[data-line-toggle]'), zb = document.querySelector('[data-ls-zoom]');
  const setLine = on => { if (zb) zb.classList.toggle('ls-noline', !on); if (tg) { tg.classList.toggle('active', on); tg.setAttribute('aria-pressed', String(on)); } try { localStorage.setItem('kb-ls-line', on ? '1' : '0'); } catch (e) {} };
  let lineOn = true; try { lineOn = localStorage.getItem('kb-ls-line') !== '0'; } catch (e) {} setLine(lineOn);
  if (tg) tg.addEventListener('click', () => setLine(tg.getAttribute('aria-pressed') !== 'true'));
  // zoom and pan the map by changing the svg viewBox: the map stays a vector, so it is sharp at any zoom (a CSS scale of the box was
  // drawn from a bitmap and pixelated). Z.x, Z.y: top-left of the view in map units
  const box = document.querySelector('[data-ls-zoom]'), Z = {k: 1, x: 0, y: 0};
  const svgEl = () => box && box.querySelector('svg.ls-map');
  const vb0 = s => { if (!s.dataset.vb) s.dataset.vb = s.getAttribute('viewBox'); return s.dataset.vb.split(' ').map(Number); };
  // smooth zoom and turn (owner 2026-11-15); none under reduced motion
  const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  let tween = 0;
  const apply = anim => {
    const s = svgEl(); if (!s) return; const [, , W, H] = vb0(s);
    Z.k = Math.min(8, Math.max(1, Z.k)); const w = W / Z.k, h = H / Z.k;
    Z.x = Math.min(W - w, Math.max(0, Z.x)); Z.y = Math.min(H - h, Math.max(0, Z.y));
    const to = [Z.x, Z.y, w, h]; box.classList.toggle('is-zoomed', Z.k > 1); cancelAnimationFrame(tween);
    const set = v => { s.setAttribute('viewBox', v.map(x => x.toFixed(1)).join(' ')); reZoom(W / v[2]); };
    if (!anim || still()) { set(to); return; }
    const from = (s.getAttribute('viewBox') || '').split(/\s+/).map(Number), t0 = performance.now(), D = 260;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); set(from.map((x, i) => x + (to[i] - x) * e)); if (k < 1) tween = requestAnimationFrame(step); };
    tween = requestAnimationFrame(step);
  };
  // keep line width, markers and labels readable while zoomed (the map is redrawn on every change)
  function reZoom(k) { if (!box) return; const kk = k || Z.k; box.querySelectorAll('svg.ls-map>g').forEach(g => { g.style.strokeWidth = (Number(g.getAttribute('stroke-width')) / Math.pow(kk, 0.8)).toFixed(2); }); }
  const unit = () => { const s = svgEl(); return s ? vb0(s)[2] / Z.k / Math.max(1, s.clientWidth) : 1; }; // map units per screen pixel
  const zoomAt = (f, cx, cy, anim) => { const s = svgEl(), u = unit(), mx = Z.x + cx * u, my = Z.y + cy * u; Z.k = Math.min(8, Z.k * f); if (Z.k <= 1) { Z.k = 1; Z.x = 0; Z.y = 0; apply(anim); return; } const u2 = s ? vb0(s)[2] / Z.k / Math.max(1, s.clientWidth) : 1; Z.x = mx - cx * u2; Z.y = my - cy * u2; apply(anim); };
  if (box) {
    document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => { const s = svgEl(), w = (s ? s.clientWidth : box.clientWidth) / 2, h = (s ? s.clientHeight : box.clientHeight) / 2; if (b.dataset.zoom === 'fit') { Z.k = 1; Z.x = 0; Z.y = 0; apply(true); } else zoomAt(b.dataset.zoom === 'in' ? 1.6 : 1 / 1.6, w, h, true); }));
    box.addEventListener('wheel', e => { if (!e.ctrlKey && Z.k === 1) return; e.preventDefault(); const r = svgEl().getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); }, {passive: false});
    const pts = new Map(); let pinch = 0;
    box.addEventListener('pointerdown', e => { if (Z.k === 1 && e.pointerType === 'mouse') return; pts.set(e.pointerId, [e.clientX, e.clientY]); box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]); if (pinch) { const r = svgEl().getBoundingClientRect(); zoomAt(d / pinch, (a[0] + c[0]) / 2 - r.left, (a[1] + c[1]) / 2 - r.top); } pinch = d; return; }
      if (Z.k > 1) { const u = unit(); Z.x -= dx * u; Z.y -= dy * u; apply(); e.preventDefault(); }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  }
  const data = JSON.parse(el.textContent);
  const q = s => document.querySelector('[data-ls="' + s + '"]'), evoKeys = Object.values(data.evoOf);
  const yearKey = data.conds['2026'] ? '2026' : Object.keys(data.conds)[0];
  const state = {carId: data.carId, compareId: '', mode: 'real', manual: Object.assign({pressureHpa: 1013, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, data.conds[yearKey] || {}), active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}};
  const sliders = document.querySelectorAll('[data-cond]');
  const syncSliders = () => sliders.forEach(s => { const k = s.dataset.cond, v = state.manual[k]; if (Number.isFinite(v)) s.value = v; const o = document.querySelector('[data-out="' + k + '"]'); if (o) o.textContent = Number(s.value).toFixed(s.step < 1 ? 1 : 0); });
  let pending = false;
  const update = () => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      // options start at the real qualifying's state when this car's season raced here (Brazil 2026: Alt, OT off), else the defaults
      if (state.optCar !== state.carId) { state.optCar = state.carId; const c = data.cars[state.carId], z = !c.series && c.year && data.zones ? data.zones[c.year < 2026 ? '2025' : String(Math.max(2026, ...Object.keys(data.zones).map(Number).filter(k => k >= 2026 && k <= c.year)))] : null, rq = z && z.real && z.year === c.year && c.fix ? z.real : {};
        state.sm = rq.grip === 'low' ? 'alt' : 'normal'; state.ot = rq.ot !== 'off'; state.drs = rq.drs !== 'off';
        if (q('sm')) { q('sm').value = state.sm; q('ot').value = state.ot ? '1' : '0'; q('drs').value = state.drs ? '1' : '0'; } }
      const v = computeView(K, data, state, R); lastTel = v.tel; lastView = v;
      q('lap').textContent = v.lap; q('pole').innerHTML = v.poleHtml; q('facts').innerHTML = v.factsHtml; q('air').innerHTML = v.airHtml;
      q('map').innerHTML = v.mapSvg; apply(); needle(v.compassDeg); q('trace').innerHTML = v.traceSvg; q('soc').innerHTML = v.socHtml; q('brakes').innerHTML = v.brakeHtml; q('key').innerHTML = v.keyHtml; q('wind').innerHTML = v.windHtml;
      { const c = data.cars[state.carId], f1 = !c.series && c.year; if (q('smWrap')) { q('smWrap').hidden = !(f1 && c.year >= 2026); q('otWrap').hidden = !(f1 && c.year >= 2026); q('drsWrap').hidden = !(f1 && c.year < 2026); } }
      q('carLabel').textContent = data.cars[state.carId].label; q('carKind').textContent = v.kindLabel;
      if (q('lineNote')) q('lineNote').textContent = v.lineNote;
      if (q('driver')) { if (q('driver').innerHTML !== v.driverOpts) q('driver').innerHTML = v.driverOpts; q('driverWrap').hidden = !v.driverOpts; }
      q('evoFacts').innerHTML = v.evoFacts; q('evoChart').innerHTML = v.evoSvg; q('qsplit').innerHTML = v.qsHtml; q('tyre').innerHTML = v.tyreHtml;
      lanesUi(); cmpTable(v.cmpRows);
      document.querySelectorAll('[data-evo-out]').forEach(o => { const k = o.dataset.evoOut; o.textContent = v.evo[k]; const i = document.querySelector('input[data-evo="' + k + '"]'); if (i && document.activeElement !== i) i.value = v.evo[k]; });
    });
  };
  if (q('driver')) q('driver').addEventListener('change', e => { state.driver = e.target.value; update(); });
  // map rotation (owner 2026-11-15): ⟲ ⟳ turn the map 15°; the compass needle shows true north; pressing it returns to the first view
  let lastView = null;
  const needle = deg => { const g = document.querySelector('[data-compass] svg g'); if (g && deg != null) g.setAttribute('transform', 'rotate(' + Math.round(deg) + ')'); };
  const turnTo = (newRot, oldRot) => { const s = svgEl(), d = ((oldRot - newRot) % 360 + 540) % 360 - 180; state.mapRot = newRot;
    if (!s || still() || !d) { redrawMap(); return; }
    s.style.transition = 'transform .38s cubic-bezier(.2,.7,.2,1)'; s.style.transformOrigin = '50% 50%'; s.style.transform = 'rotate(' + d + 'deg)';
    const g = document.querySelector('[data-compass] svg g'), n0 = g && /rotate\((-?[\d.]+)\)/.exec(g.getAttribute('transform') || ''); if (g && n0) { g.style.transformBox = 'view-box'; g.style.transform = 'rotate(' + n0[1] + 'deg)'; void g.getBoundingClientRect(); g.style.transition = 'transform .38s cubic-bezier(.2,.7,.2,1)'; g.style.transform = 'rotate(' + (Number(n0[1]) + d) + 'deg)'; }
    setTimeout(() => { if (g) { g.style.transition = ''; g.style.transform = ''; } redrawMap(); }, 390); };
  const redrawMap = () => { if (!lastView) return; const [m, v, o] = lastView.mapArgs, rot = Number.isFinite(state.mapRot) ? state.mapRot : (data.mapRot0 || 0), opts = Object.assign({}, o, {rot});
    Z.k = 1; Z.x = 0; Z.y = 0; q('map').innerHTML = renderMap(m, v, opts); apply();
    if (data.north && !data.north.mirror) needle(((data.north.deg - rot) % 360 + 360) % 360); };
  const curRot = () => Number.isFinite(state.mapRot) ? state.mapRot : (data.mapRot0 || 0);
  document.querySelectorAll('[data-rot]').forEach(b => b.addEventListener('click', () => { const r0 = curRot(); turnTo(r0 - Number(b.dataset.rot), r0); }));
  const cb = document.querySelector('[data-compass]'); if (cb) { if (!data.north || data.north.mirror) cb.title = data.ui.noNorth + ' · ' + cb.title; cb.addEventListener('click', () => { const r0 = curRot(); turnTo(data.mapRot0 || 0, r0); state.mapRot = null; }); }
  // telemetry channels (owner 2026-11-15): tick the lanes to show; the choice is kept in this browser
  let hidden = {}; try { hidden = JSON.parse(localStorage.getItem('kb-ls-hide') || '{}') || {}; } catch (e) { hidden = {}; }
  // lane order (owner 2026-11-15): drag a chip by its grip, or focus the grip and press ← →; kept in this browser
  let order = []; try { order = JSON.parse(localStorage.getItem('kb-ls-order') || '[]') || []; } catch (e) { order = []; }
  const ordered = keys => keys.slice().sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 + keys.indexOf(a) : ia) - (ib < 0 ? 99 + keys.indexOf(b) : ib); });
  const saveOrder = () => { const box = q('chans'); order = [...box.querySelectorAll('.ls-chan input')].map(i => i.value); try { localStorage.setItem('kb-ls-order', JSON.stringify(order)); } catch (e) {} showLanes(); };
  const lanesUi = () => {
    const box = q('chans'); if (!box || !lastTel) return;
    const keys = ordered(lastTel.lanes.map(L => L.key)), names = Object.fromEntries(lastTel.lanes.map(L => [L.key, L.name]));
    if (box.dataset.keys !== keys.join(',')) {
      box.dataset.keys = keys.join(',');
      box.innerHTML = keys.map(k => '<label class="ls-chan"><button type="button" class="ls-grip" aria-label="' + data.ui.move.replace('{c}', names[k]) + '">⠿</button><input type="checkbox" value="' + k + '"' + (hidden[k] ? '' : ' checked') + '><span>' + names[k] + '</span></label>').join('');
      box.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { hidden[i.value] = !i.checked; try { localStorage.setItem('kb-ls-hide', JSON.stringify(hidden)); } catch (e) {} showLanes(); }));
      box.querySelectorAll('.ls-grip').forEach(g => {
        const chip = g.closest('.ls-chan');
        g.addEventListener('click', e => e.preventDefault());
        g.addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp', sib = back ? chip.previousElementSibling : chip.nextElementSibling; if (!sib) return; if (back) sib.before(chip); else sib.after(chip); g.focus(); saveOrder(); });
        // drag the whole chip (owner 2026-11-15): a move of more than 6 px starts a drag, a plain click still toggles the channel
        let dragged = false;
        chip.addEventListener('click', e => { if (dragged) { e.preventDefault(); dragged = false; } });
        chip.addEventListener('pointerdown', e => {
          if (e.button || e.target.matches('input')) return; const x0 = e.clientX, y0 = e.clientY, fromGrip = e.target === g; let on = false; dragged = false;
          if (fromGrip) e.preventDefault();
          const start = () => { on = true; dragged = true; try { chip.setPointerCapture(e.pointerId); } catch (er) {} chip.classList.add('is-drag'); };
          if (fromGrip) start();
          const move = ev => { if (!on) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; start(); } ev.preventDefault(); const over = document.elementFromPoint(ev.clientX, ev.clientY), other = over && over.closest && over.closest('.ls-chan'); if (!other || other === chip || other.parentElement !== box) return; const r = other.getBoundingClientRect(); if (ev.clientX < r.left + r.width / 2) other.before(chip); else other.after(chip); };
          const up = () => { chip.classList.remove('is-drag'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); if (on) saveOrder(); };
          addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
        });
      });
    }
    showLanes();
  };
  const showLanes = () => {
    const tr = q('trace'), keys = ordered((lastTel ? lastTel.lanes : []).map(L => L.key));
    for (const k of keys) { const d = tr.querySelector('[data-lane="' + k + '"]'); if (d) tr.append(d); }
    const rest = [...tr.children].filter(c => !c.matches('[data-lane]') && !c.matches('[data-ls="cursor"]')); rest.forEach(c => tr.append(c));
    tr.querySelectorAll('[data-lane]').forEach(d => { d.hidden = !!hidden[d.dataset.lane]; });
  };
  // CSV downloads (UTF-8 with BOM so spreadsheet apps read Korean names)
  const csvCell = x => { const v = x == null ? '' : String(x); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const download = (name, rows) => { const blob = new Blob(['\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  const slug = x => String(x).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
  if (q('telCsv')) q('telCsv').addEventListener('click', () => {
    if (!lastTel) return; const lanes = ordered(lastTel.lanes.map(L => L.key)).map(k => lastTel.lanes.find(L => L.key === k)).filter(L => !hidden[L.key]); if (!lanes.length) return;
    const step = Math.min(...lanes.map(L => L.ds)), cols = [];
    for (const L of lanes) for (const s0 of L.ser) cols.push({L, s0, h: L.name + (L.unit ? ' (' + L.unit + ')' : '') + ' · ' + (s0.car === 'cap' ? data.ui.cap : lastTel.cars[s0.car])});
    const rows = [[data.ui.dist].concat(cols.map(c => c.h))];
    for (let x = 0; x < lastTel.len; x += step) rows.push([Math.round(x * 10) / 10].concat(cols.map(c => { const a = c.s0.v, y = a[Math.min(a.length - 1, Math.round(x / c.L.ds))]; return Number.isFinite(y) ? +(+y).toFixed(3) : ''; })));
    download('kongboda-telemetry-' + data.id + '-' + lastTel.cars.map(slug).join('_vs_') + '.csv', rows);
  });
  // PNG export (owner 2026-11-15): the shown lanes in their current order, colours read from the page so light and dark both work
  const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'visibility', 'display'];
  const inlineSvg = src => { const c = src.cloneNode(true), a = [src, ...src.querySelectorAll('*')], b = [c, ...c.querySelectorAll('*')];
    a.forEach((el, i) => { const cs = getComputedStyle(el), st = PROPS.map(k => k + ':' + cs.getPropertyValue(k)).join(';'); b[i].setAttribute('style', st); b[i].removeAttribute('class'); }); return c; };
  if (q('telPng')) q('telPng').addEventListener('click', () => {
    const tr = q('trace'), lanes = [...tr.querySelectorAll('[data-lane]')].filter(d => !d.hidden); if (!lanes.length) return;
    const root = getComputedStyle(document.documentElement), bg = root.getPropertyValue('--bg').trim() || '#fff', fg = root.getPropertyValue('--text').trim() || '#000', font = getComputedStyle(tr).fontFamily;
    const W = 1000, head = 34; let y = 44, body = '';
    for (const d of lanes) { const svg = d.querySelector('svg'); if (!svg) continue; const vb = svg.viewBox.baseVal, h = vb.height * W / vb.width, c = inlineSvg(svg);
      c.setAttribute('x', 0); c.setAttribute('y', y + head); c.setAttribute('width', W); c.setAttribute('height', h);
      body += '<text x="8" y="' + (y + 24) + '" font-size="16" font-weight="700" fill="' + fg + '">' + (d.querySelector('h3')?.textContent || '').replace(/[<&]/g, m => m === '<' ? '&lt;' : '&amp;') + '</text>' + new XMLSerializer().serializeToString(c); y += head + h + 8; }
    const title = (q('trace').closest('section')?.querySelector('h2')?.textContent || '') + ' · ' + (lastTel ? lastTel.cars.join(' vs ') : '');
    const all = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + y + '" viewBox="0 0 ' + W + ' ' + y + '" font-family="' + font.replace(/"/g, "'") + '"><rect width="100%" height="100%" fill="' + bg + '"/><text x="8" y="28" font-size="20" font-weight="700" fill="' + fg + '">' + title.replace(/[<&]/g, m => m === '<' ? '&lt;' : '&amp;') + '</text>' + body + '</svg>';
    const img = new Image(), url = URL.createObjectURL(new Blob([all], {type: 'image/svg+xml;charset=utf-8'}));
    img.onload = () => { const k = 2, cv = document.createElement('canvas'); cv.width = W * k; cv.height = y * k; const g = cv.getContext('2d'); g.scale(k, k); g.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'kongboda-telemetry-' + data.id + '-' + (lastTel ? lastTel.cars.map(slug).join('_vs_') : 'lap') + '.png'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); };
    img.onerror = () => URL.revokeObjectURL(url); img.src = url;
  });
  // compare tab: a table of every car (lap, gap, sectors, speeds) with its own CSV
  let lastCmp = [];
  const fmtL = s0 => { if (!Number.isFinite(s0)) return '–'; const m = Math.floor(s0 / 60); return (m ? m + ':' : '') + (s0 - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); };
  const cmpTable = rows => {
    lastCmp = rows || []; const box = q('cmpTable'); if (!box) return; const C = data.ui.cols, hasSec = lastCmp.some(r => r.sectors);
    box.innerHTML = '<table class="ls-table ls-cmp-table"><thead><tr>' + C.filter((_, i) => hasSec || i < 3 || i > 5).map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
      + lastCmp.map((r, j) => '<tr><td><span class="ls-key-' + j + ' ls-key-dot"></span>' + r.car + '</td><td data-no-translate>' + fmtL(r.lap) + '</td><td data-no-translate>' + (j ? (r.gap >= 0 ? '+' : '−') + Math.abs(r.gap).toFixed(3) + ' s' : '–') + '</td>'
        + (hasSec ? [0, 1, 2].map(i => '<td data-no-translate>' + (r.sectors ? r.sectors[i].toFixed(3) : '–') + '</td>').join('') : '') + '<td data-no-translate>' + Math.round(r.vmax) + ' km/h</td><td data-no-translate>' + Math.round(r.vmin) + ' km/h</td></tr>').join('') + '</tbody></table>';
  };
  if (q('cmpCsv')) q('cmpCsv').addEventListener('click', () => {
    if (!lastCmp.length) return; const C = data.ui.cols;
    download('kongboda-compare-' + data.id + '.csv', [[C[0], C[1] + ' (s)', C[2] + ' (s)', C[3] + ' (s)', C[4] + ' (s)', C[5] + ' (s)', C[6] + ' (km/h)', C[7] + ' (km/h)']].concat(lastCmp.map((r, j) => [r.car, +r.lap.toFixed(3), j ? +r.gap.toFixed(3) : 0].concat(r.sectors ? r.sectors.map(x => +x.toFixed(3)) : ['', '', ''], [Math.round(r.vmax), Math.round(r.vmin)]))));
  });
  // compare tab (the tab bar is drawn by simulator-ui.js and sends kb-sim-view): up to two more cars
  const cmpSel = () => state.view === 'compare' ? [q('compare').value, q('compare2') ? q('compare2').value : ''].filter(Boolean) : [];
  document.addEventListener('kb-sim-view', e => {
    state.view = e.detail === 'compare' ? 'compare' : 'lap';
    if (state.view === 'compare' && !q('compare').value) { const opts = [...q('compare').options].filter(o => o.value && o.value !== state.carId), same = opts.find(o => (data.cars[o.value].series || 'f1') === (data.cars[state.carId].series || 'f1')); const pick = same || opts[0]; if (pick) q('compare').value = pick.value; }
    state.compareIds = cmpSel(); update();
  });
  // one cursor across every telemetry lane, with the value of each channel at that distance (like a team data sheet)
  let lastTel = null;
  const tq = q('trace');
  tq.addEventListener('pointermove', e => {
    const sv = lastTel && e.target.closest && e.target.closest('svg.ls-trace'); if (!sv) return;
    const r = sv.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * 1000, f = (vx - 48) / (1000 - 56); if (f < 0 || f > 1) return;
    const at = f * lastTel.len, num = (x, u) => !Number.isFinite(x) ? '–' : u === 's' ? (x >= 0 ? '+' : '') + x.toFixed(2) : u === 'MJ' ? x.toFixed(2) : u === '°' ? x.toFixed(0) : Math.round(x);
    tq.querySelectorAll('.ls-cursor').forEach(l => { l.setAttribute('x1', vx.toFixed(1)); l.setAttribute('x2', vx.toFixed(1)); });
    const out = tq.querySelector('[data-ls="cursor"]');
    if (out) out.innerHTML = '<b>' + Math.round(at) + ' m</b>' + ordered(lastTel.lanes.map(L => L.key)).map(k => lastTel.lanes.find(L => L.key === k)).filter(L => !hidden[L.key]).map(L => '<b>' + L.name + ' ' + L.ser.map(s0 => s0.v).map(a => num(a[Math.min(a.length - 1, Math.round(at / L.ds))], L.unit)).join(' / ') + (L.unit && L.unit !== 's' ? ' ' + L.unit : L.unit) + '</b>').join('');
  });
  q('series').addEventListener('change', e => {
    const se = e.target.value, ids = se === 'gt3' ? Object.keys(data.fam).sort((a, b) => a.localeCompare(b, 'en')).map(b => { const f = data.fam[b]; return f[GT3B.find(x => f[x])].at(-1); })
      : data.carOrder.filter(k => k !== 'wec-lmgt3' && (data.cars[k].series || 'f1') === se && !evoKeys.includes(k));
    q('car').innerHTML = ids.map(k => '<option value="' + k + '">' + (se === 'gt3' ? data.cars[k].base : data.cars[k].label) + '</option>').join('');
    q('car').value = ids[0]; q('car').dispatchEvent(new Event('change'));
  });
  // base car + Evo tick box (enabled only when the data has that Evo entry); the event line follows the car
  const GT3B = ['gt3-sro', 'gt3-imsa', 'gt3-aco', 'gt3-dtm'];
  const pickCar = ev0 => {
    const c0 = data.cars[q('car').value], box = q('evo'), u0 = new URL(location.href);
    q('specWrap').hidden = c0.series !== 'gt3';
    if (c0.series === 'gt3') { // model -> series spec -> kit (newest kit when the model or spec changes)
      const f = data.fam[c0.base], fresh = ev0 && (ev0.target === q('car') || ev0.target === q('spec'));
      let b = q('spec').value; if (!f[b]) b = f[c0.cls] ? c0.cls : GT3B.find(x => f[x]);
      if (!ev0 || ev0.target === q('car')) q('spec').innerHTML = GT3B.filter(x => f[x]).map(x => '<option value="' + x + '"' + (x === b ? ' selected' : '') + '>' + data.bodyLabel[x] + '</option>').join('');
      const l = f[b]; box.disabled = l.length < 2; if (l.length < 2) box.checked = false; else if (fresh) box.checked = true;
      q('evoHint').textContent = l.length < 2 ? data.t.evoNone : ''; state.carId = box.checked ? l.at(-1) : l[0];
      const ev = data.events[state.carId]; q('event').hidden = !ev; q('event').textContent = ev || '';
      u0.searchParams.set('car', state.carId); if (l.length > 1 && !box.checked) u0.searchParams.set('evo', '0'); else u0.searchParams.delete('evo'); history.replaceState(null, '', u0); update(); return;
    }
    const b = q('car').value, e = data.evoOf[b];
    box.disabled = !e; if (!e) box.checked = false; else if (ev0 && ev0.target === q('car')) box.checked = true; // a newly chosen car starts on its newest spec
    q('evoHint').textContent = e ? '' : data.t.evoNone;
    state.carId = e && box.checked ? e : b;
    const ev = data.events[state.carId]; q('event').hidden = !ev; q('event').textContent = ev || '';
    const u = new URL(location.href); u.searchParams.set('car', state.carId); if (e && !box.checked) u.searchParams.set('evo', '0'); else u.searchParams.delete('evo'); history.replaceState(null, '', u); update();
  };
  ['sm', 'ot', 'drs'].forEach(k => { if (q(k)) q(k).addEventListener('change', e => { state[k] = k === 'sm' ? e.target.value : e.target.value === '1'; update(); }); });
  q('car').addEventListener('change', pickCar); q('evo').addEventListener('change', pickCar); q('spec').addEventListener('change', pickCar);
  q('compare').addEventListener('change', () => { state.compareIds = cmpSel(); update(); });
  if (q('compare2')) q('compare2').addEventListener('change', () => { state.compareIds = cmpSel(); update(); });
  // Météo-France forecast (ARPEGE/AROME through Open-Meteo): pick an hour, its weather fills the sliders
  const fc = q('forecast'), FT = fc && fc.dataset.ft ? JSON.parse(fc.dataset.ft) : null;
  const forecast = async () => {
    const [lat, lon] = fc.dataset.ll.split(','); fc.hidden = false; fc.textContent = FT.loading; const det = fc.closest('details'); if (det) det.open = true;
    try {
      const r = await fetch('https://api.open-meteo.com/v1/meteofrance?latitude=' + lat + '&longitude=' + lon + '&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,shortwave_radiation,precipitation&wind_speed_unit=ms&forecast_days=4&timezone=auto');
      const j = await r.json(), H = j.hourly; if (!H || !H.time) throw Error('no data');
      const now = Date.now(), idx = H.time.map((x, i) => i).filter(i => new Date(H.time[i] + 'Z').getTime() - (j.utc_offset_seconds || 0) * 1000 >= now - 3600e3);
      fc.innerHTML = '<label>' + FT.hour + ' <select data-fc-hour>' + idx.map(i => '<option value="' + i + '">' + H.time[i].replace('T', ' ') + (H.precipitation[i] > 0.1 ? ' · ' + FT.rain + ' ' + H.precipitation[i] + ' mm' : '') + '</option>').join('') + '</select></label><p class="fine">' + FT.note + '</p>';
      const pick = i => { Object.assign(state.manual, {airTempC: H.temperature_2m[i], humidityPct: H.relative_humidity_2m[i], pressureHpa: H.surface_pressure[i], windSpeed: H.wind_speed_10m[i], windFromDeg: H.wind_direction_10m[i], trackTempC: Math.round((H.temperature_2m[i] + (FT.a || 0) + FT.k * (H.shortwave_radiation[i] || 0)) * 2) / 2}); syncSliders(); update(); };
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
  if (data.line) update(); // the server drew the least-curvature line; the browser draws this car's own line
}

let scriptText = null;
export function lapsimScript() {
  // powertrain() lives outside lapsimKernel() and simulateLap calls it: it must be in the browser script too
  if (!scriptText) scriptText = '(()=>{const powertrain=' + powertrain.toString() + ';const K=(' + lapsimKernel.toString() + ')();const lapChannels=' + lapChannels.toString() + ';const blendLine=' + blendLine.toString() + ';const blendOff=' + blendOff.toString() + ';const renderMap=' + renderMap.toString() + ';const renderTrace=' + renderTrace.toString() + ';const evolutionDelta=' + evolutionDelta.toString() + ';const evolutionCurve=' + evolutionCurve.toString() + ';const lineTrack=' + lineTrack.toString() + ';const brakeZones=' + brakeZones.toString() + ';const computeView=' + computeView.toString() + ';(' + lapsimClient.toString() + ')(K,computeView,renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff);})();';
  return scriptText;
}
export function lapsimScriptVersion() {
  const text = lapsimScript(); let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

const CSS = `:root{--sim-slow:#ffa94d;--kb-zone:#c4c9ce;--kb-zone-mark:#00d2be}:root[data-theme="light"]{--sim-slow:#245d9c;--kb-zone:#e8b800;--kb-zone-mark:#8a0000}@media(prefers-color-scheme:light){:root:not([data-theme]){--sim-slow:#245d9c;--kb-zone:#e8b800;--kb-zone-mark:#8a0000}}
.ls-hero h1{font-size:44px;max-width:20ch}.ls-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.ls-controls label{min-width:0}.ls-controls select{width:100%}.ls-controls .ls-check{display:flex;align-items:center;gap:8px;flex-wrap:wrap;align-self:end;min-height:44px}.ls-check input{width:18px;height:18px;margin:0}.ls-check input:disabled+span{color:var(--muted)}.ls-check small{color:var(--muted);font-size:13px}.ls-event{margin:8px 0 0}
.ls-stage{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,1fr);gap:40px;align-items:center}.ls-map-wrap{margin:0;display:grid;gap:12px}.ls-map{width:100%;height:auto;max-height:540px;color:var(--text)}
.ls-start{fill:var(--text)}.ls-corner{fill:var(--muted);text-anchor:middle;font-weight:600}
.ls-map-wrap figcaption{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}.ls-legend{order:1;width:120px;height:8px;border-radius:4px;background:linear-gradient(90deg,var(--sim-slow),var(--mint))}.ls-map-wrap figcaption>span:nth-child(3){order:2}.ls-windkey{order:3;margin-left:auto;display:inline-flex;align-items:center;gap:6px}.ls-compass{fill:var(--text)}
.ls-readout{display:grid;gap:6px;align-content:center}.ls-track{font-size:20px;font-weight:700;color:var(--text)}.ls-label{font-size:13px;color:var(--muted)}
.ls-lap{font-size:clamp(56px,7vw,88px);line-height:1;font-weight:800;letter-spacing:-2px;color:var(--mint);font-variant-numeric:tabular-nums}.ls-pole{min-height:1.6em;font-size:14px;color:var(--text);margin-bottom:12px}
.ls-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 18px;margin:0;padding-top:16px;border-top:1px solid var(--line)}.ls-facts dt{font-size:12px;color:var(--muted)}.ls-facts dd{margin:4px 0 0;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text)}
.ls-air-facts{grid-template-columns:repeat(4,minmax(0,1fr));border-top:0;padding-top:0}
.ls-scroll{overflow-x:auto}.ls-trace{width:100%;height:auto;min-width:560px}.ls-grid{stroke:var(--line)}.ls-sector{stroke:var(--muted);stroke-dasharray:4 4;opacity:.6}.ls-cline{stroke:var(--muted);stroke-dasharray:2 3;opacity:.35}.ls-risk{fill:#e5484d;opacity:.12}.ls-alt{fill:#f5a524;opacity:.14}.ls-cap{stroke:var(--muted);stroke-dasharray:5 4;stroke-width:1.4}.ls-driver select{min-height:36px}.ls-cursor{stroke:var(--text);stroke-width:1;opacity:.6}.ls-cursor-read{position:sticky;top:0;z-index:1;background:var(--bg,#111);padding:6px 0;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}.ls-cursor-read b{color:var(--text);font-weight:600;margin-right:10px}.ls-ctag{font-size:11px}.ls-ch-h{font-size:14px;margin:14px 0 2px;color:var(--muted)}.ls-axis{fill:var(--muted);font-size:13px}
.ls-line{fill:none;stroke-width:2.4;stroke-linejoin:round}.ls-line-0{stroke:var(--mint)}.ls-line-1{stroke:var(--sim-slow);stroke-dasharray:6 4}
.ls-key{font-size:13px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ls-key span{display:inline-block;width:22px;height:3px;border-radius:2px}.ls-key-0{background:var(--mint)}.ls-sw{display:inline-block;width:14px;height:8px;border-radius:2px;margin-left:8px}.ls-soc{width:100%;height:auto}.ls-key-1{background:var(--sim-slow)}
.ls-sliders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px}.ls-slider{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,2fr) 52px 36px;align-items:center;gap:10px;min-width:0}.ls-slider input{min-height:32px;padding:0;accent-color:var(--mint);border:0;background:none}.ls-slider output{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}.ls-unit{font-size:12px;color:var(--muted)}
.ls-strength{max-width:520px;grid-template-columns:minmax(110px,1fr) minmax(0,2fr) 52px}
.ls-changes{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ls-change label{display:flex;gap:12px;align-items:flex-start;color:var(--text);font-size:14px;min-width:0}.ls-change input{width:20px;height:20px;min-height:0;margin-top:2px;accent-color:var(--mint)}.ls-change small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.ls-change.is-info label{color:var(--muted)}.ls-dot{width:20px;flex:0 0 20px;text-align:center}.ls-dot::before{content:'·'}
.ls-table td,.ls-table th{white-space:nowrap}.ls-notes{margin:0;padding-left:20px;display:grid;gap:10px;line-height:1.7;color:var(--muted);max-width:80ch}.ls-panel h3{font-size:18px;margin-top:6px}

.ls-surf{fill:color-mix(in oklab,var(--mint) 35%,transparent);stroke:none}.ls-kerb-w{fill:none;stroke:#fff;stroke-width:1.5}.ls-kerb{fill:none;stroke:#e5484d;stroke-dasharray:2.5 2.5;stroke-width:1.5}.ls-zoombox{overflow:hidden;position:relative;touch-action:pan-y;border-radius:12px}.ls-zoombox.is-zoomed{touch-action:none;cursor:grab}.ls-line-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}.ls-zoom-btns{margin-left:auto;display:inline-flex;flex-wrap:wrap;gap:6px;max-width:100%}.ls-map .ls-mk{stroke:#fff;transform-box:fill-box;transform-origin:center;scale:var(--inv,1)}.ls-zoombox text{transform-box:fill-box;transform-origin:center;scale:var(--inv,1)}.ls-map .ls-band{fill:#e6e8ea;stroke:none}:root[data-theme="light"] .ls-band{fill:#1f1f1f}@media(prefers-color-scheme:light){:root:not([data-theme]) .ls-band{fill:#1f1f1f}}
.ls-mk-b{fill:#e5484d}.ls-mk-a{fill:#f5a524}.ls-mk-t{fill:#30a46c}.ls-line-key [class^=ls-mk]{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 10px;vertical-align:middle}.ls-line-key [class^=ls-mk]:first-child{margin-left:0}.ls-line-key .ls-mk-b{background:#e5484d}.ls-line-key .ls-mk-a{background:#f5a524}.ls-line-key .ls-mk-t{background:#30a46c}
.ls-evo .ls-controls{grid-template-columns:repeat(3,minmax(0,1fr));margin:12px 0 16px}.ls-check{display:flex;align-items:center;gap:8px;align-self:end;min-height:40px}.ls-check input{width:20px;height:20px;min-height:0;accent-color:var(--mint)}.ls-evo .ls-facts{margin-top:16px}
.ls-line-2{stroke:var(--text);stroke-dasharray:2 3}.ls-zone{fill:none;stroke-linecap:round;opacity:.9}.ls-zone-drs,.ls-zone-sm{stroke:var(--kb-zone)}.ls-zone-t{fill:var(--text);font-weight:700;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:var(--bg);stroke-width:3px}.ls-zone-m{stroke:var(--kb-zone-mark)}.ls-zone-m-act{stroke:var(--kb-zone)}.ls-zone-mt{fill:var(--kb-zone-mark);font-weight:700;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:var(--bg);stroke-width:3px}.ls-key-2{background:var(--text)}.ls-key-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;vertical-align:middle}
main:not(.kb-cmp-view) .ls-cmp-only{display:none!important}
.ls-export{display:inline-flex;gap:6px;flex-wrap:wrap}.ls-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.ls-panel-head h2{margin:0}.ls-panel-head .pill{min-height:44px}
.ls-chans{display:flex;flex-wrap:nowrap;gap:6px;margin:12px 0 4px;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}.ls-chan{display:inline-flex;flex:0 0 auto;min-width:0;align-items:center;gap:6px;min-height:40px;padding:0 12px;white-space:nowrap;touch-action:pan-x;border:1px solid var(--line);border-radius:999px;font-size:14px;color:var(--text);cursor:pointer;user-select:none}.ls-chan input{width:18px;height:18px;margin:0;accent-color:var(--mint)}.ls-chan:has(input:not(:checked)){color:var(--muted)}
.ls-lane[hidden]{display:none}.ls-grip{border:0;background:none;color:var(--muted);font-size:16px;line-height:1;padding:6px 2px;min-width:24px;min-height:32px;cursor:grab;touch-action:none}.ls-chan.is-drag{border-color:var(--mint);opacity:.85;cursor:grabbing}.ls-chan{padding-left:6px}.ls-cmp-table td:first-child{white-space:normal;min-width:10ch}
.ls-noline .ls-line-seg{visibility:hidden}.ls-line-bar .pill{min-height:44px}.ls-line-bar .ls-icon{min-width:44px;padding:0 10px;justify-content:center;font-size:18px;line-height:1}.ls-compass-btn svg{display:block}.ls-needle{color:var(--text)}
@media(max-width:900px){.ls-stage{grid-template-columns:1fr;gap:24px}.ls-hero h1{font-size:32px}.ls-controls{grid-template-columns:1fr 1fr}.ls-air-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.ls-sliders{grid-template-columns:1fr}}
@media(max-width:520px){.ls-controls{grid-template-columns:1fr}.ls-facts{grid-template-columns:1fr 1fr}.ls-slider{grid-template-columns:1fr 52px 36px}.ls-slider>span:first-child{grid-column:1/-1}}`;
