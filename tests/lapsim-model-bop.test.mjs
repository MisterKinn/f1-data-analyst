import test from 'node:test';
import assert from 'node:assert/strict';
import {modelBopLookup} from '../scripts/sim/wec-model-bop.mjs';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p));
test('model BoP joins exact event entries and never a manufacturer prefix',()=>{
 const identities={rows:[{year:2025,track:'test',entry:'007',model:'Brand Model A'},{year:2025,track:'test',entry:'7',model:'Brand Model B'}]};
 const a={year:2025,track:'test',model:'BRAND Model A',kg:1030};
 const lookup=modelBopLookup(identities,{rows:[a]});
 assert.deepEqual(lookup(2025,'test','007'),a);
 assert.equal(lookup(2025,'test','7'),null);
 assert.equal(lookup(2026,'test','007'),null);
 assert.equal(lookup(2025,'test',''),null);
 assert.throws(()=>lookup(2025,'other','007'),/Missing exact/);
});
test('all pinned dry Hypercar top-three rows have verified exact-model BoP',()=>{
 const lookup=modelBopLookup(read('scripts/sim/data/wec-model-identities.json'),read('scripts/sim/data/wec-bop-verified-2025.json'));
 const identities=read('scripts/sim/data/wec-model-identities.json');
 const matches=identities.rows.filter(r=>r.year===2025&&r.category==='HYPERCAR'&&r.track!=='austin');
 assert.equal(matches.length,90);
 for(const r of matches)assert.ok(lookup(r.year,r.track,r.entry)?.kg,r.model);
});
