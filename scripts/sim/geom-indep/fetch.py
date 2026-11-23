"""Step 3 (claude/gate-independent-geometry-prereg-2026-11-23.md): fetch car-independent geometry sources for 4 tracks.

Runs in GitHub Actions (.github/workflows/lapsim-geom-indep.yml); the session workspace cannot reach these hosts.
Writes raw crops to OUT (default probe-out/geom-indep/): <id>-osm.json (Overpass, ODbL) and <id>-dem.json (elevation grid,
centimetres, int32 little-endian base64, row 0 = north) with source, URL, licence and grid size. Raw files go to the probe branch,
never to main (physics rules 2.9); only derived geometry is committed.
"""
import base64, io, json, math, os, sys, time
import numpy as np, requests

OUT = sys.argv[1] if len(sys.argv) > 1 else 'probe-out/geom-indep'
os.makedirs(OUT, exist_ok=True)
SEEDS = {'jeddah': (21.6319, 39.1044), 'shanghai': (31.3389, 121.2197), 'imola': (44.338, 11.708), 'suzuka': (34.8431, 136.541)}
UA = {'User-Agent': 'kongboda-lapsim geometry fetch (github.com/MisterKinn/f1-data-analyst)'}
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
log = []

def say(*a):
    m = ' '.join(str(x) for x in a); print(m, flush=True); log.append(m)

def osm(id_, lat, lon):
    q = f'[out:json][timeout:90];way["highway"="raceway"](around:3000,{lat},{lon});out tags geom;'
    for url in OVERPASS:
        for k in range(3):
            try:
                r = requests.post(url, data={'data': q}, headers=UA, timeout=120)
                if r.status_code == 200:
                    j = r.json(); j['_source'] = {'url': url, 'query': q, 'fetched': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                                                   'licence': '© OpenStreetMap contributors, ODbL 1.0'}
                    say(id_, 'osm', url, len(j.get('elements', [])), 'ways'); return j
                say(id_, 'osm', url, 'HTTP', r.status_code)
            except Exception as e: say(id_, 'osm', url, 'error', e)
            time.sleep(10 * (k + 1))
    return None

def bbox(j, lat, lon, pad=400):
    pts = [(p['lat'], p['lon']) for w in (j or {}).get('elements', []) for p in w.get('geometry', [])] or [(lat, lon)]
    la = [p[0] for p in pts]; lo = [p[1] for p in pts]
    dla = pad / 111320; dlo = pad / (111320 * math.cos(math.radians(lat)))
    return min(la) - dla, max(la) + dla, min(lo) - dlo, max(lo) + dlo

def pack(z):  # metres (NaN = no data) -> int32 cm base64
    a = np.where(np.isfinite(z), np.round(z * 100), -2**31).astype('<i4')
    return base64.b64encode(a.tobytes()).decode()

def gsi(id_, bb):
    """GSI elevation tiles (PNG): h = (R*65536 + G*256 + B) * 0.01 m; 2^23 = no data. Web Mercator tiles."""
    from PIL import Image
    for name, z, grid in [('dem5a_png', 15, 5), ('dem5b_png', 15, 5), ('dem10b_png', 14, 10)]:
        def tx(lon): return int((lon + 180) / 360 * 2**z)
        def ty(lat): r = math.radians(lat); return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z)
        x0, x1, y0, y1 = tx(bb[2]), tx(bb[3]), ty(bb[1]), ty(bb[0])
        H = np.full(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.nan); miss = 0
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                u = f'https://cyberjapandata.gsi.go.jp/xyz/{name}/{z}/{x}/{y}.png'
                try: r = requests.get(u, headers=UA, timeout=60)
                except Exception as e: say(id_, name, 'error', e); r = None
                if r is None or r.status_code != 200: miss += 1; continue
                a = np.asarray(Image.open(io.BytesIO(r.content)).convert('RGB')).astype(np.int64)
                v = a[..., 0] * 65536 + a[..., 1] * 256 + a[..., 2]
                h = np.where(v < 2**23, v, v - 2**24) * 0.01; h = np.where(v == 2**23, np.nan, h)
                H[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = h
        share = float(np.isfinite(H).mean())
        say(id_, name, f'z{z}', f'tiles {(x1-x0+1)*(y1-y0+1)} missing {miss}', f'valid {share:.3f}')
        if share > 0.6:
            return {'crs': 'webmercator-xyz', 'z': z, 'x0': x0, 'y0': y0, 'nx': H.shape[1], 'ny': H.shape[0], 'gridM': grid,
                    'source': f'GSI {name} (Geospatial Information Authority of Japan)', 'url': f'https://cyberjapandata.gsi.go.jp/xyz/{name}/{{z}}/{{x}}/{{y}}.png',
                    'licence': 'GSI Content Terms of Use (compatible with CC BY 4.0); credit: 国土地理院 / GSI Japan', 'validShare': round(share, 3), 'cm': pack(H)}
    return None

def tif_grid(raw, meta):
    import rasterio
    with rasterio.MemoryFile(raw) as m, m.open() as ds:
        # the Emilia-Romagna "DTM 5x5" WCS serves a 4-band 8-bit picture (DescribeCoverage: bands 1-4), not heights: reject it
        if ds.count > 1 or ds.dtypes[0] == 'uint8': say('rejected: picture, not heights', ds.count, ds.dtypes[0]); return {'validShare': 0}
        a = ds.read(1).astype('float64'); nd = ds.nodata
        if nd is not None: a[a == nd] = np.nan
        a[a < -500] = np.nan; t = ds.transform
        return {**meta, 'crs': str(ds.crs), 'x0': t.c, 'dx': t.a, 'y0': t.f, 'dy': t.e, 'nx': a.shape[1], 'ny': a.shape[0],
                'validShare': round(float(np.isfinite(a).mean()), 3), 'cm': pack(a)}

def utm32(lat, lon):
    from pyproj import Transformer
    return Transformer.from_crs('EPSG:4326', 'EPSG:32632', always_xy=True).transform(lon, lat)

def emilia(id_, bb):
    base = 'https://servizigis.regione.emilia-romagna.it/wcs/dtm10k_ed2014'
    try:
        cap = requests.get(base, params={'service': 'WCS', 'request': 'GetCapabilities', 'version': '1.0.0'}, headers=UA, timeout=90).text
        import re
        names = re.findall(r'<(?:wcs:)?name>([^<]+)</(?:wcs:)?name>', cap)
        say(id_, 'emilia WCS coverages', names[:10])
    except Exception as e: say(id_, 'emilia caps error', e); return None
    (xa, ya), (xb, yb) = utm32(bb[0], bb[2]), utm32(bb[1], bb[3])
    # the capabilities list the service title first; the coverage itself is named '1' (DTM10K_2014_WGS84_UTM32_RMD_1)
    tries = [(c, f) for c in sorted(set(names), key=lambda n: (not n.isdigit(), n)) for f in ('GeoTIFF', 'image/tiff', 'TIFF')]
    for cov, fmt in tries:
        p = {'service': 'WCS', 'version': '1.0.0', 'request': 'GetCoverage', 'coverage': cov, 'CRS': 'EPSG:32632', 'RESPONSE_CRS': 'EPSG:32632',
             'BBOX': f'{min(xa,xb)},{min(ya,yb)},{max(xa,xb)},{max(ya,yb)}', 'RESX': 5, 'RESY': 5, 'FORMAT': fmt}
        try:
            r = requests.get(base, params=p, headers=UA, timeout=180)
            ct = r.headers.get('content-type', '')
            say(id_, 'emilia', cov, fmt, r.status_code, ct, len(r.content), r.text[:200] if 'xml' in ct or 'html' in ct else '')
            if r.status_code == 200 and 'xml' not in ct and len(r.content) > 10000:
                g = tif_grid(r.content, {'source': f'Regione Emilia-Romagna DTM 5x5 ed. 2014 (WCS coverage {cov})', 'url': base, 'gridM': 5,
                                          'licence': 'CC BY 4.0, © Regione Emilia-Romagna'})
                if g['validShare'] > 0.6: return g
                say(id_, 'emilia low valid share', g['validShare'])
        except Exception as e: say(id_, 'emilia', cov, 'error', e)
    return None

def glo30(id_, bb):
    import rasterio
    from rasterio.windows import from_bounds
    la, lo = math.floor(bb[0]), math.floor(bb[2])
    if math.floor(bb[1]) != la or math.floor(bb[3]) != lo: say(id_, 'GLO-30 bbox crosses a 1° tile (not handled)')
    tile = f'Copernicus_DSM_COG_10_{"N" if la >= 0 else "S"}{abs(la):02d}_00_{"E" if lo >= 0 else "W"}{abs(lo):03d}_00_DEM'
    url = f'https://copernicus-dem-30m.s3.amazonaws.com/{tile}/{tile}.tif'
    try:
        with rasterio.open(url) as ds:
            w = from_bounds(bb[2], bb[0], bb[3], bb[1], ds.transform); a = ds.read(1, window=w).astype('float64'); t = ds.window_transform(w)
            a[a < -500] = np.nan
            say(id_, 'GLO-30', tile, a.shape)
            return {'crs': 'EPSG:4326', 'x0': t.c, 'dx': t.a, 'y0': t.f, 'dy': t.e, 'nx': a.shape[1], 'ny': a.shape[0], 'gridM': 30,
                    'source': 'Copernicus DEM GLO-30 (DSM, 1 arc-second)', 'url': url,
                    'licence': 'Copernicus DEM licence (free, attribution): © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA',
                    'validShare': round(float(np.isfinite(a).mean()), 3), 'cm': pack(a)}
    except Exception as e: say(id_, 'GLO-30 error', e); return None

r = requests.get('https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson', headers=UA, timeout=60)
open(f'{OUT}/f1-circuits.geojson', 'wb').write(r.content); say('bacinger/f1-circuits (MIT)', r.status_code, len(r.content))
for name in ('Shanghai', 'Suzuka'):  # attempt 2: TUM racetrack-database widths (LGPL-3.0)
    r = requests.get(f'https://raw.githubusercontent.com/TUMFTM/racetrack-database/master/tracks/{name}.csv', headers=UA, timeout=60)
    open(f'{OUT}/tum-{name}.csv', 'wb').write(r.content); say('TUM racetrack-database', name, r.status_code, len(r.content))
for id_, (lat, lon) in SEEDS.items():
    j = osm(id_, lat, lon)
    if j: json.dump(j, open(f'{OUT}/{id_}-osm.json', 'w'))
    bb = bbox(j, lat, lon)
    dem = gsi(id_, bb) if id_ == 'suzuka' else emilia(id_, bb) if id_ == 'imola' else None
    if dem is None: dem = glo30(id_, bb)
    if id_ in ('suzuka', 'imola'):  # always keep the 30 m model too, for the cross-check
        g = glo30(id_, bb)
        if g: json.dump(g, open(f'{OUT}/{id_}-dem30.json', 'w'))
    if dem: json.dump(dem, open(f'{OUT}/{id_}-dem.json', 'w'))
    else: say(id_, 'NO ELEVATION')
json.dump({'log': log, 'fetched': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, open(f'{OUT}/fetch-log.json', 'w'), indent=1)
