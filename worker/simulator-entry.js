// Home entry to the simulators: one-tap questions open the lap simulator with the
// track and car already set (the simulator reads ?track= and ?car=). The setup
// simulator is shown as coming soon until it exists. Text is authored in both
// languages here, so the block is marked data-no-translate.

import { translations } from './localization.js';

// English label for the main-menu link (kept here so localization.js stays untouched).
if (!Object.hasOwn(translations, '시뮬레이터')) translations['시뮬레이터'] = 'Simulator';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const QUESTIONS = [
 { track: 'monza', car: '2027', ko: '2027년 F1 머신은 몬자에서 몇 초에 돌까?', en: 'How fast would a 2027 F1 car lap Monza?' },
 { track: 'las-vegas', car: '2026', ko: '라스베이거스 폴 랩, 2026년 머신으로 계산하면?', en: 'Las Vegas pole lap with a 2026 car?' },
 { track: 'spa-francorchamps', car: 'wec-lmh', ko: 'WEC 하이퍼카는 스파를 얼마에 돌까?', en: 'How fast is a WEC Hypercar at Spa?' }
];

export function simulatorEntry(lang = 'ko') {
 const en = lang === 'en', t = (ko, eng) => esc(en ? eng : ko);
 const chips = QUESTIONS.map(q => `<li><a class="sim-entry-q" href="/simulation?track=${q.track}&amp;car=${q.car}">${t(q.ko, q.en)}<span aria-hidden="true">→</span></a></li>`).join('');
 return `<section class="sim-entry" aria-labelledby="sim-entry-title" data-no-translate><h2 id="sim-entry-title">${t('시뮬레이터로 바로 해 보기', 'Try the simulators')}</h2>
<div class="sim-entry-grid">
 <article class="sim-entry-card"><p class="sim-entry-kind">${t('랩타임 시뮬레이션', 'Lap-time simulation')}</p><h3>${t('조건이 바뀌면 랩타임은 얼마나 달라질까?', 'How much does lap time change when conditions change?')}</h3>
  <ul class="sim-entry-qs">${chips}</ul>
  <a class="button" href="/simulation">${t('랩타임 시뮬레이터 열기', 'Open the lap simulator')}</a></article>
 <article class="sim-entry-card is-soon"><p class="sim-entry-kind">${t('셋업 시뮬레이션', 'Setup simulation')} <span class="sim-entry-badge">${t('준비 중', 'Coming soon')}</span></p><h3>${t('이번 주말 팀들은 어떤 셋업으로 나올까?', 'Which setup will each team bring this weekend?')}</h3>
  <p>${t('세션 기록과 FIA 문서로 팀별 다운포스 수준, 차고, 타이어 운용을 추정합니다.', 'Estimates each team’s downforce level, ride height and tyre use from session records and FIA documents.')}</p>
  <a class="button secondary" href="/simulation">${t('그동안 랩타임 시뮬레이션 해 보기', 'Try lap-time simulation meanwhile')}</a></article>
</div></section>`;
}

export const simulatorEntryCss = `
.sim-entry{margin:8px 0 56px}.sim-entry h2{margin:0 0 16px}.sim-entry-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px}
.sim-entry-card{display:flex;flex-direction:column;gap:12px;padding:24px;border:1px solid var(--line);border-radius:16px;background:var(--surface);min-width:0}
.sim-entry-card h3{margin:0;font-size:20px;line-height:1.35}.sim-entry-card p{margin:0;color:var(--muted)}.sim-entry-card .button{align-self:flex-start;margin-top:auto}
.sim-entry-kind{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.02em;color:var(--mint)!important}
.sim-entry-badge{font-size:12px;font-weight:700;padding:2px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.sim-entry-qs{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.sim-entry-q{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;color:var(--text);text-decoration:none;font-weight:600}
.sim-entry-q span{color:var(--mint)}.sim-entry-q:hover,.sim-entry-q:focus-visible{border-color:var(--mint)}
@media(prefers-reduced-motion:no-preference){.sim-entry-q{transition:border-color .14s ease,transform .22s cubic-bezier(.2,.7,.2,1)}.sim-entry-q:hover{transform:translateY(-2px)}.sim-entry-q:hover span{transform:translateX(2px)}.sim-entry-q span{transition:transform .22s cubic-bezier(.2,.7,.2,1)}}
@media(max-width:800px){.sim-entry-grid{grid-template-columns:1fr}.sim-entry-card{padding:20px}}
`;
