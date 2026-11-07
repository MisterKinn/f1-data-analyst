// Worker thread for joint-bcd.mjs: holds the prepared laps, fits one group's car or one track's factors.
import {parentPort} from 'node:worker_threads';
import {fitGroup, fitTrack, buildCar, DEFAULTS} from './joint-bcd.mjs';

let groups = [], o = DEFAULTS;
parentPort.on('message', m => {
  if (m.type === 'init') { groups = m.groups; o = {...DEFAULTS, ...m.o, log: undefined}; return; }
  let result;
  if (m.type === 'group') result = fitGroup(groups.find(g => g.key === m.key), m.factors, m.x0, o);
  else if (m.type === 'track') {
    const cars = Object.fromEntries(groups.map(g => [g.key, buildCar(g, m.xs[g.key]).car]));
    result = fitTrack(groups.flatMap(g => g.laps.filter(l => l.name === m.name)), cars, m.prev, o);
  }
  parentPort.postMessage({id: m.id, result});
});
