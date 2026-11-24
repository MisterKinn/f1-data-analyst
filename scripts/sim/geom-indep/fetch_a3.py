"""Step 3 attempt 3 (claude/gate-independent-geometry-attempt3-prereg-2026-11-23.md): sources for every track with an OSM seed.

Runs in GitHub Actions (.github/workflows/lapsim-geom-a3.yml). For each track: OpenStreetMap raceway ways plus raceway area
polygons (Overpass, ODbL), once for today and once per older layout era of the step-5a registry (Overpass attic date), and the best
open elevation model the workflow can reach for the place. Elevation stays on the runner: build-a3.mjs samples it there and only
derived geometry is committed (physics rules 2.9).
Usage: python fetch_a3.py OUT [track ids comma-separated | all]
"""
import io, json, math, os, sys, time
import numpy as np, requests
sys.path.insert(0, os.path.dirname(__file__))
import fetch as F  # helpers of attempt 1 (gsi, glo30, pack, say)

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
F.OUT = OUT
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
SEEDS = {k: v['seed'] for k, v in json.load(open(os.path.join(ROOT, 'scripts/sim/data/tracks/osm-raceways-all.json')))['tracks'].items()}
ONLY = None if len(sys.argv) < 3 or sys.argv[2] == 'all' else sys.argv[2].split(',')
# Older layout eras (worker/lapsim/track-state-data.js, layoutEras = first year of each new era): OSM as of 1 June of the era's last year
ERAS = json.load(open(os.path.join(OUT, 'eras.json'))) if os.path.exists(os.path.join(OUT, 'eras.json')) else {}
# Best open elevation per country, declared in the pre-registration; everything else falls back to Copernicus GLO-30
JP = {'autopolis', 'fe-tokyo', 'fuji', 'motegi', 'okayama', 'sugo', 'suzuka'}
US = {'austin', 'barber', 'daytona', 'indianapolis', 'laguna-seca', 'las-vegas', 'lime-rock', 'long-beach', 'miami', 'mid-ohio',
      'road-america', 'road-atlanta', 'sebring', 'sonoma', 'vir', 'watkins-glen'}
NL = {'zandvoort'}
ES = {'aragon', 'catalunya', 'fe-valencia', 'jarama-2025', 'jarama', 'jerez', 'madring', 'ricardo-tormo'}
say = F.say
# No open elevation source exists (owner 2026-11-24 12:36, application of the pre-registered "source incomplete" rule, not a new rule):
# the track is source incomplete for its OSM anyway, so B and G3 both keep production geometry. Elevation is not fetched or retried.
NO_DEM = {'baku': 'no GLO-30 tiles for Azerbaijan; source incomplete; production geometry in B and G3'}

def overpass(id_, lat, lon, date=None):
    head = f'[out:json][timeout:120]' + (f'[date:"{date}T00:00:00Z"]' if date else '') + ';'
    q = head + (f'(way["highway"="raceway"](around:3000,{lat},{lon});way["area:highway"="raceway"](around:3000,{lat},{lon});'
                f'way["area"="yes"]["highway"="raceway"](around:3000,{lat},{lon});relation["area:highway"="raceway"](around:3000,{lat},{lon}););out tags geom;')
    t0 = time.time()  # at most 15 min per query, so one slow track cannot use up a job (it is then reported as NO OSM)
    for url in F.OVERPASS + ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter']:
        for k in range(3):
            if time.time() - t0 > 900: say(id_, 'osm gave up after 15 min'); return None
            try:
                r = requests.post(url, data={'data': q}, headers=F.UA, timeout=180)
                if r.status_code == 200:
                    j = r.json(); j['_source'] = {'url': url, 'query': q, 'date': date, 'licence': '© OpenStreetMap contributors, ODbL 1.0'}
                    say(id_, 'osm', date or 'now', len(j.get('elements', [])), 'elements'); return j
                say(id_, 'osm', url, 'HTTP', r.status_code)
            except Exception as e: say(id_, 'osm', url, 'error', e)
            time.sleep(15 * 2 ** k)  # backoff 15, 30, 60 s
    return None

def warp_tif(raw, meta, bb):
    """Any GeoTIFF -> EPSG:4326 grid over the bbox at about its own resolution (so build.mjs needs one sampler)."""
    import rasterio
    from rasterio.warp import reproject, Resampling, calculate_default_transform
    with rasterio.MemoryFile(raw) as m, m.open() as ds:
        if ds.count > 1 or ds.dtypes[0] == 'uint8': say('rejected: picture, not heights'); return None
        t, w, h = calculate_default_transform(ds.crs, 'EPSG:4326', ds.width, ds.height, *ds.bounds)
        a = np.full((h, w), np.nan); src = ds.read(1).astype('float64')
        if ds.nodata is not None: src[src == ds.nodata] = np.nan
        reproject(src, a, src_transform=ds.transform, src_crs=ds.crs, dst_transform=t, dst_crs='EPSG:4326', resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
        a[a < -500] = np.nan
        return {**meta, 'crs': 'EPSG:4326', 'x0': t.c, 'dx': t.a, 'y0': t.f, 'dy': t.e, 'nx': w, 'ny': h, 'validShare': round(float(np.isfinite(a).mean()), 3), 'cm': F.pack(a)}

def usgs(id_, bb, res=3):
    # 3DEP dynamic elevation (best available 1 m lidar … 1/3 arc-second) via the TNM ImageServer, US public domain
    w = int((bb[3] - bb[2]) * 111320 * math.cos(math.radians(bb[0])) / res); h = int((bb[1] - bb[0]) * 111320 / res)
    p = {'bbox': f'{bb[2]},{bb[0]},{bb[3]},{bb[1]}', 'bboxSR': 4326, 'imageSR': 4326, 'size': f'{w},{h}', 'format': 'tiff', 'pixelType': 'F32',
         'interpolation': 'RSP_BilinearInterpolation', 'f': 'image'}
    try:
        r = requests.get('https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage', params=p, headers=F.UA, timeout=300)
        say(id_, 'USGS 3DEP', r.status_code, r.headers.get('content-type'), len(r.content))
        if r.status_code == 200 and 'tif' in r.headers.get('content-type', ''):
            return warp_tif(r.content, {'source': 'USGS 3DEP dynamic elevation (best available: 1 m lidar where flown, else 1/3 arc-second)', 'gridM': res,
                                        'url': 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer', 'licence': 'US public domain (USGS)'}, bb)
    except Exception as e: say(id_, 'USGS error', e)
    return None

def wcs(id_, name, url, params, meta, bb):
    try:
        r = requests.get(url, params=params, headers=F.UA, timeout=300)
        ct = r.headers.get('content-type', ''); say(id_, name, r.status_code, ct, len(r.content), r.text[:160] if 'xml' in ct or 'html' in ct else '')
        if r.status_code == 200 and 'tif' in ct: return warp_tif(r.content, meta, bb)
    except Exception as e: say(id_, name, 'error', e)
    return None

def ahn(id_, bb):  # Netherlands AHN4 DTM 0.5 m (PDOK WCS, CC0); asked at 2 m
    from pyproj import Transformer
    t = Transformer.from_crs('EPSG:4326', 'EPSG:28992', always_xy=True); (xa, ya), (xb, yb) = t.transform(bb[2], bb[0]), t.transform(bb[3], bb[1])
    p = [('SERVICE', 'WCS'), ('VERSION', '2.0.1'), ('REQUEST', 'GetCoverage'), ('COVERAGEID', 'dtm_05m'), ('SUBSET', f'x({min(xa,xb)},{max(xa,xb)})'),
         ('SUBSET', f'y({min(ya,yb)},{max(ya,yb)})'), ('FORMAT', 'image/tiff'), ('SCALEFACTOR', '0.25')]
    return wcs(id_, 'AHN', 'https://service.pdok.nl/rws/ahn/wcs/v1_0', p, {'source': 'AHN4 DTM (0.5 m, resampled to 2 m)', 'gridM': 2,
               'url': 'https://service.pdok.nl/rws/ahn/wcs/v1_0', 'licence': 'CC0 (Rijkswaterstaat / PDOK)'}, bb)

def pnoa(id_, bb):  # Spain MDT05 (IGN, CC BY 4.0) via the INSPIRE WCS
    p = [('SERVICE', 'WCS'), ('VERSION', '2.0.1'), ('REQUEST', 'GetCoverage'), ('COVERAGEID', 'Elevacion4258_5'), ('SUBSET', f'Lat({bb[0]},{bb[1]})'),
         ('SUBSET', f'Long({bb[2]},{bb[3]})'), ('FORMAT', 'image/tiff')]
    return wcs(id_, 'PNOA MDT05', 'https://servicios.idee.es/wcs-inspire/mdt', p, {'source': 'IGN MDT05 (5 m)', 'gridM': 5,
               'url': 'https://servicios.idee.es/wcs-inspire/mdt', 'licence': 'CC BY 4.0, © Instituto Geográfico Nacional'}, bb)

def glo30m(id_, bb):  # Copernicus GLO-30 over any bbox (several 1° tiles if needed)
    import rasterio
    from rasterio.merge import merge
    tiles = []
    for la in range(math.floor(bb[0]), math.floor(bb[1]) + 1):
        for lo in range(math.floor(bb[2]), math.floor(bb[3]) + 1):
            t = f'Copernicus_DSM_COG_10_{"N" if la >= 0 else "S"}{abs(la):02d}_00_{"E" if lo >= 0 else "W"}{abs(lo):03d}_00_DEM'
            tiles.append(f'https://copernicus-dem-30m.s3.amazonaws.com/{t}/{t}.tif')
    try:
        ds = []
        for u in tiles:  # a sea tile does not exist (Baku: 404): skip it
            try: ds.append(rasterio.open(u))
            except Exception as e: say(id_, 'GLO-30 tile missing', u.split('/')[-1], str(e)[:60])
        a, tr = merge(ds, bounds=(bb[2], bb[0], bb[3], bb[1])); a = a[0].astype('float64'); a[a < -500] = np.nan
        say(id_, 'GLO-30', len(tiles), 'tile(s)', a.shape)
        return {'crs': 'EPSG:4326', 'x0': tr.c, 'dx': tr.a, 'y0': tr.f, 'dy': tr.e, 'nx': a.shape[1], 'ny': a.shape[0], 'gridM': 30,
                'source': 'Copernicus DEM GLO-30 (DSM, 1 arc-second)', 'url': tiles[0],
                'licence': 'Copernicus DEM licence (free, attribution): © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA',
                'validShare': round(float(np.isfinite(a).mean()), 3), 'cm': F.pack(a)}
    except Exception as e: say(id_, 'GLO-30 error', e); return None

def main():
    r = requests.get('https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson', headers=F.UA, timeout=60)
    open(f'{OUT}/f1-circuits.geojson', 'wb').write(r.content); say('bacinger/f1-circuits (MIT)', r.status_code, len(r.content))
    status = {}  # id -> 'ok' or the reason; a track that is not 'ok' stops the merge (no silent drops)
    def one(item):
        id_, (lat, lon) = item
        if os.path.exists(f'{OUT}/{id_}-done.json'): status[id_] = 'ok'; say(id_, 'cached raw input, not fetched again'); return
        j = overpass(id_, lat, lon)
        if not j: say(id_, 'NO OSM'); status[id_] = 'no OSM after retries'; return
        json.dump(j, open(f'{OUT}/{id_}-osm.json', 'w'))
        for e in ERAS.get(id_, []):
            h = overpass(id_, lat, lon, e['date'])
            if not h: status[id_] = f"no OSM for era {e['date']} after retries"; return
            json.dump(h, open(f"{OUT}/{id_}-osm-{e['date']}.json", 'w'))
        if id_ in NO_DEM:
            say(id_, 'elevation not fetched:', NO_DEM[id_]); json.dump({'id': id_}, open(f'{OUT}/{id_}-done.json', 'w'))
            status[id_] = 'ok, no elevation: ' + NO_DEM[id_]; return
        bb = F.bbox(j, lat, lon)
        dem = (F.gsi(id_, bb) if id_ in JP else usgs(id_, bb) if id_ in US else ahn(id_, bb) if id_ in NL else pnoa(id_, bb) if id_ in ES else None)
        if dem is None or dem.get('validShare', 0) < 0.6: dem = glo30m(id_, bb)
        if not dem: say(id_, 'NO ELEVATION'); status[id_] = 'no elevation after retries'; return
        json.dump(dem, open(f'{OUT}/{id_}-dem.json', 'w'))
        json.dump({'id': id_}, open(f'{OUT}/{id_}-done.json', 'w')); status[id_] = 'ok'
    from concurrent.futures import ThreadPoolExecutor
    todo = [(k, v) for k, v in SEEDS.items() if not ONLY or k in ONLY]
    with ThreadPoolExecutor(2) as ex:  # Overpass allows about two slots per address
        list(ex.map(one, todo))
    # two more passes, one track at a time with a growing pause, for tracks that are not complete
    for wait in (60, 180):
        for k, v in todo:
            if status.get(k) != 'ok': time.sleep(wait); one((k, v))
    json.dump(status, open(f'{OUT}/fetch-status.json', 'w'), indent=1, sort_keys=True)
    json.dump({'log': F.log, 'fetched': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, open(f'{OUT}/fetch-log.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
