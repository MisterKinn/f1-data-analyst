# W17 clipping detector (kongboda-W17-2026-11-19.zip, scripts/detect.py), unchanged: the speed rule replays all 200,211
# full-throttle runs at 0.000 m. Used by scripts/sim/energy-clip.mjs.
#!/usr/bin/env python3
"""Run: OPENBLAS_NUM_THREADS=1 python scripts/detect.py work/telemetry work/detect --jobs 4
Reads original telemetry. Writes per-event derived CSV files and a source coverage audit.
"""
import argparse
import csv
import json
import math
import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

KEY = ['event','session','driver','team','lap']
STRAIGHT = KEY + ('straight_id i0 i1 start_m end_m length_m lap_length_m duration_s entry_kmh peak_kmh end_kmh '
    'clip_m loss_kmh max_loss_kmh clip_status reason fit_b_per_m fit_points open_left open_right '
    'observed_clip_length_m ke_deficit_per_kg drag_integral_m3_s2 '
    'clip_speed_kmh observed_v2ds fit_a_ms2 power_x power_y power_min_kmh power_max_kmh in_sm_zone').split()
LAP = KEY + ('weather weather_source rainfall air_temp_c track_temp_c humidity_pct pressure_hpa wind_speed_ms '
    'wind_direction_deg compound track_status deleted accurate start_time_s lap_time_s trap_kmh '
    'lap_length_m straight_count clip_count total_clip_m unpriced_clips').split()
AUDIT = KEY + ['status','weather','weather_source','telemetry_present']
MISSING = ('None',None,'nan','NaN','')

def num(val):
    try:
        f = float(val)
        return f if math.isfinite(f) else None
    except (ValueError, TypeError):
        return None

def flag(val):
    if val in (False,0,'False','false','0'): return False
    if val in (True,1,'True','true','1'): return True
    return None

def read(p):
    with open(p, 'rb') as f: return json.load(f)

def runs(mask):
    edges=np.flatnonzero(np.diff(np.r_[False,mask,False].astype(np.int8)))
    return zip(edges[::2],edges[1::2])

def first_persistent(mask, times, persistence):
    for a,b in runs(mask):
        if times[b-1]-times[a]>=persistence-1e-8: return int(a)
    return None

def analyse(t,s,v,left,right):
    # Analysis on a fixed time grid, entry/peak/end and s index come directly from source.
    dur=t[-1]-t[0]
    grid=np.arange(0,dur+1e-8,.2)
    st=np.interp(grid,t-t[0],s)-s[0]
    vv=np.interp(grid,t-t[0],v)/3.6
    # Half-second-scale differentiation reduces noise on interpolated irregular speed samples.
    window=min(4.8,max(1.6,0.32*dur))
    k=int(np.searchsorted(grid,window,side='right'))
    fit_idx=np.arange(0,k-2,2)
    x=(vv[fit_idx]**2+vv[fit_idx+2]**2)/2
    ds=st[fit_idx+2]-st[fit_idx]
    good=ds>.1
    y=(vv[fit_idx+2][good]**2-vv[fit_idx][good]**2)/(2*ds[good])
    x=x[good]
    beta=None
    ref=np.full_like(v,np.nan,dtype=float)
    if len(x)>=3 and np.ptp(vv[:k])>=3 and np.var(x)>0:
        slope=np.sum((x-x.mean())*(y-y.mean()))/np.sum((x-x.mean())**2)
        A=y.mean()-slope*x.mean()
        if slope<0 and A>0:
            beta=-slope
            # Anchor reference at last early-fit point; only extrapolate forward.
            anchor=k-1
            offs=np.maximum(0,s-s[0]-st[anchor])
            ss=vv[anchor]**2
            df= -np.expm1(-2*beta*offs)
            ref=3.6*np.sqrt(np.maximum(0,ss+(A/beta-ss)*df))
            ref[s-s[0]<st[anchor]]=np.nan
    # Use 0.8 s forward windows, require repeated agreement. Plateau can start at entry.
    g=grid[:-4]
    ai=(vv[4:]-vv[:-4])/.8
    plateau=first_persistent((vv[4:]-vv[:-4])*3.6<=0.3,g,.4)
    below=None
    if beta is not None:
        expected=A-beta*((vv[4:]+vv[:-4])/2)**2
        ref_end=np.interp(grid[4:],t-t[0],ref)
        mask=(g>=grid[k-1])&(ai<expected-.65)&((ref_end-3.6*vv[4:])>=2)
        below=first_persistent(mask,g,.4)
    eligible=[(p,r) for p,r in [(plateau,'plateau_or_fall'),(below,'below_fit')] if p is not None]
    onset=reason=cm=loss=maxloss=ke=drag=None
    if eligible:
        gi,reason=min(eligible)
        # Snap forward onto an observed sample for traceability.
        onset=int(np.searchsorted(t,t[0]+grid[gi],side='left'))
        cm=float(s[onset]-s[0])
        if beta is not None and np.isfinite(ref[onset:]).any():
            # For early onset, counterfactual is unidentifiable until fit anchor: leave missing.
            if np.isfinite(ref[onset]):
                delta=(ref[onset:]/3.6)**2-(v[onset:]/3.6)**2
                loss=max(0.,float(ref[-1]-v[-1]))
                maxloss=max(0.,float(np.max(ref[onset:]-v[onset:])))
                ke=float((delta[-1]-delta[0])/2)
                drag=float(np.trapezoid(delta,s[onset:]))
        status='detected'
    else:
        status='no_signature' if beta is not None else 'plateau_only_assessed'
        loss=maxloss=0.
    row=dict(start_m=float(s[0]),end_m=float(s[-1]),length_m=float(s[-1]-s[0]),duration_s=float(dur),
         entry_kmh=float(v[0]),peak_kmh=float(v.max()),end_kmh=float(v[-1]),clip_m=cm,loss_kmh=loss,
         max_loss_kmh=maxloss,clip_status=status,reason=reason,fit_b_per_m=beta,fit_points=len(x),
         open_left=left,open_right=right,observed_clip_length_m=(float(s[-1]-s[0]-cm) if cm is not None else 0.),
         ke_deficit_per_kg=ke,drag_integral_m3_s2=drag,clip_speed_kmh=float(v[onset]) if onset is not None else None,
         observed_v2ds=float(np.trapezoid((v[onset:]/3.6)**2,s[onset:])) if onset is not None else None,
         fit_a_ms2=float(A) if beta is not None else None,in_sm_zone=None)
    row.update(power_x=None,power_y=None,power_min_kmh=None,power_max_kmh=None)
    if status=='no_signature':
        high=[(a,b) for a,b in runs(v>=200) if b-a>2 and t[b-1]-t[a]>=1.]
        if high:
            a,b=max(high,key=lambda ab:t[ab[1]-1]-t[ab[0]])
            elapsed=t[b-1]-t[a]
            vh=v[a:b]/3.6
            row.update(power_x=float(np.trapezoid(vh**2,s[a:b])/elapsed),
                       power_y=float((vh[-1]**2-vh[0]**2)/(2*elapsed)),
                       power_min_kmh=float(v[a:b].min()),power_max_kmh=float(v[a:b].max()))
    return row,dict(s=s,t=t,v=v,ref=ref)

def segments(telemetry_dict):
    d=telemetry_dict.get('tel',telemetry_dict)
    t,s,v,th,br=[np.array(d[k],dtype=float) for k in ('time','distance','speed','throttle','brake')]
    if min(t.shape, default=0)<2 or any(len(a)!=len(t) for a in (s,v,th,br)):
        raise ValueError('invalid_channel_shape')
    if not np.isfinite(s[-1]) or s[-1]<=0: raise ValueError('missing_final_distance')
    full=(th>=98)&(br==0)&np.isfinite(t)&np.isfinite(s)&np.isfinite(v)&(v>0)
    invalid=np.flatnonzero((np.diff(t)<=0)|(np.diff(t)>1.)|(np.diff(s)<=0))
    output=[]
    for a,b in runs(full):
        breaks=invalid[(invalid>=a)&(invalid<b-1)]+1
        for i,j in zip([a,*breaks],[*breaks,b]):
            if j-i<3 or t[j-1]-t[i]<3.:continue
            row,debug=analyse(t[i:j],s[i:j],v[i:j],i==0,j==len(t))
            row.update(i0=int(i),i1=int(j-1),straight_id=len(output)+1,lap_length_m=float(s[-1]))
            output.append((row,debug))
    return output

def per_rows(c):
    # The source normally uses parallel arrays.
    for i in range(len(c.get('lap',[]))):
        yield {k:v[i] for k,v in c.items() if isinstance(v,list) and i<len(v)}

def weather_at(rec,w):
    start=num(rec.get('lST')); end=num(rec.get('sesT'))
    vals=None; source='unknown'
    if w and start is not None and end is not None and end>start:
        times=w['wT']
        a=int(np.searchsorted(times,start,side='right'))-1
        b=int(np.searchsorted(times,end,side='right'))
        # Zero-order hold of most recent observation, bounded staleness and gap.
        if a>=0 and b>a and max(start-times[a],end-times[b-1])<=90 and np.max(np.diff(times[a:b]),initial=0)<=90:
            vals={k:list(v[a:b]) for k,v in w.items()}
            source='session_interval'
    if vals is None:
        ts=num(rec.get('wT'))
        if ts is not None and start is not None and end is not None and start-60<=ts<=end:
            vals={k:[rec.get(k)] for k in ['wR','wAT','wTT','wH','wP','wWS','wWD']}
            source='lap_observation'
    vals=vals or {}
    rain=[flag(x) for x in vals.get('wR',[])]
    raining=True if any(x is True for x in rain) else (False if rain and all(x is False for x in rain) else None)
    compound=str(rec.get('compound','')).upper()
    wet='wet' if raining is True or compound in ('INTERMEDIATE','WET') else ('dry' if raining is False else 'unknown')
    def first(k):
        return num(vals.get(k,[None])[0])
    return dict(weather=wet,weather_source=source,rainfall=raining,air_temp_c=first('wAT'),track_temp_c=first('wTT'),
                humidity_pct=first('wH'),pressure_hpa=first('wP'),wind_speed_ms=first('wWS'),wind_direction_deg=first('wWD'))

def screening(r,session,w):
    if flag(r.get('ff1G')) is True:return 'generated'
    if any(r.get(col) not in MISSING for col in ('pin','pout')):return 'pit_in_out'
    if session in ('Race','Sprint') and num(r['lap'])==1:return 'standing_start'
    if num(r.get('time')) is None:return 'untimed'
    if any(num(r.get(k)) is None for k in ('s1','s2','s3')):return 'incomplete_sectors'
    if w['weather']!='dry':return w['weather']
    return 'eligible'

def writer(path,cols):
    f=path.open('w',newline='')
    csvw=csv.DictWriter(f,fieldnames=cols);csvw.writeheader()
    return f,csvw

def session_dirs(ep):
    return sorted({p.parent.parent for p in ep.rglob('laptimes.json')} |
                  {p.parent for p in ep.rglob('session_laptimes.json')} |
                  {p.parent.parent for p in ep.rglob('*_tel.json')})

def process_event(args):
    ep,out=args
    dest=out/ep.name;dest.mkdir(parents=True,exist_ok=True)
    (dest/'.done').unlink(missing_ok=True)
    targets=[('straights.csv',STRAIGHT),('laps.csv',LAP),('audit.csv',AUDIT)]
    streams=[writer(dest/(n+'.tmp'),c) for n,c in targets]
    sw,lw,aw=[p[1] for p in streams]
    n=0
    for session in session_dirs(ep):
        sn=str(session.relative_to(ep))
        weather=session/'weather.json'
        w=read(weather) if weather.exists() else None
        if w and 'wT' in w:w['wT']=np.asarray(w['wT'],dtype=float)
        keys=set()
        drvfiles=sorted(session.glob('*/laptimes.json'))
        metas={}
        if (session/'session_laptimes.json').is_file():
            for rec in per_rows(read(session/'session_laptimes.json')):
                metas[(rec['drv'],int(rec['lap']))]=rec
        for f in drvfiles:
            for rec in per_rows(read(f)):
                metas[(f.parent.name,int(rec['lap']))]=rec
        for (drv,lap),rec in sorted(metas.items()):
            key=dict(event=ep.name,session=sn,driver=drv,lap=lap,team=rec.get('team'))
            keys.add((drv,lap))
            file=session/drv/f'{lap}_tel.json'
            wr=weather_at(rec,w);status=screening(rec,sn,wr)
            if status=='eligible' and not file.exists():status='missing_tel'
            if status=='eligible':
                try:
                    d=read(file)
                    t=d.get('tel',d)
                    if abs(float(t['time'][-1])-float(rec['time']))>max(2.,.03*float(rec['time'])):
                        raise ValueError('duration_mismatch')
                    rr=segments(d)
                except (ValueError,KeyError,IndexError,TypeError) as e:
                    status='invalid_tel_'+str(e)[:60]
            if status=='eligible':
                rows=[r for r,_ in rr]
                for r in rows: sw.writerow({**key,**r})
                lw.writerow({**key,**wr,'compound':rec.get('compound'),'track_status':rec.get('status'),
                    'deleted':flag(rec.get('del')),'accurate':flag(rec.get('iacc')),'start_time_s':num(rec.get('lST')),
                    'lap_time_s':num(rec.get('time')),'trap_kmh':num(rec.get('vst')),'lap_length_m':float(t['distance'][-1]),
                    'straight_count':len(rows),'clip_count':sum(r['clip_m'] is not None for r in rows),
                    'total_clip_m':sum(r['observed_clip_length_m'] for r in rows),
                    'unpriced_clips':sum(r['clip_m'] is not None and r['ke_deficit_per_kg'] is None for r in rows)})
                n+=1
            aw.writerow({**key,'status':status,'weather':wr['weather'],'weather_source':wr['weather_source'],'telemetry_present':file.exists()})
        for file in sorted(session.glob('*/*_tel.json')):
            drv=file.parent.name;lap=int(file.name.split('_')[0])
            if (drv,lap) not in keys:
                aw.writerow(dict(event=ep.name,session=sn,driver=drv,lap=lap,status='missing_lap_metadata',weather='unknown',telemetry_present=True))
    for f,_ in streams:f.close()
    for name,_ in targets:os.replace(dest/(name+'.tmp'),dest/name)
    (dest/'.done').write_text(str(n)+'\n')
    print(ep.name,n,flush=True)
    return n

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('output',type=Path)
    p.add_argument('--jobs',type=int,default=4);p.add_argument('--events',nargs='*')
    args=p.parse_args()
    # At the pinned SHA the unnumbered test has 3,429 lap IDs duplicating a numbered test.
    if args.events:
        events=sorted(args.source/s for s in args.events)
    else:
        events=sorted(s for s in args.source.iterdir() if s.is_dir() and
                      (s.name.endswith(' Grand Prix') or s.name in ('Pre-Season Testing 1','Pre-Season Testing 2')))
    with ProcessPoolExecutor(args.jobs) as pool:
        list(pool.map(process_event,[(e,args.output) for e in events]))
if __name__=='__main__':main()
