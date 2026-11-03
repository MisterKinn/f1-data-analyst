import {trackMaps} from './track-map-data.js';
import {mexicoSectorMap} from './mexico-sector-map.js';
// FIA Doc 7 p2 (version 1, 22 Oct 2026). Activation markers on the existing
// CC0 outline. Placement is schematic, not surveyed coordinates or telemetry.
const svg=atob(mexicoSectorMap.split(',')[1]);
const path=svg.match(/<path[^>]+\/>/s)[0],d=path.match(/d="([^"]+)"/)[1];
const points=[...d.matchAll(/([\d.]+),([\d.]+)/g)].map(m=>[+m[1],+m[2]]);
const cumulative=[0];for(let i=1;i<=points.length;i++){const a=points[i-1],b=points[i%points.length];cumulative.push(cumulative.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
const total=cumulative.at(-1),rad=-9*Math.PI/180;
function pointAt(distance){distance=(distance+total)%total;let i=cumulative.findIndex(x=>x>distance)-1;if(i<0)i=0;const a=points[i],b=points[(i+1)%points.length],r=(distance-cumulative[i])/(cumulative[i+1]-cumulative[i]);const x=a[0]+(b[0]-a[0])*r,y=a[1]+(b[1]-a[1])*r;return [x*Math.cos(rad)-y*Math.sin(rad),x*Math.sin(rad)+y*Math.cos(rad)];}
const markers=[
 ['SM A1',260,70,150,115,110],['SM A2',69,150,230,430,145],['SM A3',198,70,150,220,230]
];
const parts=[];
function marker(distance,label,color,tx,ty,low=false){const [x,y]=pointAt(distance);parts.push(`<g><title>${label}</title><path d="M${x},${y} L${tx},${ty}" stroke="${color}" stroke-width="1" fill="none"/><${low?'rect':'circle'} ${low?`x="${x-2.5}" y="${y-2.5}" width="5" height="5"`:`cx="${x}" cy="${y}" r="2.8"`} fill="${color}" stroke="#090c0f" stroke-width="1"/><text x="${tx}" y="${ty}" fill="${color}" stroke="#090c0f" stroke-width="2.8" paint-order="stroke" font-family="sans-serif" font-size="10" font-weight="700">${label}</text></g>`);}
for(const [name,index,normal,low,tx,ty] of markers){const base=cumulative[index];marker(base+normal/4304*total,name+' N','#ff7a8b',tx,ty);marker(base+low/4304*total,name+' L','#62caff',tx,ty+14,true);}
marker(cumulative[245],'OT D','#a3f568',105,190);
marker(cumulative[262],'OT A','#a3f568',62,100);
const legend='<g font-family="sans-serif" font-size="8" fill="#cbd5dd"><text x="70" y="323">SM N / L · normal / low grip</text><text x="70" y="335">OT D / A · detection / activation</text></g>';
const combined=svg.replace('</svg>',parts.join('')+legend+'</svg>');
trackMaps.mexico.imageUrl='data:image/svg+xml;base64,'+btoa(combined.replaceAll('·','&#183;'));
trackMaps.mexico.f1Zones.overlay=true;
export const mexicoZonesOverlay=trackMaps.mexico.imageUrl;
