import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOfficialEvents,mergeCalendarEvents} from '../worker/calendar-refresh.js';

// fiaformulae.com/en/calendar JSON-LD, 2026-11-14: one SportsEvent per race, named
// with a round number, so a doubleheader weekend arrives as two records.
const records=[
 {name:'R01 Mexico City E-Prix',startDate:'2027-01-15',endDate:'2027-01-16'},
 {name:'R06 Jeddah E-Prix',startDate:'2027-04-16',endDate:'2027-04-16'},
 {name:'R07 Jeddah E-Prix',startDate:'2027-04-17',endDate:'2027-04-17'},
];
const base=[
 {id:'formula-e-2027-01-16-mexico-fe',series:'formula-e',name:'멕시코시티 E-Prix',nameEn:'Mexico City E-Prix',circuit:'mexico-fe',start:'2027-01-16',end:'2027-01-16',sessions:[]},
 {id:'formula-e-2027-04-16-jeddah-fe',series:'formula-e',name:'제다 E-Prix',nameEn:'Jeddah E-Prix',circuit:'jeddah-fe',start:'2027-04-16',end:'2027-04-17',sessions:[]},
];
const url='https://www.fiaformulae.com/en/calendar',now=Date.parse('2026-11-14T00:00:00Z');

test('round-numbered official races fold into the checked-in weekend, no duplicate cards',()=>{
 const merged=mergeCalendarEvents(base,normalizeOfficialEvents(records,'formula-e',url,base,now));
 assert.deepEqual(merged.map(e=>[e.id,e.start,e.end]),[
  ['formula-e-2027-01-16-mexico-fe','2027-01-15','2027-01-16'],
  ['formula-e-2027-04-16-jeddah-fe','2027-04-16','2027-04-17'],
 ]);
 assert.equal(merged[1].nameEn,'Jeddah E-Prix');
});

test('a same-named event from another season is not matched by name alone',()=>{
 const old=[{id:'formula-e-2026-02-13-jeddah-fe',series:'formula-e',name:'제다 E-Prix',nameEn:'Jeddah E-Prix',start:'2026-02-13',end:'2026-02-14',sessions:[]}];
 const [event]=normalizeOfficialEvents([records[1],records[2]],'formula-e',url,old,now);
 assert.notEqual(event.id,old[0].id);
 assert.equal(event.start+'..'+event.end,'2027-04-16..2027-04-17');
});
