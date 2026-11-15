// Formula E circuit maps of seasons 5-8 (Gen2 layouts with no map yet: Hong Kong, Paris, Santiago, Seoul, New York, Puebla,
// Marrakesh, Bern, older London / Monaco / Rome / Valencia). Runs fetch-fe-maps.mjs from season 5 in Actions and keeps the
// seasons 9-12 maps already in fe-maps.json when the new run found fewer of them (a failed listing never removes a map).
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
const F = 'scripts/sim/data/learn/fe-maps.json', old = JSON.parse(readFileSync(F, 'utf8')), num = e => +(e.season.match(/Season (\d+)/) || [])[1];
execFileSync('node', ['scripts/sim/learn/fetch-fe-maps.mjs'], {env: {...process.env, FE_MAPS_FROM_SEASON: '5'}, stdio: 'inherit'});
const now = JSON.parse(readFileSync(F, 'utf8')), n9 = a => a.filter(e => num(e) >= 9).length;
const events = [...now.events.filter(e => num(e) < 9), ...(n9(now.events) >= n9(old.events) ? now.events : old.events).filter(e => num(e) >= 9)];
writeFileSync(F, JSON.stringify({...now, events}));
console.log('maps by season', JSON.stringify(events.reduce((o, e) => (o[e.season] = (o[e.season] || 0) + 1, o), {})));
