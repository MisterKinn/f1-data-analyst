// Worker thread for joint-bcd.mjs: holds the prepared laps, fits one group's car or one track's factors.
import {parentPort} from 'node:worker_threads';
import {fitGroup, fitTrack, buildCar, lapScore, DEFAULTS} from './joint-bcd.mjs';

let groups = [], o = DEFAULTS;
parentPort.on('message', m => {
  if (m.type === 'init') { groups = m.groups; o = {...DEFAULTS, ...m.o, log: undefined}; return; }
  let result;
  if (m.type === 'group') result = fitGroup(groups.find(g => g.key === m.key), m.factors, m.x0, o, m.adj);
  else if (m.type === 'sims') {
    const g = groups.find(x => x.key === m.key), car = buildCar(g, m.xs[g.key]).car;
    result = g.laps.map(l => m.factors[l.name] ? lapScore(l, car, m.factors[l.name], {wTime: 0, wSector: 0}).res.lapTime : null);
  }
  else if (m.type === 'track') {
    const cars = Object.fromEntries(groups.map(g => [g.key, buildCar(g, m.xs[g.key]).car]));
    result = fitTrack(groups.flatMap(g => g.laps.filter(l => l.name === m.name)), cars, m.prev, o, m.adj);
  }
  parentPort.postMessage({id: m.id, result});
});
