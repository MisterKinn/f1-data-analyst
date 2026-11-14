import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarEvents} from '../worker/race-calendar-data.js';

// Official calendar, fiaformulae.com/en/calendar, checked 2026-11-14.
test('Formula E 2027 dates follow the official calendar (Jeddah, Sanya and Monaco moved)',()=>{
 const dates=Object.fromEntries(calendarEvents.filter(e=>e.series==='formula-e'&&e.start>='2026-11').map(e=>[e.circuit,e.start+'..'+e.end]));
 assert.equal(dates['jeddah-fe'],'2027-04-16..2027-04-17');
 assert.equal(dates.sanya,'2027-04-03..2027-04-03');
 assert.equal(dates['monaco-fe'],'2027-05-01..2027-05-02');
 assert.equal(dates.berlin,'2027-05-08..2027-05-09');
 assert.ok(!calendarEvents.some(e=>e.series==='formula-e'&&e.start.startsWith('2026-12')));
});
