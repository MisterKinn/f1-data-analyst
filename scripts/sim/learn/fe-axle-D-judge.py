# Step 35 D judge (docs/prereg/step35-fe-D-axle-mode-2026-11-25.md): paired |e| harm, layout bootstrap 2000 seed 35, one-sided 97.5 % UB.
# Inputs: fe-fit.json from build-fe.mjs with LAPSIM_FE_AXLE unset / v1 / v2, copied to /tmp/D-fit-{base,v1,v2}.json.
import json,random,math,statistics as S
B=json.load(open('/tmp/D-fit-base.json'))['rows']
key=lambda r:(r['layout'],r['season'],r['key'])
out={}
for v in ['v1','v2']:
  C={key(r):r for r in json.load(open(f'/tmp/D-fit-{v}.json'))['rows']}
  pr=[(r['layout'],abs(C[key(r)]['event'])-abs(r['event']),r['event'],C[key(r)]['event']) for r in B if r['key']=='fe-gen3evo']
  lays=sorted(set(p[0] for p in pr)); random.seed(35); bs=[]
  for _ in range(2000):
    pick=[random.choice(lays) for _ in lays]; d=[p[1] for l in pick for p in pr if p[0]==l]; bs.append(S.mean(d))
  bs.sort(); ub=bs[int(0.975*len(bs))-1]
  rms=lambda a: math.sqrt(S.mean(x*x for x in a))
  out[v]=dict(n=len(pr),layouts=len(lays),meanHarmPp=round(S.mean(p[1] for p in pr),3),ub975=round(ub,3),passes=ub<=0.10,
    rmsBase=round(rms([p[2] for p in pr]),2),rmsCand=round(rms([p[3] for p in pr]),2),worse=sum(p[1]>0 for p in pr),
    rows=[(p[0],round(p[2],2),round(p[3],2)) for p in pr])
print(json.dumps(out,indent=1))
