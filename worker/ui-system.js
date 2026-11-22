// Design-system layer (UI P2, 2026-11-22). Loaded after every other stylesheet. Presentation only:
// no markup, data, handlers, simulator drawing or telemetry change.
//
// Numbers (Wolfram, see claude/ui-audit-2026-11-22.md):
//  - type scale 16 × 1.333^n → 12 · 16 · 21 · 28 · 38 · 51 (+14 for UI text)
//  - light card edge #d2ccc4 = 1.5:1 on #faf8f5; light control edge #998f7f = 3.0:1 (WCAG 1.4.11)
//  - dark card edge #303132 = 1.5:1 on #0b0c0d; dark control edge #5d5e5f = 3.0:1
// Brand colours (--mint per theme) are left as they are. Light --soft (control fill) is a warm neutral, not pink.

export const uiSystemCss = `
:root{--kb-fs-12:12px;--kb-fs-14:14px;--kb-fs-16:16px;--kb-fs-21:21px;--kb-fs-28:28px;--kb-fs-38:38px;--kb-fs-51:51px;
 --kb-edge:#303132;--kb-control-edge:#5d5e5f;--kb-shadow:0 1px 2px rgba(0,0,0,.25)}
:root[data-theme="light"]{--soft:#efeae3;--kb-edge:#d2ccc4;--kb-control-edge:#998f7f;--kb-shadow:0 1px 2px rgba(40,30,15,.05),0 6px 20px -8px rgba(40,30,15,.10)}

/* Type: one scale */
main .hero h1{font-size:clamp(var(--kb-fs-38),5vw,var(--kb-fs-51));line-height:1.16;letter-spacing:-.02em}
main>section>h2,main .section-head h2,main .panel>h2,main .sim-entry>h2,main .kb-why>h2,main .race-title-row h2,main .about>h2{font-size:clamp(var(--kb-fs-21),2.4vw,var(--kb-fs-28));line-height:1.3;letter-spacing:-.01em}
main .sim-entry-card h3,main .meanings h3{font-size:var(--kb-fs-21);line-height:1.35}
main .hero .lead{font-size:var(--kb-fs-16);line-height:1.7;max-width:62ch}
main .fine{font-size:var(--kb-fs-12)}
@media(max-width:700px){main .kb-why-table td,main .kb-why-table tbody th{width:auto!important}}

/* Surfaces: one card edge, soft lift in light mode */
main .panel,main .sim-entry-card,main .kb-why-wrap,main .ai-abilities li{border-color:var(--kb-edge);box-shadow:var(--kb-shadow)}

/* Buttons: primary = filled accent; every other button = outline on the page colour */
main .button:not(.primary):not([disabled]),main a.button.secondary{background:transparent;border:1px solid var(--kb-control-edge);color:var(--text);font-weight:650}
main .button:not(.primary):not([disabled]):hover,main a.button.secondary:hover{border-color:var(--text);background:color-mix(in oklab,var(--text) 5%,transparent)}
main .button.primary{font-weight:750}
main .sim-entry-card:first-child:not(.is-soon)>.button{background:var(--mint);border-color:var(--mint);color:var(--on-accent,#fff)}
/* One filled action per tool grid: the lap simulator; the other cards use the outline button */
main .sim-entry-card:not(:first-child):not(.is-soon)>.button{background:transparent;border-color:var(--kb-control-edge);color:var(--text)}
main .sim-entry-card:not(:first-child):not(.is-soon)>.button:hover{background:color-mix(in oklab,var(--text) 5%,transparent);border-color:var(--text)}

/* Segmented controls (UI P6): one look for tabs, view toggles and line-mode pills. Selected = ink fill, others = outline.
   Brand colours untouched; the line-mode pills on LapSim had no visible selected state at all. */
html main :is([role="tab"],button[aria-pressed],.pill){background:transparent!important;border:1px solid var(--kb-control-edge)!important;color:var(--text)!important;box-shadow:none!important;font-weight:650}
html main :is([role="tab"][aria-selected="true"],button[aria-pressed="true"],.pill.active){background:var(--text)!important;border-color:var(--text)!important;color:var(--bg)!important}
html main :is([role="tab"]:not([aria-selected="true"]),button[aria-pressed="false"],.pill:not(.active)):hover{background:color-mix(in oklab,var(--text) 6%,transparent)!important;border-color:var(--text)!important}
html main .su-conds label{flex:0 0 auto;min-width:96px;justify-content:center;border-color:var(--kb-control-edge);color:var(--text)}
html main #su-dry:checked~.su-conds label[for=su-dry],html main #su-wet:checked~.su-conds label[for=su-wet]{background:var(--text);border-color:var(--text);color:var(--bg);box-shadow:none}

/* Focus: visible ring everywhere */
main :is(a,button,select,input,summary,textarea):focus-visible{outline:2px solid var(--mint);outline-offset:2px}

@media(prefers-reduced-motion:no-preference){
 main .button{transition:transform 140ms cubic-bezier(.2,.7,.2,1),background-color 200ms ease,border-color 200ms ease}
 main .button:hover{transform:translateY(-1px)}main .button:active{transform:translateY(0) scale(.98)}
 main .sim-entry-card,main .panel.kb-lift{transition:transform 220ms cubic-bezier(.2,.7,.2,1),box-shadow 220ms ease,border-color 220ms ease}
 main .sim-entry-card:hover{transform:translateY(-2px)}
 html main :is([role="tab"],button[aria-pressed],.pill),html main .su-conds label{transition:background-color 160ms ease,color 160ms ease,border-color 160ms ease,transform 140ms cubic-bezier(.2,.7,.2,1)}
 html main :is([role="tab"],button[aria-pressed],.pill):active,html main .su-conds label:active{transform:scale(.97)}
}
`;

// Track search (UI P3): a type-to-find box for the ~100-circuit select on /simulation.
// Progressive enhancement only: the select stays, and choosing a match runs the select's own onchange.
export function uiSystemClient() {
 // The lap simulator re-renders its form in place (kbLapsimGo), so re-attach when a fresh select appears.
 if (!window.kbTrackSearchObserver && document.querySelector('select[name="track"]')) { window.kbTrackSearchObserver = new MutationObserver(() => uiSystemClient()); window.kbTrackSearchObserver.observe(document.body, { childList: true, subtree: true }); }
 const sel = document.querySelector('select[name="track"]');
 if (!sel || sel.dataset.kbSearch) return;
 sel.dataset.kbSearch = '1';
 const en = document.documentElement.lang === 'en';
 const norm = s => String(s).replace(/[\u{1F1E6}-\u{1F1FF}⚠️️]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
 const opts = [...sel.options].map(o => ({ value: o.value, text: o.textContent.trim(), key: norm(o.textContent) }));
 const id = 'kb-track-list';
 const list = document.createElement('datalist'); list.id = id;
 for (const o of opts) { const x = document.createElement('option'); x.value = o.text; list.append(x); }
 const box = document.createElement('input');
 box.type = 'search'; box.className = 'kb-track-search'; box.setAttribute('list', id);
 box.placeholder = en ? 'Find a circuit (e.g. Spa, Suzuka, KOR)' : '서킷 찾기 (예: 스파, Suzuka, KOR)';
 box.setAttribute('aria-label', en ? 'Find a circuit' : '서킷 찾기');
 box.autocomplete = 'off';
 const pick = () => {
  const q = norm(box.value); if (!q) return;
  const hit = opts.find(o => o.key === q) || (opts.filter(o => o.key.includes(q)).length === 1 ? opts.find(o => o.key.includes(q)) : null);
  if (!hit || hit.value === sel.value) return;
  sel.value = hit.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
 };
 box.addEventListener('change', pick);
 box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pick(); } });
 const note = document.createElement('span'); note.className = 'kb-track-note';
 note.textContent = (en ? `${opts.length} circuits · ⚠️ not built yet, no real lap to check, or large error` : `서킷 ${opts.length}곳 · ⚠️ 미완공, 비교할 실제 랩 없음, 또는 오차가 큰 곳`);
 const wrap = document.createElement('div'); wrap.className = 'kb-track-find'; wrap.append(box, list, note);
 const label = sel.closest('label') || sel; label.before(wrap);
}

export const uiSystemClientCss = `
.kb-track-find{grid-column:1/-1;flex:1 1 100%;max-width:560px;margin:0 0 4px;order:-1}.kb-track-search{width:100%;min-height:44px;margin:0;padding:8px 12px;border:1px solid var(--kb-control-edge);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:15px}
.kb-track-search::placeholder{color:var(--muted)}
.kb-track-note{display:block;margin-top:4px;font-size:12px;color:var(--muted);font-weight:400}
`;

// Home hero entrance (UI P4) with anime.js (waapi + splitText + stagger), once on load.
// Plan: h1 words rise out of a clip mask (100%→0, 70 ms stagger, 700 ms outExpo); at 350 ms the lead and
// buttons rise 12 px and fade in (80 ms stagger, 500 ms); at 600 ms the Kongboda column of the comparison
// table brightens row by row (90 ms stagger, 450 ms). Transforms and opacity only; nothing runs under
// prefers-reduced-motion, and CSS shows everything after 1.6 s if the script never runs.
export function heroMotionClient() {
 const hero = document.querySelector('.kb-hero');
 if (!hero || hero.dataset.kbEntered) return;
 hero.dataset.kbEntered = '1';
 const A = window.kbAnime, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
 const show = () => hero.classList.add('kb-hero-in');
 if (!A || reduce) { show(); return; }
 try {
  const h1 = hero.querySelector('h1');
  const { words } = A.splitText(h1, { words: { wrap: 'clip' }, accessible: true });
  show();
  A.waapi.animate(words, { translateY: ['100%', '0%'], delay: A.stagger(70), duration: 700, ease: 'outExpo' });
  A.waapi.animate(hero.querySelectorAll('.lead, .hero-actions > *'), { opacity: [0, 1], translateY: [12, 0], delay: A.stagger(80, { start: 350 }), duration: 500, ease: 'outCubic' });
  const cells = document.querySelectorAll('.kb-why-table tbody td:last-child');
  if (cells.length) A.waapi.animate(cells, { opacity: [0.35, 1], delay: A.stagger(90, { start: 600 }), duration: 450, ease: 'outQuad' });
 } catch { show(); }
}

// Next-session countdown under "This/Next week in motorsport" (UI P4). Reads the calendar the week box
// already loaded (window.kbCalendarEvents); updates every 30 s; shows nothing if no session is ahead.
export function nextSessionClient() {
 const status = document.querySelector('[data-race-calendar="week"] .race-status-row');
 if (!status || status.dataset.kbNext) return;
 status.dataset.kbNext = '1';
 const en = document.documentElement.lang === 'en';
 const line = document.createElement('p'); line.className = 'kb-next-session'; line.setAttribute('aria-live', 'off');
 status.after(line);
 const fmt = ms => {
  const m = Math.max(0, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
  if (en) return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
  return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${mm}분` : `${mm}분`;
 };
 const tick = () => {
  const now = Date.now(); let best = null;
  for (const e of window.kbCalendarEvents || []) for (const s of e.sessions || []) {
   const t = Date.parse(s.start); if (t > now && (!best || t < best.t)) best = { t, e, s };
  }
  if (!best) { line.hidden = true; return; }
  line.hidden = false;
  const ev = en ? (best.e.nameEn || best.e.name) : best.e.name, ss = en ? (best.s.nameEn || best.s.name) : (best.s.name || best.s.nameEn);
  const when = new Date(best.t).toLocaleString(en ? 'en-GB' : 'ko-KR', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  line.innerHTML = '';
  const strong = document.createElement('strong'); strong.textContent = en ? `Next: ${fmt(best.t - now)}` : `다음 세션까지 ${fmt(best.t - now)}`;
  line.append(strong, document.createTextNode(` · ${best.e.seriesLabel || String(best.e.series).toUpperCase()} ${ev} ${ss} · ${when}`));
 };
 const start = () => { tick(); setInterval(() => { if (document.visibilityState !== 'hidden') tick(); }, 30000); };
 if (window.kbCalendarEvents) start(); else { let n = 0; const wait = setInterval(() => { if (window.kbCalendarEvents || ++n > 40) { clearInterval(wait); start(); } }, 250); }
}

export const heroMotionCss = `
@media(prefers-reduced-motion:no-preference){.kb-hero:not(.kb-hero-in) h1,.kb-hero:not(.kb-hero-in) .lead,.kb-hero:not(.kb-hero-in) .hero-actions{opacity:0;animation:kb-hero-fallback 0s 1.6s forwards}}
@keyframes kb-hero-fallback{to{opacity:1}}
.kb-next-session{margin:4px 0 12px;font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}
.kb-next-session strong{color:var(--mint);font-weight:750;margin-right:2px}
`;
