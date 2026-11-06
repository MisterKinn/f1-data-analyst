// Pure helpers shared by the rules monitor (GitHub Actions) and the server lookup.
// No network or storage here, so every function can be unit tested with fixtures.

export const RULES_INDEX_VERSION=1;
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

export const decodeEntities=s=>String(s??'').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,k)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[k]);
export const htmlText=s=>decodeEntities(String(s??'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')).replace(/(?:\s*-->)+/g,' ').replace(/\s+/g,' ').trim();
const attr=(s,name)=>decodeEntities(s.match(new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]??'');
const pad=n=>String(n).padStart(2,'0');
export const slug=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function absolute(href,base){try{const u=new URL(decodeEntities(href),base);return u.protocol==='https:'||u.protocol==='http:'?u.href:null;}catch{return null;}}
function ymd(y,m,d){y=Number(y);if(y<100)y+=2000;m=Number(m);d=Number(d);if(!(y>1949&&y<2101&&m>=1&&m<=12&&d>=1&&d<=31))return null;return `${y}-${pad(m)}-${pad(d)}`;}

// Dates written in titles or listings: 2026-10-19, 19.10.26, 19/10/2026, 19 October 2026.
export function findDate(text,order='dmy'){
 const t=String(text??'');let m;
 if((m=t.match(/\b(20\d{2}|19\d{2})[-_.](\d{1,2})[-_.](\d{1,2})\b/)))return ymd(m[1],m[2],m[3]);
 if((m=t.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b/)))return order==='mdy'?ymd(m[3],m[1],m[2]):ymd(m[3],m[2],m[1]);
 if((m=t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/i)))return ymd(m[3],MONTHS[m[2].toLowerCase()],m[1]);
 if((m=t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i)))return ymd(m[3],MONTHS[m[1].toLowerCase()],m[2]);
 return null;
}

// FIA timestamps such as "Published on 02.11.26 02:55 CET".
export function fiaTimestamp(text){
 const m=String(text??'').match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?\s*(CEST|CET|UTC|GMT)?/i);if(!m)return null;
 const date=ymd(m[3],m[2],m[1]);if(!date)return null;if(m[4]===undefined)return date;
 const offset={CEST:'+02:00',CET:'+01:00',UTC:'Z',GMT:'Z'}[(m[6]||'CET').toUpperCase()];
 return `${date}T${pad(m[4])}:${m[5]}:00${offset}`;
}

export function issueOf(title){
 const m=String(title??'').match(/\b(?:Iss(?:ue)?\.?\s*(\d+)|Version\s*(\d+(?:\.\d+)?)|V(\d+(?:\.\d+)?)\b|Rev(?:ision)?\.?\s*(\d+)|Amendment\s*(\d+))/i);
 if(!m)return null;const v=m.slice(1).find(x=>x!==undefined);return {label:m[0].replace(/\s+/g,' '),number:Number(v)};
}
export const regulationYear=title=>{const m=String(title??'').match(/\b(20\d{2})\b/);return m?Number(m[1]):null;};

// Same rulebook across issues: drop issue, dates and file noise.
export function familyKey(title){
 return slug(String(title??'')
  .replace(/\b(?:Iss(?:ue)?\.?\s*\d+|Version\s*\d+(?:\.\d+)?|V\d+(?:\.\d+)?|Rev(?:ision)?\.?\s*\d+|Amendment\s*\d+)\b/gi,' ')
  .replace(/\b(?:20\d{2}|19\d{2})[-_.]\d{1,2}[-_.]\d{1,2}\b/g,' ')
  .replace(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g,' ')
  .replace(/\b(?:final|clean|published|pdf)\b/gi,' '));
}

// fia.com/regulation/category/<id>: grouped lists of dated PDFs.
export function parseFiaRegulations(html,base='https://www.fia.com'){
 const out=new Map();let group=null;
 const re=/<div\b[^>]*class=["'][^"']*\bview-grouping-header\b[^"']*["'][^>]*>([\s\S]*?)<\/div>|<li\b[^>]*class=["'][^"']*\blist-item\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
 for(const m of String(html??'').matchAll(re)){
  if(m[1]!==undefined){group=htmlText(m[1]);continue;}
  const body=m[2],a=body.match(/<a\b([^>]*)>/i);if(!a)continue;
  const url=absolute(attr(a[1],'href'),base);if(!url||!/\.pdf(?:$|[?#])/i.test(url)||out.has(url))continue;
  const title=htmlText(body.match(/<div\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??'')||decodeURIComponent(url.split('/').pop());
  const published=fiaTimestamp(htmlText(body.match(/class=["'][^"']*\bpublished\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??''))||findDate(title);
  out.set(url,{url,title,published,group});
 }
 return [...out.values()];
}

// fia.com/documents/championships/<id>: latest event's documents.
export function parseFiaEventDocuments(html,base='https://www.fia.com'){
 const s=String(html??'');
 const event=htmlText(s.match(/<div\b[^>]*class=["'][^"']*\bevent-title\b[^"']*\bactive\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??s.match(/<div\b[^>]*class=["'][^"']*\bevent-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??'')||null;
 const docs=[];
 for(const m of s.matchAll(/<li\b[^>]*class=["'][^"']*\bdocument-row\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)){
  const body=m[1],a=body.match(/<a\b([^>]*)>/i);if(!a)continue;const url=absolute(attr(a[1],'href'),base);if(!url)continue;
  const title=htmlText(body.match(/class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??'')||htmlText(body);
  const published=fiaTimestamp(htmlText(body.match(/class=["'][^"']*\bpublished\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??''));
  docs.push({url,title,number:title.match(/\bDoc\s*(\d+)/i)?.[1]??null,published,recalled:/recall/i.test(m[0].slice(0,300)+' '+title)});
 }
 return {event,docs};
}

// Any page that links PDFs (IMSA, IndyCar, NLS, series sites). Dates only when written.
const urlDate=url=>{const m=String(url).match(/\/((?:19|20)\d{2})\/(\d{2})\/(\d{2})\//);return m?ymd(m[1],m[2],m[3]):null;};
export function parsePdfLinks(html,base,{include,exclude,date_order='dmy'}={}){
 const out=new Map(),inc=include?new RegExp(include,'i'):null,exc=exclude?new RegExp(exclude,'i'):null;
 for(const m of String(html??'').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const url=absolute(attr(m[1],'href'),base);if(!url||!/\.pdf(?:$|[?#])/i.test(new URL(url).pathname+new URL(url).search))continue;
  const file=decodeURIComponent(new URL(url).pathname.split('/').pop()||'').replace(/\.pdf$/i,'').replace(/[_-]+/g,' ');
  const title=htmlText(m[2])||attr(m[1],'title')||file;const hay=title+' '+file;
  if(inc&&!inc.test(hay))continue;if(exc&&exc.test(hay))continue;
  const key=url.replace(/[?#].*$/,'');if(out.has(key))continue;
  out.set(key,{url,title:title.length<4?file:title,published:findDate(title,date_order)||urlDate(url)||findDate(file,date_order)});
 }
 return [...out.values()];
}

// ---------- article index ----------
const STOP=new Set('the a an of to and or in on for by with at from be is are was were as that this these those any all each other such may must shall will not no if than then which who whom their its it his her they them there where when within without under over into out per via upon also only same more most less least has have had been being do does did can could should would one two three four five six seven eight nine ten between after before during up down off section article appendix page regulations regulation fia formula championship competition competitor competitors'.split(' '));
export function tokenize(s){return String(s??'').toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}.]+/u).map(w=>w.replace(/^\.+|\.+$/g,'')).filter(w=>w.length>1&&!STOP.has(w));}
function keywords(text,limit=24){
 const counts=new Map();for(const w of tokenize(text)){if(/^\d+(\.\d+)*$/.test(w)||w.length<3)continue;counts.set(w,(counts.get(w)||0)+1);}
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(x=>x[0]);
}
const clip=(s,n)=>{s=String(s??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
// Article numbers: B1.5.4, 33.3, C14.3, L-4.2 style (with optional "Article" prefix).
const NUM=/^(?:art(?:icle)?\.?\s+)?((?:[A-Z]{1,2}-?)?\d{1,3}(?:\.\d{1,3}){0,4}[a-z]?)\)?[.:]?\s+(.*)$/i;

// pages: [{page, text}] in reading order. Returns article records {n,h,p,x,k}.
// TOC lines (short text ending with a page number) are dropped; the longest body wins per number.
export function splitArticles(pages,{excerpt=220,maxArticles=4000}={}){
 const found=new Map(),heads=new Map();let current=null,section=null;
 const headFor=n=>{for(let k=n;k.includes('.');k=k.slice(0,k.lastIndexOf('.'))){const h=heads.get(k.slice(0,k.lastIndexOf('.')));if(h)return h;}return heads.get(n)||section||'';};
 const flush=()=>{if(!current)return;const body=current.lines.join(' ').replace(/\s+/g,' ').trim();const rec={n:current.n,h:current.h,p:current.p,toc:!!current.toc,len:body.length,x:clip(body,excerpt),k:keywords(current.h+' '+body)};const prev=found.get(rec.n);if(!prev||(prev.toc&&!rec.toc)||(prev.toc===rec.toc&&rec.len>prev.len))found.set(rec.n,rec);current=null;};
 for(const {page,text} of pages){
  for(const raw of String(text??'').split(/\r?\n/)){
   const line=raw.replace(/\s+/g,' ').trim();if(!line)continue;
   const article=line.match(/^ARTICLE\s+((?:[A-Z]{1,2}-?)?\d{1,3})\s*[:.\-–]\s*(.+)$/i);
   if(article){flush();section=clip(article[2],90);heads.set(article[1].toUpperCase(),section);current={n:article[1].toUpperCase(),h:section,p:page,lines:[]};continue;}
   const m=line.match(NUM);
   if(m&&/\d/.test(m[1])&&!/^\d{4}$/.test(m[1])&&!/^\d+\s*(?:%|mm|kg|km|m|s|kw|mj|bar)\b/i.test(m[2])){
    const rest=m[2],n=m[1].toUpperCase();if(/^\d+$/.test(rest))continue; // bare TOC page number
    flush();
    const toc=/\s\d{1,3}$/.test(rest)&&rest.length<90,depth=(n.match(/\./g)||[]).length;
    // Section titles (B1.8 Driving) are short, unpunctuated and at most one level deep.
    const isHeading=depth<=1&&rest.length<=90&&!/[.;:,]$/.test(rest)&&!/^[a-z]/.test(rest);
    if(isHeading){const h=clip(rest.replace(/\s\d{1,3}$/,''),90);if(!toc||!heads.has(n))heads.set(n,h);current={n,h,p:page,toc,lines:[]};}
    else current={n,h:clip(headFor(n),90),p:page,toc,lines:toc?[]:[rest]};
    continue;
   }
   if(current&&!current.toc)current.lines.push(line);
  }
 }
 flush();
 return [...found.values()].filter(r=>r.len>0||r.h).slice(0,maxArticles).map(({len,toc,...r})=>r);
}

// Split one document's articles into parts below the storage object limit.
export function partition(articles,maxBytes=700_000){
 const parts=[];let cur=[],size=2;
 for(const a of articles){const s=JSON.stringify(a).length+1;if(cur.length&&size+s>maxBytes){parts.push(cur);cur=[];size=2;}cur.push(a);size+=s;}
 if(cur.length)parts.push(cur);return parts;
}

// ---------- event documents ----------
export function eventDocCategory(title){
 const t=String(title??'');
 if(/race director|event notes|competition notes|notes? to teams|track limits|pit lane|drivers?['’]? (?:meeting|briefing)|circuit map/i.test(t))return 'race_director';
 if(/decision|offence|infringement|summons|penalty|reprimand|disqualif|right of review|appeal|hearing/i.test(t))return 'decision';
 if(/power unit|energy store|gearbox|exhaust/i.test(t))return 'power_unit';
 if(/balance of performance|\bbop\b|technical bulletin|bulletin/i.test(t))return 'bulletin';
 if(/classification|starting grid|results?|lap chart|championship points/i.test(t))return 'classification';
 if(/timetable|schedule|entry list|visa|accreditation|car display/i.test(t))return 'admin';
 return 'other';
}
export const eventDocWantsText=c=>['race_director','decision','power_unit','bulletin','other'].includes(c);

// ---------- query side ----------
// Korean/English topic aliases -> English terms used in rulebooks.
export const TOPICS={
 'track limits':['track limits','track','leaving the track','white lines','트랙 리밋','트랙리밋','트랙 이탈','코스 이탈'],
 'safety car':['safety car','sc','세이프티카','세이프티 카'],
 'virtual safety car':['virtual safety car','vsc','버추얼 세이프티카','버추얼'],
 'full course yellow':['full course yellow','fcy','code 60','풀코스 옐로','풀 코스 옐로','코드 60'],
 'red flag':['red flag','suspension','suspended','레드 플래그','적기','중단'],
 'pit lane':['pit lane','pit entry','pit exit','pit stop','피트 레인','피트레인','피트 스톱','피트스톱','피트'],
 'parc ferme':['parc ferme','parc fermé','파르크 페르메','파크 퍼미'],
 'power unit':['power unit','pu','engine','energy store','파워 유닛','파워유닛','엔진'],
 'tyres':['tyre','tyres','tire','tires','compound','타이어','컴파운드'],
 'penalty':['penalty','penalties','time penalty','drive through','stop and go','grid penalty','reprimand','페널티','패널티','드라이브 스루','그리드 강등','견책'],
 'overtaking':['overtaking','overtake','passing','추월'],
 'blue flags':['blue flag','blue flags','블루 플래그','청기'],
 'yellow flags':['yellow flag','yellow flags','double waved','옐로 플래그','황기'],
 'start procedure':['start','starting procedure','formation lap','grid','false start','스타트','출발','포메이션 랩'],
 'qualifying':['qualifying','qualifying session','퀄리파잉','예선'],
 'sprint':['sprint','스프린트'],
 'points':['points','classification','포인트','점수','순위'],
 'balance of performance':['balance of performance','bop','성능 조정','성능조정'],
 'drs':['drs','adjustable bodywork','overtake mode','드래그 감소','오버테이크 모드'],
 'weather':['wet','rain','intermediate','wet weather','레인','우천','비'],
 'driver change':['driver change','minimum drive time','maximum drive time','드라이버 교체','최소 주행 시간'],
 'refuelling':['refuelling','refueling','fuel','energy','급유','연료'],
 'protest':['protest','appeal','right of review','항의','이의','재심'],
 'conduct':['driving standards','conduct','incident','collision','causing a collision','forcing','defending','주행 기준','주행 매너','접촉','충돌'],
 'scrutineering':['scrutineering','weighing','weight','검차','차량 검사','무게'],
};
export function expandQuery(query){
 const q=String(query??'').toLowerCase().normalize('NFKC'),terms=new Set(tokenize(q));const phrases=new Set();
 for(const [canon,aliases] of Object.entries(TOPICS))if(aliases.some(a=>q.includes(a.toLowerCase()))||q.includes(canon)){phrases.add(canon);for(const a of aliases)if(/^[\x00-\x7f]+$/.test(a)){phrases.add(a);for(const w of tokenize(a))terms.add(w);}}
 const number=q.match(/\b(?:art(?:icle)?\.?\s*)?((?:[a-z]{1,2}-?)?\d{1,3}(?:\.\d{1,3}){1,4})\b/i)?.[1]?.toUpperCase()??null;
 return {terms:[...terms],phrases:[...phrases],number};
}
export function scoreArticle(a,{terms,phrases,number}){
 if(number&&(a.n===number||a.n.startsWith(number+'.')))return 100-(a.n.length-number.length);
 const h=String(a.h||'').toLowerCase(),x=String(a.x||'').toLowerCase(),k=new Set(a.k||[]);let s=0;
 for(const p of phrases){if(h.includes(p))s+=6;else if(x.includes(p))s+=3;}
 for(const t of terms){if(h.includes(t))s+=3;if(k.has(t))s+=2;else if(x.includes(t))s+=1;}
 return s;
}

export const SERIES_ALIASES={
 f1:['f1','formula 1','formula one','포뮬러1','포뮬러 1','에프원'],f2:['f2','formula 2'],f3:['f3','formula 3'],
 'formula-e':['formula e','formula-e','fe','포뮬러e','포뮬러 e'],wec:['wec','world endurance','르망','le mans','하이퍼카'],
 wrc:['wrc','rally','랠리'],erc:['erc'],'world-rx':['world rx','rallycross','wrx'],macau:['macau','마카오'],
 'fia-formula-regional':['frec','formula regional','fr'],'fia-f4':['f4'],tcr:['tcr'],'fia-general':['isc','sporting code','international sporting code','appendix l','국제 스포팅 코드'],
 imsa:['imsa'],indycar:['indycar','indy nxt','인디카'],nls:['nls','nurburgring','뉘르부르크링'],scca:['scca'],'fia-other':['fia other'],
 dakar:['dakar','다카르'],elms:['elms','european le mans'],lemanscup:['le mans cup','michelin le mans cup'],alms:['alms','asian le mans'],'gtwc-europe':['gtwc','gt world challenge','gtwc europe'],'british-gt':['british gt'],'24h-series':['24h series','24h 시리즈'],dtm:['dtm'],btcc:['btcc'],'motorsport-uk':['motorsport uk','msuk'],'super-formula':['super formula','슈퍼 포뮬러','슈퍼포뮬러'],'super-taikyu':['super taikyu','슈퍼 다이큐','슈퍼다이큐'],superrace:['superrace','super race','슈퍼레이스','슈퍼 레이스'],'hyundai-n-festival':['n festival','n페스티벌','n 페스티벌','현대 n 페스티벌'],motogp:['motogp','moto gp','motogp','worldsbk','wsbk','모토gp'],'gr-cup':['gr cup','gr86']
};
export function seriesFrom(value){
 const v=String(value??'').trim().toLowerCase();if(!v)return null;if(SERIES_ALIASES[v])return v;
 for(const [id,names] of Object.entries(SERIES_ALIASES))if(names.includes(v))return id;
 return slug(v)||null;
}
