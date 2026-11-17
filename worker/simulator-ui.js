// Simulator page UI, applied from outside the simulator script (attribute lookups only):
// lap / compare tabs, a plain result sentence with one-tap compare buttons, folded detail
// sections, and a map overlay (checkered finish line, corner labels placed beside the
// track, corner names for selected tracks). The map is redrawn by the simulator on every
// change, so the overlay is re-applied on each redraw (before paint, via MutationObserver).

// Corner names for the current F1 numbering. One entry may cover several turns; the name
// is shown at the first turn of the list.
// Spa uses the forms Korean fans use (owner's choice: 라 소스, 오 루즈, 라디옹, 푸옹, 파녜, 스타벨로, 폴 프레르, 르 콤브, 말메디, 재키 익스, 리바지, 시케인).
// Sources: formula1.com and team corner guides, circuit sites; unnamed or uncertain turns are left out.
export const CORNER_NAMES = {"spa-francorchamps":[{"turns":[1],"ko":"라 소스","en":"La Source"},{"turns":[2],"ko":"오 루즈","en":"Eau Rouge"},{"turns":[3,4],"ko":"라디옹","en":"Raidillon"},{"turns":[5,6],"ko":"르 콤브","en":"Les Combes"},{"turns":[7],"ko":"말메디","en":"Malmedy"},{"turns":[8],"ko":"리바지","en":"Rivage"},{"turns":[9],"ko":"재키 익스","en":"Jacky Ickx"},{"turns":[10,11],"ko":"푸옹","en":"Pouhon"},{"turns":[12,13],"ko":"파녜","en":"Fagnes","between":true},{"turns":[14],"ko":"스타벨로","en":"Stavelot"},{"turns":[15],"ko":"폴 프레르","en":"Paul Frère"},{"turns":[16,17],"ko":"블랑시몽","en":"Blanchimont"},{"turns":[18,19],"ko":"시케인","en":"Chicane"}],"monza":[{"turns":[1,2],"ko":"레티필로","en":"Rettifilo"},{"turns":[3],"ko":"쿠르바 그란데","en":"Curva Grande"},{"turns":[4,5],"ko":"로지아","en":"Roggia"},{"turns":[6],"ko":"레스모 1","en":"Lesmo 1"},{"turns":[7],"ko":"레스모 2","en":"Lesmo 2"},{"turns":[9,8,10],"ko":"바리안테 아스카리","en":"Variante Ascari"},{"turns":[11],"ko":"파라볼리카","en":"Parabolica"}],"silverstone":[{"turns":[1],"ko":"애비","en":"Abbey"},{"turns":[2],"ko":"팜","en":"Farm"},{"turns":[3],"ko":"빌리지","en":"Village"},{"turns":[4],"ko":"루프","en":"Loop"},{"turns":[5],"ko":"에인트리","en":"Aintree"},{"turns":[6],"ko":"브룩랜즈","en":"Brooklands"},{"turns":[7],"ko":"러필드","en":"Luffield"},{"turns":[8],"ko":"우드코트","en":"Woodcote"},{"turns":[9],"ko":"콥스","en":"Copse"},{"turns":[10,11],"ko":"마고츠","en":"Maggotts","between":true},{"turns":[12,13],"ko":"베케츠","en":"Becketts","between":true},{"turns":[14],"ko":"채플","en":"Chapel"},{"turns":[15],"ko":"스토","en":"Stowe"},{"turns":[16],"ko":"베일","en":"Vale"},{"turns":[18,17],"ko":"클럽","en":"Club"}],"interlagos":[{"turns":[1,2],"ko":"세나 S","en":"Senna S"},{"turns":[3],"ko":"쿠르바 두 솔","en":"Curva do Sol"},{"turns":[4,5],"ko":"데시다 두 라구","en":"Descida do Lago"},{"turns":[6,7],"ko":"페하두라","en":"Ferradura"},{"turns":[8],"ko":"라한지냐","en":"Laranjinha"},{"turns":[9],"ko":"핑헤리뉴","en":"Pinheirinho"},{"turns":[10],"ko":"비쿠 지 파투","en":"Bico de Pato"},{"turns":[11],"ko":"메르굴류","en":"Mergulho"},{"turns":[12],"ko":"중싸웅","en":"Junção"}],"imola":[{"turns":[2,3,4],"ko":"탐부렐로","en":"Tamburello"},{"turns":[5,6],"ko":"빌뇌브","en":"Villeneuve"},{"turns":[7],"ko":"토사","en":"Tosa"},{"turns":[9],"ko":"피라텔라","en":"Piratella"},{"turns":[11,12,13],"ko":"아퀴 미네랄리","en":"Acque Minerali"},{"turns":[14,15],"ko":"바리안테 알타","en":"Variante Alta"},{"turns":[17,18],"ko":"리바차","en":"Rivazza"}],"suzuka":[{"turns":[3,4,5,6],"ko":"S 커브","en":"S Curves"},{"turns":[7],"ko":"던롭","en":"Dunlop"},{"turns":[11],"ko":"헤어핀","en":"Hairpin"},{"turns":[13,14],"ko":"스푼","en":"Spoon"},{"turns":[15],"ko":"우마무스메 130R","en":"Uma Musume 130R"},{"turns":[16,17],"ko":"카시오 트라이앵글","en":"Casio Triangle"},{"turns":[8],"ko":"데그너 1","en":"Degner 1"},{"turns":[9],"ko":"데그너 2","en":"Degner 2"}],"zandvoort":[{"turns":[1],"ko":"타잔","en":"Tarzan"},{"turns":[2],"ko":"헤를라흐","en":"Gerlach"},{"turns":[3],"ko":"휘헨홀츠","en":"Hugenholtz"},{"turns":[4],"ko":"훈서루흐","en":"Hunserug"},{"turns":[5],"ko":"슬로테마커","en":"Slotemaker"},{"turns":[6,7],"ko":"샤이블라크","en":"Scheivlak"},{"turns":[8],"ko":"마스터스","en":"Masters"},{"turns":[11,12],"ko":"한스 에른스트","en":"Hans Ernst"},{"turns":[14],"ko":"아리에 루엔디크","en":"Arie Luyendyk"}],"monte-carlo":[{"turns":[1],"ko":"생 드보","en":"Sainte Dévote"},{"turns":[2],"ko":"보 리바지","en":"Beau Rivage"},{"turns":[3],"ko":"마스네","en":"Massenet"},{"turns":[4],"ko":"카지노","en":"Casino"},{"turns":[5],"ko":"미라보 오트","en":"Mirabeau Haute"},{"turns":[6],"ko":"페어몬트 헤어핀","en":"Fairmont Hairpin"},{"turns":[7],"ko":"미라보 바","en":"Mirabeau Bas"},{"turns":[8],"ko":"포르티에","en":"Portier"},{"turns":[9],"ko":"터널","en":"Tunnel"},{"turns":[10,11],"ko":"누벨 시케인","en":"Nouvelle Chicane"},{"turns":[12],"ko":"타박","en":"Tabac"},{"turns":[13,14,15,16],"ko":"피씬","en":"Piscine"},{"turns":[18],"ko":"라스카스","en":"Rascasse"},{"turns":[19],"ko":"앙토니 노게스","en":"Anthony Noghès"}],"le-mans":[{"turns":[1],"ko":"던롭 커브","en":"Dunlop Curve"},{"turns":[2,3],"ko":"던롭 시케인","en":"Dunlop Chicane"},{"turns":[6],"ko":"테르트르 루즈","en":"Tertre Rouge"},{"turns":[7],"ko":"데이토나 시케인","en":"Daytona Chicane"},{"turns":[8],"ko":"미쉐린 시케인","en":"Michelin Chicane"},{"turns":[9],"ko":"뮬산 코너","en":"Mulsanne Corner"},{"turns":[11],"ko":"인디아나폴리스","en":"Indianapolis"},{"turns":[12],"ko":"아르나지","en":"Arnage"},{"turns":[14,15,17],"ko":"포르쉐 커브","en":"Porsche Curves"},{"turns":[18,19,20,21],"ko":"포드 시케인","en":"Ford Chicane"}],"daytona":[{"turns":[3],"ko":"인터내셔널 호스슈","en":"International Horseshoe"},{"turns":[4],"ko":"더 킹크","en":"The Kink"},{"turns":[5],"ko":"웨스트 호스슈","en":"West Horseshoe"},{"turns":[6],"ko":"나스카 1","en":"NASCAR 1"},{"turns":[7],"ko":"나스카 2","en":"NASCAR 2"},{"turns":[8,9,10,11],"ko":"르망 시케인","en":"Le Mans Chicane"},{"turns":[12],"ko":"나스카 3","en":"NASCAR 3"}],"sebring":[{"turns":[6],"ko":"거니 벤드","en":"Gurney Bend"},{"turns":[7],"ko":"헤어핀","en":"Hairpin"},{"turns":[8,9],"ko":"판지오 시케인","en":"Fangio Chicane"},{"turns":[10],"ko":"커닝햄 코너","en":"Cunningham Corner"},{"turns":[14],"ko":"비숍 벤드","en":"Bishop Bend"},{"turns":[17],"ko":"선셋 벤드","en":"Sunset Bend"}],"mugello":[{"turns":[1],"ko":"산 도나토","en":"San Donato"},{"turns":[2],"ko":"루코","en":"Luco"},{"turns":[3],"ko":"포조 세코","en":"Poggio Secco"},{"turns":[4],"ko":"마테라시","en":"Materassi"},{"turns":[5],"ko":"보르고 산 로렌초","en":"Borgo San Lorenzo"},{"turns":[6],"ko":"카사노바","en":"Casanova"},{"turns":[7],"ko":"사벨리","en":"Savelli"},{"turns":[8],"ko":"아라비아타 1","en":"Arrabbiata 1"},{"turns":[9],"ko":"아라비아타 2","en":"Arrabbiata 2"},{"turns":[10],"ko":"스카르페리아","en":"Scarperia"},{"turns":[11],"ko":"팔라조","en":"Palagio"},{"turns":[12],"ko":"코렌타이오","en":"Correntaio"},{"turns":[13],"ko":"비온데티 1","en":"Biondetti 1"},{"turns":[14],"ko":"비온데티 2","en":"Biondetti 2"},{"turns":[15],"ko":"부치네","en":"Bucine"}],"fuji":[{"turns":[1],"ko":"퍼스트 코너","en":"First Corner"},{"turns":[3],"ko":"코카콜라 코너","en":"Coca-Cola Corner"},{"turns":[4,5],"ko":"100R","en":"100R"},{"turns":[6],"ko":"헤어핀","en":"Hairpin"},{"turns":[9],"ko":"300R","en":"300R"},{"turns":[10],"ko":"던롭 코너","en":"Dunlop Corner"},{"turns":[14,15],"ko":"네츠 코너","en":"Netz Corner"},{"turns":[16],"ko":"파나소닉 코너","en":"Panasonic Corner"}],"laguna-seca":[{"turns":[2],"ko":"안드레티 헤어핀","en":"Andretti Hairpin"},{"turns":[8,9],"ko":"콕스크루","en":"The Corkscrew"},{"turns":[10],"ko":"레이니 커브","en":"Rainey Curve"}],"mosport":[{"turns":[1],"ko":"클레이턴","en":"Clayton"},{"turns":[3],"ko":"퀘벡","en":"Quebec"},{"turns":[6],"ko":"모스","en":"Moss"},{"turns":[10,11],"ko":"에스","en":"Esses"},{"turns":[12],"ko":"화이츠","en":"Whites"}],"road-america":[{"turns":[9,10],"ko":"캐러셀","en":"Carousel"},{"turns":[11],"ko":"더 킹크","en":"The Kink"},{"turns":[12],"ko":"캐나다 코너","en":"Canada Corner"},{"turns":[13],"ko":"빌 미첼 벤드","en":"Bill Mitchell Bend"}],"vir":[{"turns":[1],"ko":"호스슈","en":"Horseshoe"},{"turns":[3],"ko":"나스카 벤드","en":"NASCAR Bend"},{"turns":[4],"ko":"레프트 훅","en":"Left Hook"},{"turns":[7],"ko":"스네이크","en":"Snake"},{"turns":[8,9,10,11],"ko":"클라이밍 에스","en":"Climbing Esses"},{"turns":[12],"ko":"사우스 벤드","en":"South Bend"},{"turns":[13],"ko":"오크 트리","en":"Oak Tree"},{"turns":[14,15],"ko":"롤러코스터","en":"Roller Coaster"},{"turns":[16,17],"ko":"호그 펜","en":"Hog Pen"}],"road-atlanta":[{"turns":[5],"ko":"에스","en":"The Esses"}],"long-beach":[{"turns":[11],"ko":"헤어핀","en":"The Hairpin"}],"las-vegas":[{"turns":[7,8,9],"ko":"스피어","en":"Sphere"}],"montreal":[{"turns":[14],"ko":"월 오브 챔피언스","en":"Wall of Champions"}],"madring":[{"turns":[12],"ko":"라 모누멘탈","en":"La Monumental"}],"macau":[{"turns":[2],"ko":"만다린","en":"Mandarin"},{"turns":[3],"ko":"리스보아","en":"Lisboa"},{"turns":[4],"ko":"산 프란시스코","en":"S. Francisco"},{"turns":[7],"ko":"머터니티","en":"Maternity"},{"turns":[8],"ko":"테디 입","en":"Teddy Yip"},{"turns":[12],"ko":"파이올","en":"Paiol"},{"turns":[15],"ko":"폴리스","en":"Police"},{"turns":[16],"ko":"무어리시","en":"Moorish"},{"turns":[18],"ko":"도나 마리아","en":"Dona Maria"},{"turns":[19],"ko":"멜코 헤어핀","en":"Melco Hairpin"},{"turns":[22],"ko":"피셔맨스 벤드","en":"Fisherman's Bend"},{"turns":[23],"ko":"R 벤드","en":"R Bend"}]};

export const simulatorUiCss = `
.kb-sim-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;border-bottom:1px solid var(--line);padding-bottom:8px;position:relative}
.kb-sim-tabs button{min-height:44px;padding:0 16px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font:inherit;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.kb-sim-tabs button[aria-selected="true"]{border-color:var(--mint);color:var(--text);box-shadow:inset 0 0 0 1px var(--mint)}
.kb-soon{font-size:12px;font-weight:700;padding:1px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.kb-sim-summary{margin:4px 0 0;font-size:16px;line-height:1.55;color:var(--text);max-width:520px}.kb-sim-summary b{font-variant-numeric:tabular-nums}
.kb-presets{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}.kb-presets button{font:inherit;font-size:14px;font-weight:600;min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);cursor:pointer}.kb-presets button[aria-pressed="true"]{border-color:var(--mint);box-shadow:inset 0 0 0 1px var(--mint)}
.kb-sec-fold>summary{display:flex;align-items:baseline;justify-content:space-between;gap:12px;cursor:pointer;list-style:none}.kb-sec-fold>summary::-webkit-details-marker{display:none}
.kb-sec-fold>summary h2{margin:0}.kb-sec-fold>summary::after{content:"＋";color:var(--muted);font-size:20px;line-height:1}.kb-sec-fold[open]>summary::after{content:"－"}
.kb-sec-fold>summary .kb-sec-hint{flex:1 1 auto;color:var(--muted);font-size:14px;text-align:right;margin-right:4px}
.kb-sec-fold[open]>summary{margin-bottom:12px}.kb-sec-fold .kb-fold{border-top:0;margin-top:0}.kb-sec-fold .kb-fold>summary{display:none}
.ls-map .ls-start{display:none}
.ls-map .ls-corner{paint-order:stroke;stroke:var(--bg);stroke-linejoin:round;dominant-baseline:central}
.ls-map .kb-corner-name{fill:var(--muted);font-weight:600}.ls-map .kb-corner-sub{font-weight:500;opacity:.8}
.ls-map .kb-flag-dark{fill:var(--text)}.ls-map .kb-flag-light{fill:var(--bg)}.ls-map .kb-flag-edge{fill:none;stroke:var(--text)}
@media(max-width:700px){.kb-sec-fold>summary .kb-sec-hint{display:none}.kb-sim-summary{font-size:15px}}
`;

export function simulatorUiClient(CORNER_NAMES) {
 if (!document.getElementById('lapsim-data') && !document.querySelector('[data-ls="map"]')) return;
 const en = document.documentElement.lang === 'en', t = (ko, eng) => en ? eng : ko;
 const $ = s => document.querySelector(s), q = s => $('[data-ls="' + s + '"]');
 const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
 const safe = fn => { try { fn(); } catch (e) { /* enhancement only */ } };
 const ns = 'http://www.w3.org/2000/svg', svgEl = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
 const parseLap = s => { const m = String(s || '').match(/(\d+):(\d{2}\.\d+)|(\d+\.\d+)/); return m ? (m[1] ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3])) : NaN; };
 const fmtLap = v => { const m = Math.floor(v / 60); return m + ':' + (v - m * 60).toFixed(3).padStart(6, '0'); };
 const trackId = () => $('select[name="track"]')?.value || new URLSearchParams(location.search).get('track') || 'monza';
 const names = () => CORNER_NAMES[trackId()] || [];
 const nameAt = num => { const n = Number(num); const hit = names().find(e => e.turns.includes(n)); return hit ? { name: en ? hit.en : hit.ko, sub: '', first: hit.turns[0] === n && !hit.between } : null; /* one language only (owner 2026-11-15) */ };

 // --- Map geometry ---
 function mapGeometry(svg) {
  const paths = [...svg.querySelectorAll('g>path')]; if (!paths.length) return null;
  const pts = []; for (const p of paths) { const nums = (p.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]); }
  const g = svg.querySelector('g'), sw = Number(g?.getAttribute('stroke-width')) || 20;
  const vb = (svg.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number);
  // the lap start: the server's (hidden) start mark, which follows the series' own line (Silverstone non-F1: National Pits Straight)
  const st = svg.querySelector('.ls-start'), sx = st ? Number(st.getAttribute('x')) + Number(st.getAttribute('width')) / 2 : NaN, sy = st ? Number(st.getAttribute('y')) + Number(st.getAttribute('height')) / 2 : NaN;
  let start = 0; if (Number.isFinite(sx)) { let bd = Infinity; pts.forEach((p, i) => { const d = (p[0] - sx) ** 2 + (p[1] - sy) ** 2; if (d < bd) { bd = d; start = i; } }); }
  // the track's own edges (the band is drawn at real width, wider than the racing line): labels keep off them too
  const bp = (svg.querySelector('.ls-band')?.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).map(q => q.split(',').map(Number)), h = bp.length >> 1;
  const edges = h > 2 ? [bp.slice(0, h), bp.slice(h)] : [];
  return { pts, sw, vb, paths, start, edges };
 }
 const nearest = (pts, x, y) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
 const clearance = (pts, x, y) => { let bd = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy, k = L ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L)) : 0, dx = a[0] + vx * k - x, dy = a[1] + vy * k - y, d = dx * dx + dy * dy; if (d < bd) bd = d; } return Math.sqrt(bd); };

 // exact distance from the track polyline to an axis-aligned box (0 when the track crosses it)
 const rectClear = (pts, b) => {
  const inside = (x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  const ptRect = (x, y) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
  const segSeg = (p, q, r, s2) => { const d = (q[0] - p[0]) * (s2[1] - r[1]) - (q[1] - p[1]) * (s2[0] - r[0]); if (!d) return false; const u = ((r[0] - p[0]) * (s2[1] - r[1]) - (r[1] - p[1]) * (s2[0] - r[0])) / d, v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d; return u >= 0 && u <= 1 && v >= 0 && v <= 1; };
  const ptSeg = (x, y, a, c) => { const vx = c[0] - a[0], vy = c[1] - a[1], L = vx * vx + vy * vy, k = L ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L)) : 0; return Math.hypot(a[0] + vx * k - x, a[1] + vy * k - y); };
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
   const a = pts[i], c = pts[(i + 1) % pts.length];
   if (inside(a[0], a[1])) return 0;
   for (let k = 0; k < 4; k++) if (segSeg(a, c, corners[k], corners[(k + 1) % 4])) return 0;
   best = Math.min(best, ptRect(a[0], a[1]), ...corners.map(([x, y]) => ptSeg(x, y, a, c)));
  }
  return best;
 };
 function finishLine(svg, geo) {
  svg.querySelector('.kb-flag')?.remove();
  const [a, b] = [geo.pts[geo.start], geo.pts[Math.min(geo.pts.length - 1, geo.start + 4)]]; if (!a || !b) return;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  const across = geo.sw * 5.8, /* = OT D/A tick length */ along = geo.sw * 1.3, cols = 6, rows = 2, cw = across / cols, rh = along / rows;
  const grp = svgEl('g', { class: 'kb-flag', transform: 'translate(' + a[0] + ' ' + a[1] + ') rotate(' + (ang + 90) + ')', 'aria-hidden': 'true' });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grp.append(svgEl('rect', { x: (-across / 2 + c * cw).toFixed(2), y: (-along / 2 + r * rh).toFixed(2), width: cw.toFixed(2), height: rh.toFixed(2), class: (r + c) % 2 ? 'kb-flag-light' : 'kb-flag-dark' }));
  grp.append(svgEl('rect', { x: (-across / 2).toFixed(2), y: (-along / 2).toFixed(2), width: across.toFixed(2), height: along.toFixed(2), class: 'kb-flag-edge', 'stroke-width': (geo.sw * 0.12).toFixed(2) }));
  const corners = svg.querySelector('.ls-corner'); corners ? svg.insertBefore(grp, corners) : svg.append(grp);
 }

 function placeCorners(svg, geo) {
  const labels = [...svg.querySelectorAll('text.ls-corner')]; if (!labels.length) return;
  const numL = labels.find(l => !l.classList.contains('ls-corner-nm')), fs = (numL && parseFloat(getComputedStyle(numL).fontSize)) || geo.sw * 5.3, placed = [], [vx, vy, vw, vh] = geo.vb, margin = fs * 0.4;
  const boxes = (x, y, w, h) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 });
  if (geo.pts[geo.start]) { const a = geo.pts[geo.start], r = geo.sw * 3.2; placed.push({ x0: a[0] - r, x1: a[0] + r, y0: a[1] - r, y1: a[1] + r }); } // keep labels off the finish flag
  const over = (b, p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1), hits = b => placed.some(p => over(b, p));
  // a hard hit is something drawn in this view; soft ones are zones of the other options (hidden now, kept free so labels stay put)
  const hardHits = b => placed.reduce((n, p) => n + (!p.soft && over(b, p)), 0);
  // keep corner labels off the DRS / Straight Mode bands, their labels and the OT marks (owner 2026-11-15: '19' printed over 'DRS 3')
  safe(() => {
   const hid = e => e.style.opacity === '0';
   for (const t of svg.querySelectorAll('.ls-zone-t,.ls-zone-mt')) { const r = t.getBBox(), m = geo.sw * 0.4, soft = hid(t), a = (+(/rotate\((-?[\d.]+)/.exec(t.getAttribute('transform') || '') || [0, 0])[1]) * Math.PI / 180, cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    for (let k = -3; k <= 3; k++) { const x = cx + Math.cos(a) * r.width * k / 7, y = cy + Math.sin(a) * r.width * k / 7, hw = r.width / 14 + m, hh = r.height / 2 + m; placed.push({ x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh, soft }); } }
   // and off the pit lane (owner 2026-11-17: Silverstone "Hamilton Straight" over the Wing pit lane)
   for (const z of svg.querySelectorAll('path.ls-pit')) { const L = z.getTotalLength(), r = geo.sw * 0.7; for (let d = 0; d <= L; d += geo.sw * 1.5) { const pt = z.getPointAtLength(d); placed.push({ x0: pt.x - r, x1: pt.x + r, y0: pt.y - r, y1: pt.y + r }); } }
   for (const z of svg.querySelectorAll('path.ls-zone,line.ls-zone-m')) { const L = z.getTotalLength(), r = geo.sw * 0.9, soft = hid(z); for (let d = 0; d <= L; d += geo.sw * 1.5) { const pt = z.getPointAtLength(d); placed.push({ x0: pt.x - r, x1: pt.x + r, y0: pt.y - r, y1: pt.y + r, soft }); } }
  });
  const inside = (x, y) => { let c = false; const P = geo.pts; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const grow = () => { const labelsBoxes = placed.slice(1); if (!labelsBoxes.length) return; const x0 = Math.min(vx, ...labelsBoxes.map(b => b.x0)), y0 = Math.min(vy, ...labelsBoxes.map(b => b.y0)), x1 = Math.max(vx + vw, ...labelsBoxes.map(b => b.x1)), y1 = Math.max(vy + vh, ...labelsBoxes.map(b => b.y1)); svg.setAttribute('viewBox', [x0, y0, x1 - x0, y1 - y0].map(v => v.toFixed(1)).join(' ')); };
  // names that sit between two turns (owner 2026-11-15: Silverstone Maggotts between 10 and 11, Becketts between 12 and 13)
  for (const e of names().filter(e => e.between)) {
   const find = num => labels.find(l => (l.dataset.orig || l.dataset.kbNum || l.textContent.replace(/\D.*$/, '')) === String(num));
   const a = find(e.turns[0]), b = find(e.turns[1]); if (!a || !b || svg.querySelector('[data-kb-between="' + e.turns.join('-') + '"]')) continue;
   const ax0 = Number(a.dataset.kbX ?? a.getAttribute('x')), ay0 = Number(a.dataset.kbY ?? a.getAttribute('y')), bx0 = Number(b.dataset.kbX ?? b.getAttribute('x')), by0 = Number(b.dataset.kbY ?? b.getAttribute('y'));
   const t = svgEl('text', { class: 'ls-corner kb-between', x: ((ax0 + bx0) / 2).toFixed(1), y: ((ay0 + by0) / 2).toFixed(1), 'data-kb-between': e.turns.join('-'), 'data-kb-name': en ? e.en : e.ko }); t.textContent = ''; svg.append(t); labels.push(t);
  }
  // straight names (owner 2026-11-17): written along their straight, beside it on the side with more room (outside the circuit first)
  for (const label of labels.filter(l => l.classList.contains('ls-straight'))) {
   if (!label.dataset.kbX) { label.dataset.kbX = label.getAttribute('x'); label.dataset.kbY = label.getAttribute('y'); }
   const ax = Number(label.dataset.kbX), ay = Number(label.dataset.kbY), i = nearest(geo.pts, ax, ay), P = geo.pts, n = P.length;
   const p0 = P[(i - 4 + n) % n], p1 = P[(i + 4) % n], tl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, tx = (p1[0] - p0[0]) / tl, ty = (p1[1] - p0[1]) / tl;
   let ang = Math.atan2(ty, tx) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
   label.removeAttribute('dy'); label.setAttribute('stroke-width', (fs * 0.16).toFixed(1));
   let bb = null; try { bb = label.getBBox(); } catch (e) {} const len = bb ? bb.width : fs * 6, hh = bb ? bb.height : fs, d = geo.sw * 2.4 + hh * 0.6; // just beside the straight, clear of the track band
   // a turned label is checked as a row of small boxes along its length (its upright bounding box would cover the far side too)
   const ca = Math.cos(ang * Math.PI / 180), sa = Math.sin(ang * Math.PI / 180), row = (x, y) => [-3, -2, -1, 0, 1, 2, 3].map(k => boxes(x + ca * len * k / 6.5, y + sa * len * k / 6.5, len / 6.5 + hh * 0.3, hh));
   // a label longer than its straight may also slide a little along it (Singapore 'Anderson Bridge' clear of D2)
   const cands = [1, 1.5, 2.1, 2.8].flatMap((f, fi) => [0, 0.3, -0.3, 0.6, -0.6].flatMap((sl, si) => [1, -1].map(side => { const x = P[i][0] - ty * side * d * f + tx * len * sl, y = P[i][1] + tx * side * d * f + ty * len * sl, b = row(x, y); return { x, y, b, fi, si, hit: b.filter(hits).length, out: !inside(x, y), trk: b.filter(q => rectClear(geo.pts, q) < geo.sw * 1.2 || geo.edges.some(E => rectClear(E, q) < geo.sw * 0.2)).length }; })));
   // off the track first (Singapore 'Anderson Bridge' on the next road), then free, then closest to the straight, then outside
   const best = cands.sort((a, b) => a.trk - b.trk || a.hit - b.hit || a.si - b.si || a.fi - b.fi || b.out - a.out)[0];
   placed.push(...best.b); label.setAttribute('x', best.x.toFixed(1)); label.setAttribute('y', best.y.toFixed(1));
   // about its own point, not with CSS transform-box: iPhone Safari turned such labels about the map corner (owner 2026-11-17)
   label.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ' ' + best.x.toFixed(1) + ' ' + best.y.toFixed(1) + ')');
  }
  // corner labels (owner 2026-11-17): no leader lines, every label beside its own corner, and one size for all numbers and one for all
  // names on a map: when a corner has too little room the whole map's labels get smaller (88 %, 76 %, 66 %), not that label alone
  const gap = geo.sw * 1.8, nPts = geo.pts.length, edgeClear = b => geo.edges.length ? Math.min(...geo.edges.map(E => rectClear(E, b))) : Infinity;
  const byNear = (a, b) => (b.out - a.out) || a.dist - b.dist || Math.abs(a.rot) - Math.abs(b.rot); // outside the circuit first, then nearest
  const corners = labels.filter(l => !l.classList.contains('ls-straight')).map(label => {
   if (!label.dataset.kbX) { label.dataset.kbX = label.getAttribute('x'); label.dataset.kbY = label.getAttribute('y'); }
   const ax = Number(label.dataset.kbX), ay = Number(label.dataset.kbY), nameOnly = label.classList.contains('ls-corner-nm'), num = label.dataset.orig || label.textContent.replace(/\D.*$/, '') || label.textContent;
   // a name-only label (OpenStreetMap corner name) keeps its whole text (owner 2026-11-17: Le Mans 'First', Daytona 'Turn', 'The')
   const own = label.dataset.kbName, info = own ? { name: own, sub: '', first: true } : nameOnly ? null : nameAt(num), showName = info && info.first;
   label.removeAttribute('dy'); if (!nameOnly) label.textContent = own ? '' : label.textContent.split(' ')[0];
   label.querySelectorAll('tspan').forEach(n => n.remove());
   const fsBase = nameOnly ? fs * 0.72 : fs; // a name-only label is set at the names' size
   const lines = showName ? [[info.name, 0.72, 'kb-corner-name']].concat(info.sub ? [[info.sub, 0.56, 'kb-corner-name kb-corner-sub']] : []) : [];
   const draw = sc => { // the label at sc of its size; its box size and the offset of its centre from y
    const f0 = fsBase * sc; label.style.fontSize = f0.toFixed(1) + 'px'; label.querySelectorAll('tspan').forEach(n => n.remove());
    label.setAttribute('stroke-width', (f0 * 0.22).toFixed(1)); label.setAttribute('x', ax); label.setAttribute('y', ay);
    let prevF = own ? f0 * 0.5 : f0; for (const [txt, k, cls] of lines) { const f2 = fs * k * sc, ts = svgEl('tspan', { x: ax, dy: (prevF * 0.42 + f2 * 0.95).toFixed(1), class: cls }); ts.style.fontSize = f2.toFixed(1) + 'px'; ts.textContent = txt; label.append(ts); prevF = f2; }
    let bb = null; try { bb = label.getBBox(); } catch (e) {}
    const halo = f0 * 0.22, w = bb && bb.width ? bb.width + halo : f0 * 2, h = bb && bb.height ? bb.height + halo : f0 * 1.6;
    return { w, h, offY: bb && bb.height ? (bb.y + bb.height / 2) - ay : 0, m: margin * sc };
   };
   const i = nearest(geo.pts, ax, ay), p0 = geo.pts[Math.max(0, i - 3)], p1 = geo.pts[Math.min(geo.pts.length - 1, i + 3)];
   let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
   const spots = (d, base, strict, far) => { const out = [];
    for (const dist of far ? [base * 1.8, base * 2.2, base * 2.7, base * 3.3, base * 4] : [base, base * 1.25, base * 1.5]) for (const rot of [0, 20, -20, 40, -40, 60, -60, 85, -85, 115, -115]) for (const side of [1, -1]) {
     const r = rot * Math.PI / 180, nx = -ty * side, ny = tx * side, dx = nx * Math.cos(r) - ny * Math.sin(r), dy = nx * Math.sin(r) + ny * Math.cos(r);
     const x = ax + dx * dist, y = ay + dy * dist, b = boxes(x, y, d.w + d.m, d.h + d.m), edge = Math.max(vw, vh) * 0.06;
     if (b.x0 < vx - edge || b.y0 < vy - edge || b.x1 > vx + vw + edge || b.y1 > vy + vh + edge || (strict && hits(b))) continue;
     // own: the track nearest the label is this corner's own stretch, not another part of the lap (owner 2026-11-15: Suzuka T15 read as T8)
     const j = nearest(geo.pts, x, y), gi = Math.min(Math.abs(j - i), nPts - Math.abs(j - i));
     out.push({ x, y, b, dist, rot, own: gi <= Math.max(4, nPts * 0.03), out: !inside(x, y), hit: hits(b), hard: hardHits(b), c: rectClear(geo.pts, boxes(x, y, d.w, d.h)), e: edgeClear(boxes(x, y, d.w, d.h)) });
    } return out; };
   // places the label at size sc; returns 0 beside its corner, 1 a little farther out, 4 only a last-resort spot
   return sc => {
    const d = draw(sc), base = geo.sw * 1.1 + Math.max(d.w, d.h) * 0.55, clear = k => k.c >= gap * 0.6 && k.e >= geo.sw * 0.25 && k.own;
    let cost = 0, near = spots(d, base, true), best = near.filter(k => k.c >= gap && k.e >= geo.sw * 0.5 && k.own).sort(byNear)[0] || near.filter(clear).sort(byNear)[0];
    if (!best) { cost = 1; best = spots(d, base, true, true).filter(clear).sort(byNear)[0]; }
    if (!best) { cost = 4; // last resort: nothing drawn under it, then off the track, then clear of hidden zones, its own stretch, nearest
     const all = spots(d, base, false).concat(spots(d, base, false, true)), off = k => k.c >= gap * 0.4 && k.e >= geo.sw * 0.2;
     best = all.sort((a, b) => a.hard - b.hard || off(b) - off(a) || a.hit - b.hit || b.own - a.own || a.dist - b.dist)[0] || { x: ax, y: ay - base, b: boxes(ax, ay - base, d.w, d.h) }; }
    placed.push(best.b); label.dataset.kbSc = sc + (cost ? (cost > 1 ? ' min' : ' far') : '');
    label.setAttribute('x', best.x.toFixed(1)); label.setAttribute('y', (best.y - d.offY).toFixed(1));
    label.querySelectorAll('tspan').forEach(ts => ts.setAttribute('x', best.x.toFixed(1)));
    return cost;
   };
  });
  const p0 = placed.length, run = sc => { placed.length = p0; return corners.reduce((n, place) => n + place(sc), 0); };
  // the largest size that is at most one 'a little farther out' label worse than the best size
  const score = [];
  for (const sc of [1, 0.88, 0.76, 0.66]) { score.push([sc, run(sc)]); if (!score.at(-1)[1]) break; }
  const low = Math.min(...score.map(q => q[1])), pick = score.find(q => q[1] <= low + 1)[0];
  if (pick !== score.at(-1)[0]) run(pick);
  grow();
 }

 const layoutCache = new Map();
 function enhanceMap() {
  const svg = q('map')?.querySelector('svg.ls-map'); if (!svg || svg.dataset.kbMap === '1') return;
  svg.dataset.kbMap = '1'; const geo = mapGeometry(svg); if (!geo) return;
  safe(() => finishLine(svg, geo));
  // label layout depends only on track shape and labels, not on the colours a slider changes: cache it
  const labels = [...svg.querySelectorAll('text.ls-corner')], key = svg.getAttribute('viewBox') + '|' + [...svg.querySelectorAll('.ls-zone-t,.ls-zone-mt')].map(z => z.textContent + z.getAttribute('x')).join(';') + '|' + labels.map(l => l.getAttribute('x') + ',' + l.getAttribute('y') + ',' + l.textContent).join(';') + '|' + (en ? 'en' : 'ko');
  const hit = layoutCache.get(key);
  if (hit) { safe(() => { svg.setAttribute('viewBox', hit.viewBox); labels.forEach((l, i) => { l.outerHTML = hit.labels[i]; }); }); return; }
  safe(() => placeCorners(svg, geo));
  layoutCache.set(key, { viewBox: svg.getAttribute('viewBox'), labels: [...svg.querySelectorAll('text.ls-corner')].map(l => l.outerHTML) });
 }

 // --- Result sentence and compare presets ---
 function slowestCorner() {
  const trace = q('trace')?.querySelector('svg.ls-trace'), line = trace?.querySelector('.ls-line-0'), svg = q('map')?.querySelector('svg.ls-map');
  if (!line || !svg) return null;
  const ticks = [...trace.querySelectorAll('text.ls-axis[text-anchor="end"]')].map(n => ({ y: Number(n.getAttribute('y')), v: Number(n.textContent) })).filter(p => Number.isFinite(p.y) && Number.isFinite(p.v));
  if (ticks.length < 2) return null;
  const a = ticks[0], b = ticks[ticks.length - 1], sp = y => a.v + (y - a.y) * (b.v - a.v) / (b.y - a.y);
  const nums = (line.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []; if (nums.length < 4) return null;
  let mi = 1, x0 = nums[0], x1 = nums[nums.length - 2]; for (let i = 1; i < nums.length; i += 2) if (nums[i] > nums[mi]) mi = i;
  const f = (nums[mi - 1] - x0) / (x1 - x0), speed = Math.round(sp(nums[mi]));
  const paths = [...svg.querySelectorAll('g>path')], lens = paths.map(p => p.getTotalLength()), total = lens.reduce((s, v) => s + v, 0);
  let d = f * total, pt = null; for (let i = 0; i < paths.length; i++) { if (d <= lens[i] || i === paths.length - 1) { pt = paths[i].getPointAtLength(Math.min(d, lens[i])); break; } d -= lens[i]; }
  let corner = null, bd = Infinity; for (const lab of svg.querySelectorAll('text.ls-corner')) { const x = Number(lab.dataset.kbX ?? lab.getAttribute('x')), y = Number(lab.dataset.kbY ?? lab.getAttribute('y')), dd = Math.hypot(x - pt.x, y - pt.y); if (dd < bd) { bd = dd; corner = (lab.firstChild?.textContent || lab.textContent).trim(); } }
  return { speed, corner };
 }
 function summary() {
  const lap = q('lap'); if (!lap) return;
  let box = $('.kb-sim-summary'); if (!box) { box = el('p', 'kb-sim-summary'); box.setAttribute('data-no-translate', ''); box.setAttribute('aria-live', 'polite'); (q('pole') || lap).after(box); }
  const v = parseLap(lap.textContent), pole = parseLap(q('pole')?.textContent), slow = safeVal(slowestCorner);
  const parts = [];
  if (Number.isFinite(v) && Number.isFinite(pole)) { const d = v - pole; parts.push(Math.abs(d) < 0.0005 ? t('이 조건의 계산은 실제 폴 기록과 같습니다.', 'With these conditions the lap matches the real pole.') : t('이 조건이면 실제 폴보다 ' + Math.abs(d).toFixed(3) + '초 ' + (d < 0 ? '빠릅니다.' : '느립니다.'), 'With these conditions the lap is ' + Math.abs(d).toFixed(3) + ' s ' + (d < 0 ? 'faster' : 'slower') + ' than the real pole.')); }
  else if (Number.isFinite(v)) parts.push(t('실제 폴 기록이 없는 차라 ' + fmtLap(v) + '는 추정치입니다.', 'No real pole exists for this car, so ' + fmtLap(v) + ' is an estimate.'));
  if (slow && slow.corner) { const nm = nameAt(slow.corner); parts.push(t('가장 느린 곳은 ' + slow.corner + '번 코너' + (nm ? '(' + nm.name + ')' : '') + ', 약 ' + slow.speed + ' km/h입니다.', 'The slowest point is Turn ' + slow.corner + (nm ? ' (' + nm.name + ')' : '') + ', about ' + slow.speed + ' km/h.')); }
  box.textContent = parts.join(' ');
 }
 const safeVal = fn => { try { return fn(); } catch (e) { return null; } };
 function presets() {
  const compare = q('compare'), car = q('car'); if (!compare || !car || $('.kb-presets')) return;
  const wanted = [['2027', t('2027 머신과 비교', 'Compare with 2027')], ['base2019', t('2019년 머신과 비교', 'Compare with 2019')], ['wec-lmh', t('WEC 하이퍼카와 비교', 'Compare with a WEC Hypercar')]];
  const row = el('div', 'kb-presets'); row.setAttribute('data-no-translate', '');
  const sync = () => row.querySelectorAll('button').forEach(b => { b.hidden = b.dataset.v === car.value; b.setAttribute('aria-pressed', String(compare.value === b.dataset.v && $('main').classList.contains('kb-cmp-view'))); });
  for (const [v, label] of wanted) { if (![...compare.options].some(o => o.value === v)) continue; const b = el('button', '', label); b.type = 'button'; b.dataset.v = v; b.addEventListener('click', () => { compare.value = v; if (showTab) showTab('compare'); compare.dispatchEvent(new Event('change', { bubbles: true })); sync(); }); row.append(b); }
  compare.addEventListener('change', sync); car.addEventListener('change', sync); sync();
  ($('.kb-sim-summary') || q('pole') || q('lap')).after(row);
 }

 // --- Folded detail sections ---
 function foldSections() {
  const hints = sec => {
   if (sec.querySelector('[data-ls="air"]')) return t('기온·노면·바람·공기 밀도', 'Temperature, track, wind, air density');
   if (sec.classList.contains('ls-evo')) return t('세션 시각별 랩타임 · 자동 재생', 'Lap time over the session · Auto');
   if (sec.querySelector('ul.ls-changes') && !sec.querySelector('li.ls-change')) return t('이번 주말 공지된 변경 없음', 'No changes announced this weekend');
   if (sec.querySelector('ul.ls-changes')) { const all = sec.querySelectorAll('li.ls-change').length, can = sec.querySelectorAll('input[data-change]').length, on = sec.querySelectorAll('input[data-change]:checked').length; return t('변경 ' + all + '개 · 반영 가능 ' + can + '개 · 켠 항목 ' + on + '개', all + ' changes · ' + can + ' can change lap time · ' + on + ' on'); }
   if (sec.querySelector('svg.ls-race')) return t('전략별 레이스 타임 · 랩별 예상 페이스', 'Race time by strategy · expected lap pace');
   if (sec.querySelector('table.ls-table')) return t('실제 폴과의 오차 · 2027–2028 예측', 'Error vs real pole · 2027–2028 projection');
   if (sec.querySelector('#lapsim-data')) return t('모델이 다루는 것과 다루지 않는 것', 'What the model covers and leaves out');
   return t('펼쳐서 보기', 'Open to see');
  };
  for (const sec of document.querySelectorAll('main section.panel.ls-panel')) {
   if (sec.querySelector('[data-ls="trace"]') || sec.classList.contains('ls-cmp-panel') || sec.querySelector(':scope>.kb-sec-fold')) continue;
   const h2 = sec.querySelector(':scope>h2'); if (!h2) continue;
   const fold = el('details', 'kb-sec-fold'), sum = el('summary'), hint = el('span', 'kb-sec-hint'); hint.setAttribute('data-no-translate', '');
   sum.append(h2, hint); fold.append(sum); for (const n of [...sec.childNodes]) fold.append(n); sec.append(fold);
   const upd = () => { hint.textContent = hints(sec); }; upd(); sec.addEventListener('change', upd);
   const inner = fold.querySelector('.kb-fold'); if (inner) inner.open = true;
  }
  const mode = q('mode'), air = q('air')?.closest('.kb-sec-fold');
  if (mode && air) { const open = () => { if (mode.value === 'manual') air.open = true; }; mode.addEventListener('change', open); open(); }
 }

 // --- Lap / compare tabs (owner 2026-11-15: the setup tab left the page, the setup simulator has its own menu page) ---
 function tabs() {
  const hero = $('main .ls-hero'); if (!hero || $('.kb-sim-tabs')) return;
  const bar = el('div', 'kb-sim-tabs'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', t('시뮬레이터 보기', 'Simulator view')); bar.setAttribute('data-no-translate', '');
  const mk = (id, label) => { const b = el('button', '', label); b.type = 'button'; b.id = 'kb-tab-' + id; b.setAttribute('role', 'tab'); return b; };
  const lapTab = mk('lap', t('랩타임 시뮬레이션', 'Lap-time simulation')), cmpTab = mk('compare', t('비교하기', 'Compare'));
  bar.append(lapTab, cmpTab); hero.after(bar);
  const main = $('main');
  function show(which, focus) {
   const cmp = which === 'compare';
   lapTab.setAttribute('aria-selected', String(!cmp)); cmpTab.setAttribute('aria-selected', String(cmp)); lapTab.tabIndex = cmp ? -1 : 0; cmpTab.tabIndex = cmp ? 0 : -1;
   main.classList.toggle('kb-cmp-view', cmp); if (focus) (cmp ? cmpTab : lapTab).focus();
   try { history.replaceState(null, '', location.pathname + location.search + (cmp ? '#compare' : '')); } catch (e) {}
   document.dispatchEvent(new CustomEvent('kb-sim-view', { detail: cmp ? 'compare' : 'lap' }));
  }
  showTab = show;
  lapTab.addEventListener('click', () => show('lap')); cmpTab.addEventListener('click', () => show('compare'));
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(lapTab.getAttribute('aria-selected') === 'true' ? 'compare' : 'lap', true); } });
  if (location.hash === '#setup') { const tr = new URLSearchParams(location.search).get('track'); location.href = '/setup' + (tr ? '?track=' + encodeURIComponent(tr) : ''); return; }
  show(location.hash === '#compare' ? 'compare' : 'lap');
 }
 let showTab = null;

 const start = () => {
  safe(tabs); safe(enhanceMap); safe(summary); safe(presets); safe(foldSections);
  const map = q('map'); if (map) new MutationObserver(() => { safe(enhanceMap); }).observe(map, { childList: true });
  let timer = null; const lap = q('lap'); if (lap) new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => safe(summary), 120); }).observe(lap, { childList: true, characterData: true, subtree: true });
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
