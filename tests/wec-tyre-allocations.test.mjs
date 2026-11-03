import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarEvents} from '../worker/race-calendar-data.js';
import {wecTyreAllocations} from '../worker/wec-tyre-allocations.js';
test('round evidence is distinct from a supplier range and next-season allocation',()=>{
 const monza=calendarEvents.find(e=>e.id==='wec-2026-11-06-monza');
 assert.deepEqual(monza.tyreAllocations[0].compounds,[]);
 assert.equal(monza.tyreAllocations[0].status,'unverified');
 assert.deepEqual(monza.tyreAllocations[1].compounds,['Medium','Wet']);
 const barcelona=calendarEvents.find(e=>e.id==='wec-2026-10-16-barcelona');
 assert.deepEqual(barcelona.tyreAllocations[0].compounds,['Soft','Medium','Wet']);
 assert.ok(wecTyreAllocations({...monza,start:'2027-11-01'}).every(a=>a.status==='unverified'&&a.compounds.length===0));
 assert.equal(wecTyreAllocations({series:'f1'}),null);
});
