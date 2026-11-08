// Simulator page UI, applied from outside the simulator script (attribute lookups only):
// lap / setup tabs, a plain result sentence with one-tap compare buttons, folded detail
// sections, and a map overlay (checkered finish line, corner labels placed beside the
// track, corner names for selected tracks). The map is redrawn by the simulator on every
// change, so the overlay is re-applied on each redraw (before paint, via MutationObserver).

// Corner names for the current F1 numbering. One entry may cover several turns; the name
// is shown at the first turn of the list.
// Spa uses the forms Korean fans use (owner's choice: 푸옹, 파녜, 스타벨로, 르 콤브, 말메디, 재키 익스).
// Sources: formula1.com and team corner guides, circuit sites; unnamed or uncertain turns are left out.
export const CORNER_NAMES = {"spa-francorchamps":[{"turns":[1],"ko":"라 수르스","en":"La Source"},{"turns":[2],"ko":"오 루주","en":"Eau Rouge"},{"turns":[3,4],"ko":"레디옹","en":"Raidillon"},{"turns":[5,6],"ko":"르 콤브","en":"Les Combes"},{"turns":[7],"ko":"말메디","en":"Malmedy"},{"turns":[8],"ko":"브뤼셀","en":"Bruxelles"},{"turns":[9],"ko":"재키 익스","en":"Jacky Ickx"},{"turns":[10,11],"ko":"푸옹","en":"Pouhon"},{"turns":[12,13],"ko":"파녜","en":"Fagnes"},{"turns":[15],"ko":"스타벨로","en":"Stavelot"},{"turns":[16,17],"ko":"블랑시몽","en":"Blanchimont"},{"turns":[18,19],"ko":"버스 스톱","en":"Bus Stop"}],"monza":[{"turns":[1,2],"ko":"레티필로","en":"Rettifilo"},{"turns":[3],"ko":"쿠르바 그란데","en":"Curva Grande"},{"turns":[4,5],"ko":"로자","en":"Roggia"},{"turns":[6],"ko":"레즈모 1","en":"Lesmo 1"},{"turns":[7],"ko":"레즈모 2","en":"Lesmo 2"},{"turns":[8,9,10],"ko":"아스카리","en":"Ascari"},{"turns":[11],"ko":"파라볼리카","en":"Parabolica"}],"silverstone":[{"turns":[1],"ko":"애비","en":"Abbey"},{"turns":[2],"ko":"팜","en":"Farm"},{"turns":[3],"ko":"빌리지","en":"Village"},{"turns":[4],"ko":"루프","en":"Loop"},{"turns":[5],"ko":"에인트리","en":"Aintree"},{"turns":[6],"ko":"브루클랜즈","en":"Brooklands"},{"turns":[7],"ko":"러필드","en":"Luffield"},{"turns":[8],"ko":"우드코트","en":"Woodcote"},{"turns":[9],"ko":"콥스","en":"Copse"},{"turns":[10,11],"ko":"매고츠","en":"Maggotts"},{"turns":[12,13],"ko":"베케츠","en":"Becketts"},{"turns":[14],"ko":"채플","en":"Chapel"},{"turns":[15],"ko":"스토","en":"Stowe"},{"turns":[16],"ko":"베일","en":"Vale"},{"turns":[17,18],"ko":"클럽","en":"Club"}],"interlagos":[{"turns":[1,2],"ko":"세나 S","en":"Senna S"},{"turns":[3],"ko":"쿠르바 두 솔","en":"Curva do Sol"},{"turns":[4,5],"ko":"데시다 두 라구","en":"Descida do Lago"},{"turns":[6,7],"ko":"페라두라","en":"Ferradura"},{"turns":[8],"ko":"라란지냐","en":"Laranjinha"},{"turns":[9],"ko":"피녜이리뉴","en":"Pinheirinho"},{"turns":[10],"ko":"비쿠 지 파투","en":"Bico de Pato"},{"turns":[11],"ko":"메르굴류","en":"Mergulho"},{"turns":[12],"ko":"중상","en":"Junção"},{"turns":[13],"ko":"카페","en":"Café"}],"imola":[{"turns":[2,3,4],"ko":"탐부렐로","en":"Tamburello"},{"turns":[5,6],"ko":"빌뇌브","en":"Villeneuve"},{"turns":[7],"ko":"토사","en":"Tosa"},{"turns":[9],"ko":"피라텔라","en":"Piratella"},{"turns":[11,12,13],"ko":"아쿠에 미네랄리","en":"Acque Minerali"},{"turns":[14,15],"ko":"바리안테 알타","en":"Variante Alta"},{"turns":[17,18],"ko":"리바차","en":"Rivazza"}],"suzuka":[{"turns":[3,4,5,6],"ko":"S 커브","en":"S Curves"},{"turns":[7],"ko":"던롭","en":"Dunlop"},{"turns":[8,9],"ko":"데그너","en":"Degner"},{"turns":[11],"ko":"헤어핀","en":"Hairpin"},{"turns":[13,14],"ko":"스푼","en":"Spoon"},{"turns":[15],"ko":"130R","en":"130R"},{"turns":[16,17],"ko":"카시오 트라이앵글","en":"Casio Triangle"}],"zandvoort":[{"turns":[1],"ko":"타잔","en":"Tarzan"},{"turns":[2],"ko":"헤를라흐","en":"Gerlach"},{"turns":[3],"ko":"휘헨홀츠","en":"Hugenholtz"},{"turns":[4],"ko":"훈서루흐","en":"Hunserug"},{"turns":[5],"ko":"슬로테마커","en":"Slotemaker"},{"turns":[6,7],"ko":"스헤이블락","en":"Scheivlak"},{"turns":[8],"ko":"마스터스","en":"Masters"},{"turns":[11,12],"ko":"한스 에른스트","en":"Hans Ernst"},{"turns":[14],"ko":"아리 라위언데이크","en":"Arie Luyendyk"}],"monte-carlo":[{"turns":[1],"ko":"생트 데보트","en":"Sainte Dévote"},{"turns":[2],"ko":"보 리바주","en":"Beau Rivage"},{"turns":[3],"ko":"마스네","en":"Massenet"},{"turns":[4],"ko":"카지노","en":"Casino"},{"turns":[5],"ko":"미라보 오트","en":"Mirabeau Haute"},{"turns":[6],"ko":"페어몬트 헤어핀","en":"Fairmont Hairpin"},{"turns":[7],"ko":"미라보 바","en":"Mirabeau Bas"},{"turns":[8],"ko":"포르티에","en":"Portier"},{"turns":[9],"ko":"터널","en":"Tunnel"},{"turns":[10,11],"ko":"누벨 시칸","en":"Nouvelle Chicane"},{"turns":[12],"ko":"타바크","en":"Tabac"},{"turns":[13,14,15,16],"ko":"수영장","en":"Piscine"},{"turns":[18],"ko":"라스카스","en":"Rascasse"},{"turns":[19],"ko":"앙토니 노게스","en":"Anthony Noghès"}]};

export const simulatorUiCss = `
.kb-sim-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;border-bottom:1px solid var(--line);padding-bottom:8px;position:relative}
.kb-sim-tabs button{min-height:44px;padding:0 16px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font:inherit;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.kb-sim-tabs button[aria-selected="true"]{border-color:var(--mint);color:var(--text);box-shadow:inset 0 0 0 1px var(--mint)}
.kb-soon{font-size:12px;font-weight:700;padding:1px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.kb-setup-view .ls-controls,.kb-setup-view .ls-stage,.kb-setup-view section.panel:not(.kb-setup-panel){display:none!important}
.kb-setup-panel h2{margin-top:0}.kb-setup-panel ul{margin:8px 0 16px;padding-left:20px;color:var(--muted)}.kb-setup-panel .kb-empty-actions{display:flex;gap:8px;flex-wrap:wrap}
.kb-sim-summary{margin:4px 0 0;font-size:16px;line-height:1.55;color:var(--text);max-width:520px}.kb-sim-summary b{font-variant-numeric:tabular-nums}
.kb-presets{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}.kb-presets button{font:inherit;font-size:14px;font-weight:600;min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);cursor:pointer}.kb-presets button[aria-pressed="true"]{border-color:var(--mint);box-shadow:inset 0 0 0 1px var(--mint)}
.kb-sec-fold>summary{display:flex;align-items:baseline;justify-content:space-between;gap:12px;cursor:pointer;list-style:none}.kb-sec-fold>summary::-webkit-details-marker{display:none}
.kb-sec-fold>summary h2{margin:0}.kb-sec-fold>summary::after{content:"＋";color:var(--muted);font-size:20px;line-height:1}.kb-sec-fold[open]>summary::after{content:"－"}
.kb-sec-fold>summary .kb-sec-hint{flex:1 1 auto;color:var(--muted);font-size:14px;text-align:right;margin-right:4px}
.kb-sec-fold[open]>summary{margin-bottom:12px}.kb-sec-fold .kb-fold{border-top:0;margin-top:0}.kb-sec-fold .kb-fold>summary{display:none}
.ls-map .ls-start{display:none}
.ls-map .ls-corner{paint-order:stroke;stroke:var(--bg);stroke-linejoin:round;dominant-baseline:central}
.ls-map .kb-corner-name{fill:var(--muted);font-weight:600}.ls-map .kb-corner-sub{font-weight:500;opacity:.8}
.ls-map .kb-leader{stroke:var(--muted);opacity:.55;fill:none}
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
 const nameAt = num => { const n = Number(num); const hit = names().find(e => e.turns.includes(n)); return hit ? { name: en ? hit.en : hit.ko, sub: en || hit.en === hit.ko ? '' : hit.en, first: hit.turns[0] === n } : null; };

 // --- Map geometry ---
 function mapGeometry(svg) {
  const paths = [...svg.querySelectorAll('g>path')]; if (!paths.length) return null;
  const pts = []; for (const p of paths) { const nums = (p.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]); }
  const g = svg.querySelector('g'), sw = Number(g?.getAttribute('stroke-width')) || 20;
  const vb = (svg.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number);
  return { pts, sw, vb, paths };
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
  const [a, b] = [geo.pts[0], geo.pts[Math.min(geo.pts.length - 1, 4)]]; if (!a || !b) return;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  const across = geo.sw * 3.4, along = geo.sw * 1.3, cols = 6, rows = 2, cw = across / cols, rh = along / rows;
  const grp = svgEl('g', { class: 'kb-flag', transform: 'translate(' + a[0] + ' ' + a[1] + ') rotate(' + (ang + 90) + ')', 'aria-hidden': 'true' });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grp.append(svgEl('rect', { x: (-across / 2 + c * cw).toFixed(2), y: (-along / 2 + r * rh).toFixed(2), width: cw.toFixed(2), height: rh.toFixed(2), class: (r + c) % 2 ? 'kb-flag-light' : 'kb-flag-dark' }));
  grp.append(svgEl('rect', { x: (-across / 2).toFixed(2), y: (-along / 2).toFixed(2), width: across.toFixed(2), height: along.toFixed(2), class: 'kb-flag-edge', 'stroke-width': (geo.sw * 0.12).toFixed(2) }));
  const corners = svg.querySelector('.ls-corner'); corners ? svg.insertBefore(grp, corners) : svg.append(grp);
 }

 function placeCorners(svg, geo) {
  svg.querySelectorAll('.kb-leader').forEach(n => n.remove());
  const labels = [...svg.querySelectorAll('text.ls-corner')]; if (!labels.length) return;
  const fs = geo.sw * 3.4, placed = [], [vx, vy, vw, vh] = geo.vb, margin = fs * 0.4;
  const boxes = (x, y, w, h) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 });
  if (geo.pts[0]) { const a = geo.pts[0], r = geo.sw * 2; placed.push({ x0: a[0] - r, x1: a[0] + r, y0: a[1] - r, y1: a[1] + r }); } // keep labels off the finish flag
  const hits = b => placed.some(p => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
  const grow = () => { const labelsBoxes = placed.slice(1); if (!labelsBoxes.length) return; const x0 = Math.min(vx, ...labelsBoxes.map(b => b.x0)), y0 = Math.min(vy, ...labelsBoxes.map(b => b.y0)), x1 = Math.max(vx + vw, ...labelsBoxes.map(b => b.x1)), y1 = Math.max(vy + vh, ...labelsBoxes.map(b => b.y1)); svg.setAttribute('viewBox', [x0, y0, x1 - x0, y1 - y0].map(v => v.toFixed(1)).join(' ')); };
  for (const label of labels) {
   if (!label.dataset.kbX) { label.dataset.kbX = label.getAttribute('x'); label.dataset.kbY = label.getAttribute('y'); }
   const ax = Number(label.dataset.kbX), ay = Number(label.dataset.kbY), num = label.textContent.replace(/\D.*$/, '') || label.textContent;
   const info = nameAt(num), showName = info && info.first;
   label.removeAttribute('dy'); label.textContent = label.textContent.split(' ')[0];
   label.querySelectorAll('tspan').forEach(n => n.remove());
   const numText = label.textContent;
   const nameFs = fs * 0.58, subFs = fs * 0.46, textW = (str, size) => [...str].reduce((a, ch) => a + size * (/[\u3131-\uD7A3]/.test(ch) ? 0.95 : ch === ' ' ? 0.3 : 0.58), 0);
   const lines = showName ? [[info.name, nameFs, 'kb-corner-name']].concat(info.sub ? [[info.sub, subFs, 'kb-corner-name kb-corner-sub']] : []) : [];
   label.setAttribute('stroke-width', (fs * 0.22).toFixed(1)); label.setAttribute('x', ax); label.setAttribute('y', ay);
   let prevF = fs; for (const [txt, f2, cls] of lines) { const ts = svgEl('tspan', { x: ax, dy: (prevF * 0.5 + f2 * 0.65).toFixed(1), class: cls, 'font-size': f2.toFixed(1) }); ts.textContent = txt; label.append(ts); prevF = f2; }
   let bb = null; try { bb = label.getBBox(); } catch (e) {}
   const halo = fs * 0.22;
   const w = bb && bb.width ? bb.width + halo : Math.max(textW(numText, fs), ...lines.map(([s2, f2]) => textW(s2, f2))), h = bb && bb.height ? bb.height + halo : fs + lines.reduce((a, [, f2]) => a + f2 * 1.15, 0);
   const offY = bb && bb.height ? (bb.y + bb.height / 2) - ay : 0; // text centre relative to its y attribute
   const i = nearest(geo.pts, ax, ay), p0 = geo.pts[Math.max(0, i - 3)], p1 = geo.pts[Math.min(geo.pts.length - 1, i + 3)];
   let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
   const base = geo.sw * 1.1 + Math.max(w, h) * 0.55, gap = geo.sw * 1.05;
   // clearance of the whole label box from the track (3 x 3 sample points)
   const boxClear = b => rectClear(geo.pts, b);
   const cands = [];
   for (const dist of [base, base * 1.3, base * 1.7, base * 2.2, base * 2.9]) for (const rot of [0, 20, -20, 40, -40, 60, -60, 85, -85, 115, -115]) for (const side of [1, -1]) {
    const r = rot * Math.PI / 180, nx = -ty * side, ny = tx * side, dx = nx * Math.cos(r) - ny * Math.sin(r), dy = nx * Math.sin(r) + ny * Math.cos(r);
    const x = ax + dx * dist, y = ay + dy * dist, b = boxes(x, y, w + margin, h + margin);
    const out = Math.max(vw, vh) * 0.06; if (b.x0 < vx - out || b.y0 < vy - out || b.x1 > vx + vw + out || b.y1 > vy + vh + out || hits(b)) continue;
    cands.push({ x, y, b, dist, rot, c: boxClear(boxes(x, y, w, h)) });
   }
   // nearest spot with enough room; if none has room, the spot farthest from the track
   const ok = cands.filter(k => k.c >= gap).sort((a, b) => a.dist - b.dist || Math.abs(a.rot) - Math.abs(b.rot));
   let best = ok[0] || cands.sort((a, b) => b.c - a.c)[0];
   if (!best) { const x = ax, y = ay - base; best = { x, y, b: boxes(x, y, w, h), dist: base }; }
   placed.push(best.b);
   label.setAttribute('x', best.x.toFixed(1)); label.setAttribute('y', (best.y - offY).toFixed(1));
   label.querySelectorAll('tspan').forEach(ts => ts.setAttribute('x', best.x.toFixed(1)));
   if (best.dist > base * 1.25) {
    const k = (best.dist - Math.max(w, h) * 0.55) / best.dist, sx = ax + (best.x - ax) * 0.25, sy = ay + (best.y - ay) * 0.25;
    svg.insertBefore(svgEl('line', { x1: sx.toFixed(1), y1: sy.toFixed(1), x2: (ax + (best.x - ax) * k).toFixed(1), y2: (ay + (best.y - ay) * k).toFixed(1), class: 'kb-leader', 'stroke-width': (geo.sw * 0.12).toFixed(2) }), label);
   }
  }
  grow();
 }

 const layoutCache = new Map();
 function enhanceMap() {
  const svg = q('map')?.querySelector('svg.ls-map'); if (!svg || svg.dataset.kbMap === '1') return;
  svg.dataset.kbMap = '1'; const geo = mapGeometry(svg); if (!geo) return;
  safe(() => finishLine(svg, geo));
  // label layout depends only on track shape and labels, not on the colours a slider changes: cache it
  const labels = [...svg.querySelectorAll('text.ls-corner')], key = svg.getAttribute('viewBox') + '|' + labels.map(l => l.getAttribute('x') + ',' + l.getAttribute('y') + ',' + l.textContent).join(';') + '|' + (en ? 'en' : 'ko');
  const hit = layoutCache.get(key);
  if (hit) { safe(() => { svg.setAttribute('viewBox', hit.viewBox); labels.forEach((l, i) => { l.outerHTML = hit.labels[i]; }); const first = svg.querySelector('text.ls-corner'); for (const ln of hit.leaders) { const tmp = document.createElementNS(ns, 'g'); tmp.innerHTML = ln; first ? svg.insertBefore(tmp.firstChild, first) : svg.append(tmp.firstChild); } }); return; }
  safe(() => placeCorners(svg, geo));
  layoutCache.set(key, { viewBox: svg.getAttribute('viewBox'), labels: [...svg.querySelectorAll('text.ls-corner')].map(l => l.outerHTML), leaders: [...svg.querySelectorAll('.kb-leader')].map(l => l.outerHTML) });
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
  const sync = () => row.querySelectorAll('button').forEach(b => { b.hidden = b.dataset.v === car.value; b.setAttribute('aria-pressed', String(compare.value === b.dataset.v)); });
  for (const [v, label] of wanted) { if (![...compare.options].some(o => o.value === v)) continue; const b = el('button', '', label); b.type = 'button'; b.dataset.v = v; b.addEventListener('click', () => { compare.value = compare.value === v ? '' : v; compare.dispatchEvent(new Event('change', { bubbles: true })); sync(); }); row.append(b); }
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
   if (sec.querySelector('[data-ls="trace"]') || sec.querySelector(':scope>.kb-sec-fold')) continue;
   const h2 = sec.querySelector(':scope>h2'); if (!h2) continue;
   const fold = el('details', 'kb-sec-fold'), sum = el('summary'), hint = el('span', 'kb-sec-hint'); hint.setAttribute('data-no-translate', '');
   sum.append(h2, hint); fold.append(sum); for (const n of [...sec.childNodes]) fold.append(n); sec.append(fold);
   const upd = () => { hint.textContent = hints(sec); }; upd(); sec.addEventListener('change', upd);
   const inner = fold.querySelector('.kb-fold'); if (inner) inner.open = true;
  }
  const mode = q('mode'), air = q('air')?.closest('.kb-sec-fold');
  if (mode && air) { const open = () => { if (mode.value === 'manual') air.open = true; }; mode.addEventListener('change', open); open(); }
 }

 // --- Lap / setup tabs ---
 function tabs() {
  const hero = $('main .ls-hero'); if (!hero || $('.kb-sim-tabs')) return;
  const bar = el('div', 'kb-sim-tabs'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', t('시뮬레이터 종류', 'Simulator type')); bar.setAttribute('data-no-translate', '');
  const mk = (id, label, soon) => { const b = el('button', '', label); b.type = 'button'; b.id = 'kb-tab-' + id; b.setAttribute('role', 'tab'); if (soon) b.append(el('span', 'kb-soon', t('준비 중', 'Soon'))); return b; };
  const lapTab = mk('lap', t('랩타임 시뮬레이션', 'Lap-time simulation')), setupTab = mk('setup', t('셋업 시뮬레이션', 'Setup simulation'), true);
  bar.append(lapTab, setupTab); hero.after(bar);
  const panel = el('section', 'panel kb-setup-panel'); panel.id = 'kb-setup'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'kb-tab-setup'); panel.setAttribute('data-no-translate', ''); panel.hidden = true;
  panel.append(el('h2', '', t('셋업 시뮬레이션은 준비 중입니다', 'Setup simulation is coming')), el('p', '', t('세션 기록과 FIA 문서로 팀별 셋업을 추정합니다. 이런 것을 보여 줄 예정입니다.', 'It will estimate each team’s setup from session records and FIA documents, for example:')));
  const ul = el('ul'); for (const s of [t('다운포스 수준(윙 각도)과 직선 속도의 균형', 'Downforce level (wing) against straight-line speed'), t('차고·서스펜션 성향(연석 사용, 노면 대응)', 'Ride height and suspension tendency (kerbs, bumps)'), t('타이어 운용: 워밍업, 공기압·캠버 한도(FIA 문서)', 'Tyre use: warm-up, pressure and camber limits (FIA documents)')]) ul.append(el('li', '', s));
  const act = el('div', 'kb-empty-actions'); const back = el('button', 'button', t('랩타임 시뮬레이션 해 보기', 'Try lap-time simulation')); back.type = 'button'; back.addEventListener('click', () => show('lap', true)); act.append(back);
  panel.append(ul, act); bar.after(panel);
  const main = $('main');
  function show(which, focus) { const setup = which === 'setup'; lapTab.setAttribute('aria-selected', String(!setup)); setupTab.setAttribute('aria-selected', String(setup)); lapTab.tabIndex = setup ? -1 : 0; setupTab.tabIndex = setup ? 0 : -1; panel.hidden = !setup; main.classList.toggle('kb-setup-view', setup); if (focus) (setup ? setupTab : lapTab).focus(); try { history.replaceState(null, '', setup ? '#setup' : location.pathname + location.search); } catch (e) {} }
  lapTab.addEventListener('click', () => show('lap')); setupTab.addEventListener('click', () => show('setup'));
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(lapTab.getAttribute('aria-selected') === 'true' ? 'setup' : 'lap', true); } });
  show(location.hash === '#setup' ? 'setup' : 'lap');
 }

 const start = () => {
  safe(tabs); safe(enhanceMap); safe(summary); safe(presets); safe(foldSections);
  const map = q('map'); if (map) new MutationObserver(() => { safe(enhanceMap); }).observe(map, { childList: true });
  let timer = null; const lap = q('lap'); if (lap) new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => safe(summary), 120); }).observe(lap, { childList: true, characterData: true, subtree: true });
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
