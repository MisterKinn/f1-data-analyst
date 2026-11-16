# A2 corner placement (see docs/lapsim-track-shapes.md). Inputs in /tmp/a2: <id>.json {path, labels [[num,x,y]] | dots}
# exported from the Commons SVG in a browser, mid-<id>.json (our midline), cand-<id>.json (corner-candidates.mjs).
# Official turn numbers from a circuit's official map (Wikimedia SVG): fit the map's track path onto our midline (rotation, mirror,
# scale searched), then each numbered label (or corner dot) -> nearest point of our line -> lap distance; snapped to our own bend
# peak within SNAP_M when one is there. Output: /tmp/a2/out-<id>.json
import json,sys,math,numpy as np
from scipy.spatial import cKDTree
SNAP_M=70
id=sys.argv[1]; d=json.load(open(f'/tmp/a2/{id}.json')); m=json.load(open(f'/tmp/a2/mid-{id}.json')); cand=json.load(open(f'/tmp/a2/cand-{id}.json'))
M=np.array(m['mid']); L=m['len']; n=len(M); tr=cKDTree(M)
P=np.array(d['path'],float); P[:,1]*=-1
labs=d.get('labels') or []; pts=np.array([[x,-y] for _,x,y in labs],float) if labs else np.array([[x,-y] for x,y in d['dots']],float)
names=[s for s,_,_ in labs] if labs else [str(i+1) for i in range(len(pts))]
lenP=np.hypot(*np.diff(P,axis=0).T).sum()
def icp(S, R, t, it=50):
    X=S@R.T+t
    for _ in range(it):
        dd,j=tr.query(X); Y=M[j]; w=dd<np.percentile(dd,90)+1e-9; mx,my=X[w].mean(0),Y[w].mean(0); A=X-mx
        U,sv,Vt=np.linalg.svd(A[w].T@(Y[w]-my)); Rr=Vt.T@U.T
        if np.linalg.det(Rr)<0: Vt[1]*=-1; Rr=Vt.T@U.T
        X=A@Rr.T+my; R=Rr@R; t=Rr@(t-mx)+my
    dd,_=tr.query(X); return np.sqrt((dd**2).mean()), R, t
best=None
for scale in [L/lenP*f for f in (0.5,0.6,0.7,0.8,0.9,1.0,1.1)]:
  for mir in (False,True):
    S=P*scale; S=S-S.mean(0)
    if mir: S=S*np.array([-1,1])
    for deg in range(0,360,15):
        th=math.radians(deg); R=np.array([[math.cos(th),-math.sin(th)],[math.sin(th),math.cos(th)]]); t=M.mean(0).copy()
        r,R2,t2=icp(S,R,t,25)
        if best is None or r<best[0]: best=(r,scale,mir,R2,t2)
r,scale,mir,R,t=best
S=P*scale; c0=S.mean(0); S=S-c0
if mir: S=S*np.array([-1,1])
r,R,t=icp(S,R,t,80)
Q=pts*scale-c0
if mir: Q=Q*np.array([-1,1])
Q=Q@R.T+t
# Each label is a few metres off the track and can sit nearer another part of the circuit, so take for every label the few
# local nearest stretches of our line and pick, over all labels in number order, the set that runs once round the lap (DP).
X=M; cs=cand['candidates']
def opts(q):
    d=np.hypot(*(X-q).T); i=np.arange(n); loc=(d<=np.roll(d,1))&(d<=np.roll(d,-1))
    o=sorted(((d[k],k) for k in i[loc]),key=lambda x:x[0]); o=[x for x in o if x[0]<=o[0][0]+80][:5]; return o
if labs:
    order=sorted(range(len(names)),key=lambda k:(int(''.join(c for c in names[k] if c.isdigit())),names[k]))
    O=[opts(Q[k]) for k in order]; best=None
    for a0 in range(len(O[0])):
        s0=O[0][a0][1]; rel=lambda k:(k-s0)%n
        dp=[{a0:(O[0][a0][0],[a0])}]
        for j in range(1,len(O)):
            cur={}
            for b,(db,kb) in enumerate(O[j]):
                for a,(c,path) in dp[-1].items():
                    if rel(kb)>rel(O[j-1][a][1]) and (b not in cur or c+db<cur[b][0]): cur[b]=(c+db,path+[b])
            dp.append(cur)
            if not cur: break
        if dp[-1] and len(dp)==len(O):
            c,path=min(dp[-1].values(),key=lambda x:x[0])
            if best is None or c<best[0]: best=(c,path)
    sel=[O[j][best[1][j]] for j in range(len(O))] if best else [O[j][0] for j in range(len(O))]
    items=[(names[order[j]],sel[j][1]/n*L,sel[j][0]) for j in range(len(O))]
else:
    dq,jq=tr.query(Q); ss=sorted(jq/n*L); items=[(str(i+1),v,0.0) for i,v in enumerate(ss)]
out=[]; used=set()
for nm,si,g in items:
    near=min(cs,key=lambda c:min(abs(c['s']-si),L-abs(c['s']-si))) if cs else None
    dist=min(abs(near['s']-si),L-abs(near['s']-si)) if near else 1e9
    snap=dist<=SNAP_M and near['s'] not in used
    if snap: used.add(near['s'])
    num=int(''.join(c for c in nm if c.isdigit())); let=''.join(c for c in nm if c.isalpha()).lower()
    out.append({'number':num,'letter':let,'s':int(near['s'] if snap else round(si)),'mapS':int(round(si)),'snap':bool(snap),'labelGapM':round(float(g),1)})
res={'id':id,'fitRmsM':round(float(r),1),'mirror':bool(mir),'scale':round(scale*lenP/L,3),'labels':len(names),'corners':out}
json.dump(res,open(f'/tmp/a2/out-{id}.json','w'))
order_ok=sum(out[i]['mapS']>out[(i+1)%len(out)]['mapS'] for i in range(len(out)))<=1
print(id,'fit',res['fitRmsM'],'m mirror',mir,'scale',res['scale'],'labels',len(names),'lap-order ok',order_ok,'snapped',sum(c['snap'] for c in out),'|',' '.join(f"T{c['number']}{c['letter']}:{c['s']}{'' if c['snap'] else '*'}" for c in out))
