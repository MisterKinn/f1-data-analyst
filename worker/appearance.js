export const appearanceControl=`<label class="appearance-control"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="sr-only">화면 테마</span><select id="appearance" aria-label="화면 테마"><option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></select></label>`;
// Runs before styles paint. The server passes the signed-in account's saved mode;
// visitors who are not signed in always follow the device setting.
export function appearanceBoot(saved){
 const preference=['system','light','dark'].includes(saved)?saved:'system';
 try{localStorage.removeItem('kongboda-appearance');}catch{}
 const light=typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: light)').matches;
 document.documentElement.dataset.appearance=preference;
 document.documentElement.dataset.theme=preference==='system'?(light?'light':'dark'):preference;
}
export function appearanceClient(){
 const root=document.documentElement,select=document.querySelector('#appearance'),status=document.querySelector('#appearance-status');
 const media=matchMedia('(prefers-color-scheme: light)');
 const apply=preference=>{if(!['system','light','dark'].includes(preference))preference='system';root.dataset.appearance=preference;root.dataset.theme=preference==='system'?(media.matches?'light':'dark'):preference;if(select)select.value=preference;};
 apply(root.dataset.appearance||'system');
 media.addEventListener('change',()=>{if(root.dataset.appearance==='system')apply('system');});
 if(!select)return;
 const say=(ko,en)=>{if(status)status.textContent=root.lang==='en'?en:ko;};
 select.addEventListener('change',async()=>{
  const previous=root.dataset.appearance||'system',value=select.value;apply(value);say('저장 중…','Saving…');select.disabled=true;
  try{const body=new FormData();body.set('appearance',value);const response=await fetch('/account/appearance',{method:'POST',body,credentials:'same-origin',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(String(response.status));say('저장했습니다. 로그인한 모든 기기에 적용됩니다.','Saved. It applies on every device where you are signed in.');}
  catch{apply(previous);say('저장하지 못했습니다. 다시 시도하세요.','Could not save. Please try again.');}
  finally{select.disabled=false;}
 });
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
/* PC: the menu always sits on the logo row, right of the logo. */@media(min-width:801px){header{display:flex;flex-wrap:nowrap;align-items:center;justify-content:flex-start;gap:clamp(16px,3vw,48px)}header>.brand{flex:0 0 auto}header nav{order:2;flex:1 1 auto;flex-wrap:nowrap;justify-content:flex-start;min-width:0;gap:clamp(12px,2vw,28px)}header nav a{white-space:nowrap}header>.header-actions{order:3;flex:0 0 auto;margin-left:auto}}@media(min-width:801px) and (max-width:1100px){header nav a{font-size:14px}header .signed-in-name{display:none}}
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
