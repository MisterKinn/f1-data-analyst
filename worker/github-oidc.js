// Verifies GitHub Actions OIDC tokens so the F1 collector workflow can push snapshots
// without any shared secret: only this repository's main-branch collector workflow can
// obtain a token with these claims.
export const OIDC_ISSUER='https://token.actions.githubusercontent.com';
export const OIDC_AUDIENCE='kongboda-motorsports';
export const COLLECTOR_REPOSITORY='MisterKinn/f1-data-analyst';
export const COLLECTOR_WORKFLOW=COLLECTOR_REPOSITORY+'/.github/workflows/f1-live-collector.yml@refs/heads/main';
let jwksCache=null;
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const part=s=>JSON.parse(new TextDecoder().decode(b64(s)));
async function jwks(fetcher,now){
 if(jwksCache&&now-jwksCache.at<3600_000)return jwksCache.keys;
 const r=await fetcher(OIDC_ISSUER+'/.well-known/jwks',{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('GitHub signing keys unavailable');
 const keys=(await r.json()).keys||[];jwksCache={at:now,keys};return keys;
}
export function resetOidcCache(){jwksCache=null;}
export const RULES_MONITOR_WORKFLOW=COLLECTOR_REPOSITORY+'/.github/workflows/rules-monitor.yml@refs/heads/main';
export async function verifyCollectorToken(token,{fetcher=fetch,now=Date.now(),workflow=COLLECTOR_WORKFLOW}={}){
 const pieces=String(token||'').split('.');
 if(pieces.length!==3)throw Error('Malformed token');
 const header=part(pieces[0]),claims=part(pieces[1]);
 if(header.alg!=='RS256'||!header.kid)throw Error('Unsupported token');
 const jwk=(await jwks(fetcher,now)).find(k=>k.kid===header.kid&&k.kty==='RSA');
 if(!jwk)throw Error('Unknown signing key');
 const key=await crypto.subtle.importKey('jwk',{kty:'RSA',n:jwk.n,e:jwk.e,alg:'RS256',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1])))throw Error('Bad signature');
 const t=Math.floor(now/1000);
 if(claims.iss!==OIDC_ISSUER||claims.aud!==OIDC_AUDIENCE)throw Error('Wrong issuer or audience');
 if(!(claims.exp>t)||(claims.nbf&&claims.nbf>t+60))throw Error('Expired token');
 if(claims.repository!==COLLECTOR_REPOSITORY||claims.ref!=='refs/heads/main'||claims.workflow_ref!==workflow)throw Error('Token is not from the expected workflow');
 return claims;
}
