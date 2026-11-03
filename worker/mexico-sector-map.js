import {trackMaps} from './track-map-data.js';
// FIA Document 7 (2026), p2: sector lengths. Overlay is a schematic, not surveyed timing-line geometry.
const map=trackMaps.mexico,svg=atob(map.imageUrl.split(',')[1]);
const path=svg.match(/<path[^>]+\/>/s)[0],d=path.match(/d="([^"]+)"/)[1],transform=path.match(/transform="([^"]+)"/)?.[1]||'';
const segments=[['S1','#ff6b73',0,1.914],['S2','#57c7ff',1.914,1.494],['S3','#ffd166',3.408,.896]];
const colored=svg.slice(0,svg.indexOf('<path'))+segments.map(([label,color,start,length])=>`<path transform="${transform}" d="${d}" fill="none" stroke="${color}" stroke-width="4.5" stroke-linecap="round" pathLength="100" stroke-dasharray="${length/4.304*100} ${100-length/4.304*100}" stroke-dashoffset="${-start/4.304*100}"/>`).join('')+'</svg>';
map.imageUrl='data:image/svg+xml;base64,'+btoa(colored);
export const mexicoSectorMap=map.imageUrl;
