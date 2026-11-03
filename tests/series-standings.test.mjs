import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEndurance,parseNls,parseImsa,parseFormulaE} from '../worker/series_standings.js';
import {officialUrl} from '../worker/official.js';
test('official sources reject foreign URLs, credentials and private paths',()=>{
 for(const url of ['http://elms.alkamelsystems.com/','https://evil.test/a.pdf','https://user@elms.alkamelsystems.com/','https://files.alkamelcloud.com/private/a.pdf','https://elms.alkamelsystems.com/Results/%5cprivate.pdf','https://www.nuerburgring-langstrecken-serie.de/wp-admin/'])assert.throws(()=>officialUrl(url));
 assert.equal(officialUrl('https://elms.alkamelsystems.com/Results/a.pdf'),'https://elms.alkamelsystems.com/Results/a.pdf');
});
const cells=(...items)=>items.map(([text,x])=>({text,x}));
test('endurance points use total, preserve ties and normalize cross-year title whitespace',()=>{
 const d={pages:[{text:'2025 -2026',rows:[{y:100,cells:cells(['Pos',10],['Driver',30],['Point',100],['Pole',140])},{y:90,cells:cells(['1',10],['One',30],['109',105],['1',140],['25',160])},{y:80,cells:cells(['1',10],['Two',30],['109',105],['1',140],['25',160])}]}]};
 assert.deepEqual(parseEndurance(d,'2025-2026',false).map(r=>[r.position,r.points]),[[1,109],[1,109]]);
 assert.throws(()=>parseEndurance({...d,next_page:2},'2025-2026',false));assert.throws(()=>parseEndurance(d,'2026-2027',false));
});
test('NLS tied ranks continue over pages and class ranks stay labelled',()=>{
 const head={y:100,cells:cells(['Pos.',10],['Fahrer',30],['Pkte.',100],['1',140])};
 const d={pages:[{text:'2026',rows:[{y:110,cells:cells(['Klasse A - class A',10])},head,{y:90,cells:cells(['1',10],['One',30],['109,00',100])}]},{text:'2026',rows:[head,{y:90,cells:cells(['Two',30],['109,00',100])}]}]};
 const rows=parseNls(d,2026);assert.equal(rows[1].position,1);assert.equal(rows[1].points,109);assert.equal(rows[1].team,'Klasse A - class A');
});
test('IMSA preserves leading-zero car numbers and uses published net totals',()=>{
 const rows=parseImsa({championship:{year:'2026'},classification:[{position:2,net_position:1,key:'04',team:'Team',total_points:200,total_net_points:190}]},2026);
 assert.deepEqual(rows[0],{position:1,name:'Team',number:'#04',team:'',points:190});
 assert.throws(()=>parseImsa({championship:{year:'2025'},classification:[]},2026));
});
test('FE reads cumulative points instead of race pts and requires all categories',()=>{
 const html=['Drivers','Teams','Manufacturers'].map(c=>`<table><th>2025-2026 FIA Formula E World Championship - ${c}</th><tr class="competitor"><td class="position">1</td><td><div class="name">Test</div></td><td class="pts">25</td><td class="points">100<sup>pts</sup></td></tr></table>`).join('');
 assert.deepEqual(parseFormulaE(html).map(c=>c.rows[0].points),[100,100,100]);assert.throws(()=>parseFormulaE('<table></table>'));
});
