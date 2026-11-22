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

/* Focus: visible ring everywhere */
main :is(a,button,select,input,summary,textarea):focus-visible{outline:2px solid var(--mint);outline-offset:2px}

@media(prefers-reduced-motion:no-preference){
 main .button{transition:transform 140ms cubic-bezier(.2,.7,.2,1),background-color 200ms ease,border-color 200ms ease}
 main .button:hover{transform:translateY(-1px)}main .button:active{transform:translateY(0) scale(.98)}
 main .sim-entry-card,main .panel.kb-lift{transition:transform 220ms cubic-bezier(.2,.7,.2,1),box-shadow 220ms ease,border-color 220ms ease}
 main .sim-entry-card:hover{transform:translateY(-2px)}
}
`;
