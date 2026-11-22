// Home hero and "why not just ask ChatGPT/Claude" pitch (UI P1, 2026-11-22).
// Authored in both languages; the block is data-no-translate like simulator-entry.js.
// Claims stay within what the site really does: physics lap model calibrated on real
// qualifying laps, FIA documents read from the source, BoP estimated from Al Kamel laps,
// connector tools for Claude and ChatGPT. No accuracy figures here (the simulator shows them).

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ROWS = [
 {
  ko: ['랩타임', '기억 속 기록으로 어림잡은 숫자. 아직 안 달린 차는 지어내기 쉽습니다.', '트랙 형상·날씨·규정을 넣어 물리 모델이 한 바퀴를 직접 계산합니다. 실제 예선 랩으로 보정한 모델입니다.'],
  en: ['Lap time', 'A number guessed from memory. For a car that has not raced yet, it is easy to make one up.', 'A physics model drives the lap with the track shape, weather and rules. It is calibrated on real qualifying laps.'],
  href: '/simulation'
 },
 {
  ko: ['규정', '학습한 시점의 규정. 조항 번호와 개정판이 틀리기 쉽습니다.', 'FIA 공식 문서를 원문에서 읽고 개정판·조항·페이지까지 밝힙니다.'],
  en: ['Rules', 'The rules as they were at training time. Article numbers and editions are easy to get wrong.', 'Reads the FIA documents at the source and names the edition, article and page.'],
  href: '/ai'
 },
 {
  ko: ['공개되지 않은 값', '2026 WEC 하이퍼카 BoP는 공개되지 않았습니다. 그래서 답이 없거나, 있는 척합니다.', '알카멜 공식 타이밍의 모든 랩으로 대회별 무게·출력·에너지를 추정하고, 추정이라고 표시합니다.'],
  en: ['Hidden numbers', 'The 2026 WEC Hypercar BoP is not published, so you get no answer, or a made-up one.', 'Every Al Kamel lap is used to estimate weight, power and energy per event, marked as an estimate.'],
  href: '/bop'
 },
 {
  ko: ['셋업', '“다운포스를 줄이세요” 같은 일반론.', '서킷별로 윙·차고·스프링 방향을 시뮬레이션과 규정, 피렐리 처방으로 보여 줍니다.'],
  en: ['Set-up', 'General advice such as “run less downforce”.', 'Wing, ride height and spring direction per circuit, from the simulation, the rules and Pirelli prescriptions.'],
  href: '/setup'
 }
];

export function homeHero(lang = 'ko') {
 const t = (ko, en) => (lang === 'en' ? en : ko);
 return `<section class="hero kb-hero" data-no-translate><h1>${t('그럴듯한 답 말고,', 'Not a plausible answer.')}<br><em>${t('계산된 답.', 'A calculated one.')}</em></h1>
<p class="lead">${esc(t('“2027년 F1 머신은 몬자를 몇 초에 돌까?” 챗봇은 그럴듯한 숫자를 내놓습니다. 꽁보다는 실제 예선 랩으로 보정한 물리 모델로 직접 계산하고, FIA 문서와 공식 타이밍을 근거로 보여 줍니다.', '“How fast would a 2027 F1 car lap Monza?” A chatbot gives you a plausible number. Kongboda calculates it with a physics model calibrated on real qualifying laps, and shows the FIA documents and official timing behind it.'))}</p>
<div class="hero-actions"><a class="button primary" href="/simulation?track=monza&amp;car=2027">${t('몬자 2027 랩 계산해 보기', 'Calculate a 2027 Monza lap')}</a><a class="button" href="/ai">${t('내 AI에 꽁보다 연결하기', 'Connect Kongboda to your AI')}</a></div></section>`;
}

export function whyKongboda(lang = 'ko', { heading = true } = {}) {
 const en = lang === 'en', t = (ko, e) => (en ? e : ko);
 const rows = ROWS.map(r => { const [topic, ai, kb] = en ? r.en : r.ko; return `<tr><th scope="row"><a href="${r.href}">${esc(topic)}</a></th><td data-l="${t('그냥 물어볼 때', 'Asking directly')}">${esc(ai)}</td><td data-l="${t('꽁보다', 'Kongboda')}">${esc(kb)}</td></tr>`; }).join('');
 return `<section class="kb-why" aria-labelledby="kb-why-title" data-no-translate>${heading ? `<h2 id="kb-why-title">${t('ChatGPT·Claude에 그냥 물어보면 안 되나요?', 'Why not just ask ChatGPT or Claude?')}</h2>` : `<h2 id="kb-why-title" class="kb-why-sub">${t('그냥 물어볼 때와 무엇이 다른가요?', 'What changes compared with asking directly?')}</h2>`}
<p class="kb-why-lead">${t('물어봐도 됩니다. 다만 일반 AI는 계산하지 않고, 원문을 읽지 않고, 공개되지 않은 값을 모릅니다.', 'You can. But a general AI does not calculate, does not read the source documents, and does not know numbers that were never published.')}</p>
<div class="kb-why-wrap"><table class="kb-why-table"><thead><tr><th scope="col"></th><th scope="col">${t('그냥 물어볼 때', 'Asking directly')}</th><th scope="col">${t('꽁보다', 'Kongboda')}</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="kb-why-foot">${t('쓰던 AI를 바꿀 필요는 없습니다. Claude나 ChatGPT에 꽁보다를 연결하면 같은 AI가 꽁보다의 계산기와 공식 자료로 답합니다.', 'Keep the AI you use. Connect Kongboda to Claude or ChatGPT and the same AI answers with Kongboda’s calculators and official sources.')} <a href="/ai">${t('연결 방법 보기', 'See how to connect')} →</a></p></section>`;
}

export const homePitchCss = `
.kb-hero .hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.kb-why{margin:0 0 56px}.kb-why h2{margin:0 0 8px}.kb-why-lead{margin:0 0 20px;color:var(--muted);max-width:62ch;font-size:16px;line-height:1.6}
.kb-why-wrap{border:1px solid var(--line-strong,var(--line));border-radius:16px;background:var(--surface);overflow:hidden}
.kb-why-table{width:100%;border-collapse:collapse;font-size:15px;line-height:1.55}
.kb-why-table th,.kb-why-table td{padding:16px 20px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.kb-why-table tr:last-child>*{border-bottom:0}
.kb-why-table thead th{font-size:13px;font-weight:700;color:var(--muted);padding-top:14px;padding-bottom:14px}
.kb-why-table thead th:last-child{color:var(--mint)}
.kb-why-table tbody th{width:16%;font-weight:700;white-space:nowrap}.kb-why-table tbody th a{color:var(--text);text-decoration:none}.kb-why-table tbody th a:hover{color:var(--mint)}
.kb-why-table td:nth-child(2){color:var(--muted);width:38%}
.kb-why-table td:last-child{font-weight:600}
.kb-why-foot{margin:16px 0 0;font-size:15px;line-height:1.6}.kb-why-foot a{color:var(--mint);font-weight:700;white-space:nowrap}
@media(max-width:700px){.kb-why-table thead{display:none}.kb-why-table,.kb-why-table tbody,.kb-why-table tr,.kb-why-table th,.kb-why-table td{display:block;width:auto}
 .kb-why-table tr{padding:16px;border-bottom:1px solid var(--line)}.kb-why-table tr:last-child{border-bottom:0}
 .kb-why-table th,.kb-why-table td{padding:0;border:0}.kb-why-table tbody th{margin-bottom:8px;font-size:16px}
 .kb-why-table td+td{margin-top:8px}.kb-why-table td::before{display:block;font-size:12px;font-weight:700;margin-bottom:2px}
 .kb-why-table td::before{content:attr(data-l);color:var(--muted)}.kb-why-table td:last-child::before{color:var(--mint)}}
`;
