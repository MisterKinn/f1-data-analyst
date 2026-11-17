# Offline: reads the owner's local iRacing extract (SRS env var, default ~/srs: sessions.jsonl + channels/*.parquet; personal use,
# never committed). Outputs only derived numbers. Run from the repo root.
# Clean iRacing GPS laps per our track id: Lat/Lon/Alt/LapDistPct/VertAccel at 60 Hz, complete laps on track, no teleports
import os, json, numpy as np, pyarrow.parquet as pq, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from irmap import IR
def laps(id, maxlaps=12, cols=('Lat', 'Lon', 'Alt', 'LapDistPct', 'Speed', 'VertAccel')):
    out = []
    for l in open(os.path.expanduser(os.environ.get('SRS', '~/srs')) + '/sessions.jsonl'):
        d = json.loads(l)
        if IR.get(d.get('track')) != id: continue
        df = pq.read_table(os.path.expanduser(os.environ.get('SRS', '~/srs')) + f"/channels/{d['sid']}.parquet", columns=list(dict.fromkeys(list(cols) + ['Lat', 'Lap', 'OnPitRoad', 'PlayerTrackSurface']))).to_pandas()
        for lap, g in df.groupby('Lap'):
            if len(g) < 1500 or (g.OnPitRoad != 0).any() or (g.Lat.abs() < 1).any() or g.LapDistPct.min() > .005 or g.LapDistPct.max() < .995: continue
            dp = np.diff(g.LapDistPct.values)
            if (np.abs(dp) > .002).sum() > 1: continue           # practice resets jump along the lap
            out.append({k: g[k].values for k in cols} | {'sid': d['sid'], 'off': int((g.PlayerTrackSurface.values == 0).sum())})
            if len(out) >= maxlaps: return out
    return out
