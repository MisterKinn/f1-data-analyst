// Setup simulator drawings: a generic (unbranded) 2026 F1 car and a generic Le Mans Hypercar seen from the
// side, front and rear, with leader lines from each set-up item to a label carrying its value.
// Shapes are simple original outlines, not any team's car.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const SHAPES = {
  f1: {
    side: `<line x1="10" y1="215" x2="630" y2="215" class="g"/>
<path class="b" d="M20 186 L120 176 L200 164 L255 146 L300 138 L322 108 L352 104 L372 130 L470 134 L540 140 L558 160 L558 188 L470 198 L200 198 L120 194 Z"/>
<path class="d" d="M300 138 Q330 112 372 130" fill="none"/><path class="d" d="M120 200 L540 200"/>
<rect class="w" x="8" y="188" width="100" height="8" rx="2"/><rect class="w" x="10" y="176" width="6" height="22"/>
<rect class="w" x="540" y="62" width="62" height="10" rx="3"/><rect class="w" x="546" y="78" width="56" height="7" rx="3"/><rect class="w" x="600" y="54" width="6" height="62"/><line class="d" x1="572" y1="90" x2="548" y2="148"/>
<polyline class="s" points="170,170 186,160 192,166 198,156 204,162 210,152 226,146"/>
<circle class="t" cx="150" cy="175" r="40"/><circle class="h" cx="150" cy="175" r="16"/><circle class="t" cx="500" cy="170" r="45"/><circle class="h" cx="500" cy="170" r="18"/>`,
    front: `<line x1="10" y1="215" x2="350" y2="215" class="g"/>
<rect class="t" x="34" y="122" width="56" height="93" rx="10" transform="rotate(-3 62 215)"/><rect class="t" x="270" y="122" width="56" height="93" rx="10" transform="rotate(3 298 215)"/>
<path class="b" d="M150 196 L156 112 Q180 88 204 112 L210 196 Z"/><path class="d" d="M156 112 Q180 70 204 112" fill="none"/>
<line class="d" x1="90" y1="150" x2="156" y2="130"/><line class="d" x1="270" y1="150" x2="204" y2="130"/><line class="s" x1="118" y1="136" x2="242" y2="136"/><circle class="h" cx="118" cy="136" r="5"/><circle class="h" cx="242" cy="136" r="5"/>
<rect class="w" x="26" y="198" width="308" height="9" rx="3"/><rect class="w" x="26" y="186" width="6" height="22"/><rect class="w" x="328" y="186" width="6" height="22"/>`,
    rear: `<line x1="10" y1="215" x2="350" y2="215" class="g"/>
<rect class="t" x="28" y="112" width="68" height="103" rx="10"/><rect class="t" x="264" y="112" width="68" height="103" rx="10"/>
<path class="b" d="M140 196 L150 110 Q180 92 210 110 L220 196 Z"/><rect class="w" x="108" y="62" width="144" height="14" rx="4"/><rect class="w" x="114" y="80" width="132" height="9" rx="4"/>
<rect class="w" x="102" y="54" width="7" height="58"/><rect class="w" x="251" y="54" width="7" height="58"/><line class="d" x1="180" y1="90" x2="180" y2="112"/>
<path class="w" d="M112 212 L248 212 L232 192 L128 192 Z"/><circle class="s" cx="180" cy="168" r="13"/><line class="d" x1="96" y1="168" x2="167" y2="168"/><line class="d" x1="193" y1="168" x2="264" y2="168"/>`,
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
    ['side', 'aero', 8, 8, 60, 190, 'frontWing'], ['side', 'springs', 150, 8, 200, 152], ['side', 'dampers', 292, 8, 214, 158], ['side', 'aero', 470, 8, 570, 66, 'rearWing'],
    ['side', 'brakeCooling', 40, 236, 150, 175], ['side', 'rideHeight', 250, 236, 330, 207], ['side', 'diff', 460, 236, 500, 170],
    ['front', 'camber', 8, 8, 62, 140, 'tyreF'], ['front', 'rollBalance', 200, 8, 180, 136], ['front', 'aero', 120, 236, 180, 203, 'frontWing'],
    ['rear', 'aero', 8, 8, 120, 68, 'rearWing'], ['rear', 'camber', 222, 8, 298, 140, 'tyreR'], ['rear', 'diff', 8, 236, 180, 168], ['rear', 'rideHeight', 222, 236, 180, 202, 'diffuser'],
  ],
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
    const w = view === 'side' ? 640 : 360, items = CALLOUTS[kind].filter(c => c[0] === view);
    const marks = items.map(([, k, bx, by, ax, ay, lk]) => {
      const bw = 120, bh = 40, cx = Math.min(Math.max(ax, bx), bx + bw), cy = by < 100 ? by + bh : by;
      const v = value(k, lk); if (v == null) return '';
      return `<line class="cl" x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}"/><circle class="cd" cx="${ax}" cy="${ay}" r="4"/>
<rect class="lb" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6"/><text class="ln" x="${bx + 6}" y="${by + 15}">${esc(NAMES[lk || k][L])}</text><text class="lv" x="${bx + 6}" y="${by + 32}">${esc(v)}</text>`;
    }).join('');
    return `<figure><figcaption>${esc(VIEW[view][L])}</figcaption><svg viewBox="0 0 ${w} 290" role="img" aria-label="${esc(VIEW[view][L])}">${SHAPES[kind][view]}${marks}</svg></figure>`;
  };
  return `<div class="su-views">${fig('side')}${fig('front')}${fig('rear')}</div>`;
}
