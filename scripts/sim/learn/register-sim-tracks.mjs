// Attach simulator tracks that were added after the registry build to their registry layout (one layout per simulator track).
//   node scripts/sim/learn/register-sim-tracks.mjs
// A layout of the same venue within 0.4 % of the track's official length takes the track; otherwise a new layout is added.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
export const ADDED = {'paul-ricard-2021': 'paul-ricard', dubai: 'dubai', 'ricardo-tormo': 'valencia', misano: 'misano', sonoma: 'sonoma', sachsenring: 'sachsenring',
  oschersleben: 'oschersleben', zolder: 'zolder', donington: 'donington', 'oulton-park': 'oulton-park', motegi: 'motegi', buriram: 'buriram', okayama: 'okayama', zhuhai: 'zhuhai',
  vallelunga: 'vallelunga', estoril: 'estoril', jerez: 'jerez', sydney: 'sydney', 'sydney-gardner': 'sydney', inje: 'inje', sebring: 'sebring', aragon: 'aragon', lausitz: 'lausitz',
  autopolis: 'autopolis', mandalika: 'mandalika', 'magny-cours': 'magny-cours', 'phillip-island': 'phillip-island', snetterton: 'snetterton', istanbul: 'istanbul', sochi: 'sochi', 'long-beach': 'long-beach', detroit: 'detroit'};
const REG = 'scripts/sim/data/track-registry.json', reg = JSON.parse(readFileSync(REG, 'utf8')), sim = {...lapsimTracks, ...lapsimExtraTracks};
for (const [id, venue] of Object.entries(ADDED)) { const t = sim[id]; if (!t) continue; const km = +((t.officialLengthM || t.length) / 1000).toFixed(3);
  if (reg.layouts.some(l => l.sim === id)) continue;
  reg.venues[venue] ||= {name: t.name, country: null, aliases: [venue.replace(/-/g, ' ')]};
  const old = reg.layouts.filter(l => l.venue === venue && !l.sim && Math.abs(l.lengthKm / km - 1) < 0.004).sort((a, b) => Math.abs(a.lengthKm - km) - Math.abs(b.lengthKm - km))[0];
  if (old) { old.sim = id; old.id = id; old.sources.push('simulator'); for (const l of reg.layouts) if (l.near && l.venue === venue && l.id !== id && Math.abs(l.lengthKm / km - 1) < 0.02) l.near = id; }
  else reg.layouts.push({id, venue, lengthKm: km, seasons: [], sources: ['simulator'], sim: id});
  console.log(id, '->', venue, km, old ? 'existing layout' : 'new layout'); }
writeFileSync(REG, JSON.stringify(reg, null, 1).replace(/\[\n\s+(\d+),\n\s+(\d+)\n\s+\]/g, '[$1, $2]'));
