// UI motion layer: skeleton loaders, empty states, table motion, tab ink, hero entry,
// copy feedback and simulation-page replay. Progressive enhancement only: it reads the
// DOM other modules render and never changes their data or handlers. If an element it
// expects is missing, that effect does nothing. Every effect honours reduced motion.
// Skills applied: vectorlab motion/transitions/loaders/empty-states/reduced-motion,
// design-taste-frontend (hover/press, one entry moment), anime.js (WAAPI-first timing).

export const uiMotionCss = `
:root{--kb-ease:cubic-bezier(.2,.7,.2,1);--kb-ease-out:cubic-bezier(.2,0,0,1);--kb-fast:140ms;--kb-base:220ms;--kb-slow:420ms}
.kb-skeleton{display:grid;gap:0;margin:8px 0 0}.kb-skeleton-row{display:grid;grid-template-columns:40px minmax(0,1fr) 90px;gap:16px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
.kb-skeleton-row.kb-wide{grid-template-columns:40px minmax(0,1.4fr) 90px minmax(0,1fr)}
.kb-bone{display:block;height:12px;border-radius:6px;background:color-mix(in oklab,var(--text) 9%,transparent)}.kb-bone.kb-two{height:28px;background:linear-gradient(color-mix(in oklab,var(--text) 9%,transparent) 0 12px,transparent 12px 18px,color-mix(in oklab,var(--text) 6%,transparent) 18px 28px);background-size:70% 100%;background-repeat:no-repeat}
.kb-skeleton-row:nth-child(3n) .kb-two{background-size:55% 100%}.kb-skeleton-row:nth-child(3n+1) .kb-two{background-size:62% 100%}
.kb-empty{display:grid;justify-items:start;gap:8px;padding:24px 0 8px;border-top:1px solid var(--line)}.kb-empty-icon{display:inline-grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:50%;color:var(--mint)}
.kb-empty h3{margin:4px 0 0;font-size:17px}.kb-empty p{margin:0;color:var(--muted);max-width:560px}.kb-empty-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.coming-soon .kb-empty{border-top:0;padding-top:4px}
.standings-table td:last-child{position:relative}.kb-share{position:absolute;left:0;right:12px;bottom:6px;height:2px;border-radius:2px;background:color-mix(in oklab,var(--mint) 70%,transparent);transform-origin:left center;transform:scaleX(var(--kb-share,0))}
.tab-list.kb-has-ink{position:relative}.kb-tab-ink{position:absolute;left:0;bottom:-1px;height:2px;width:0;border-radius:2px;background:var(--mint);pointer-events:none}
.kb-copied::before{content:"✓ ";font-weight:700}
.kb-lap-delta{display:inline-block;width:max-content;justify-self:start;align-self:start;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;padding:2px 8px;border-radius:999px;border:1px solid currentColor;opacity:0}
.kb-lap-delta.kb-faster{color:var(--mint)}.kb-lap-delta.kb-slower{color:var(--sim-slow,#ffa94d)}.kb-lap-delta.kb-show{opacity:1}
.kb-replay{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px}.kb-replay button{font:inherit;font-size:14px;font-weight:700;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);cursor:pointer}
.kb-auto{font:inherit;font-size:13px;font-weight:700;min-height:32px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);cursor:pointer;justify-self:start}.kb-auto[aria-pressed="true"]{border-color:var(--mint);box-shadow:inset 0 0 0 1px var(--mint)}.kb-auto-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 12px}.kb-auto-row .fine{margin:0}
.kb-fold{border-top:1px solid var(--line);margin-top:12px}.kb-fold>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;cursor:pointer;list-style:none;font-weight:700}.kb-fold>summary::-webkit-details-marker{display:none}.kb-fold>summary::after{content:"＋";color:var(--muted);font-weight:400}.kb-fold[open]>summary::after{content:"－"}
.kb-fold-count{color:var(--muted);font-weight:400;font-size:14px}.kb-fold-sub{margin-top:8px}.kb-fold-sub>summary{font-weight:600;font-size:14px;padding:10px 0}
.kb-fold .ls-changes{list-style:none;margin:8px 0;padding:0;display:grid;gap:0}.kb-fold .ls-change{border-bottom:1px solid var(--line)}.kb-fold .ls-change>label{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;padding:10px 0;cursor:pointer}.kb-fold .ls-change.is-info>label{cursor:default}
.kb-fold .ls-change input{margin:3px 0 0;accent-color:var(--mint)}.kb-fold .ls-change .ls-dot{width:8px;height:8px;margin:7px 0 0 4px;border-radius:50%;background:var(--line)}.kb-fold .ls-change-text{display:block;line-height:1.45}.kb-fold .ls-change small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.kb-fold .ls-change.is-info .ls-change-text{color:var(--muted)}
.kb-replay-seek{flex:1 1 180px;min-width:140px;accent-color:var(--mint)}.kb-replay button[hidden]{display:none}.ls-trace{cursor:col-resize;touch-action:pan-y}
.kb-replay-time{font-variant-numeric:tabular-nums;color:var(--muted);font-size:14px}.kb-car{fill:var(--text);stroke:var(--bg);pointer-events:none}.kb-cursor{stroke:var(--text);stroke-width:2;opacity:.7;pointer-events:none}
@media(prefers-reduced-motion:no-preference){
 .kb-skeleton .kb-bone{animation:kb-pulse 1.4s ease-in-out infinite}
 .kb-enter{animation:kb-enter var(--kb-base) var(--kb-ease) both}
 .kb-row-enter{animation:kb-enter 260ms var(--kb-ease) both;animation-delay:calc(var(--kb-i,0) * 24ms)}
 .kb-share{transition:transform 600ms var(--kb-ease)}.kb-share.kb-share-start{transform:scaleX(0)}
 .kb-tab-ink{transition:transform 260ms var(--kb-ease),width 260ms var(--kb-ease)}
 .tab-panel:not([hidden]){animation:kb-enter var(--kb-base) var(--kb-ease) both}
 .kb-copied{animation:kb-press 260ms var(--kb-ease-out)}
 .kb-lap-delta{transition:opacity 180ms ease}
 .hero h1.kb-hero-enter{animation:kb-rise 520ms var(--kb-ease) both}.hero h1.kb-hero-enter em{display:inline-block;animation:kb-rise 520ms var(--kb-ease) 120ms both}
 .hero .lead.kb-hero-enter{animation:kb-enter 480ms var(--kb-ease) 260ms both}
 header .brand.kb-brand-enter img{animation:kb-wipe 640ms var(--kb-ease) both}
 a.race-card:hover,.race-card[href]:hover,.coming-soon .button:hover,.kb-replay button:hover{transform:translateY(-2px)}
 a.race-card,.race-card[href]{transition:transform var(--kb-base) var(--kb-ease),border-color var(--kb-base) ease,box-shadow var(--kb-base) ease}
 .button:active,button:active{transform:scale(.98)}
}
@keyframes kb-pulse{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes kb-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes kb-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes kb-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes kb-press{0%{transform:scale(1)}40%{transform:scale(.96)}100%{transform:scale(1)}}
@keyframes kb-fade{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){
 .kb-enter,.kb-row-enter,.tab-panel:not([hidden]),.kb-empty{animation:kb-fade 120ms linear both!important}
 .kb-lap-delta{transition:opacity 120ms linear!important}
 .kb-replay [data-kb-play]{display:none}
}
`;

export function uiMotionClient() {
 const en = document.documentElement.lang === 'en', t = (ko, eng) => en ? eng : ko;
 const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
 const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
 const safe = fn => { try { fn(); } catch (e) { /* enhancement only */ } };
 const announce = text => { const live = document.getElementById('copy-feedback'); if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); } };

 // 1. Skeleton loaders: shown after 150 ms while a results container is busy and empty.
 function skeletonFor(target, wide) {
  const box = el('div', 'kb-skeleton'); box.setAttribute('aria-hidden', 'true'); box.dataset.kbSkeleton = '';
  for (let i = 0; i < 8; i++) { const row = el('div', 'kb-skeleton-row' + (wide ? ' kb-wide' : '')); row.append(el('span', 'kb-bone'), el('span', 'kb-bone kb-two'), el('span', 'kb-bone')); if (wide) row.append(el('span', 'kb-bone')); box.append(row); }
  return box;
 }
 function watchBusy(target, wide) {
  let timer = null;
  const check = () => {
   const busy = target.getAttribute('aria-busy') === 'true';
   const skeleton = target.querySelector(':scope>[data-kb-skeleton]');
   if (!busy) { clearTimeout(timer); timer = null; skeleton?.remove(); return; }
   if (!skeleton && !timer && !target.children.length) timer = setTimeout(() => { timer = null; if (target.getAttribute('aria-busy') === 'true' && !target.children.length) target.append(skeletonFor(target, wide)); }, 150);
  };
  new MutationObserver(check).observe(target, { attributes: true, attributeFilter: ['aria-busy'], childList: true });
  check();
 }

 // 2. Table motion: rows enter with a short stagger; background refreshes slide rows to new places.
 const rowKey = tr => (tr.querySelector('.participant-text')?.firstChild?.textContent || tr.cells[1]?.textContent || '').trim();
 function watchTable(target, withShare) {
  let last = null;
  new MutationObserver(() => safe(() => {
   const table = target.querySelector(':scope>table'); if (!table || table === last?.table) return;
   const caption = table.caption?.textContent || '', rows = [...table.tBodies[0]?.rows || []];
   if (withShare) addShare(rows);
   if (!reduce() && last && last.caption === caption && last.rects.size) {
    for (const tr of rows) { const before = last.rects.get(rowKey(tr)); if (!before) continue; const now = tr.getBoundingClientRect(), dy = before - now.top; if (Math.abs(dy) > 1) tr.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' }); }
   } else rows.slice(0, 9).forEach((tr, i) => { tr.style.setProperty('--kb-i', i); tr.classList.add('kb-row-enter'); tr.addEventListener('animationend', () => tr.classList.remove('kb-row-enter'), { once: true }); });
   const rects = new Map(); for (const tr of rows) rects.set(rowKey(tr), tr.getBoundingClientRect().top);
   last = { table, caption, rects };
  })).observe(target, { childList: true });
 }
 function addShare(rows) {
  const points = rows.map(tr => Number(String(tr.cells[tr.cells.length - 1]?.textContent || '').replace(/[^\d.]/g, ''))), max = Math.max(...points.filter(Number.isFinite), 0);
  if (!max) return;
  rows.forEach((tr, i) => { const cell = tr.cells[tr.cells.length - 1]; if (!cell || !Number.isFinite(points[i]) || cell.querySelector('.kb-share')) return; const bar = el('span', 'kb-share kb-share-start'); bar.setAttribute('aria-hidden', 'true'); bar.style.setProperty('--kb-share', (points[i] / max).toFixed(3)); cell.append(bar); requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('kb-share-start'))); });
 }

 // 3. Empty states: say what belongs here, why, and give one way forward.
 function emptyBlock(title, text, actions) {
  const box = el('div', 'kb-empty kb-enter'); box.dataset.kbEmpty = ''; box.setAttribute('data-no-translate', '');
  const icon = el('span', 'kb-empty-icon', '◷'); icon.setAttribute('aria-hidden', 'true');
  const row = el('div', 'kb-empty-actions'); for (const a of actions) row.append(a);
  box.append(icon, el('h3', '', title), el('p', '', text)); if (actions.length) box.append(row); return box;
 }
 function actionButton(label, onClick, primary) { const b = el('button', 'button' + (primary ? '' : ' secondary'), label); b.type = 'button'; b.addEventListener('click', onClick); return b; }
 function actionLink(label, href) { const a = el('a', 'button secondary', label); a.href = href; return a; }
 function watchResultsEmpty(root) {
  const target = root.querySelector('[data-result-table]'), status = root.querySelector('[data-result-status]'), eventSelect = root.querySelector('[data-result-event]');
  if (!target || !status) return;
  const check = () => safe(() => {
   if (target.getAttribute('aria-busy') === 'true' || target.children.length) return;
   if (!/아직 없습니다|No published race results/.test(status.textContent)) return;
   const actions = [];
   if (eventSelect && eventSelect.selectedIndex >= 0 && eventSelect.options.length > 1) {
    const prev = eventSelect.selectedIndex > 0 ? eventSelect.selectedIndex - 1 : 1;
    actions.push(actionButton(t('직전 라운드 결과 보기', 'Show the previous round'), () => { eventSelect.selectedIndex = prev; eventSelect.dispatchEvent(new Event('change')); }, true));
   }
   target.append(emptyBlock(t('아직 공개된 결과가 없어요', 'No results published yet'), t('공식 결과는 보통 세션이 끝나고 몇 분 뒤에 올라옵니다. 올라오면 이 자리에 순위와 갭, 타이어가 표시됩니다.', 'Official results usually arrive a few minutes after the session ends. Positions, gaps and tyres will appear here.'), actions));
  });
  new MutationObserver(check).observe(target, { attributes: true, attributeFilter: ['aria-busy'], childList: true });
  new MutationObserver(check).observe(status, { childList: true, characterData: true, subtree: true });
 }
 function enhanceComingSoon() {
  document.querySelectorAll('.coming-soon').forEach(panel => safe(() => {
   if (panel.querySelector('[data-kb-empty]')) return;
   const tabs = panel.closest('[data-series-tabs]'), first = tabs?.querySelector('[role=tab]');
   const actions = [];
   if (first) actions.push(actionButton(t('지금은 ' + first.textContent.trim() + ' 보기', 'See ' + first.textContent.trim() + ' for now'), () => { first.click(); first.focus(); }, true));
   actions.push(actionLink(t('꽁보다 AI에게 물어보기', 'Ask Kongboda AI'), '/ai'));
   const row = el('div', 'kb-empty-actions'); row.dataset.kbEmpty = ''; row.setAttribute('data-no-translate', ''); for (const a of actions) row.append(a);
   panel.append(row);
  }));
 }
 function enhanceAlertsEmpty() {
  document.querySelectorAll('main p.fine').forEach(p => safe(() => {
   if (!/새 문서 알림이 없습니다|no new document alerts/i.test(p.textContent) || p.nextElementSibling?.dataset?.kbEmpty !== undefined) return;
   const row = el('div', 'kb-empty-actions'); row.dataset.kbEmpty = ''; row.setAttribute('data-no-translate', '');
   const link = actionLink(t('FIA 공식 문서 목록 열기', 'Open the FIA document list'), 'https://www.fia.com/documents/championships/fia-formula-one-world-championship-14'); link.target = '_blank'; link.rel = 'noopener noreferrer';
   row.append(link); p.after(el('p', 'fine', t('공식 문서는 보통 세션이 끝난 뒤에 올라옵니다.', 'Official documents usually arrive after a session ends.')), row);
  }));
 }

 // 4. Tab ink: a 2 px bar slides under the selected tab.
 function tabInk(list) {
  if (list.querySelector('.kb-tab-ink')) return;
  const ink = el('span', 'kb-tab-ink'); ink.setAttribute('aria-hidden', 'true'); list.classList.add('kb-has-ink'); list.append(ink);
  const place = () => { const tab = list.querySelector('[role=tab][aria-selected="true"]'); if (!tab) return; const box = list.getBoundingClientRect(), r = tab.getBoundingClientRect(); ink.style.width = r.width + 'px'; ink.style.transform = 'translateX(' + (r.left - box.left) + 'px)'; };
  new MutationObserver(place).observe(list, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
  addEventListener('resize', place); document.fonts?.ready?.then(place); place();
 }

 // 5. Hero: one entry moment per visit to the home page.
 function heroEntry() {
  if (location.pathname !== '/' || reduce()) return;
  let seen = false; try { seen = sessionStorage.getItem('kb-hero-seen') === '1'; sessionStorage.setItem('kb-hero-seen', '1'); } catch (e) {}
  if (seen) return;
  document.querySelector('main>.hero h1')?.classList.add('kb-hero-enter');
  document.querySelector('main>.hero .lead')?.classList.add('kb-hero-enter');
  document.querySelector('header .brand')?.classList.add('kb-brand-enter');
 }

 // 6. Copy feedback: a check mark and a spoken message; the existing handler keeps the label text.
 document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-copy-target],[data-copy],[data-copy-from]'); if (!b) return;
  setTimeout(() => { if (/복사 실패|Copy failed/.test(b.textContent)) return; b.classList.remove('kb-copied'); void b.offsetWidth; b.classList.add('kb-copied'); announce(t('클립보드에 복사했습니다.', 'Copied to the clipboard.')); setTimeout(() => b.classList.remove('kb-copied'), 1600); }, 60);
 });

 // 7. Simulation page: line draw, lap count-up, delta chip, lap replay. Read-only on the sim DOM.
 const parseLap = s => { const m = String(s).trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/); return m ? (Number(m[1] || 0) * 60 + Number(m[2])) : NaN; };
 const fmtLap = v => { const m = Math.floor(v / 60), s = (v - m * 60).toFixed(3).padStart(6, '0'); return m + ':' + s; };
 function simulation() {
  const lap = document.querySelector('[data-ls="lap"]'), mapBox = document.querySelector('[data-ls="map"]'), traceBox = document.querySelector('[data-ls="trace"]');
  if (!lap || !mapBox) return;
  // Delta chip beside the lap time; the lap element itself stays owned by the simulator script.
  let base = parseLap(lap.textContent), counting = false, written = '', chipTimer = null;
  const chip = el('span', 'kb-lap-delta'); chip.setAttribute('aria-hidden', 'true'); chip.setAttribute('data-no-translate', '');
  lap.after(chip);
  new MutationObserver(() => {
   if (counting && lap.textContent === written) return; counting = false; const v = parseLap(lap.textContent); if (!Number.isFinite(v) || !Number.isFinite(base)) { base = v; return; }
   const d = v - base; clearTimeout(chipTimer);
   if (Math.abs(d) < 0.0005) { chip.classList.remove('kb-show'); return; }
   chip.textContent = (d > 0 ? '+' : '−') + Math.abs(d).toFixed(3) + ' s'; chip.className = 'kb-lap-delta kb-show ' + (d < 0 ? 'kb-faster' : 'kb-slower');
   chipTimer = setTimeout(() => { chip.classList.remove('kb-show'); base = parseLap(lap.textContent); }, 2200);
  }).observe(lap, { childList: true, characterData: true, subtree: true });
  // Count-up once, when the readout is first seen.
  const countUp = () => {
   const target = parseLap(lap.textContent); if (!Number.isFinite(target) || reduce()) return;
   const text = lap.textContent, start = performance.now(), dur = 700;
   counting = true; written = text;
   // Stops at once if the simulator script writes a new value during the count.
   const step = now => { if (!counting || lap.textContent !== written) { counting = false; return; } const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3); written = k < 1 ? fmtLap(target * e) : text; lap.textContent = written; if (k < 1) requestAnimationFrame(step); else setTimeout(() => { counting = false; }, 0); };
   requestAnimationFrame(step);
  };
  // Lap replay built from the speed trace (x = distance, y = speed) and the map path lengths.
  function lapModel() {
   const svg = mapBox.querySelector('svg.ls-map'), trace = traceBox?.querySelector('svg.ls-trace'), line = trace?.querySelector('.ls-line-0');
   if (!svg || !line) return null;
   const paths = [...svg.querySelectorAll('g>path')]; if (!paths.length) return null;
   const lengths = paths.map(p => p.getTotalLength()), total = lengths.reduce((a, b) => a + b, 0);
   const ticks = [...trace.querySelectorAll('text.ls-axis[text-anchor="end"]')].map(n => ({ y: Number(n.getAttribute('y')), v: Number(n.textContent) })).filter(p => Number.isFinite(p.y) && Number.isFinite(p.v));
   if (ticks.length < 2) return null;
   const a = ticks[0], b = ticks[ticks.length - 1], speedAt = y => a.v + (y - a.y) * (b.v - a.v) / (b.y - a.y);
   const pts = (line.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []; if (pts.length < 8) return null;
   const xs = [], vs = []; for (let i = 0; i + 1 < pts.length; i += 2) { xs.push(pts[i]); vs.push(Math.max(20, speedAt(pts[i + 1]))); }
   const x0 = xs[0], x1 = xs[xs.length - 1], frac = [], time = [0];
   for (let i = 0; i < xs.length; i++) { frac.push((xs[i] - x0) / (x1 - x0)); if (i) time.push(time[i - 1] + (frac[i] - frac[i - 1]) * 2 / (vs[i] + vs[i - 1])); }
   const tEnd = time[time.length - 1]; if (!(tEnd > 0)) return null;
   const point = f => { let d = f * total; for (let i = 0; i < paths.length; i++) { if (d <= lengths[i] || i === paths.length - 1) return paths[i].getPointAtLength(Math.min(d, lengths[i])); d -= lengths[i]; } };
   const fracAtTime = tn => { const tt = tn * tEnd; let lo = 0, hi = time.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (time[m] <= tt) lo = m; else hi = m; } const k = (tt - time[lo]) / ((time[hi] - time[lo]) || 1); return frac[lo] + (frac[hi] - frac[lo]) * k; };
   return { svg, trace, paths, lengths, total, point, fracAtTime, x0, x1, width: Number(svg.getAttribute('stroke-width')) || Number(svg.querySelector('g')?.getAttribute('stroke-width')) || 20 };
  }
  function drawOn() {
   if (reduce()) return; const svg = mapBox.querySelector('svg.ls-map'); if (!svg) return;
   const paths = [...svg.querySelectorAll('g>path')], lengths = paths.map(p => p.getTotalLength()), total = lengths.reduce((a, b) => a + b, 0); let acc = 0; const dur = 1100;
   paths.forEach((p, i) => { const L = lengths[i]; p.animate([{ strokeDasharray: L + ' ' + L, strokeDashoffset: L }, { strokeDasharray: L + ' ' + L, strokeDashoffset: 0 }], { duration: Math.max(16, dur * L / total), delay: dur * acc / total, easing: 'linear', fill: 'backwards' }); acc += L; });
  }
  // Replay with play/pause, stop and seek (slider or click on the speed trace).
  const ns = 'http://www.w3.org/2000/svg';
  const rp = { k: 0, running: false, raf: 0, last: 0, model: null, car: null, cursor: null, lapS: NaN };
  const bar = el('div', 'kb-replay'); bar.setAttribute('data-no-translate', '');
  const playBtn = el('button', '', ''); playBtn.type = 'button'; playBtn.dataset.kbPlay = '';
  const stopBtn = el('button', '', '■'); stopBtn.type = 'button'; stopBtn.setAttribute('aria-label', t('재생 끝내기', 'End replay')); stopBtn.hidden = true;
  const seek = el('input', 'kb-replay-seek'); seek.type = 'range'; seek.min = '0'; seek.max = '1000'; seek.step = '1'; seek.value = '0'; seek.setAttribute('aria-label', t('랩 위치', 'Lap position'));
  const clock = el('span', 'kb-replay-time'); clock.setAttribute('aria-live', 'off');
  bar.append(playBtn, stopBtn, seek, clock);
  (mapBox.closest('figure') || mapBox).append(bar);
  const speedup = () => Math.max(4, Math.round(rp.lapS / 9));
  const label = () => { playBtn.textContent = rp.running ? t('❚❚ 일시정지', '❚❚ Pause') : rp.k > 0 && rp.k < 1 ? t('▶ 이어서 재생', '▶ Resume') : rp.k >= 1 ? t('▶ 다시 재생', '▶ Replay') : t('▶ 한 랩 재생', '▶ Replay the lap'); };
  function ensure() {
   const fresh = !rp.car?.isConnected || !rp.cursor?.isConnected || !rp.model;
   if (!fresh) return true;
   rp.car?.remove(); rp.cursor?.remove();
   rp.model = lapModel(); rp.lapS = parseLap(lap.textContent); if (!rp.model || !Number.isFinite(rp.lapS)) { rp.model = null; return false; }
   rp.car = document.createElementNS(ns, 'circle'); rp.car.setAttribute('r', String(rp.model.width * 1.5)); rp.car.setAttribute('stroke-width', String(rp.model.width * 0.5)); rp.car.setAttribute('class', 'kb-car'); rp.model.svg.append(rp.car);
   rp.cursor = document.createElementNS(ns, 'line'); rp.cursor.setAttribute('y1', '12'); rp.cursor.setAttribute('y2', '250'); rp.cursor.setAttribute('class', 'kb-cursor'); rp.model.trace.append(rp.cursor);
   stopBtn.hidden = false; return true;
  }
  function render() {
   if (!ensure()) return; const m = rp.model, f = m.fracAtTime(rp.k), p = m.point(f);
   rp.car.setAttribute('cx', p.x.toFixed(1)); rp.car.setAttribute('cy', p.y.toFixed(1));
   const x = (m.x0 + (m.x1 - m.x0) * f).toFixed(1); rp.cursor.setAttribute('x1', x); rp.cursor.setAttribute('x2', x);
   seek.value = String(Math.round(rp.k * 1000)); seek.setAttribute('aria-valuetext', fmtLap(rp.k * rp.lapS));
   clock.textContent = fmtLap(rp.k * rp.lapS) + ' / ' + fmtLap(rp.lapS) + ' · ' + speedup() + t('배속', '× speed');
  }
  function frame(now) {
   if (!rp.running) return;
   const dur = rp.lapS / speedup() * 1000; rp.k = Math.min(1, rp.k + (now - rp.last) / dur); rp.last = now;
   render(); if (rp.k >= 1) { pause(); return; } rp.raf = requestAnimationFrame(frame);
  }
  function play() { if (reduce() || !ensure()) return; if (rp.k >= 1) rp.k = 0; rp.running = true; rp.last = performance.now(); label(); rp.raf = requestAnimationFrame(frame); }
  function pause() { rp.running = false; cancelAnimationFrame(rp.raf); label(); }
  function stop() { pause(); rp.k = 0; rp.car?.remove(); rp.cursor?.remove(); rp.car = rp.cursor = rp.model = null; seek.value = '0'; clock.textContent = ''; stopBtn.hidden = true; label(); }
  function seekTo(k) { rp.k = Math.min(1, Math.max(0, k)); render(); if (rp.running) rp.last = performance.now(); label(); }
  playBtn.addEventListener('click', () => rp.running ? pause() : play());
  stopBtn.addEventListener('click', stop);
  seek.addEventListener('input', () => seekTo(Number(seek.value) / 1000));
  // Click or drag on the speed trace jumps to that distance.
  const timeAtFrac = f => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (rp.model.fracAtTime(mid) < f) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const traceSeek = e => safe(() => { if (!ensure()) return; const svg = rp.model.trace, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const x = pt.matrixTransform(svg.getScreenCTM().inverse()).x; const f = (x - rp.model.x0) / (rp.model.x1 - rp.model.x0); if (f < 0 || f > 1) return; seekTo(timeAtFrac(f)); });
  if (traceBox) { traceBox.addEventListener('pointerdown', e => { if (!e.target.closest('svg.ls-trace')) return; traceSeek(e); const move = ev => traceSeek(ev), up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); }; addEventListener('pointermove', move); addEventListener('pointerup', up); }); }
  // The simulator redraws map and trace on every change: keep the replay position and redraw the car.
  const redraw = () => { if (!rp.car) return; rp.model = null; render(); };
  new MutationObserver(redraw).observe(mapBox, { childList: true });
  if (traceBox) new MutationObserver(redraw).observe(traceBox, { childList: true });
  addEventListener('keydown', e => { if (e.key === 'Escape' && rp.car) stop(); });
  label();
  // First view: draw the line, count up the lap, then replay once.
  let first = true;
  const io = new IntersectionObserver(entries => { if (!first || !entries.some(x => x.isIntersecting)) return; first = false; io.disconnect(); safe(drawOn); safe(countUp); if (!reduce()) setTimeout(() => safe(play), 1300); }, { threshold: 0.35 });
  io.observe(mapBox);
 }

 // 8. Track evolution: an Auto button runs the existing session-time slider from start to end.
 function evolutionAuto() {
  const input = document.querySelector('input[type=range][data-evo="end"]'); if (!input || input.dataset.kbAuto) return; input.dataset.kbAuto = '1';
  const row = el('div', 'kb-auto-row'); row.setAttribute('data-no-translate', '');
  const btn = el('button', 'kb-auto'); btn.type = 'button'; btn.setAttribute('aria-pressed', 'false');
  const note = el('p', 'fine', t('세션 시각을 처음부터 끝까지 자동으로 움직입니다.', 'Moves the session time from start to end.'));
  row.append(btn, note);
  const panel = input.closest('.ls-sliders'); (panel || input.closest('label')).before(row);
  let timer = null, resumable = false; const min = Number(input.min) || 0, max = Number(input.max) || 120, step = Math.max(Number(input.step) || 1, Math.round((max - min) / 60));
  const label = () => { btn.textContent = timer ? t('❚❚ 자동 멈춤', '❚❚ Pause auto') : resumable ? t('▶ 자동 이어서', '▶ Resume auto') : t('▶ 자동', '▶ Auto'); btn.setAttribute('aria-pressed', String(!!timer)); };
  const set = v => { input.value = String(v); input.dispatchEvent(new Event('input', { bubbles: true })); };
  const halt = () => { clearInterval(timer); timer = null; label(); };
  btn.addEventListener('click', () => {
   if (timer) { halt(); resumable = true; label(); return; }
   if (!resumable) set(min); resumable = false;
   timer = setInterval(() => { const v = Math.min(max, Number(input.value) + step); set(v); if (v >= max) halt(); }, 130);
   label();
  });
  const manual = () => { halt(); resumable = false; label(); }; input.addEventListener('pointerdown', manual); input.addEventListener('keydown', manual);
  label();
 }

 // 9. FIA circuit changes: folded by default, a summary line, items that can change lap time first.
 function foldCircuitChanges() {
  const list = document.querySelector('ul.ls-changes'); const section = list?.closest('section'); if (!section || section.querySelector('.kb-fold')) return;
  const heading = section.querySelector('h2'); if (!heading) return;
  const fold = el('details', 'kb-fold'); const summary = el('summary'); const sumText = el('span'), count = el('span', 'kb-fold-count'); summary.append(sumText, count); summary.setAttribute('data-no-translate', ''); fold.append(summary);
  for (const node of [...section.childNodes]) if (node !== heading) fold.append(node);
  section.append(fold);
  const items = [...list.querySelectorAll(':scope>li')], info = items.filter(li => li.classList.contains('is-info'));
  if (info.length) {
   const sub = el('details', 'kb-fold-sub'); const s2 = el('summary', '', t('랩타임 영향이 없는 변경 ' + info.length + '개', info.length + ' changes with no lap-time effect')); s2.setAttribute('data-no-translate', '');
   const ul = el('ul', 'ls-changes'); info.forEach(li => ul.append(li)); sub.append(s2, ul); list.after(sub);
  }
  const boxes = [...list.querySelectorAll('input[type=checkbox][data-change]')];
  const update = () => { const on = boxes.filter(b => b.checked).length; sumText.textContent = t('변경 사항 ' + items.length + '개 보기', 'Show ' + items.length + ' changes'); count.textContent = t('랩타임 반영 가능 ' + boxes.length + '개 · 켠 항목 ' + on + '개', boxes.length + ' can change lap time · ' + on + ' on'); };
  boxes.forEach(b => b.addEventListener('change', update)); update();
 }

 const start = () => {
  document.querySelectorAll('#standings').forEach(n => { safe(() => watchBusy(n, false)); safe(() => watchTable(n, true)); });
  document.querySelectorAll('[data-race-results]').forEach(root => { const target = root.querySelector('[data-result-table]'); if (target) { safe(() => watchBusy(target, true)); safe(() => watchTable(target, false)); } safe(() => watchResultsEmpty(root)); });
  document.querySelectorAll('[data-series-tabs] .tab-list').forEach(list => safe(() => tabInk(list)));
  safe(enhanceComingSoon); safe(enhanceAlertsEmpty); safe(heroEntry); safe(simulation); safe(evolutionAuto); safe(foldCircuitChanges);
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
