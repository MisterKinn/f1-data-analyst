// Presentation-only changes. No account, collector or deployment settings.
export const refinementCss = `
:root{color-scheme:dark}::selection{background:#50dfc1;color:#09110f}a,button,summary{touch-action:manipulation}a:focus-visible,button:focus-visible,summary:focus-visible,select:focus-visible{outline:2px solid var(--mint);outline-offset:4px}a{ text-underline-offset:4px }p{max-width:75ch}code{overflow-wrap:anywhere}main{min-width:0}h1{letter-spacing:-.025em;text-wrap:balance}.skip-link{position:fixed;left:16px;top:-100px;z-index:1001;padding:12px 18px;background:var(--mint);color:#09110f;border-radius:8px}.skip-link:focus{top:12px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap}.hero .lead{max-width:64ch}.hero .connection-note{font-size:14px;line-height:1.7;color:var(--muted)}.button.primary{color:#09110f;background:var(--mint);border-color:var(--mint);font-weight:750}.hero-actions .button{min-height:48px}.connect-section{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:32px}.connect-section .actions{align-self:center;justify-self:end}.series-name{font-weight:800;font-size:clamp(24px,3vw,36px);letter-spacing:-.02em;line-height:1.2;color:var(--text)}.series-small .series-name{font-size:17px;line-height:1.35}.series .support-label{font-size:13px;color:var(--mint)}.race-series-name{display:block;font-size:14px!important;font-weight:800;line-height:1.25;color:var(--text);overflow-wrap:anywhere}.team-color-mark{display:inline-block;flex:0 0 9px;width:9px;height:9px;border-radius:50%;background:var(--team-color,var(--mint));align-self:center}
:root[data-theme="light"] .team-color-mark.team-color-light{box-shadow:inset 0 0 0 1px #8a99a0}.team-logo-slot:has(.team-color-mark){width:16px;min-width:16px;height:auto}.demo-question{display:flex;align-items:start;justify-content:space-between;gap:12px;margin:14px 0;grid-column:1/-1}.demo-question p{font-weight:600;color:var(--text);font-size:15px!important;margin:0;max-width:58ch}.demo-question button{flex:none;min-height:44px;font-size:13px;padding:8px 12px}.example-disclaimer{font-size:13px;color:var(--muted);margin:0 0 12px}.example-disclaimer strong{color:var(--text)}#kb-recorded .foot,#kb-recorded .foot a,#kb-recorded .cap{font-size:13px!important;line-height:1.7!important}#kb-recorded .foot{max-width:75ch}#kb-recorded .foot a{ text-decoration:underline }#language{min-width:48px!important;min-height:48px!important}.language-control{width:48px!important;height:48px!important;flex-basis:48px!important}.view-switch{display:flex;align-items:center;gap:4px}.view-switch a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:4px}.resource-card h2{font-size:23px}.install-address{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.install-address code{font-size:14px}.guide-details{padding-top:18px;border-top:1px solid var(--line)}.guide-details p{margin-top:14px}.guide-questions{display:grid;gap:16px}.guide-question{display:flex;gap:16px;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid var(--line)}.guide-question button{min-height:44px;flex:none}.guide-question p{color:var(--text)}.public-support-note{color:var(--muted);font-size:14px;line-height:1.7}.preview-note{padding:12px 18px;background:#152320;border-bottom:1px solid #315049;color:#d4e9e3;font-size:13px}.shell{max-width:1180px}header{margin-bottom:44px}.approved-brand{width:230px;height:auto}header nav{gap:18px}header nav .nav-start{color:var(--mint)}.home-calendar .race-card{min-height:0!important}.race-cards{scroll-padding-inline:12px!important;padding-inline:12px!important}.session-live-badge::before{animation:none!important}.session-live-badge{letter-spacing:0!important;white-space:normal!important;font-size:12px!important}.series-live-badge{position:static!important;align-self:flex-start;margin:0!important;max-width:100%}.race-card h3 a{color:inherit;text-decoration:none}.race-card h3 a:hover{text-decoration:underline}.not-found{min-height:45vh;align-content:center}.not-found p{max-width:50ch}.table-scroll-hint{color:var(--muted);font-size:12px}
@media(max-width:800px){header nav,header nav.is-open{transition:opacity 180ms ease,transform 180ms ease!important}header{margin-bottom:32px}header>.brand{width:auto}.approved-brand{width:190px}.hero-actions{display:grid;grid-template-columns:1fr 1fr}.connect-section{grid-template-columns:1fr;gap:18px}.connect-section .actions{display:flex;justify-self:start}.guide-question{align-items:start}.series-name{font-size:26px}}
@media(max-width:700px){.shell{padding-top:20px}header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}header>.brand{justify-self:start!important}.approved-brand{width:150px!important}header .header-actions{gap:4px}.display-toggle{display:none!important}.account-icon,.language-control{width:44px!important;min-width:44px!important;height:44px!important;flex-basis:44px!important}#language{min-width:44px!important;min-height:44px!important}header nav{grid-column:1/-1}.hero h1{font-size:clamp(27px,7vw,35px);line-height:1.35;letter-spacing:-.025em}.hero h1 .mobile-break{display:inline}.hero .lead{font-size:16px;line-height:1.75}.hero{gap:18px}.hero-actions{gap:10px}.hero-actions .button{font-size:14px;padding-inline:10px}.connection-note{font-size:13px!important}.demo-question{flex-direction:column;gap:8px}.demo-question button{align-self:flex-start}#kb-recorded .foot,#kb-recorded .foot a,#kb-recorded .cap{font-size:13px!important}.guide-question{flex-direction:column;gap:10px}.guide-question button{align-self:flex-start}.install-address{align-items:start}.signed-in-name{max-width:75px}.standings-table .participant{gap:5px}.series .support-label{font-size:12px}.race-cards{scroll-padding-inline:10px!important;padding-inline:10px!important}.account-settings>.hero{padding-top:0}}
main{grid-template-columns:minmax(0,1fr)}main>*{min-width:0}.hero{grid-template-columns:minmax(0,1fr)}.hero-actions .button{min-width:0;white-space:normal;text-align:center}.example-disclaimer{margin-bottom:18px!important}.hero-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
@media(max-width:700px){header>.brand{grid-column:1;grid-row:1}header>.header-actions{grid-column:2;grid-row:1;justify-self:end;width:auto;flex-wrap:nowrap}header nav{grid-row:2}.hero-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:350px){.approved-brand{width:125px!important}.hero-actions{grid-template-columns:minmax(0,1fr)}.header-actions{gap:0!important}.account-control{gap:0}header .menu{padding:8px}}
/* Fluid layout follows available space; never tween layout dimensions on resize. */
:root{--page-gutter:clamp(1rem,5vw,4.5rem);--section-gap:clamp(2rem,4vw,3rem)}
.shell{max-width:1324px;padding:clamp(1.25rem,2.5vw,1.875rem) var(--page-gutter) 28px}
main{gap:var(--section-gap)}header{gap:clamp(1rem,2.5vw,2.25rem);margin-bottom:var(--section-gap)}
h1,.hero h1{font-size:clamp(1.75rem,1rem + 3vw,3.25rem);overflow-wrap:anywhere}
h2{font-size:clamp(1.4375rem,1.1rem + 1vw,1.75rem)}
.hero,.about{gap:clamp(1.125rem,2.5vw,1.75rem)}
.hero .lead{font-size:clamp(1rem,.94rem + .2vw,1.0625rem)}
.grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:clamp(.875rem,1.6vw,1.25rem)}
.panel,.series{padding:clamp(1.125rem,2.2vw,1.75rem)}
header nav{gap:clamp(.75rem,1.5vw,1.125rem)}header nav a{white-space:nowrap}
header .header-actions{flex-shrink:0}.approved-brand{width:clamp(9.375rem,18vw,14.375rem)}
.grid>*,.steps>*,.connect-section>*,.meanings>*,.section-head>*{min-width:0}
.section-head{flex-wrap:wrap}.standings-table td small{font-size:12px}
.track-map figcaption{font-size:12px}button:disabled,.button:disabled{color:var(--muted)}
.race-results-panel{min-width:0}.race-results-table th,.race-results-table td{overflow-wrap:anywhere}
#kb-recorded{container-type:inline-size;container-name:examples}
#kb-recorded .card-slot{overflow:visible}
#kb-recorded .analysis{min-width:0;overflow-wrap:anywhere}
#kb-recorded h3{font-size:clamp(1.1875rem,1.02rem + .5vw,1.375rem)}
#kb-recorded .sector-value{min-width:0;overflow-wrap:anywhere}
#kb-recorded .analysis table{table-layout:fixed}
#kb-recorded .analysis th,#kb-recorded .analysis td{overflow-wrap:anywhere;word-break:keep-all}
#kb-recorded .analysis.live{display:flex;grid-template-columns:none}
#kb-recorded .carousel-stage{padding-inline:clamp(25px,3vw,38px)}
#kb-recorded .side-arrow.prev{left:-10px}#kb-recorded .side-arrow.next{right:-10px}
#kb-recorded .barrow{grid-template-columns:minmax(0,86px) minmax(0,1fr) minmax(0,66px)}
@container examples (min-width:860px){
 #kb-recorded .analysis.live{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:18px 28px;align-content:start}
 #kb-recorded .live>.foot{grid-column:1/-1}
}
@media(min-width:801px) and (max-width:1100px){
 header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 24px}
 header>.brand{grid-column:1;grid-row:1}header>.header-actions{grid-column:2;grid-row:1}
 header nav{grid-column:1/-1;grid-row:2;flex-direction:row;flex-wrap:wrap;justify-content:flex-start}
}
@media(max-width:800px){
 header nav,header nav.is-open{max-height:none;overflow:visible;visibility:visible;transform:none;padding-top:0;transition:none!important}
 header nav{display:none;opacity:1}header nav.is-open{display:flex;opacity:1;padding-top:12px}
 header nav a{white-space:normal}
 .compact-series{grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))}
 .meanings,.connect-section,.usage-modes .steps{grid-template-columns:minmax(0,1fr)}
}
@media(max-width:700px){.hero-actions{grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))}.hero-actions .button{word-break:keep-all}}
@media(prefers-reduced-motion:reduce){
 html{scroll-behavior:auto!important}
 *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}

`;

const names={f1:'Formula 1',wec:'FIA WEC',imsa:'IMSA','formula-e':'Formula E',nls:'NLS',lemanscup:'Michelin Le Mans Cup',elms:'European Le Mans Series',alms:'Asian Le Mans Series',gtwc:'GT World Challenge',nascar:'NASCAR',dakar:'Dakar',macau:'Macau','24h-series':'24H Series',wrc:'WRC','super-taikyu':'Super Taikyu',mclaren:'McLaren',mercedes:'Mercedes',ferrari:'Ferrari',redbull:'Red Bull',racingbulls:'Racing Bulls',williams:'Williams',haas:'Haas',astonmartin:'Aston Martin',alpine:'Alpine',audi:'Audi',cadillac:'Cadillac',toyota:'Toyota',bmw:'BMW',porsche:'Porsche',peugeot:'Peugeot',genesis:'Genesis'};
export function plainIdentityAsset(path){
 const match=path.match(/^\/assets\/(?:team\/([^/]+)\.svg|schedule\/([^/]+)|([^/]+)-official(?:\.svg|\.png)?)$/);
 if(!match)return null;
 const slug=match[1]||match[2]||match[3],name=names[slug]||slug.replace(/^gt-/,'').replace(/-/g,' '),safe=name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="70" viewBox="0 0 300 70" role="img" aria-label="${safe}"><title>${safe}</title><text x="0" y="45" fill="#f1f5f6" font-family="sans-serif" font-size="26" font-weight="700">${safe}</text></svg>`;
}
