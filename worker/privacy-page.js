// Privacy notice (2026-11-22). Describes only what the code stores: Google sign-in identity,
// account settings the user saves, AI connection status, and four first-party cookies.
// Keep in step with worker/google-auth.js, accounts.js, personal-instructions.js and the cookie writers.

export function privacyPage(lang = 'ko') {
 const t = (ko, en) => (lang === 'en' ? en : ko);
 const li = items => `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
 return `<div class="privacy-page" data-no-translate><section class="hero"><h1>${t('개인정보 처리방침', 'Privacy notice')}</h1><p class="lead">${t('꽁보다는 로그인하지 않아도 모든 시뮬레이터와 일정을 쓸 수 있습니다. 로그인했을 때만 아래 정보를 저장합니다.', 'Every simulator and schedule works without signing in. The information below is stored only when you sign in.')}</p></section>
<section class="panel"><h2>${t('로그인하면 저장하는 것', 'What we store when you sign in')}</h2>${li([
  t('Google 계정의 고유 ID, 이메일 주소, 이름 — 본인 확인과 계정 연결에만 씁니다.', 'Your Google account ID, email address and name, used only to identify you and link your account.'),
  t('직접 저장한 설정 — 좋아하는 팀·드라이버·제조사, 화면 모드, AI 답변 지침(최대 4,000자).', 'Settings you save yourself: favourite team, drivers and manufacturer, display mode, and AI answer instructions (up to 4,000 characters).'),
  t('Claude·ChatGPT 연결 상태와 마지막 확인 시각.', 'Whether Claude or ChatGPT is connected, and when it was last checked.')
 ])}</section>
<section class="panel"><h2>${t('쿠키', 'Cookies')}</h2><p>${t('광고·추적 쿠키는 쓰지 않습니다. 사이트가 쓰는 쿠키는 다음뿐입니다.', 'We use no advertising or tracking cookies. The site sets only these:')}</p>${li([
  t('로그인 세션', 'Sign-in session'),
  t('언어 선택 (kongboda_lang)', 'Language (kongboda_lang)'),
  t('시간대 — 일정을 현지 시간으로 보여 주기 위해 (kongboda_tz)', 'Time zone, to show schedules in your local time (kongboda_tz)'),
  t('휴대폰에서 PC 화면 보기 선택 (kongboda_view)', 'Phone “view as PC” choice (kongboda_view)')
 ])}</section>
<section class="panel"><h2>${t('보관과 삭제', 'Storage and deletion')}</h2><p>${t('계정 정보는 사이트 운영용 클라우드 저장소에 보관하며 다른 이용자에게 보이지 않습니다. 판매하거나 광고에 쓰지 않습니다.', 'Account data is kept in the cloud storage that runs the site and is never shown to other users. It is not sold or used for advertising.')}</p><p>${t('<a href="/account">계정 설정</a>의 ‘회원 탈퇴’에서 언제든 계정과 저장한 설정을 삭제할 수 있습니다. Google 계정 자체는 삭제되지 않습니다.', 'You can delete your account and saved settings at any time under “Delete account” in <a href="/account">account settings</a>. Your Google account itself is not affected.')}</p></section></div>`;
}
