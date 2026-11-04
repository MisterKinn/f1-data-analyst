// Exports public pages from the real worker, with local interactions and no live connections.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../worker/index.js';
import {championships,websiteRoute} from '../worker/website.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const at=process.argv.indexOf('--output');
const output=resolve(at<0?resolve(root,'../../../outputs/preview'):process.argv[at+1]);
const origin='https://preview.invalid';
const paths=['/','/guide','/about','/resources','/account',...championships.map(c=>'/championships/'+c.slug)];
const filename=(path,lang)=>((path==='/'?'index':path.slice(1).replaceAll('/','-'))+(lang==='en'?'.en':'')+'.html');
const routeFiles=Object.fromEntries(paths.map(path=>[path,{ko:filename(path,'ko'),en:filename(path,'en')}]));
const assetCache=new Map();
const get=path=>worker.fetch(new Request(origin+path),{},{});
async function asset(path){
 path=path.split('?')[0];
 if(assetCache.has(path))return assetCache.get(path);
 const response=await get(path);
 if(!response.ok)throw Error('Missing preview asset '+path+': '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 const value='data:'+response.headers.get('content-type')+';base64,'+bytes.toString('base64');
 assetCache.set(path,value);return value;
}
// An offline review shows the explicitly dated source fixture, not runtime freshness.
const calendar=await websiteRoute(new Request(origin+'/api/race-calendar')).json();
const scripts=[];
for(const path of ['/assets/race-features.js','/assets/website.js','/assets/examples.js','/assets/i18n.js']){
 const response=await get(path);if(response.ok)scripts.push({path,source:await response.text()});
}
// Include literal local assets used by dynamically created calendar elements.
for(const source of scripts.map(s=>s.source))for(const match of source.matchAll(/['"](\/assets\/[^'"\s+]+)['"]/g)){
 if(!match[1].endsWith('/'))try{await asset(match[1]);}catch{}
}
await mkdir(output,{recursive:true});
const records=[];
for(const language of ['ko','en'])for(const path of paths){
 const request=new Request(origin+path,{headers:{cookie:'kongboda_lang='+language}});
 const response=await worker.fetch(request,{},{});
 if(!response.ok)throw Error('Preview route failed '+path+': '+response.status);
 let html=await response.text();
 // The server timezone cookie/reload bootstrap is unnecessary in a static export.
 html=html.replace(/<script>(?:(?!<\/script>)[\s\S])*kongboda_tz(?:(?!<\/script>)[\s\S])*<\/script>/,'');
 const inlineScripts=[];
 html=html.replace(/<script\b[^>]*src="(\/assets\/[^"?]+)[^"]*"[^>]*><\/script>/g,(_,url)=>{inlineScripts.push(url);return '';});
 for(const match of [...html.matchAll(/\b(src|href)="(\/assets\/[^"?]+)[^"]*"/g)])html=html.replace(match[0],match[1]+'="'+await asset(match[2])+'"');
 for(const match of [...html.matchAll(/url\(['"]?(\/assets\/[^)'"?]+)[^)]*\)/g)])html=html.replace(match[0],"url('"+await asset(match[1])+"')");
 for(const match of [...html.matchAll(/href="(\/(?!assets\/)[^"]*)"/g)]){
  const raw=match[1].replaceAll('&amp;','&'),url=new URL(raw,origin);
  let target=url.pathname,query=url.search;
  if(target==='/display'){target=url.searchParams.get('path')||path;query='?view='+url.searchParams.get('mode');}
  if(routeFiles[target])html=html.replace(match[0],'href="'+routeFiles[target][language]+query+url.hash+'"');
 }
 const message=language==='en'?'Review preview · Calendar snapshot: '+calendar.checkedAt+' · Sign-in and live data require the production connection':'검토용 프리뷰 · 일정 스냅샷: '+calendar.checkedAt+' · 로그인/실시간 조회는 운영 연결 후 확인';
 const config={language,path,routes:routeFiles,assets:Object.fromEntries(assetCache),calendar,message};
 const bootstrap='('+previewRuntime.toString()+')('+JSON.stringify(config).replaceAll('<','\\u003c')+');';
 const payload=inlineScripts.map(url=>{
  let source=scripts.find(s=>s.path===url)?.source;
  if(source===undefined)throw Error('Unknown preview script '+url);
  source=source.replaceAll('location.href=destination','window.__previewNavigate(destination)').replaceAll("location.href='/championships/'+series.value","window.__previewNavigate('/championships/'+series.value)");
  return '<script>'+source.replaceAll('</script','<\\/script')+'</script>';
 }).join('');
 const banner='<aside class="preview-notice" role="note">'+message+'</aside>';
 const style='<style>.preview-notice{position:relative;padding:10px 18px;background:#153a35;color:#fff;font:13px/1.5 system-ui;text-align:center}.preview-disabled{opacity:.55;cursor:not-allowed!important}[data-preview-only]{font:13px/1.6 system-ui;color:#a8c7bd;margin:12px 0}</style>';
 // CSP ensures accidental unconverted media or API URLs cannot make background requests.
 html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">'+style);
 html=html.replace(/<body([^>]*)>/,'<body$1>'+banner);
 html=html.replace('</body>',()=>'<script>'+bootstrap+'</script>'+payload+'</body>');
 await writeFile(resolve(output,filename(path,language)),html);
 records.push({path,language,file:filename(path,language),bytes:Buffer.byteLength(html)});
}
await writeFile(resolve(output,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),source:'Public worker.fetch, anonymous identity',offlineCalendarSourcesChecked:calendar.checkedAt,liveData:false,authentication:false,pages:records},null,2));
console.log('Exported '+records.length+' self-contained public previews to '+output);

function previewRuntime(config){
 const local=value=>{try{const u=new URL(value,'https://preview.invalid');if(u.origin!=='https://preview.invalid')return null;let path=u.pathname,query=u.search;if(path==='/display'){path=u.searchParams.get('path')||config.path;query='?view='+u.searchParams.get('mode');}return config.routes[path]?config.routes[path][config.language]+query+u.hash:null;}catch{return null;}};
 window.__previewNavigate=value=>{const target=local(value);if(target)location.href=target;};
 window.fetch=async input=>{
  const raw=typeof input==='string'?input:input.url;
  const u=new URL(raw,'https://preview.invalid');
  if(u.origin==='https://preview.invalid'&&u.pathname==='/api/race-calendar')return new Response(JSON.stringify(config.calendar),{headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({error:config.message}),{status:503,headers:{'content-type':'application/json'}});
 };
 const replaceAsset=(el,attribute)=>{const value=el.getAttribute(attribute);if(!value?.startsWith('/assets/'))return;const replacement=config.assets[value.split('?')[0]];if(replacement)el.setAttribute(attribute,replacement);};
 const update=root=>{
  if(root.nodeType!==1)return;
  const elements=[root,...root.querySelectorAll('img,source,a,form,button')];
  for(const el of elements){
   replaceAsset(el,'src');
   if(el.tagName==='A'){
    const href=el.getAttribute('href')||'';
    if(/^\/(?:auth\/|signin-with-chatgpt|signout-with-chatgpt|oauth\/)/.test(href)){el.removeAttribute('href');el.setAttribute('aria-disabled','true');el.classList.add('preview-disabled');el.title=config.message;}
    else if(href.startsWith('/')){const target=local(href);if(target)el.setAttribute('href',target);}
   }
   if(el.tagName==='FORM'){el.addEventListener('submit',event=>event.preventDefault());for(const field of el.querySelectorAll('input,button,textarea,select'))field.disabled=true;}
  }
 };
 update(document.body);
 new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')update(record.target);else for(const node of record.addedNodes)update(node);}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href']});
 document.addEventListener('change',event=>{
  if(event.target.id==='language'){event.preventDefault();event.stopImmediatePropagation();location.href=config.routes[config.path][event.target.value];}
 },true);
 document.addEventListener('click',event=>{
  const link=event.target.closest('a');if(!link)return;
  if(link.matches('[aria-disabled=true]')){event.preventDefault();event.stopImmediatePropagation();return;}
  if(link.hasAttribute('data-display-toggle')){event.preventDefault();event.stopImmediatePropagation();location.href=config.routes[config.path][config.language]+'?view='+(link.dataset.target||'mobile');}
 },true);
 // Unavailable live results remain visibly unavailable; the static calendar retains its checked date.
 queueMicrotask(()=>{for(const el of document.querySelectorAll('#standing-status,[data-result-status]'))el.textContent=config.message;});
}
