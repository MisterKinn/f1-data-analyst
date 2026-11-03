// Dumps worker/session-schedule.js to schedule.json so the Python bot shares one schedule source.
// Usage: node discord-bot/export_schedule.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sessionSchedule } from '../worker/session-schedule.js';

const out = fileURLToPath(new URL('./schedule.json', import.meta.url));
writeFileSync(out, JSON.stringify(sessionSchedule, null, 1) + '\n');
console.log(`wrote ${Object.keys(sessionSchedule).length} events to ${out}`);
