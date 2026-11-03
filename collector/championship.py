"""Current championship totals fetched through FastF1's Jolpica interface."""
import json
import math
import sys
from datetime import datetime, timezone


def normalize(response, kind, year):
    if len(response) != 1 or int(response[0]['season']) != year:
        raise ValueError('Unexpected FastF1 season')
    standing = response[0]
    key = 'DriverStandings' if kind == 'drivers' else 'ConstructorStandings'
    rows = []
    for item in standing[key]:
        driver = item.get('Driver', {})
        name = (' '.join([driver['givenName'], driver['familyName']]) if kind == 'drivers'
                else item['Constructor']['name'])
        points = float(item['points'])
        position = int(item['position'])
        if position < 1 or not name or not math.isfinite(points) or points < 0:
            raise ValueError('Invalid FastF1 standing')
        rows.append({'position': position, 'name': name, 'points': points,
                     'team': ', '.join(c['name'] for c in item.get('Constructors', [])),
                     'number': driver.get('permanentNumber', '')})
    if not rows or len(rows) >= 100:
        raise ValueError('Missing or incomplete FastF1 standings')
    return {'series': 'f1', 'season': year, 'round': int(standing['round']),
            'provider': 'FastF1 · Jolpica',
            'source': f'https://api.jolpi.ca/ergast/f1/{year}/last/{"driverStandings" if kind == "drivers" else "constructorStandings"}/',
            'retrieved_at': datetime.now(timezone.utc).isoformat(),
            'categories': [{'id': kind, 'label': '드라이버' if kind == 'drivers' else '컨스트럭터', 'rows': rows}]}


def retrieve(kind, year):
    from fastf1 import Cache
    from fastf1.ergast import Ergast
    if kind not in ('drivers', 'constructors') or year != datetime.now(timezone.utc).year:
        raise ValueError('Only current championship standings are supported')
    # This runs in a separate process: temporary cache settings cannot affect live collection.
    with Cache.disabled():
        client = Ergast(result_type='raw', auto_cast=False)
        method = client.get_driver_standings if kind == 'drivers' else client.get_constructor_standings
        for attempt in range(2):
            try:
                return normalize(method(season=year, round='last', limit=100), kind, year)
            except Exception:
                if attempt:
                    raise


if __name__ == '__main__':
    print(json.dumps(retrieve(sys.argv[1], int(sys.argv[2])), ensure_ascii=False))
