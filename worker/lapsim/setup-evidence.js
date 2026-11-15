// Published facts the setup simulator shows next to its own estimates (read 2026-11-15).
// Kept apart from the physics so an estimate is never presented as a fact.

const FIA = 'https://www.fia.com/system/files/decision-document/';
const pirelliDoc = (slug, v = '') => `${FIA}2026_${slug}_grand_prix_-_competition_notes_-_pirelli_preview${v}.pdf`;

// F1 2026 Pirelli prescriptions for slicks (FIA "Pirelli Preview", Sporting Regulations B6.1.3 a)):
// compounds, minimum starting pressure front/rear [psi], camber limit front/rear [deg]; i = the same for intermediates.
export const PIRELLI_2026 = {
  melbourne: {c: 'C3·C4·C5', p: [28.5, 26.0], cam: [-3.25, -1.75], i: {p: [29.0, 28.0], cam: [-3.5, -2.25]}, url: `${FIA}2026_australian_grand_prix_-_event_notes_-_pirelli_preview_v2.pdf`},
  shanghai: {c: 'C2·C3·C4', p: [26.5, 24.5], cam: [-3.0, -1.75], i: {p: [27.5, 28.0], cam: [-3.25, -2.25]}, url: pirelliDoc('chinese')},
  suzuka: {c: 'C1·C2·C3', p: [28.0, 26.0], cam: [-2.75, -1.5], i: {p: [28.5, 28.0], cam: [-3.0, -2.0]}, url: pirelliDoc('japanese', '_v2')},
  miami: {c: 'C3·C4·C5', p: [26.5, 26.5], cam: [-3.0, -1.75], i: {p: [28.5, 28.5], cam: [-3.25, -2.25]}, url: pirelliDoc('miami', '_v2')},
  montreal: {c: 'C3·C4·C5', p: [25.5, 26.0], cam: [-3.25, -2.0], i: {p: [26.5, 27.0], cam: [-3.5, -2.5]}, url: pirelliDoc('canadian')},
  'monte-carlo': {c: 'C3·C4·C5', p: [24.0, 23.0], cam: [-3.25, -2.25], i: {p: [23.0, 23.0], cam: [-3.25, -2.25]}, url: pirelliDoc('monaco')},
  catalunya: {c: 'C2·C3·C4', p: [25.0, 24.0], cam: [-3.0, -1.75], i: {p: [25.5, 25.0], cam: [-3.0, -2.0]}, url: pirelliDoc('barcelona-catalunya', '_v2')},
  spielberg: {c: 'C3·C4·C5', p: [24.0, 24.0], cam: [-3.0, -1.75], i: {p: [26.0, 26.0], cam: [-3.25, -2.25]}, url: pirelliDoc('austrian')},
  silverstone: {c: 'C1·C2·C3', p: [28.0, 26.0], cam: [-2.75, -1.5], i: {p: [28.0, 26.0], cam: [-3.0, -1.75]}, url: pirelliDoc('british')},
  'spa-francorchamps': {c: 'C2·C3·C4', p: [28.0, 28.0], cam: [-2.75, -1.5], i: {p: [29.5, 27.5], cam: [-3.0, -2.0]}, url: pirelliDoc('belgian')},
  hungaroring: {c: 'C3·C4·C5', p: [24.0, 23.0], cam: [-3.25, -2.0], i: {p: [25.0, 24.5], cam: [-3.5, -2.5]}, url: pirelliDoc('hungarian')},
  zandvoort: {c: 'C2·C3·C4', p: [26.0, 25.0], cam: [-2.75, -1.5], i: {p: [27.5, 26.5], cam: [-3.0, -2.0]}, url: pirelliDoc('dutch')},
  monza: {c: 'C3·C4·C5', p: [26.0, 26.0], cam: [-3.0, -2.0], i: {p: [28.0, 28.0], cam: [-3.25, -2.5]}, url: pirelliDoc('italian')},
  madring: {c: 'C2·C3·C4', p: [26.5, 25.5], cam: [-2.75, -1.5], i: {p: [28.0, 26.5], cam: [-3.0, -2.0]}, url: pirelliDoc('spanish')},
  baku: {c: 'C3·C4·C5', p: [27.5, 27.5], cam: [-3.0, -1.75], i: {p: [28.5, 28.5], cam: [-3.25, -2.25]}, url: pirelliDoc('azerbaijan')},
  singapore: {c: 'C3·C4·C5', p: [24.0, 23.0], cam: [-3.25, -2.0], i: {p: [25.0, 24.0], cam: [-3.5, -2.5]}, url: pirelliDoc('singapore')},
  austin: {c: 'C2·C3·C4', p: [26.5, 25.5], cam: [-3.0, -1.75], i: {p: [28.0, 26.5], cam: [-3.25, -2.25]}, url: pirelliDoc('united_states')},
  'mexico-city': {c: 'C3·C4·C5', p: [25.5, 24.5], cam: [-3.0, -1.75], i: {p: [27.5, 26.5], cam: [-3.25, -2.0]}, url: pirelliDoc('mexico_city')},
  interlagos: {c: 'C3·C4·C5', p: [27.0, 26.5], cam: [-3.0, -1.75], i: {p: [28.0, 27.5], cam: [-3.25, -2.25]}, url: pirelliDoc('sao_paulo')},
};
// season range of the prescriptions above (for the knob position)
export const PIRELLI_RANGE = (() => { const v = Object.values(PIRELLI_2026); const f = v.map(x => x.p[0]), c = v.map(x => x.cam[0]);
  return {pMin: Math.min(...f), pMax: Math.max(...f), camMin: Math.min(...c), camMax: Math.max(...c)}; })();

// 2026 straight-mode (active aero) zones per circuit, as announced by the FIA (PlanetF1 list, Sept 2026).
// Monaco has none: no active aero at all there.
export const SM_ZONES = {melbourne: 5, shanghai: 4, suzuka: 2, miami: 3, montreal: 3, 'monte-carlo': 0, catalunya: 4, spielberg: 4,
  silverstone: 4, 'spa-francorchamps': 5, hungaroring: 4, zandvoort: 2, monza: 4};
export const SM_SOURCE = 'https://www.planetf1.com/news/italian-grand-prix-2026-fia';

// Brembo braking-difficulty index (1 easy – 5 very hard), as quoted by the press with the year.
export const BREMBO = {
  montreal: {i: 4, y: 2023, url: 'https://thebrakereport.com/canadian-gp-challenges-brakes/'},
  'mexico-city': {i: 4, y: 2023, url: 'https://thebrakereport.com/mexico-city-gp-brembo-details-brake-challenges/'},
  'spa-francorchamps': {i: 4, y: 2023, url: 'https://thebrakereport.com/spa-f1-circuit-tough-on-brakes/'},
  sakhir: {i: 4, y: 2025, url: 'https://www.f1-fansite.com/?p=306192'},
  'monte-carlo': {i: 3, y: 2025, url: 'https://f1grandprix.motorionline.com/en/f1-gp-monaco-la-carta-didentita-dello-stradale-di-monte-carlo-secondo-brembo/'},
  hungaroring: {i: 3, y: 2023, url: 'https://thebrakereport.com/brembo-rates-hungaroring-a-3-in-braking-difficulty/'},
  spielberg: {i: 3, y: 2023, url: 'https://thebrakereport.com/austrian-gp-braking-challenges/'},
  catalunya: {i: 3, y: 2020, url: 'https://www.velocitynews.co.nz/the-2020-hungarian-grand-prix-according-to-brembo'},
  miami: {i: 2, y: 2026, url: 'https://f1.newsauto.it/en/formula-1/f1-miami-2026-oversized-brakes-between-brembo-history-and-new-engineering-challenges-13446'},
  zandvoort: {i: 2, y: 2023, url: 'https://thebrakereport.com/brembo-dutch-grand-prix-easy-on-brakes/'},
  suzuka: {i: 1, y: 2023, url: 'https://www.conceptcarz.com/u51615/brembo-formula-1-suzuka-grand-prix.aspx'},
  silverstone: {i: 1, y: 2023, url: 'https://www.conceptcarz.com/u51615/brembo-formula-1-suzuka-grand-prix.aspx'},
};

// What the technical press reported about wing level (F1) per circuit. level: 0 low – 1 max downforce.
export const F1_PRESS = {
  monza: {level: 0.05, ko: '전통적으로 시즌 최저 다운포스 윙. 2026년엔 액티브 에어로 덕분에 타협이 덜 극단적이라 페라리는 몬자 전용 리어윙을 따로 만들지 않음', en: 'Traditionally the lowest-downforce wing of the year; in 2026 active aero makes the compromise less extreme and Ferrari built no bespoke Monza rear wing',
    url: 'https://www.the-race.com/formula-1/everything-ferraris-changing-to-try-to-win-at-monza/'},
  baku: {level: 0.2, ko: '몬자처럼 직선 속도가 성능의 큰 몫 — 팀들이 저드래그 윙 여러 개를 가져와 비교', en: 'Like Monza, straight-line speed is a big part of performance; teams bring several low-drag wings',
    url: 'https://www.the-race.com/formula-1/how-each-active-f1-rear-wing-concept-works-gary-anderson-explains/'},
  'las-vegas': {level: 0.2, ko: '윙 레벨 선택이 승부를 가른 서킷(직선 위주, 저온)', en: 'Wing level decided races here (long straights, cold track)',
    url: 'https://www.formula1.com/en/latest/article/tech-tuesday-did-ferraris-qualifying-gamble-on-rear-wing-levels-cost-them-a.4MtmviBaGUVierJmqPLGYn'},
  'monte-carlo': {level: 1, ko: '2026년 유일하게 스트레이트 모드(액티브 에어로) 구간이 없음 — 최대 다운포스 윙에, 액추에이터 자리를 작은 윙렛으로 바꾼 팀도 있음', en: 'The only 2026 track with no straight-mode zone; max-downforce wings, some teams fitted winglets where the actuator sits',
    url: 'https://racer.com/2026/06/04/how-f1-teams-exploit-monaco-rules-with-quirky-rear-wing-additions'},
  hungaroring: {level: 0.9, ko: '느린 트랙 — 트랙션과 제동 안정성이 핵심(피렐리)', en: 'Slow track where traction and braking stability matter most (Pirelli)',
    url: 'https://www.formula1.com/en/latest/article/what-tyres-will-the-teams-and-drivers-have-for-the-2026-hungarian-grand-prix.RikSxOCPXMkPloK0RRmqQ'},
  singapore: {level: 0.95, ko: '모나코·헝가리와 비슷한 고다운포스 윙이 일반적', en: 'High-downforce wings similar to Monaco and Hungary are the norm',
    url: 'https://www.autosport.com/f1/news/how-mclarens-rear-wing-choice-again-caught-attention-in-singapore/10658076/'},
  'mexico-city': {level: 1, ko: '해발 2,240m — 공기가 약 20% 희박해 최대 다운포스 윙을 달아도 실제 다운포스는 적음', en: '2,240 m altitude: air about 20 % thinner, so even a max-downforce wing gives little downforce', url: null},
  spielberg: {level: 0.5, ko: '고저차·급제동이 있는 스톱 앤 고 레이아웃, 내리막 제동에서 앞 타이어 주의(피렐리)', en: 'Stop-and-go layout with elevation and heavy braking; watch the front axle in downhill braking (Pirelli)',
    url: 'https://www.formula1.com/en/latest/article/what-tyres-will-the-teams-and-drivers-have-for-the-2026-austrian-grand-prix.2bhUStvp9xxGLpN2gvTeib'},
  madring: {level: 0.6, ko: '노면이 매우 매끄러워 그립이 낮은 편, 뱅크 코너 T12(피렐리)', en: 'Very smooth asphalt with low grip, banked Turn 12 (Pirelli)',
    url: 'https://www.formula1.com/en/latest/article/what-tyres-will-the-teams-and-drivers-have-for-the-2026-spanish-grand-prix.2vlcVOBnZUFRCooVcqWG7n'},
};

// Hypercar: what the rules and the press say about set-up freedom
export const HYPERCAR_PRESS = [
  {ko: '모든 차는 FIA 풍동에서 같은 맵으로 측정해 좁은 공력 성능 창(드래그·다운포스) 안에 들어가야 함 — 드래그를 줄이거나 다운포스를 늘리는 개발이 아니라 창을 맞추는 개발', en: 'Every car is measured in the FIA wind tunnel and must sit in a narrow aero window; development targets the window, not less drag or more downforce',
    url: 'https://www.motorsport.com/wec/news/insights-how-toyota-has-updated-its-hypercar-for-wec-2026/10790991/'},
  {ko: '르망을 포함해 시즌 내내 차체 사양은 하나 — 예전 LMP1처럼 르망 전용 저드래그 키트가 없음', en: 'One bodywork for the whole season including Le Mans; no Le Mans low-drag kit as in LMP1 days',
    url: 'https://www.pmw-magazine.com/features/le-mans-100-hypercar-technical-preview.html'},
  {ko: '조절 가능한 공력 장치 하나(리어윙 등)의 어느 위치에서도 창 안에 있어야 하고, 차고·롤·피치에 따른 공력 변화가 실제 성능 차이를 만듦', en: 'Every setting of the single adjustable device must stay in the window; how aero changes with ride height, roll and pitch is where performance hides',
    url: 'https://pmw-magazine.com/features/tech-insight-le-mans-hypercar-bop-analysis.html'},
  {ko: '알핀 A424는 르망용 저드래그·저다운포스 콘셉트였는데 듀얼 밴드 BoP로 장점이 상쇄되어 2026년 에보 조커를 공력에 사용', en: 'Alpine’s low-drag A424 lost its edge to the dual-band BoP and used its 2026 Evo joker on aero',
    url: 'https://www.the-race.com/endurance/what-we-know-alpine-2026-wec-hypercar-breaks-cover/'},
];

// Air density check (Wolfram StandardAtmosphereData, ISA 15 °C): Mexico City 2,240 m ≈ 0.983 kg/m³, −19.8 % vs sea level.
export const ALTITUDE_NOTE = {'mexico-city': -19.8, interlagos: -7.1, spielberg: -6.3, 'las-vegas': -5.8, madring: -6.1};
