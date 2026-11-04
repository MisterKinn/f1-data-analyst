// Shared Google sign-in script for the login page and the account page.
// Works across browsers:
// - Normal browsers: popup sign-in.
// - Popup blocked / unsupported, iOS home-screen apps: redirect sign-in, but
//   only when the auth handler is first-party (authDomain === this host via
//   the /__/auth proxy). Redirect through *.firebaseapp.com breaks in
//   storage-partitioned browsers (iOS Safari, Firefox, Brave).
// - In-app browsers (KakaoTalk, Instagram, Facebook, Naver, Line, Android
//   WebView ...): Google blocks sign-in there, so open the page in the
//   system browser instead.
const FIREBASE='https://www.gstatic.com/firebasejs/12.6.0';

export const IN_APP_PATTERN=/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|DaumApps|everytimeApp|BAND\/|Snapchat|TikTok|musical_ly|BytedanceWebview|Twitter|; wv\)/i;

export function googleLoginScript(dataJson,{button='#google-login',status='#google-login-status'}={}){
 return `<script type="module">import{initializeApp}from'${FIREBASE}/firebase-app.js';import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult}from'${FIREBASE}/firebase-auth.js';
const d=${dataJson},button=document.querySelector(${JSON.stringify(button)}),status=document.querySelector(${JSON.stringify(status)});
const auth=getAuth(initializeApp(d.config)),provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
const ua=navigator.userAgent||'',inApp=${IN_APP_PATTERN}.test(ua),android=/Android/i.test(ua),ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const firstParty=d.config.authDomain===location.host,standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
const MARK='kongboda-google-redirect',store={get(){try{return sessionStorage.getItem(MARK)}catch{return'unknown'}},set(){try{sessionStorage.setItem(MARK,'1')}catch{}},clear(){try{sessionStorage.removeItem(MARK)}catch{}}};
const MESSAGES={'auth/popup-closed-by-user':'로그인 창이 닫혔습니다. 다시 시도해 주세요.','auth/cancelled-popup-request':'로그인 창이 닫혔습니다. 다시 시도해 주세요.','auth/network-request-failed':'네트워크 연결을 확인한 뒤 다시 시도해 주세요.','auth/unauthorized-domain':'이 주소에서는 로그인할 수 없습니다. kongboda-motorsports.vercel.app에서 시도해 주세요.','auth/login-too-old':'로그인 시간이 지났습니다. 다시 시도해 주세요.'};
const codeOf=e=>typeof e?.code==='string'?e.code:'auth/session-failed';
const say=text=>{status.textContent=text};
const fail=e=>{const code=codeOf(e);say((MESSAGES[code]||'로그인을 완료하지 못했습니다.')+' ('+code+')');button.disabled=false;console.error(e)};
const finish=async result=>{if(!result)return false;say('로그인 정보를 확인하는 중…');const token=await result.user.getIdToken();const response=await fetch('/auth/firebase/session',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':d.csrf},body:JSON.stringify({token,csrf:d.csrf,returnTo:d.back})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(payload.error||'auth/session-failed'),{code:payload.error||'auth/session-failed'});location.assign(payload.location);return true};
const redirect=async()=>{store.set();say('Google 로그인 페이지로 이동합니다…');await signInWithRedirect(auth,provider)};
const REDIRECT_CODES=new Set(['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported']);
const external=()=>{const here=location.href;
 if(/KAKAOTALK/i.test(ua)){location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(here);return true}
 if(/Line\\//i.test(ua)){const u=new URL(here);u.searchParams.set('openExternalBrowser','1');location.href=u.href;return true}
 if(android){const u=new URL(here);location.href='intent://'+u.host+u.pathname+u.search+'#Intent;scheme=https;S.browser_fallback_url='+encodeURIComponent(here)+';end';return true}
 return false};
const showInApp=()=>{say(ios?'이 앱 안의 브라우저에서는 Google 로그인이 막혀 있습니다. 화면의 ··· 또는 공유 메뉴에서 ‘Safari로 열기’를 누르거나, 아래 버튼으로 주소를 복사해 Safari에서 열어 주세요.':'이 앱 안의 브라우저에서는 Google 로그인이 막혀 있습니다. 메뉴에서 ‘다른 브라우저로 열기’를 누르거나, 아래 버튼으로 주소를 복사해 Chrome 등에서 열어 주세요.');
 if(!document.querySelector('#google-login-copy')){const copy=document.createElement('button');copy.type='button';copy.id='google-login-copy';copy.className='button';copy.textContent='주소 복사';copy.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);copy.textContent='복사했습니다'}catch{prompt('이 주소를 복사해 브라우저에서 열어 주세요.',location.href)}};status.after(copy)}
 button.disabled=false};
button.addEventListener('click',async()=>{button.disabled=true;
 if(inApp){if(!external())showInApp();else{say('외부 브라우저에서 계속합니다…');setTimeout(showInApp,2500)}return}
 if(firstParty&&standalone){try{await redirect()}catch(error){store.clear();fail(error)}return}
 say('Google 로그인 중…');
 try{await finish(await signInWithPopup(auth,provider))}
 catch(error){if(firstParty&&REDIRECT_CODES.has(codeOf(error))){try{await redirect()}catch(e){store.clear();fail(e)}}else fail(error)}});
if(inApp)say(ios?'앱 안의 브라우저에서는 Google 로그인이 제한됩니다. Safari에서 열어 주세요.':'앱 안의 브라우저에서는 Google 로그인이 제한됩니다. Chrome 등 기본 브라우저에서 열어 주세요.');
else if(firstParty&&store.get()){button.disabled=true;say('로그인을 마무리하는 중…');getRedirectResult(auth).then(async result=>{store.clear();if(!await finish(result)){button.disabled=false;say('')}}).catch(error=>{store.clear();fail(error)})}
</script>`;
}
