// Timing71 replay description (+ series) → track id. Ids of the 26 simulator tracks match
// worker/lapsim/tracks-data.js; other venues get their own id so the geometry gap list can name them.
const T = [
  // local-language / sponsor event names (checked against dates, docs/lapsim-t71.md)
  ['spielberg', /osterreich|steiermark|styrian/], ['hungaroring', /magyar/], ['interlagos', /brasil/], ['silverstone', /70th anniversary/],
  ['paul-ricard', /grand prix de france/], ['hockenheim', /deutschland/], ['nurburgring-gp', /eifel/], ['sochi', /russian/],
  ['mugello', /toscana/], ['portimao', /portugal/], ['istanbul', /turkish|turkey/],
  ['road-atlanta', /petit le mans/], ['daytona', /roar before/], ['mid-ohio', /acura sports ?car challenge/], ['detroit', /sports car classic/],
  ['mosport', /chevrolet grand prix|mobil 1 sportscar grand prix/], ['lime-rock', /northeast grand prix/],
  ['road-america', /continental tire road|imsa road|sports ?car weekend|motul sportscar (endurance )?grand prix/], ['laguna-seca', /america.s tire 250/],
  // simulator tracks
  ['sakhir', /bahrain|sakhir/], ['jeddah', /jeddah|saudi/], ['imola', /imola|emilia/], ['interlagos', /interlagos|s(ã|a)o paulo|brazil/],
  ['las-vegas', /las vegas/], ['lusail', /lusail|qatar|losail/], ['yas-marina-circuit', /abu dhabi|yas marina/], ['melbourne', /australian|melbourne|albert park/],
  ['shanghai', /chinese|shanghai/], ['suzuka', /japanese|suzuka/], ['miami', /miami/], ['mosport', /mosport|canadian tire|ctmp/], ['montreal', /canad|montr(e|é)al|gilles/],
  ['monte-carlo', /monaco|monte.?carlo/], ['catalunya', /catalunya|barcelona|espana/], ['spielberg', /austria|red bull ring|spielberg/],
  ['silverstone', /silverstone|british/], ['spa-francorchamps', /spa\b|francorchamps|belgi/], ['hungaroring', /hungar/],
  ['zandvoort', /zandvoort|dutch/], ['monza', /monza|italian grand|d.italia/], ['madring', /madring|madrid/], ['baku', /baku|azerbaijan/],
  ['kuala-lumpur', /sepang|malaysia/], ['singapore', /singapore/], ['austin', /circuit of the americas|\bcota\b|united states grand|lone star|austin/],
  ['mexico-city', /mexico|hermanos rodr/],
  // other venues (need geometry)
  ['le-mans', /(?<!petit )le mans(?! cup)|sarthe/], ['fuji', /fuji/], ['portimao', /portim(a|ã)o|algarve/], ['paul-ricard', /paul ricard|castellet|le castellet/],
  ['daytona', /daytona|rolex 24/], ['sebring', /sebring/], ['long-beach', /long beach/], ['laguna-seca', /laguna seca|monterey/],
  ['watkins-glen', /watkins glen|the glen|sahlen/], ['lime-rock', /lime rock/],
  ['road-america', /road america|elkhart/], ['vir', /virginia|\bvir\b/], ['road-atlanta', /road atlanta|petit le mans/],
  ['indianapolis', /indianapolis|\bindy\b|bricks/], ['detroit', /detroit|belle isle/], ['mid-ohio', /mid-?ohio/], ['barber', /barber/],
  ['sonoma', /sonoma|sears point/], ['nola', /nola|new orleans/], ['utah', /utah/], ['st-petersburg', /st\.? ?pete/],
  ['hockenheim', /hockenheim/], ['norisring', /norisring|n(u|ü)rnberg/], ['nordschleife', /24h|nordschleife|\bnls\b|\bvln\b|qualifiers/],
  ['nurburgring-gp', /n(u|ü)rburgring/], ['lausitz', /lausitz|eurospeedway/], ['oschersleben', /oschersleben/], ['sachsenring', /sachsenring/],
  ['zolder', /zolder/], ['assen', /assen/], ['brands-hatch', /brands hatch/], ['donington', /donington/], ['misano', /misano/],
  ['valencia', /valencia|ricardo tormo/], ['magny-cours', /magny/], ['hungaroring', /mogyor/], ['kyalami', /kyalami/],
  ['bathurst', /bathurst|mount panorama/], ['dubai', /dubai/], ['macau', /macau|guia/], ['mugello', /mugello/],
  ['vallelunga', /vallelunga/], ['estoril', /estoril/], ['aragon', /arag(o|ó)n|motorland/], ['jarama', /jarama/],
  ['moscow', /moscow/], ['buriram', /burr?iram|chang/], ['the-bend', /the bend/], ['ningbo', /ningbo/],
  // Formula E street circuits (by city)
  ...['diriyah', 'ad-diriyah', 'tokyo', 'london', 'berlin', 'rome', 'paris', 'new york', 'hong kong', 'sanya', 'santiago', 'marrakesh|marrakech',
    'punta del este', 'swiss|bern', 'cape town', 'hyderabad', 'jakarta', 'seoul', 'portland', 'vancouver', 'puebla', 'zurich', 'sao paulo', 'shanghai', 'misano', 'monaco', 'mexico city', 'tempelhof']
    .map(c => [`fe-${c.split('|')[0].replace(/\s+/g, '-')}`, new RegExp(c)]),
];
// Series whose venues share names with FE cities are matched to the circuit list first.
export function trackOf(series, description) {
  if (/le mans 24/i.test(series)) return 'le-mans';
  if (/macau/i.test(series)) return 'macau';
  const d = `${description}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fe = /formula e/i.test(series);
  for (const [id, re] of T) {
    if (id.startsWith('fe-') !== fe) continue;
    if (re.test(d)) return id;
  }
  if (fe) for (const [id, re] of T) if (!id.startsWith('fe-') && re.test(d)) return id; // e.g. FE at Monaco/Misano circuits
  return null;
}

// Sessions with no venue in the name take the track of a same-series session within ±4 days.
export function mapSessions(sessions) {
  for (const x of sessions) x.track ??= trackOf(x.series, x.description);
  for (const x of sessions) if (!x.track) {
    const near = sessions.filter(y => y.track && y.key === x.key && Math.abs(y.start - x.start) < 4 * 86400)
      .sort((a, b) => Math.abs(a.start - x.start) - Math.abs(b.start - x.start));
    if (near.length) { x.track = near[0].track; x.trackBy = 'nearby session'; }
  }
  return sessions;
}
