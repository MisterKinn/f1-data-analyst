import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const D = JSON.parse(readFileSync('scripts/sim/data/published-bop-2023-w16.json', 'utf8'));

test('W16 published Hypercar/GTP BoP 2023: 49 WEC + 36 IMSA rows with source and page, IMSA kW never invented', () => {
  assert.equal(D.rows.filter(r => r.series === 'WEC').length, 49); assert.equal(D.rows.filter(r => r.series === 'IMSA').length, 36);
  for (const r of D.rows) { assert.equal(r.season, 2023); assert.match(r.source, /^https:\/\/(www\.fia\.com|www\.imsa\.com|fiawec)/); assert.ok(r.page >= 1); }
  assert.deepEqual(D.rows.find(r => r.track === 'daytona' && r.model === 'Acura ARX-06'), {series: 'IMSA', season: 2023, track: 'daytona', maker: 'Acura', model: 'Acura ARX-06', kg: 1030, kW: 500, MJ: 920,
    source: 'https://www.imsa.com/wp-content/uploads/sites/32/2023/01/24/TB-IWSC-23-17-Rolex-24-BoP-01242023.pdf', page: 2});
});
