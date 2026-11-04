import {sessionState} from './session-state.js';

export const raceFeatureCss=`
.track-map{margin:8px 0;min-width:0}.track-map img{display:block;width:100%;height:120px;object-fit:contain;padding:8px;background:#11171c;border-radius:8px}.track-map figcaption{font-size:11px;color:var(--muted);line-height:1.5}.track-map-links{display:flex;gap:10px;flex-wrap:wrap}.sm-zones{font-size:12px;line-height:1.6;padding:0;list-style:none}.sm-zones li{margin:6px 0}

[data-race-calendar="week"] .race-card[hidden]{display:none!important}
[data-race-calendar="week"] .race-cards{display:flex;flex-direction:column;gap:0;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:4px 16px}
[data-race-calendar="week"] .race-card{display:grid;grid-template-columns:110px minmax(0,1fr) auto;align-items:center;gap:6px 16px;width:100%;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:13px 0;background:none}
[data-race-calendar="week"] .race-card:last-child{border-bottom:0}
[data-race-calendar="week"] .race-card h3{font-size:16px;margin:0}
[data-race-calendar="week"] .race-card p{margin:0;font-size:12px}
.week-event-info{min-width:0;display:grid;gap:3px}.week-event-info p{line-height:1.45!important}[data-race-calendar="week"] summary{padding:4px 0!important}.week-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.week-detail{grid-column:2/-1;width:100%}.race-series-logo[src="/assets/gtwc-official.svg"]{height:44px}.race-series-logo{width:100px;height:26px;object-fit:contain;filter:brightness(0) invert(1)}
@media(max-width:600px){[data-race-calendar="week"] .race-cards{padding:3px 12px}[data-race-calendar="week"] .race-card{grid-template-columns:76px minmax(0,1fr);gap:5px 10px;padding:10px 0}[data-race-calendar="week"] .race-card h3{font-size:14px}.race-series-logo{width:74px;height:22px}.week-actions,.week-detail{grid-column:2/-1}.week-actions a{font-size:12px}}

.series-logo[src="/assets/nls-official"]{filter:none!important;mix-blend-mode:normal!important}.team-logo.verified-logo{width:48px;height:32px}.language-select{min-width:0;width:98px;font-size:13px;min-height:40px;padding:7px}.race-section{min-width:0}.race-section h2{font-size:23px}.race-cards{display:grid;align-items:start;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}.race-card{border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:20px;min-width:0;display:flex;flex-direction:column;gap:9px}.race-card h3{font-size:19px}.race-card p{font-size:13px}.race-card a{font-size:13px}.race-card details{margin-top:0}.race-card summary{font-size:13px}.circuit-facts{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin:5px 0;font-size:12px;line-height:1.35}.circuit-facts dt{color:var(--muted)}.circuit-facts dd{margin:0}.calendar-strip{display:flex;align-items:flex-start;overflow-x:auto;gap:14px;padding-bottom:10px;scroll-snap-type:x proximity}.calendar-strip .race-card{flex:0 0 min(310px,88%);scroll-snap-align:start}.race-timezone{margin:8px 0 16px}.standings-more{margin-top:16px}.race-meta{color:var(--mint)!important}.race-card .button{min-height:36px;padding:7px 12px;align-self:start}.race-card details p{margin:8px 0}.race-card details a{margin-right:10px}@media(max-width:420px){.header-actions{gap:5px}.language-select{width:83px;padding:5px;font-size:12px}.approved-brand{width:175px}.team-logo-slot{width:44px;min-width:44px}.participant{gap:6px}}

/* Compact, landscape circuit presentation on both mobile and desktop. */
.calendar-strip .race-card{flex-basis: min(360px,92%)}
.track-map{width:100%;margin:0}.track-map img{height:148px;padding:4px;object-fit:contain}.track-map.fia-zone-overlay img{height:auto;width:100%;max-height:330px}.track-map figcaption{font-size:10px;margin-top:3px}
[data-race-calendar="week"] .race-card{grid-template-columns:100px minmax(0,1fr) 150px}
[data-race-calendar="week"] .track-map{grid-column:3;grid-row:1 / span 2;align-self:center}
[data-race-calendar="week"] .track-map img{height:76px;padding:2px}
[data-race-calendar="week"] .track-map figcaption{font-size:9px}
[data-race-calendar="week"] .week-actions{grid-column:2}
[data-race-calendar="week"] .week-detail{grid-column:2/-1}
@media(max-width:600px){[data-race-calendar="week"] .race-card{grid-template-columns:minmax(0,1fr) 106px;gap:6px 10px}[data-race-calendar="week"] .race-card>.tag{grid-column:1}[data-race-calendar="week"] .week-event-info{grid-column:1}[data-race-calendar="week"] .track-map{grid-column:2;grid-row:1 / span 3}[data-race-calendar="week"] .week-actions{grid-column:1}[data-race-calendar="week"] .week-detail{grid-column:1/-1}.track-map img{height:132px}.calendar-strip .race-card{padding:16px}}
.session-times{display:grid;gap:5px;margin:6px 0}.session-time{display:grid;grid-template-columns:minmax(110px,auto) 1fr auto;gap:8px;align-items:center;font-size:12px;line-height:1.5}.session-time time{color:var(--mint);font-variant-numeric:tabular-nums;white-space:nowrap}.session-time a{font-size:11px;color:var(--text);white-space:nowrap}.week-event-info .session-time{grid-template-columns:135px minmax(0,1fr) auto}[data-race-calendar="week"] .race-card{align-items:start}[data-race-calendar="week"] .track-map{align-self:center}@media(max-width:600px){.week-event-info .session-time{grid-template-columns:1fr auto;gap:0 6px}.session-time time{grid-column:1/-1}.session-time a{padding:3px 0}.week-event-info{grid-column:1/-1!important}.week-event-info .session-times{margin-top:10px}.week-event-info h3{padding-right:110px}[data-race-calendar="week"] .track-map{grid-row:1 / span 2;align-self:start;pointer-events:none}.session-time span{color:var(--text)}}
.youtube-link{display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px}.youtube-link svg{display:block}.session-time>span{white-space:nowrap;min-width:0}.session-time time{grid-column:auto}
@media(max-width:600px){.race-card>.race-meta,.week-event-info>.race-meta{display:none}.week-event-info .session-time,.session-time{grid-template-columns:max-content minmax(0,1fr) auto;column-gap:8px;min-height:32px;font-size:11px}.session-time time{grid-column:auto;font-size:11px}.session-time>span{white-space:nowrap}.session-time a{padding:4px}.week-event-info .session-times{width:100%}.week-event-info .session-time{display:grid}}

.navigable-race-card{cursor:pointer}.navigable-race-card:focus-visible{outline:2px solid var(--mint);outline-offset:3px}.navigable-race-card:hover h3{color:var(--mint)}
/* Weekly cards show compact session lists; maps belong to championship calendars. */
[data-race-calendar="week"] .race-card{grid-template-columns:84px minmax(0,1fr);gap:4px 12px;padding:10px 0}
[data-race-calendar="week"] .race-series-logo{width:80px;height:24px}
[data-race-calendar="week"] .week-event-info{grid-column:2!important}
[data-race-calendar="week"] .week-event-info h3{padding-right:0;font-size:15px}
[data-race-calendar="week"] .session-times{gap:1px;margin:4px 0}
[data-race-calendar="week"] .session-time{min-height:26px}
[data-race-calendar="week"] .week-actions,[data-race-calendar="week"] .week-detail{grid-column:2}
@media(max-width:600px){[data-race-calendar="week"] .race-card{grid-template-columns:1fr;gap:4px;padding:10px 0}[data-race-calendar="week"] .week-event-info,[data-race-calendar="week"] .week-actions,[data-race-calendar="week"] .week-detail{grid-column:1!important}[data-race-calendar="week"] .week-event-info .session-times{margin-top:4px}}
/* Tight session rows and a three-card desktop carousel. */
[data-race-calendar="week"] .session-times{gap:0;margin:3px 0}
[data-race-calendar="week"] .session-time{min-height:22px;line-height:1.3}
[data-race-calendar="week"] .youtube-link{min-height:22px;padding:2px 0}
@media(min-width:900px){
 [data-race-calendar="week"] .race-cards{display:flex;flex-direction:row;align-items:stretch;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;border:0;background:none;padding:3px 2px 12px}
 [data-race-calendar="week"] .race-card{display:flex;flex-direction:column;align-items:stretch;flex:0 0 calc((100% - 28px)/3);width:calc((100% - 28px)/3);min-width:0;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--surface);scroll-snap-align:start;gap:8px}
 [data-race-calendar="week"] .race-card:last-child{border-bottom:1px solid var(--line)}
 [data-race-calendar="week"] .session-time{grid-template-columns:max-content minmax(0,1fr) auto;font-size:11px;gap:5px}
 [data-race-calendar="week"] .week-event-info{display:block;min-width:0}
}

[data-race-calendar="week"] .race-card:not(.navigable-race-card){cursor:default;transform:none;box-shadow:none}
[data-race-calendar="week"] .week-session-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.week-session-columns .session-column{display:grid;gap:3px;align-content:start;min-width:0}
[data-race-calendar="week"] .week-session-columns .session-time{display:flex;flex-wrap:wrap;gap:2px 5px;align-items:center;font-size:11px}
.week-session-columns .session-time time{font-size:10px}
@media(max-width:350px){[data-race-calendar="week"] .week-session-columns{grid-template-columns:1fr}}
@media(max-width:700px){[data-race-calendar="week"] .race-card{grid-template-columns:80px minmax(0,1fr);column-gap:12px;align-items:center}[data-race-calendar="week"] .race-series-logo{grid-column:1;grid-row:1}[data-race-calendar="week"] .week-event-info{display:contents}[data-race-calendar="week"] .week-event-info h3{grid-column:2;grid-row:1;align-self:center}[data-race-calendar="week"] .week-session-columns,[data-race-calendar="week"] .session-times{grid-column:1/-1}[data-race-calendar="week"] .session-time time{min-height:0!important;line-height:1.5}[data-race-calendar="week"] .session-time>span{line-height:1.5}.session-time{align-items:center}.session-time time{min-height:0!important;line-height:1.5}}

@media(max-width:400px){[data-race-calendar="week"] .race-card .week-session-columns{grid-template-columns:1fr}}.race-title-mobile{display:none}@media(max-width:700px){.race-title-mobile{display:inline}.race-title-desktop{display:none}[data-race-calendar="week"] .race-card .session-time{display:grid!important;grid-template-columns:7em minmax(0,1fr) auto;gap:3px;font-size:14px!important;align-items:center}[data-race-calendar="week"] .session-time time{width:100%;font-size:14px!important;font-variant-numeric:tabular-nums;white-space:nowrap}.calendar-strip .session-time{grid-template-columns:9.4em minmax(0,1fr) auto}[data-race-calendar="week"] .race-card .session-time>span{font-size:14px}[data-race-calendar="week"] .race-card.long-session-names .week-session-columns{grid-template-columns:1fr}}
/* Shared time/name columns keep session names aligned even when labels wrap. */
@media(min-width:701px){
[data-race-calendar="week"] .race-card .week-session-columns{grid-template-columns:1fr;gap:3px}
[data-race-calendar="week"] .race-card .session-column{gap:3px}
[data-race-calendar="week"] .race-card .session-time{display:grid;grid-template-columns:8.5em minmax(0,1fr) 24px;gap:8px;min-height:25px;align-items:baseline;font-size:12px}
[data-race-calendar="week"] .race-card .session-time time{font-size:12px;font-variant-numeric:tabular-nums}
[data-race-calendar="week"] .race-card .session-time>span{white-space:normal;overflow-wrap:anywhere;text-align:left}
[data-race-calendar="week"] .race-series-logo{height:32px;object-position:left center}
[data-race-calendar="week"] .week-event-info h3{min-height:24px;text-align:left}
}
@media(min-width:1700px){[data-race-calendar="week"] .race-card:not(.long-session-names) .week-session-columns{grid-template-columns:repeat(2,minmax(0,1fr))}}
/* Match mobile branding: series logo beside the event title, sessions below. */
@media(min-width:701px){
 [data-race-calendar="week"] .race-card{display:grid;grid-template-columns:80px minmax(0,1fr);grid-template-rows:auto 1fr;align-content:start;align-items:start;gap:8px 12px}
 [data-race-calendar="week"] .race-card>.tag{grid-column:1;grid-row:1;margin:0;align-self:center}
 [data-race-calendar="week"] .week-event-info{display:contents}
 [data-race-calendar="week"] .week-event-info h3{grid-column:2;grid-row:1;align-self:center;margin:0;min-height:0}
 [data-race-calendar="week"] .week-session-columns,[data-race-calendar="week"] .session-times{grid-column:1/-1;grid-row:2;align-self:start}
}
/* Dense desktop schedule rows: avoid control minimum heights inflating every row. */
@media(min-width:701px){
 [data-race-calendar="week"] .race-card{padding:12px;row-gap:6px;grid-template-rows:auto auto;align-content:start}
 [data-race-calendar="week"] .race-card .week-session-columns{gap:0}
 [data-race-calendar="week"] .race-card .session-column{gap:0}
 [data-race-calendar="week"] .race-card .session-time{min-height:19px;line-height:1.25;gap:2px 8px;padding:0;align-items:center}
 [data-race-calendar="week"] .race-card .session-time time,[data-race-calendar="week"] .race-card .session-time>span{min-height:0;line-height:1.25;padding:0}
 [data-race-calendar="week"] .race-card .youtube-link{min-height:19px;height:19px;padding:0}
 [data-race-calendar="week"] .session-times{margin:2px 0 0}
}
/* Desktop: practice left, qualifying/race right; time labels hug session names. */
.map-switches{display:flex;gap:6px;margin:0 0 6px}.map-switches button{font-size:12px;min-height:32px;padding:5px 12px;border-radius:999px}.map-switches button[aria-pressed="true"]{color:var(--bg);background:var(--mint)}.track-map.zone-map-active img{height:320px;background:#fff}.track-map figcaption a{margin-left:6px}
.week-scroll-controls{display:none}
@media(min-width:901px){
 [data-race-calendar="week"] .race-cards{overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:#52656f #11171c;scroll-padding:2px}
 [data-race-calendar="week"] .race-card .week-session-columns{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 [data-race-calendar="week"] .race-card .session-time{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:2px 4px;min-height:22px;font-size:11px}
 [data-race-calendar="week"] .race-card .session-time time{width:auto;font-size:11px;letter-spacing:-.35px;flex:none}
 [data-race-calendar="week"] .race-card .session-time>span{font-size:11px;white-space:normal;overflow-wrap:normal}
 [data-race-calendar="week"] .race-card .youtube-link{min-width:20px;width:20px;min-height:22px}
 [data-race-calendar="week"] .race-card .session-column{gap:2px}
 [data-race-calendar="week"] .week-scroll-controls:not([hidden]){display:flex;justify-content:flex-end;gap:8px;margin:0 0 8px}
 .week-scroll-controls button{width:36px;min-height:36px;padding:4px;border-radius:50%}
}
@media(min-width:901px) and (max-width:1199px){[data-race-calendar="week"] .race-card{flex-basis:calc((100% - 14px)/2);width:calc((100% - 14px)/2)}}


/* One horizontal weekly layout at every viewport size. Card widths change
   continuously; the schedule never switches into a vertical list. */
[data-race-calendar="week"] .race-cards{display:flex;flex-direction:row;align-items:stretch;gap:14px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:#52656f #11171c;scroll-padding:2px;border:0;background:none;padding:3px 2px 12px}
[data-race-calendar="week"] .race-card{display:grid;grid-template-columns:72px minmax(0,1fr);grid-template-rows:auto 1fr;align-content:start;align-items:start;flex:0 0 clamp(280px,calc((100% - 28px)/3),420px);width:auto;min-width:0;padding:14px;gap:12px 10px;border:1px solid var(--line);border-radius:12px;background:var(--surface);scroll-snap-align:start}
[data-race-calendar="week"] .race-card:last-child{border-bottom:1px solid var(--line)}
[data-race-calendar="week"] .race-card>.tag{grid-column:1;grid-row:1;align-self:center;margin:0}
[data-race-calendar="week"] .race-series-logo{width:70px;height:28px;object-position:left center}
[data-race-calendar="week"] .week-event-info{display:contents}
[data-race-calendar="week"] .week-event-info h3{grid-column:2;grid-row:1;align-self:center;padding:0;min-height:0;margin:0;font-size:15px;line-height:1.5}
[data-race-calendar="week"] .race-card .week-session-columns,[data-race-calendar="week"] .race-card.long-session-names .week-session-columns{grid-column:1/-1;grid-row:2;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-self:start;gap:12px;margin:0;width:auto}
[data-race-calendar="week"] .race-card .session-column{gap:10px}
[data-race-calendar="week"] .race-card .session-time{display:flex!important;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:1px;min-height:0;font-size:12px!important;line-height:1.5;padding:0}
[data-race-calendar="week"] .race-card .session-time time{width:auto;min-height:0;font-size:12px!important;line-height:1.5;letter-spacing:0;white-space:nowrap}
[data-race-calendar="week"] .race-card .session-time>span{font-size:12px;line-height:1.5;white-space:normal;overflow-wrap:normal}
[data-race-calendar="week"] .session-time abbr{text-decoration:none;cursor:help}
[data-race-calendar="week"] .race-card .youtube-link{min-width:28px;min-height:28px;padding:3px}
[data-race-calendar="week"] .week-scroll-controls:not([hidden]){display:flex;justify-content:flex-end;gap:8px;margin:0 0 8px}
[data-race-calendar="week"] .week-scroll-controls button{display:flex;align-items:center;justify-content:center;width:44px;min-height:44px;padding:8px;border-radius:8px}
[data-race-calendar="week"] .week-scroll-controls svg{width:20px;height:20px}
[data-race-calendar="week"] .week-scroll-controls button:disabled{opacity:.35;cursor:default}

`;

// Restrained motion and compact badges keep titles and mobile cards readable.
export const sessionStateCss=`
.session-live-badge{display:inline-flex;align-items:center;vertical-align:middle;gap:5px;margin-left:8px;padding:3px 7px;border:1px solid #ff636366;border-radius:999px;background:#ff454518;color:#ff6969;font:700 12px/1.2 system-ui,sans-serif;letter-spacing:.7px;white-space:nowrap}
.session-live-badge[hidden]{display:none!important}
.series[data-live-series]{position:relative}.series-live-badge{position:absolute;right:18px;top:18px;margin:0}.series[data-live-series]>.series-logo{max-width:calc(100% - 65px)}
.session-time.session-finished time,.session-time.session-finished>span{color:var(--muted)!important}
.session-live-badge{white-space:normal;letter-spacing:0;font-weight:600;max-width:100%;line-height:1.5}.race-series-name{font:700 14px/1.4 system-ui,sans-serif;color:var(--text);letter-spacing:.01em}
@media(max-width:700px){.session-live-badge{margin-left:6px;font-size:12px}.series-live-badge{top:16px;right:16px;margin:0}}
`;

export const scheduleLogoCss='[data-race-calendar="week"] .race-series-logo[src="/assets/schedule/24h-series"]{object-fit:cover;object-position:left;width:80px;height:38px;filter:grayscale(1) contrast(100);mix-blend-mode:screen}';
export function calendarSection(series){return `<section class="race-section" data-race-calendar="${series||'week'}"><h2>${series?'레이스 캘린더':'이번 주의 모터스포츠'}</h2><p class="fine race-timezone" data-race-status>일정 확인 중…</p><div class="${series?'calendar-strip':'race-cards'}" data-race-cards></div></section>`;}
export function weekBounds(now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);
 const end=new Date(start);end.setDate(end.getDate()+7);return {start,end};
}
// Use session instants across midnight/week boundaries; date-only events use venue dates.
export function weeklyEventVisible(event,now,weekBounds,sessionState){
 const clock=+now,week=weekBounds(new Date(clock));
 const sessions=event.sessions?.length?event.sessions:(event.raceStart?[{nameEn:'Race',start:event.raceStart}]:[]);
 const localDate=value=>new Date(value+'T12:00:00');
 const eventOverlaps=localDate(event.start)<week.end&&localDate(event.end||event.start)>=week.start;
 if(sessions.length)return sessions.some(session=>{
  const state=sessionState(session,event,clock),start=Date.parse(session.start);
  return Number.isFinite(start)&&(eventOverlaps||start<+week.end&&(state.end??start)>=+week.start)&&state.phase!=='finished';
 });
 const venueDate=new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock));
 return eventOverlaps&&(event.end||event.start)>=venueDate;
}
export function compactSessionName(name){
 return String(name||'').replace(/프리 퀄리파잉|Pre-qualifying/gi,'Pre-Q')
  .replace(/퀄리파잉|Qualifying|Qualification|예선/gi,'Q')
  .replace(/하이퍼폴|Hyperpole/gi,'HP')
  .replace(/공식 연습|Official practice|Free practice|practice|연습/gi,'FP')
  .replace(/공식 테스트|Official test/gi,'Test')
  .replace(/브론즈 세션|Bronze session/gi,'Bronze')
  .replace(/(\bQ)\s+(\d+)\b/g,'$1$2').replace(/\s+/g,' ').trim();
}

export function scheduledSessionStatus(event,clock,language='ko',resolveState=sessionState){
 const phases=(event.sessions||[]).map(session=>resolveState(session,event,clock).phase);
 const phase=phases.includes('live')?'live':phases.includes('starting-soon')?'starting-soon':null;
 const en=language==='en';
 const label=phase==='live'?(en?'Session in progress · scheduled':'세션 진행 중 · 일정 기준'):phase==='starting-soon'?(en?'Starting soon · scheduled':'곧 시작 · 일정 기준'):'';
 return {visible:Boolean(phase),phase,label,description:en?'Based on the published schedule; timing-feed connection is not confirmed.':'공식 일정에 따른 표시이며, 실시간 수집기 연결 상태를 뜻하지 않습니다.'};
}

export function raceFeaturesClient(dictionary,translateText,weekBounds,sessionState,weeklyEventVisible,compactSessionName,scheduledSessionStatus){
 const lang=document.documentElement.lang==='en'?'en':'ko';
 const t=(ko,en)=>lang==='en'?en:ko;
 window.kongbodaTranslate=s=>lang==='en'?translateText(String(s),dictionary):s;
 const select=document.querySelector('#language');
 if(select){select.value=lang;select.addEventListener('change',()=>{document.cookie='kongboda_lang='+select.value+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');location.reload();});}
 // Translate only explicitly selected UI messages. API records and user content are never walked or rewritten.
 const root=document.querySelector('[data-race-calendar]');if(!root)return;
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',locale=lang==='en'?'en-GB':'ko-KR';
 const status=root.querySelector('[data-race-status]'),cards=root.querySelector('[data-race-cards]');
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 const link=(label,url)=>{const a=node('a',label);a.href=url;if(/^https:\/\//.test(url)){a.target='_blank';a.rel='noopener noreferrer';}return a;};
 const date=(value)=>new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00':value);
 const shortSession=name=>String(name||'').replace(/프리 퀄리파잉|Pre-qualifying/gi,'Pre-Q').replace(/퀄리파잉\s*(\d+)|Qualifying\s*(\d+)/gi,(_,a,b)=>'Q'+(a||b)).replace(/퀄리파잉|Qualifying|예선/gi,t('퀄리파잉','Qualifying')).replace(/공식 연습|Official practice|practice|연습/gi,'FP').replace(/공식 테스트|Official test/gi,'Test').replace(/레이스\s*(\d+)|Race\s*(\d+)/gi,(_,a,b)=>'R'+(a||b)).replace(/브론즈 세션|Bronze session/gi,'Bronze');
 const display=(value)=>date(value).toLocaleDateString(locale,{year:'numeric',month:'short',day:'numeric'});
 const empty=t('공식 자료로 확인된 해당 기간의 대회가 없습니다.','No events verified from official sources for this period.');
 let carouselObserver=null;
 function loadCalendar(){return publicJsonRequest('/api/race-calendar',{cache:'no-store',timeoutMs:15000}).then(({response:r,data})=>{if(!r.ok)throw Error();return data;}).then(data=>{
  function render(){
  if(data.unavailable){cards.replaceChildren();status.textContent=t('24시간 이내 확인된 일정이 없습니다. 공식 일정 갱신을 다시 확인하고 있습니다.','No schedule verified within 24 hours. Checking the official sources again.');return ()=>{};}
  carouselObserver?.disconnect();cards.onscroll=null;cards.onkeydown=null;cards.replaceChildren();root.querySelector('.week-scroll-controls')?.remove();
  const now=new Date(),week=weekBounds(now),series=root.dataset.raceCalendar;
  let events=data.events.filter(e=>series==='week'?weeklyEventVisible(e,now,weekBounds,sessionState):e.series===series||(e.seriesIds||[]).includes(series));
  if(series!=='week'){
   const upcoming=events.filter(e=>date(e.end||e.start)>=new Date(now.getFullYear(),now.getMonth(),now.getDate()));
   events=upcoming.length?upcoming:events.slice(-3);
  }
  // Editorial display priority; not a measured global audience ranking.
  const seriesPriority=['f1','wec','imsa','formula-e','elms','nls','alms','lemanscup'];
  const priority=e=>{const index=seriesPriority.indexOf(e.series);return index<0?seriesPriority.length:index;};
  events.sort((a,b)=>series==='week'?(priority(a)-priority(b)||date(a.start)-date(b.start)):date(a.start)-date(b.start));
  let syncWeekControls=()=>{};
  if(series==='week'){
   cards.tabIndex=0;cards.setAttribute('role','region');cards.setAttribute('aria-label',t('이번 주 대회 · 좌우 스크롤','This week’s events · scroll horizontally'));
   const controls=node('div',undefined,'week-scroll-controls'),buttons=[];
   const scroll=step=>cards.scrollBy({left:step*((cards.querySelector('.race-card:not([hidden])')?.getBoundingClientRect().width||280)+14),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   for(const [step,label] of [[-1,t('이전 대회','Previous events')],[1,t('다음 대회','Next events')]]){
    const button=node('button');button.type='button';button.setAttribute('aria-label',label);
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="'+(step<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7')+'"/></svg>';
    button.addEventListener('click',()=>scroll(step));controls.append(button);buttons.push(button);
   }
   cards.before(controls);
   syncWeekControls=()=>{const max=cards.scrollWidth-cards.clientWidth;controls.hidden=max<=1;buttons[0].disabled=cards.scrollLeft<=1;buttons[1].disabled=cards.scrollLeft>=max-1;};
   cards.onscroll=syncWeekControls;
   cards.onkeydown=event=>{if(event.target===cards&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();scroll(event.key==='ArrowLeft'?-1:1);}};
   carouselObserver=new ResizeObserver(syncWeekControls);carouselObserver.observe(cards);
  }
  const period=series==='week'?display(week.start.toISOString())+' – '+display(new Date(week.end-1).toISOString())+' · ':'';
  const zoneLabel=['Asia/Seoul','Etc/GMT-9'].includes(zone)?t('한국시간 기준','Korea time'):t('기기 현지시간 기준','Your local time');
  status.textContent=zoneLabel+' · '+t('월–일 기준','Monday–Sunday')+' · '+t('공식 일정 확인: ','Sources checked: ')+data.checkedAt;
  if(!events.length){cards.append(node('p',empty,'fine'));return ()=>{};}
  const timedEvents=[];let emptyMessage=null;
  const liveBadge=()=>{const badge=node('span','','session-live-badge');badge.hidden=true;badge.setAttribute('data-no-translate','');return badge;};
  for(const e of events){
   const card=node('article',undefined,'race-card');if(['nascar','super-taikyu'].includes(e.series))card.classList.add('long-session-names');
   if(series==='week')card.append(node('p',e.seriesLabel||e.series.toUpperCase(),'tag'));
   card.append(node('h3',lang==='en'?(e.nameEn||e.name):e.name));
   if(series!=='week')card.append(node('p',display(e.start)+(e.end&&e.end!==e.start?' – '+display(e.end):''),'race-meta'));
   const sessions=e.sessions?.length?e.sessions:(e.raceStart?[{name:'레이스',nameEn:'Race',start:e.raceStart,source:e.raceTimeSource}]:[]);
   const timedRows=[];
   const sessionList=node('div',undefined,'session-times');
   for(const session of sessions){const row=node('div',undefined,'session-time');const time=node('time',new Date(session.start).toLocaleString(locale,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}));time.dateTime=session.start;const fullName=(lang==='en'?session.nameEn:session.name)||session.name||session.nameEn||'',label=node('span');if(series==='week'){const abbr=node('abbr',compactSessionName(fullName));abbr.title=fullName;label.append(abbr);}else label.textContent=shortSession(fullName);row.append(time,label);if(session.watchUrl){const a=link('',session.watchUrl);a.className='youtube-link';a.setAttribute('aria-label',shortSession(lang==='en'?session.nameEn:session.name)+' · YouTube');a.title='YouTube';a.innerHTML='<svg viewBox="0 0 24 18" width="19" height="14" aria-hidden="true"><path fill="white" d="M23.5 3s-.3-2.1-1.2-3C21.2-.9 3-.9 1.7 0 .5.9.2 3 .2 3S0 5.5 0 8v2c0 2.5.2 5 .2 5s.3 2.1 1.5 3c1 .9 19.4.9 20.6 0 1-.9 1.2-3 1.2-3s.5-2.5.5-5V8c0-2.5-.5-5-.5-5Z" transform="translate(0 1) scale(1 .85)"/><path fill="#0b1014" d="m10 5 6 4-6 4z"/></svg>';row.append(a);}sessionList.append(row);}
   for(let i=0;i<sessions.length;i++)timedRows.push({row:sessionList.children[i],session:sessions[i]});
   if(sessions.length)card.append(sessionList);else card.append(node('p',display(e.start)+(e.end&&e.end!==e.start?' – '+display(e.end):'')+' · '+t('세부 시작 시각은 공식 발표 후 안내','Session times pending the official itinerary'),'fine'));
   const info=data.circuits[e.circuit]||{};card.append(node('p',info.name||e.circuit));
   const details=node('details');details.append(node('summary',t('서킷 · 타이어 · 전략','Circuit · tyres · strategy')));
   const dl=node('dl',undefined,'circuit-facts');
   for(const [key,label,en,unit] of [['lengthKm','트랙 길이','Track length',' km'],['elevationM','해발고도','Altitude',' m'],['elevationChangeM','고저차','Elevation change',' m'],['offsetM','스타트–피니시 거리','Start–finish offset',' m']]){
    dl.append(node('dt',t(label,en)),node('dd',info[key]!=null?info[key]+unit:t('미확인','Not verified')));
   }
   const map=data.trackMaps?.[e.circuit];
   if(map&&series!=='week'){
    const figure=node('figure',undefined,'track-map');const img=node('img');img.src=map.imageUrl;img.alt=(info.name||e.circuit)+' '+t('트랙맵','track map');img.loading='lazy';img.width=270;img.height=120;if(map.background==='light')img.style.background='#fff';
    img.onerror=()=>{img.replaceWith(node('p',t('트랙맵을 불러오지 못했습니다. 원문을 확인하세요.','Map unavailable. Open the source.')));};figure.append(img);
    if(map.attributionRequired!==false){const caption=node('figcaption',map.attribution+' · ');caption.append(link(map.license,map.licenseUrl));figure.append(caption);}
    card.append(figure);
    const zones=map.f1Zones;
    if(e.series==='f1'&&zones?.overlay&&Number(e.start.slice(0,4))===zones.season){
     figure.classList.add('fia-zone-overlay');
     img.alt=(info.name||e.circuit)+' S1/S2/S3 · SM normal/low grip · OT detection/activation (schematic)';

    }

    const maplinks=node('div',undefined,'track-map-links');maplinks.append(link(t('트랙맵 출처 ↗','Track map source ↗'),map.sourceUrl));if(map.officialMapUrl)maplinks.append(link(t('공식 트랙맵 ↗','Official track map ↗'),map.officialMapUrl));details.append(maplinks);
   }else if(!map)details.append(node('p',t('해당 레이아웃의 트랙맵 확인 중','Track map for this layout pending verification')));
   details.append(dl);

   if(e.series==='wec'&&Array.isArray(e.tyreAllocations)){
    const tyres=node('div',undefined,'class-tyre-allocation');
    const names={Soft:t('소프트','Soft'),Medium:t('미디엄','Medium'),Hard:t('하드','Hard'),Wet:t('웨트','Wet')};
    for(const allocation of e.tyreAllocations){const row=node('p');row.append(node('strong',allocation.category+' · '+allocation.supplier+': '));row.append(document.createTextNode(allocation.status==='confirmed'?allocation.compounds.map(c=>names[c]||c).join(' · '):t('대회별 컴파운드 배정 확인 중','Event compound allocation pending verification')));if(allocation.source)row.append(document.createTextNode(' '),link(t('출처 ↗','Source ↗'),allocation.source));tyres.append(row);}
    details.append(tyres);
   }else{
    details.append(node('p',t('타이어: ','Tyres: ')+(lang==='en'?(e.tyresEn||'Event allocation not verified'):(e.tyres||'대회별 지정 정보 미확인'))));
   }
   details.append(node('p',t('예상 전략: ','Strategy outlook: ')+(lang==='en'?(e.strategyEn||'Published when event rules and tyre information are verified.'):(e.strategy?.replace(/^예상: /,'')||'대회 규정·타이어 정보 확인 후 제공'))));
   if(info.notes)details.append(node('p',lang==='en'?(info.notesEn||''):info.notes));
   if(info.sourceUrl)details.append(link(t('서킷 출처 ↗','Circuit source ↗'),info.sourceUrl));
   for(const [key,ko,en] of [['tyreSource','타이어 출처 ↗','Tyre source ↗'],['strategySource','전략 근거 ↗','Strategy source ↗']])if(e[key])details.append(link(t(ko,en),e[key]));
   card.append(details);
   const supported=(e.seriesIds||[e.series]).filter(id=>data.supported.includes(id)&&!id.startsWith('gtwc')&&id!=='nascar');
   if(series==='week'){
    const parts=[...card.children];const brand=parts[0],heading=parts[1],mapFigure=parts.find(p=>p.tagName==='FIGURE');
    let compactTitle=heading.textContent;
    if(e.series.startsWith('gtwc-'))compactTitle=({'gtwc-europe':t('유럽','Europe'),'gtwc-asia':t('아시아','Asia'),'gtwc-america':t('아메리카','America'),'gtwc-australia':t('오스트레일리아','Australia')})[e.series]||compactTitle;
    if(e.series.startsWith('gtwc-')){const venue=heading.textContent.split(' · ').slice(1).join(' · ');if(venue)compactTitle+=' · '+venue;}
    else if(['nascar','wec','imsa','formula-e'].includes(e.series))compactTitle=compactTitle.replace(/^(?:FIA\s+WEC|WEC|IMSA|NASCAR|ABB\s+FIA\s+Formula\s+E|Formula\s+E|포뮬러\s*E)\s*(?:[·:–—-]\s*)?/i,'');
    heading.textContent=compactTitle;
    const main=node('div',undefined,'week-event-info');main.append(heading);const sessionTimes=parts.find(p=>p.classList.contains('session-times'));if(sessionTimes){const practice=node('div',undefined,'session-column'),competitive=node('div',undefined,'session-column');for(const row of [...sessionTimes.children]){const name=row.querySelector('span')?.textContent||'';(/\bFP[123]?\b|practice|연습|프랙티스|test|bronze/i.test(name)?practice:competitive).append(row);}if(e.series==='wrc'){const rallyRows=[...competitive.children];for(const row of rallyRows.slice(0,Math.ceil(rallyRows.length/2)))practice.append(row);}sessionTimes.replaceChildren(...[practice,competitive].filter(col=>col.children.length));sessionTimes.classList.add('week-session-columns');main.append(sessionTimes);}
    // Date/time and circuit stay visible; detailed measurements remain expandable.
    for(const part of parts.slice(2))if(part!==details&&part.tagName==='P'){
     if(part.classList.contains('fine')||!part.className){if(!sessions.length&&part.classList.contains('fine'))main.append(part);else details.prepend(part);continue;}
     main.append(part);
    }
    const actions=node('div',undefined,'week-actions');
    for(const part of parts)if(part.tagName==='A'){part.classList.remove('button');actions.append(part);}
    details.className='week-detail';
    const seriesName=node('span',e.seriesLabel||e.series.toUpperCase(),'race-series-name');seriesName.setAttribute('data-no-translate','');brand.replaceChildren(seriesName);
    card.replaceChildren(brand,main);
    if(supported.length){
     const destination='/championships/'+supported[0];
     card.classList.add('navigable-race-card');
     const titleLink=link(heading.textContent,destination);heading.replaceChildren(titleLink);
    }
   }
   const badge=liveBadge();card.querySelector('h3').append(badge);
   timedEvents.push({event:{...e,sessions},rows:timedRows,badge,card});
   cards.append(card);
  }
  const homeCards=[...document.querySelectorAll('[data-live-series]')].map(card=>{const badge=card.querySelector('.series-live-badge')||liveBadge();badge.classList.add('series-live-badge');if(!badge.parentNode)card.append(badge);return {card,badge,series:card.dataset.liveSeries};});
  function refreshSessionStates(){
   const clock=Date.now(),active=new Map();
   for(const entry of timedEvents){if(series==='week')entry.card.hidden=!weeklyEventVisible(entry.event,new Date(clock),weekBounds,sessionState);for(const {row,session} of entry.rows){const state=sessionState(session,entry.event,clock);row.classList.toggle('session-finished',state.phase==='finished');row.dataset.sessionState=state.phase;}
    const info=scheduledSessionStatus(entry.event,clock,lang,sessionState);entry.badge.hidden=!info.visible;entry.badge.textContent=info.label;entry.badge.title=info.description;entry.badge.setAttribute('aria-label',info.label+' · '+info.description);if(info.visible&&(!active.has(entry.event.series)||info.phase==='live'))active.set(entry.event.series,info);
   }
   if(series==='week'){const visible=timedEvents.some(entry=>!entry.card.hidden);if(!visible&&!emptyMessage){emptyMessage=node('p',empty,'fine');cards.append(emptyMessage);}if(emptyMessage)emptyMessage.hidden=visible;requestAnimationFrame(syncWeekControls);}
   for(const {badge,series} of homeCards){const info=active.get(series);badge.hidden=!info;badge.textContent=info?.label||'';badge.title=info?.description||'';badge.setAttribute('aria-label',info?info.label+' · '+info.description:'');}
  }
  if(data.stale)status.textContent+=' · '+t('일부 출처 갱신 확인 중 · 확인 시각 참고','Some sources could not refresh · check the verification time');
  refreshSessionStates();return refreshSessionStates;
  }
  let refresh=render(),weekStart=+weekBounds(new Date()).start,lastFetch=Date.now(),fetching=false;
  function tick(){
   const start=+weekBounds(new Date()).start;
   if(start!==weekStart){weekStart=start;refresh=render();}
   refresh();
   if(!fetching&&Date.now()-lastFetch>=300000){fetching=true;publicJsonRequest('/api/race-calendar',{cache:'no-store',timeoutMs:15000}).then(({response:r,data:next})=>{if(!r.ok)throw Error();data=next;lastFetch=Date.now();refresh=render();}).catch(()=>{lastFetch=Date.now()-240000;if(Date.now()-Date.parse(data.checkedAt)>=86400000){data={...data,events:[],unavailable:true};refresh=render();}status.textContent=t('최신 일정 확인 실패 · 이전 조회 일정 표시 중','Refresh failed · showing the previous schedule');}).finally(()=>{fetching=false;});}
  }
  setInterval(()=>{if(document.visibilityState!=='hidden')tick();},15000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick();});
  window.addEventListener('pageshow',tick);
 }).catch(()=>{
 status.textContent=t('일정을 불러오지 못했습니다.','Could not load the schedule.');
 const retry=node('button',t('다시 시도','Retry'));retry.type='button';
 retry.addEventListener('click',()=>{retry.remove();status.textContent=t('일정 불러오는 중…','Loading schedule…');loadCalendar();},{once:true});
 status.append(document.createTextNode(' '),retry);
 });}loadCalendar();
}

