export const appearanceControl=`<label class="appearance-control"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="sr-only">화면 테마</span><select id="appearance" aria-label="화면 테마"><option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></select></label>`;
// Runs before styles paint. Storage denial must never prevent reading the page.
export function appearanceBoot(){
 let preference='system';try{const saved=localStorage.getItem('kongboda-appearance');if(['system','light','dark'].includes(saved))preference=saved;}catch{}
 const light=typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: light)').matches;
 document.documentElement.dataset.appearance=preference;
 document.documentElement.dataset.theme=preference==='system'?(light?'light':'dark'):preference;
}
export function appearanceClient(){
 const root=document.documentElement,select=document.querySelector('#appearance');if(!select)return;
 const media=matchMedia('(prefers-color-scheme: light)');
 const apply=preference=>{if(!['system','light','dark'].includes(preference))preference='system';root.dataset.appearance=preference;root.dataset.theme=preference==='system'?(media.matches?'light':'dark'):preference;select.value=preference;};
 apply(root.dataset.appearance||'system');
 select.addEventListener('change',()=>{apply(select.value);try{localStorage.setItem('kongboda-appearance',select.value);}catch{}});
 media.addEventListener('change',()=>{if(root.dataset.appearance==='system')apply('system');});
 window.addEventListener('storage',event=>{if(event.key==='kongboda-appearance')apply(event.newValue||'system');});
}
const lightTokens=`--bg:#f6f8f7;--surface:#ffffff;--line:#cbd7d2;--text:#17252a;--muted:#52636a;--mint:#006b58;--blue:#245d9c;--soft:#e8f1ed;--paper:#ffffff;--on-accent:#ffffff;--analysis-surface:#ffffff;color-scheme:light;`;
export const appearanceCss=`
:root{--blue:#92b6ff;--on-accent:#09110f;--analysis-surface:linear-gradient(140deg,#141e23,#0c1216);--soft:#18262c;--paper:#0c1216}
:root[data-theme="light"]{${lightTokens}}
@media(prefers-color-scheme:light){:root:not([data-theme]){${lightTokens}}}
html,body{background:var(--bg);color:var(--text)}
.appearance-control{display:inline-flex;align-items:center;gap:7px;min-width:0;flex:0 0 auto;color:var(--muted);font-size:13px}
.appearance-control select{min-width:0;max-width:120px;min-height:44px;padding:8px;background:var(--surface);color:var(--text)}
header nav{min-width:0;flex-wrap:wrap}
@media(min-width:801px) and (max-width:1300px){header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 24px}header>.brand{grid-column:1;grid-row:1}header>.header-actions{grid-column:2;grid-row:1}header nav{grid-column:1/-1;grid-row:2;flex-direction:row;flex-wrap:wrap;justify-content:flex-start}}
.button.primary,.primary{color:var(--on-accent)}
#kb-recorded{--bg:var(--surface);--paper:var(--bg);--ink:var(--text);--muted:inherit;--line:inherit;--mint:inherit;--blue:inherit;--soft:inherit;color-scheme:inherit}
/* Rebind explicit demo colors without inheriting unresolved custom-property cycles. */
:root[data-theme="light"] #kb-recorded{--bg:#ffffff;--paper:#f6f8f7;--ink:#17252a;--muted:#52636a;--line:#cbd7d2;--mint:#006b58;--blue:#245d9c;--soft:#e8f1ed}
#kb-recorded .analysis{background:var(--analysis-surface)}
:root[data-theme="light"] button,:root[data-theme="light"] .button{background:var(--soft);color:var(--text)}
:root[data-theme="light"] .button.primary,:root[data-theme="light"] .primary{background:var(--mint);color:var(--on-accent)}
:root[data-theme="light"] input,:root[data-theme="light"] select,:root[data-theme="light"] option{background:var(--surface);color:var(--text)}
:root[data-theme="light"] .approved-brand{filter:brightness(0) saturate(100%) invert(28%) sepia(39%) saturate(1282%) hue-rotate(121deg) brightness(91%) contrast(101%)!important}
:root[data-theme="light"] #kb-recorded .sector-value.loss::before{background:#e4edf7}
:root[data-theme="light"] #kb-recorded .sector-value.gain::before{background:#dceee5}
:root[data-theme="light"] .track-map img{background:#eef2f0}
:root[data-theme="light"] .race-tyre.tyre-H{color:#52636a}
:root[data-theme="light"] .race-tyre.tyre-M{color:#776000}
:root[data-theme="light"] .race-tyre.tyre-S{color:#b2213b}
:root[data-theme="light"] .race-tyre.tyre-I{color:#186a3e}
:root[data-theme="light"] .race-tyre.tyre-W{color:#245d9c}
:root[data-theme="light"] .session-live-badge{color:#a52235;border-color:#bd6974;background:#fff1f2}
:root[data-theme="light"] .calendar-strip,:root[data-theme="light"] [data-race-calendar="week"] .race-cards{scrollbar-color:#8da59a #edf3ef}
:root[data-theme="light"] ::selection{background:#bce9db;color:#17252a}
`;

// Apply the same palette when scripts are disabled and the OS requests light mode.
const fallbackLight=appearanceCss.split('\n').filter(line=>line.includes(':root[data-theme="light"]')).map(line=>line.replaceAll(':root[data-theme="light"]',':root:not([data-theme])')).join('\n');
export const noScriptAppearanceCss='@media(prefers-color-scheme:light){'+fallbackLight+'}';
