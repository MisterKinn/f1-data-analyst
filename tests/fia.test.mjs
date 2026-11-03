import assert from 'node:assert/strict';
import {fiaCall,officialUrl,parseDocuments} from '../worker/fia.js';
const call=async(name,args)=>JSON.parse((await fiaCall(name,args)).content[0].text);
const originalFetch=globalThis.fetch;
const root='https://www.fia.com/documents/championships/fia-formula-one-world-championship-14',season=root+'/season/season-2026-2072';
const row=(title,url='')=>`<li class="document-row"><a href="${url}"><div class="title">${title}</div><div class="published">Published on <span>09.10.26 16:55</span> CET</div></a></li>`;
const docs=row("Doc 26 - Drivers' Meeting",'/system/files/briefing.pdf')+row('Recalled - DOC 15 - New PU Elements')+row("Doc 13 - Race Director's Competition Notes V2",'/system/files/v2.pdf')+row("Doc 6 - Race Director's Competition Notes",'/system/files/v1.pdf');
assert.equal(parseDocuments(docs,root)[1].recalled,true);
for(const url of ['http://www.fia.com/x','https://fia.com.evil.test/x','https://user:password@fia.com/x','https://www.fia.com:444/x','https://127.0.0.1/x'])assert.throws(()=>officialUrl(url));
const makePDF=()=>{
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const stream='BT /F1 12 Tf 40 700 Td (PU usage: Driver 63 = 4) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 let out='%PDF-1.4\n';const offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
 const xref=out.length;out+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return out;
};
globalThis.fetch=async url=>{
 if(url===root)return new Response(`<option value="${season}">SEASON 2026</option>`,{headers:{'content-type':'text/html'}});
 if(url===season)return new Response(`<option value="${season}">Singapore Grand Prix</option>`,{headers:{'content-type':'text/html'}});
 if(url.includes('/event/'))return new Response(docs,{headers:{'content-type':'text/html'}});
 if(url.endsWith('/briefing.pdf'))return new Response(makePDF(),{headers:{'content-type':'application/pdf'}});
 if(url.endsWith('/offsite'))return new Response(null,{status:302,headers:{location:'https://evil.test/pdf'}});
 if(url.endsWith('/big'))return new Response('x',{headers:{'content-length':'12000001'}});
 if(url.endsWith('/denied'))return new Response('denied',{status:403});
 if(url.includes('/regulation/'))return new Response('<a href="/system/files/2027.pdf"><div class="title">FIA 2027 F1 Regulations - Iss 3 - 2026-10-01</div></a><a href="/system/files/2026.pdf"><div class="title">FIA 2026 F1 Regulations - Iss 16 - 2026-02-27</div></a>',{headers:{'content-type':'text/html'}});
 return new Response('<title>ADUO</title><article><p>Official review results.</p><a href="/system/files/aduo.pdf">Report</a></article>',{headers:{'content-type':'text/html'}});
};
try{
 const briefing=await call('fia_list_documents',{year:2026,event:'Singapore Grand Prix',category:'briefing',limit:1});assert.equal(briefing.total_records,3);assert.equal(briefing.next_offset,1);assert.equal(briefing.records[0].document_number,'26');assert.ok(briefing.records[0].published.includes('CET'));
 assert.equal((await call('fia_list_documents',{year:2026,event:'Singapore Grand Prix'})).total_records,3);assert.equal((await call('fia_list_documents',{year:2026,event:'Singapore Grand Prix',include_recalled:true})).total_records,4);
 const rules=await call('fia_list_regulations',{year:2026});assert.equal(rules.records[0].regulation_year,2026);assert.equal(rules.total_records,1);
 const pdf=await call('fia_read_document',{url:'https://www.fia.com/system/files/briefing.pdf',page_count:1});assert.equal(pdf.total_pages,1);assert.match(pdf.pages[0].text,/Driver 63 = 4/);assert.equal(pdf.next_page,null);assert.ok(pdf.pages[0].rows[0].cells[0].x>0);
 await assert.rejects(()=>call('fia_read_document',{url:'https://www.fia.com/system/files/briefing.pdf',start_page:2}),/page count/);
 const html=await call('fia_read_document',{url:'https://api.fia.com/news/aduo'});assert.equal(html.extraction_scope,'article_body');assert.match(html.text,/Official review results/);assert.equal(html.pdf_links.length,1);
 for(const [path,message]of [['offsite',/official FIA/],['big',/12 MB/],['denied',/403/]])await assert.rejects(()=>call('fia_read_document',{url:'https://www.fia.com/'+path}),message);
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: FIA archive, briefing/recall/version filtering, regulation year, PDF text/pages, HTML, pagination, size limits and redirect allowlist.');
