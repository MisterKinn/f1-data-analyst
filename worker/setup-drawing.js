// Setup simulator drawings: a generic (unbranded) 2026 F1 car and a generic Le Mans Hypercar seen from the
// side, front and rear, with leader lines from each set-up item to a label carrying its value.
// Hypercar shapes are simple original outlines. F1 uses the owner's cut-out drawings of the 2026 and 2025 cars
// (/assets/f1-2026|2025/<view>.webp, owner 2026-11-15) in place of the earlier hand-drawn outline.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const SHAPES = {
  f1: {
    side: `<line x1="10" y1="215" x2="630" y2="215" class="g"/><image href="/assets/f1-2026/side.webp" x="10" y="74" width="620" height="141" preserveAspectRatio="xMidYMax meet"/>`,
    front: `<line x1="10" y1="215" x2="350" y2="215" class="g"/><image href="/assets/f1-2026/front.webp" x="48" y="50" width="265" height="165" preserveAspectRatio="xMidYMax meet"/>`,
    rear: `<line x1="10" y1="215" x2="350" y2="215" class="g"/><image href="/assets/f1-2026/rear.webp" x="48" y="50" width="265" height="165" preserveAspectRatio="xMidYMax meet"/>`,
  },
  'f1-2025': {
    side: `<line x1="10" y1="215" x2="630" y2="215" class="g"/><image href="/assets/f1-2025/side.webp" x="10" y="80" width="620" height="135" preserveAspectRatio="xMidYMax meet"/>`,
    front: `<line x1="10" y1="215" x2="350" y2="215" class="g"/><image href="/assets/f1-2025/front.webp" x="34" y="50" width="292" height="165" preserveAspectRatio="xMidYMax meet"/>`,
    rear: `<line x1="10" y1="215" x2="350" y2="215" class="g"/><image href="/assets/f1-2025/rear.webp" x="35" y="50" width="290" height="165" preserveAspectRatio="xMidYMax meet"/>`,
  },
  hypercar: {
    side: `<line x1="10" y1="215" x2="630" y2="215" class="g"/>
<path class="b" d="M18 196 Q24 160 110 150 L225 140 Q280 98 340 98 Q392 100 412 134 L560 138 Q598 146 606 168 L606 198 L18 200 Z"/>
<path class="d" d="M240 138 Q290 104 340 104 Q380 106 398 134" fill="none"/><path class="d" d="M18 202 L606 202"/>
<rect class="w" x="532" y="70" width="84" height="10" rx="3"/><rect class="w" x="612" y="62" width="6" height="40"/><path class="d" d="M560 80 Q556 110 548 138" fill="none"/>
<polyline class="s" points="170,160 186,150 192,156 198,146 204,152 210,142 226,136"/>
<circle class="t" cx="150" cy="178" r="38"/><circle class="h" cx="150" cy="178" r="15"/><circle class="t" cx="500" cy="176" r="40"/><circle class="h" cx="500" cy="176" r="16"/>`,
    front: `<line x1="10" y1="215" x2="350" y2="215" class="g"/>
<rect class="t" x="40" y="140" width="52" height="75" rx="9" transform="rotate(-3 66 215)"/><rect class="t" x="268" y="140" width="52" height="75" rx="9" transform="rotate(3 294 215)"/>
<path class="b" d="M28 196 L36 132 Q60 120 110 120 L140 92 Q180 70 220 92 L250 120 Q300 120 324 132 L332 196 Z"/><path class="d" d="M140 92 Q180 78 220 92 L230 118 L130 118 Z" fill="none"/>
<line class="s" x1="110" y1="150" x2="250" y2="150"/><circle class="h" cx="110" cy="150" r="5"/><circle class="h" cx="250" cy="150" r="5"/><rect class="w" x="34" y="198" width="292" height="6" rx="2"/>`,
    rear: `<line x1="10" y1="215" x2="350" y2="215" class="g"/>
<rect class="t" x="36" y="140" width="58" height="75" rx="9"/><rect class="t" x="266" y="140" width="58" height="75" rx="9"/>
<path class="b" d="M26 198 L32 130 Q70 116 120 116 L146 92 Q180 76 214 92 L240 116 Q290 116 328 130 L334 198 Z"/>
<rect class="w" x="30" y="58" width="300" height="12" rx="4"/><rect class="w" x="26" y="50" width="7" height="34"/><rect class="w" x="327" y="50" width="7" height="34"/><line class="d" x1="150" y1="70" x2="160" y2="96"/><line class="d" x1="210" y1="70" x2="200" y2="96"/>
<path class="w" d="M96 212 L264 212 L246 190 L114 190 Z"/><circle class="s" cx="180" cy="160" r="13"/>`,
  },
};

// [view, knob, label box x,y, anchor x,y, label override key]
const CALLOUTS = {
  f1: [
    ['side', 'aero', 8, 8, 34, 190, 'frontWing'], ['side', 'springs', 150, 8, 171, 143], ['side', 'dampers', 292, 8, 215, 136], ['side', 'aero', 470, 8, 598, 106, 'rearWing'],
    ['side', 'brakeCooling', 40, 236, 140, 164], ['side', 'rideHeight', 250, 236, 326, 206], ['side', 'diff', 460, 236, 540, 171],
    ['front', 'camber', 8, 8, 71, 150, 'tyreF'], ['front', 'rollBalance', 200, 8, 180, 128], ['front', 'aero', 120, 236, 180, 190, 'frontWing'],
    ['rear', 'aero', 8, 8, 120, 70, 'rearWing'], ['rear', 'camber', 222, 8, 289, 150, 'tyreR'], ['rear', 'diff', 8, 236, 180, 152], ['rear', 'rideHeight', 222, 236, 180, 186, 'diffuser'],
  ],
  'f1-2025': [],
  hypercar: [
    ['side', 'rideHeight', 8, 8, 40, 196, 'splitter'], ['side', 'springs', 150, 8, 200, 142], ['side', 'dampers', 292, 8, 214, 150], ['side', 'aero', 470, 8, 574, 74, 'rearWing'],
    ['side', 'brakeCooling', 40, 236, 150, 178], ['side', 'rideHeight', 250, 236, 330, 208], ['side', 'diff', 460, 236, 500, 176],
    ['front', 'camber', 8, 8, 66, 160, 'tyreF'], ['front', 'rollBalance', 200, 8, 180, 150], ['front', 'tc', 120, 236, 180, 105, 'tc'],
    ['rear', 'aero', 8, 8, 100, 64, 'rearWing'], ['rear', 'camber', 222, 8, 296, 160, 'tyreR'], ['rear', 'diff', 8, 236, 180, 160], ['rear', 'rideHeight', 222, 236, 180, 202, 'diffuser'],
  ],
};
const NAMES = {frontWing: ['앞날개', 'Front wing'], rearWing: ['리어윙', 'Rear wing'], tyreF: ['앞 타이어', 'Front tyre'], tyreR: ['뒤 타이어', 'Rear tyre'], diffuser: ['디퓨저·뒤 차고', 'Diffuser / rear height'],
  splitter: ['스플리터·앞 차고', 'Splitter / front height'], tc: ['트랙션 컨트롤', 'Traction control'], aero: ['공력', 'Aero'], springs: ['스프링', 'Springs'], dampers: ['댐퍼', 'Dampers'],
  brakeCooling: ['브레이크 덕트', 'Brake ducts'], rideHeight: ['차고', 'Ride height'], diff: ['디퍼렌셜', 'Differential'], rollBalance: ['안티롤바', 'Anti-roll bars'], camber: ['캠버·공기압', 'Camber & pressure']};
const VIEW = {side: ['옆', 'Side'], front: ['앞', 'Front'], rear: ['뒤', 'Rear']};

export const drawingCss = `.su-views{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin:8px 0 16px}.su-views figure{margin:0;border:1px solid var(--line);border-radius:12px;padding:8px}
.su-views figcaption{font-size:13px;color:var(--muted);margin:0 0 4px}.su-views svg{width:100%;height:auto;display:block}
.su-views .b{fill:var(--surface);stroke:var(--text);stroke-width:2}.su-views .d{stroke:var(--text);stroke-width:2;fill:none;opacity:.7}.su-views .w{fill:var(--mint);opacity:.85}
.su-views .t{fill:var(--text);opacity:.85}.su-views .h{fill:var(--bg)}.su-views .s{stroke:var(--mint);stroke-width:3;fill:none}.su-views .g{stroke:var(--muted);stroke-dasharray:4 4}
.su-views .cl{stroke:var(--muted);stroke-width:1}.su-views .cd{fill:var(--mint)}.su-views .lb{fill:var(--bg);stroke:var(--line)}.su-views .ln{font-size:11px;fill:var(--muted)}.su-views .lv{font-size:12px;font-weight:700;fill:var(--text)}
@media(max-width:900px){.su-views{grid-template-columns:1fr 1fr}.su-views figure:first-child{grid-column:1/-1}}`;

// value: function (knobKey, labelKey) -> short string
export function carViews(kind, value, L) {
  const fig = view => {
    const w = view === 'side' ? 640 : 360, items = (CALLOUTS[kind] || []).filter(c => c[0] === view);
    const marks = (items || []).map(([, k, bx, by, ax, ay, lk]) => {
      const bw = 120, bh = 40, cx = Math.min(Math.max(ax, bx), bx + bw), cy = by < 100 ? by + bh : by;
      const v = value(k, lk); if (v == null) return '';
      return `<line class="cl" x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}"/><circle class="cd" cx="${ax}" cy="${ay}" r="4"/>
<rect class="lb" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6"/><text class="ln" x="${bx + 6}" y="${by + 15}">${esc(NAMES[lk || k][L])}</text><text class="lv" x="${bx + 6}" y="${by + 32}">${esc(v)}</text>`;
    }).join('');
    return `<figure><figcaption>${esc(VIEW[view][L])}</figcaption><svg viewBox="0 0 ${w} 290" role="img" aria-label="${esc(VIEW[view][L])}">${SHAPES[kind][view]}${marks}</svg></figure>`;
  };
  return `<div class="su-views">${fig('side')}${fig('front')}${fig('rear')}</div>`;
}
