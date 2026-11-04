import {officialSource,officialArchive,textOf,clean,links} from './official.js';
import {readPublishedDocument} from './wec.js';
export const NEW_SERIES=['imsa','formula-e','nls','elms','alms','lemanscup'];
const memoCache=new Map();
async function memo(k,fn){let v=memoCache.get(k);if(v&&Date.now()-v.at<300000)return v.value;const value=await fn();memoCache.set(k,{at:Date.now(),value});return value;}
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const label=s=>s.replace(/Drivers?/gi,'드라이버').replace(/Teams?/gi,'팀').replace(/Manufacturers?/gi,'매뉴팩처러').replace(/_/g,' ');
// IMSA Al Kamel file titles -> "class · kind" labels people can scan.
export function imsaCategoryLabel(title){
 const cls=t=>t.replace(/GT\s*Daytona\s*PRO|GTDPRO/i,'GTD PRO').replace(/GT\s*Daytona/i,'GTD').trim();
 const kind=t=>/Drivers?/i.test(t)?'드라이버':/Teams?/i.test(t)?'팀':/Manufacturers?/i.test(t)?'매뉴팩처러':'';
 let m=title.match(/^VP Fuels Front Runner Award\s*-\s*IWSC\s*\d+\s+(.+)$/i);if(m)return 'VP Fuels 프런트러너 상 · '+cls(m[1]);
 m=title.match(/^S\d+\s+(.+?)\s+Award$/i);if(m)return m[1]+' 상';
 m=title.match(/^IWSC\s*\d+\s+(.+?)\s+(Drivers?|Teams?|Manufacturers?)$/i);if(m)return cls(m[1])+' · '+kind(m[2]);
 m=title.match(/^\d+\s+IMEC\s+(.+?)\s+(Drivers?|Teams?|Manufacturers?)\b/i);if(m)return '엔듀런스컵 · '+cls(m[1])+' · '+kind(m[2]);
 return label(title);
}
function checkRows(rows){if(!rows.length||rows.some(r=>!r.name||!Number.isFinite(r.points)||!Number.isFinite(r.position)||r.position<1))throw Error('공식 순위 형식을 확인하지 못했습니다.');return rows;}
export function parseFormulaE(html){
 const categories=[];
 for(const m of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const h=m[1],part=clean(h).match(/Championship\s*-\s*(Drivers|Teams|Manufacturers)/i)?.[1];if(!part)continue;
  const rows=[...h.matchAll(/<tr\b[^>]*class=["'][^"']*\bcompetitor\b[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)].map(([_,r])=>{
   const cell=cls=>r.match(new RegExp('<(?:td|div)\\b[^>]*class=["\'][^"\']*\\b'+cls+'\\b[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/(?:td|div)>','i'))?.[1]??'';
   return {position:Number(clean(cell('position'))),name:clean(cell('name')),points:Number(clean(cell('points').replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,''))),team:clean(cell('team')),number:''};
  });categories.push({id:part.toLowerCase(),label:label(part),rows:checkRows(rows)});
 }if(categories.length!==3)throw Error('Formula E의 세 부문 순위를 확인하지 못했습니다.');return categories;
}
export function parseImsa(raw,year,id){
 if(String(raw.championship?.year)!==String(year)||!Array.isArray(raw.classification))throw Error('IMSA 시즌 또는 형식 불일치');
 return checkRows(raw.classification.map(r=>({position:Number(r.net_position??r.position),name:String(r.team||r.manufacturer||r.key),number:r.team?'#'+r.key:'',team:'',points:Number(r.total_net_points??r.total_points)})));
}
export function parseEndurance(document,season,team){
 if(document.next_page||document.pages.some(p=>p.truncated)||!document.pages[0]?.text.replace(/\s+/g,'').includes(String(season).replace(/\s+/g,'')))throw Error('포인트 PDF 전체 시즌 확인 실패');
 const rows=[];
 for(const page of document.pages){
  const header=page.rows.find(r=>r.cells.some(c=>/^Pos\.?$/.test(c.text))&&r.cells.some(c=>/^Points?$/.test(c.text)));if(!header)throw Error('포인트 머리글 없음');
  const px=header.cells.find(c=>/^Points?$/.test(c.text)).x,rx=header.cells.find(c=>c.text==='Pole')?.x,nat=header.cells.find(c=>c.text==='NAT'||c.text==='Nat')?.x;
  if(!Number.isFinite(rx))throw Error('누적 포인트 구분 실패');
  for(const r of page.rows){if(r.y>=header.y||!/^\d+$/.test(r.cells[0]?.text)||r.cells[0].x>header.cells[0].x+15)continue;
   const pts=r.cells.filter(c=>c.x>=px-3&&c.x<rx-8);if(pts.length!==1||!/^\d+(?:\.\d+)?$/.test(pts[0].text))throw Error('포인트 열 불일치');
   let left=r.cells.slice(1).filter(c=>c.x<px-3);let number='';if(team){number='#'+left.shift()?.text;if(nat)left=left.filter(c=>c.x<nat-3);else left=left.slice(0,-1);}
   rows.push({position:Number(r.cells[0].text),name:left.map(c=>c.text).join(' '),number,team:'',points:Number(pts[0].text)});
  }
 }return checkRows(rows);
}
export function parseNls(document,year){
 if(document.next_page||document.pages.some(p=>p.truncated)||!document.pages[0]?.text.includes(String(year)))throw Error('NLS 전체 PDF 확인 실패');
 const rows=[];let position=0,group='';
 for(const page of document.pages){let header=null;
  for(const r of page.rows){
   const text=r.cells.map(c=>c.text).join(' ');
   if(/^Klasse [^ ]+(?: -|$)/.test(text)){if(group!==text)position=0;group=text;}
   if(r.cells.some(c=>c.text==='Pkte.')){header=r;continue;}if(!header||r.y>=header.y)continue;
   const px=header.cells.find(c=>c.text==='Pkte.').x,nx=header.cells[1].x,pts=r.cells.find(c=>Math.abs(c.x-px)<5&&/^\d+,\d+$/.test(c.text));
   if(!pts){if(/^#\d/.test(text)&&rows.length)rows.at(-1).number=text;continue;}
   const rank=r.cells.find(c=>Math.abs(c.x-header.cells[0].x)<5&&/^\d+$/.test(c.text));if(rank)position=Number(rank.text);
   const name=r.cells.filter(c=>c.x>=nx-3&&c.x<px-8).map(c=>c.text).join(' ');if(!name)throw Error('NLS 이름 열 누락');
   rows.push({position,name,points:Number(pts.text.replace(',','.')),number:'',team:group});
  }
 }return checkRows(rows);
}
const NLS='https://www.nuerburgring-langstrecken-serie.de/language/en/point-standings/';
const nlsLabels={'gesamtwertung':'종합 · 드라이버','junior-trophaee':'주니어','nls-speed-trophaee':'스피드 트로피','produktionswagen-trophaee':'프로덕션카','klassensieger-trophaee':'클래스별 드라이버','ladies-trophaee':'여성 드라이버','gentleman-trophaee':'젠틀맨','goodyear-award':'Goodyear Award','kw-team-trophaee':'클래스별 팀 · KW'};
export async function newSeriesStandings(series,requested,year,env){
 if(series==='formula-e'){
  // Cross-year championship: use the latest season with published results, not a fabricated calendar-year table.
  const found=await memo('fe-'+year,async()=>{for(const end of [year+1,year]){try{const source=await officialSource('https://www.fia.com/events/abb-fia-formula-e-world-championship/season-'+(end-1)+'-'+end+'/standings',env),html=textOf(source);if(!html.includes((end-1)+'-'+end))continue;const categories=parseFormulaE(html);if(categories.some(c=>c.rows.some(r=>r.points>0)))return {source,categories,season:(end-1)+'-'+end};}catch{}}throw Error('Formula E 공식 순위 미확인');});
  return {series,season:found.season,event:'공식 공개 순위',provider:'FIA · Formula E',source:found.source.url,retrieved_at:found.source.retrieved_at,categories:found.categories,classification:'PUBLISHED'};
 }
 const listing=await memo('listing-'+series+'-'+year,async()=>{
  if(series==='nls'){
   const page=await officialSource(NLS,env),files=links(textOf(page),page.url).filter(f=>f.url.includes('/'+year+'/')&&/\.pdf$/i.test(f.url));
   const categories=Object.entries(nlsLabels).flatMap(([id,label])=>{const f=files.find(f=>new URL(f.url).pathname.split('/').at(-1).startsWith(id+'-'+year));return f?[{id,label,...f}]:[];});
   if(categories.length!==9)throw Error('NLS 9개 부문 확인 실패');return {season:year,event:'NLS 공식 발표',categories};
  }
  const index=await officialArchive(series,undefined,undefined,env),seasons=index.seasons.filter(s=>series==='alms'?Number(s.name.slice(0,4))<=year:Number(s.name)===year).sort((a,b)=>b.name.localeCompare(a.name));
  for(const season of seasons.slice(0,2)){
   const page=await officialArchive(series,season.id,undefined,env);let files=page.files,event=page.events.at(-1)?.name||page.events.at(-1);
   if(series==='imsa'){
    const events=[...page.events].sort((a,b)=>Number(b.id.split('_')[0])-Number(a.id.split('_')[0]));
    for(const e of events.slice(0,8)){const p=await officialArchive(series,season.id,e.id,env);const points=p.files.filter(f=>/IMSA WeatherTech SportsCar Championship\/POINTS DATA - Official\//i.test(decodeURIComponent(f.url))&&/\.json$/i.test(f.url)&&!(/IMEC/i.test(f.title)&&!/Overall/i.test(f.title)));
     if(points.length){return {season:season.name,event:e.name,categories:points.sort((a,b)=>Number(!/IWSC/.test(a.title))-Number(!/IWSC/.test(b.title))||a.title.localeCompare(b.title)).map(f=>{const title=decodeURIComponent(new URL(f.url).pathname).split('/').at(-1).replace(/\.json$/i,'');return {...f,id:slug(title),label:series==='imsa'?imsaCategoryLabel(title):label(title)};})};}}
    throw Error('IMSA 시즌 누적 순위 문서 미확인');
   }
   const points=files.filter(f=>/champio/i.test(f.folders.join(' '))&&f.format==='pdf');if(!points.length)continue;
   const round=f=>Number(decodeURIComponent(f.url).match(/\/(?:Results|results)\/[^/]+\/(\d+)_/i)?.[1]);const latest=Math.max(...points.map(round));
   const chosen=new Map();for(const f of points.filter(f=>round(f)===latest)){
    const title=decodeURIComponent(f.url).split('/').at(-1),m=series==='lemanscup'?title.match(/^(.+?)_20\d{2}_Round_\d+_.+?_(Drivers|Teams)_Classification/i):title.match(/(?:ELMS|ALMS)_(.+?)_(?:CHAMPIONSHIP|TROPHY)_/i);if(!m)continue;
    const part=(series==='lemanscup'?m[1]+'_'+m[2]:m[1]).replace(/_DRIVER$/,'_DRIVERS'),id=slug(part),old=chosen.get(id);if(!old||/FINAL|RACE_2/i.test(title))chosen.set(id,{...f,id,label:label(part)});
   }
   if(chosen.size)return {season:season.name,event:[...chosen.values()][0].folders[0],categories:[...chosen.values()]};
  }throw Error('공식 챔피언십 문서가 아직 없습니다.');
 });
 const selected=listing.categories.find(c=>c.id===requested)||(!requested||requested==='default'?listing.categories[0]:null);if(!selected)throw Error('해당 부문을 찾을 수 없습니다.');
 const result=await memo('points-'+selected.url,async()=>{
  const source=await officialSource(selected.url,env);if(series==='imsa'){const data=JSON.parse(textOf(source));return {rows:parseImsa(data,year,selected.id),classification:'PUBLISHED',retrieved_at:source.retrieved_at};}
  const document=await readPublishedDocument({url:selected.url,start_page:1,page_count:100},source),text=document.pages.map(p=>p.text).join('\n');
  return {rows:series==='nls'?parseNls(document,year):parseEndurance(document,listing.season,selected.id.endsWith('teams')),classification:/Vorläufig|PROVISIONAL/i.test(text)?'PROVISIONAL':/\bFINAL\b/.test(text)?'FINAL':'PUBLISHED',retrieved_at:source.retrieved_at};
 });
 return {series,season:listing.season,event:listing.event,provider:series==='nls'?'NLS 공식 기록':'Al Kamel',source:selected.url,retrieved_at:result.retrieved_at,classification:result.classification,categories:listing.categories.map(c=>({id:c.id,label:c.label,...(c.id===selected.id?{rows:result.rows}:{})})),selected_category:selected.id};
}
