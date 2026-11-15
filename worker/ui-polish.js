// UI polish layer (presentation only). Loaded after every other stylesheet; touches the home
// simulator entry, the "what Kongboda means" block and the Kongboda AI page. It never changes
// data, handlers or markup other modules render, and leaves the simulator, calendar and
// championship tables alone because other work streams own them.
// Motion: native WAAPI (anime.js skill, WAAPI-first), transforms and opacity only, one
// scroll-reveal per block, skipped under prefers-reduced-motion.

export const uiPolishCss = `
.sim-entry{margin-bottom:40px}
.sim-entry-card{transition:border-color var(--kb-base,220ms) ease,box-shadow var(--kb-base,220ms) ease}
.sim-entry-card:not(.is-soon):hover,.sim-entry-card:not(.is-soon):focus-within{border-color:color-mix(in oklab,var(--mint) 45%,var(--line))}
.sim-entry-card:not(.is-soon)>.button{background:var(--mint);border-color:var(--mint);color:var(--on-accent,#09110f);font-weight:750}
.sim-entry-card:not(.is-soon)>.button:hover{background:color-mix(in oklab,var(--mint) 88%,#fff);border-color:transparent}
.sim-entry-card.is-soon h3{color:color-mix(in oklab,var(--text) 82%,var(--muted))}
.sim-entry-q{font-variant-numeric:tabular-nums}
.ai-abilities{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
@media(min-width:960px){.ai-abilities{grid-template-columns:repeat(3,minmax(0,1fr))}}
.ai-abilities li{transition:border-color var(--kb-base,220ms) ease}
.ai-abilities li:hover{border-color:color-mix(in oklab,var(--mint) 40%,var(--line))}
.ai-steps>li+li{margin-top:6px}
.ai-copy{margin:10px 0 6px}
.ai-copy .button{width:auto}
.ai-examples li{color:var(--text);background:color-mix(in oklab,var(--surface) 70%,transparent)}
.kb-reveal-wait{opacity:0}
@media print{.kb-reveal-wait{opacity:1}}
@media(prefers-reduced-motion:no-preference){
 .sim-entry-card:not(.is-soon)>.button{transition:transform var(--kb-fast,140ms) var(--kb-ease-out,ease),background-color var(--kb-base,220ms) ease}
 .sim-entry-card:not(.is-soon)>.button:hover{transform:translateY(-1px)}
}
`;

export function uiPolishClient() {
 try {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  // [container, items]: each container reveals once, its items staggered by 70 ms (null: the container itself).
  const groups = [['.sim-entry-grid', '.sim-entry-card'], ['.about .meanings', ':scope>div'], ['.ai-page>.panel', null]];
  const io = new IntersectionObserver(entries => {
   for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    io.unobserve(entry.target);
    (entry.target.kbRevealItems || []).forEach((item, i) => {
     item.classList.remove('kb-reveal-wait');
     item.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: Math.min(i, 6) * 70, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    });
   }
  }, { rootMargin: '0px 0px -8% 0px' });
  const fold = innerHeight * 0.92;
  for (const [box, child] of groups) document.querySelectorAll(box).forEach(container => {
   // Content already on screen at load stays as it is; only blocks below the fold reveal.
   if (container.closest('[data-kb-reveal]') || container.getBoundingClientRect().top < fold) return;
   const items = child ? [...container.querySelectorAll(child)] : [container];
   if (!items.length) return;
   container.dataset.kbReveal = '';
   items.forEach(item => item.classList.add('kb-reveal-wait'));
   container.kbRevealItems = items;
   io.observe(container);
  });
  // Safety net: never leave content hidden (print, or a viewport stretched to the whole page by a capture tool).
  const showAll = () => document.querySelectorAll('.kb-reveal-wait').forEach(n => n.classList.remove('kb-reveal-wait'));
  addEventListener('beforeprint', showAll);
  addEventListener('resize', () => { if (innerHeight >= document.documentElement.scrollHeight * 0.9) showAll(); });
 } catch (e) { document.querySelectorAll('.kb-reveal-wait').forEach(n => n.classList.remove('kb-reveal-wait')); }
}
