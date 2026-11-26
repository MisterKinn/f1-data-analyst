# Step 35 (central 19:00, optional): Attack Mode per FE race, Seasons 9-12, from the parsed event notes / bulletins
# (fe-event-notes-r<run>.json, fork release fe-inputs-event-notes). Rule: per round, the latest document that states Attack Mode
# (bulletin after event note); a double-header note (e.g. "R16R17") also covers the second round when that round has no own document.
#   python3 -I scripts/sim/learn/fe-attack-mode-table.py <fe-event-notes.json> <out.json>
import json, re, sys
src, outp = sys.argv[1], sys.argv[2]
d = json.load(open(src)); rows = d['rows']
rnd = lambda ev: int(re.match(r'R(\d+)', ev).group(1))
season = lambda s: int(re.search(r'Season (\d+)', s).group(1))
events = {}
for r in rows: events.setdefault((season(r['season']), rnd(r['event'])), {'event': r['event'], 'docs': []})['docs'] += [r] if r.get('note') and r.get('amTimeS') else []
def covers(title, n, same_venue):  # rounds named in a note title (R16R17, R08&R09, R15-R16); a note naming no round covers a same-venue next round
    m = re.search(r'-R(\d+)\s*(?:&|-)?\s*R?(\d+)?|R(\d+)\s*(?:&|-|R)\s*R?(\d+)', title)
    if m: return n in [int(x) for x in m.groups() if x]
    return same_venue and not re.search(r'R\d+', title)
bnum = lambda x: int(re.search(r'Bulletin\s*No\.?\s*(\d+)', x['note'], re.I).group(1)) if x['kind'] == 'bulletin' and re.search(r'Bulletin\s*No\.?\s*(\d+)', x['note'], re.I) else None
def bulletins(docs):  # latest version (AMENDED wins) of each numbered bulletin, by number
    b = {}
    for x in docs:
        k = bnum(x)
        if k is not None and (k not in b or 'AMENDED' in x['note'].upper()): b[k] = x
    return [b[k] for k in sorted(b)]
def label(n, pick, docs, via):
    naming = {x['amTimeS'] for x in docs if x.get('amTimeS') and n in (x.get('roundsNamed') or [])}
    if len(naming) > 1: return 'assumption (double-header split: documents naming this round disagree)'
    if n in (pick.get('roundsNamed') or []): return 'document names this round'
    return 'own folder document' if via == 'own' else 'assumption (double-header split)'
table = []
for (s, n), e in sorted(events.items()):
    docs, via, second = e['docs'], 'own', False
    if not docs:
        pe = events.get((s, n - 1), {}); prev = pe.get('docs', []); venue = lambda ev: re.sub(r'^R\d+\s+', '', ev or '')
        if any(covers(x['note'], n, venue(pe.get('event')) == venue(e['event'])) for x in prev if x['kind'] == 'event note'):
            docs, via, second = prev, 'double-header documents of R%02d' % (n - 1), True
    if not docs: table.append({'season': s, 'round': n, 'event': e['event'], 'covered': False}); continue
    bl = bulletins(docs)  # race 1 of a double-header: first AM bulletin; race 2: last one (Berlin S10: Bulletin 2 = 6 min, Bulletin 3 = 4 min)
    notes = [x for x in docs if x['kind'] == 'event note']
    pick = (bl[-1] if second else bl[0]) if bl else notes[-1]
    table.append({'season': s, 'year': 2014 + s, 'round': n, 'event': e['event'], 'covered': True, 'via': via, 'amKW': pick['amKW'],
                  'amTimeS': pick['amTimeS'], 'activations': pick['activations'], 'armingsMax': pick['armingsMax'],
                  'doc': pick['note'], 'kind': pick['kind'], 'url': pick['url'], 'roundsNamed': pick.get('roundsNamed'),
                  # label (central 19:20): the double-header split is an assumption unless the chosen document names this round
                  'label': label(n, pick, docs, via),
                  'agreesWithEventNote': all((x['amTimeS'], x['activations']) == (pick['amTimeS'], pick['activations']) for x in docs if x.get('amTimeS'))})
cov = [t for t in table if t['covered']]
out = {'source': d['source'] + ' (parsed facts only)', 'rule': 'latest document stating Attack Mode per round; double-header note covers round n+1',
       'races': len(table), 'covered': len(cov), 'bySeason': {s: [sum(1 for t in table if t['season'] == s and t['covered']), sum(1 for t in table if t['season'] == s)] for s in sorted({t['season'] for t in table})},
       'rows': table}
assert out['races'] > 0
json.dump(out, open(outp, 'w'), indent=1, ensure_ascii=False)
print(out['races'], 'races', out['covered'], 'covered', out['bySeason'])
for t in table: print(t['season'], t['round'], t['event'], t.get('amTimeS'), t.get('activations'), t.get('via'), t.get('agreesWithEventNote'))
