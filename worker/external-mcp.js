// Credentials are account-scoped and never accept caller-supplied identity headers.
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const key=h=>'website-accounts/mcp-token/'+h+'.json';
const read=async(env,k)=>{const o=await env.BUCKET.get(k);return o?o.json():null;};
export const EXTERNAL_MCP_UNAVAILABLE='외부 MCP 연결은 OAuth 2.1 기반 계정 인증이 준비될 때까지 사용할 수 없습니다.';
export async function issueMcpToken(){throw Error(EXTERNAL_MCP_UNAVAILABLE);}
export async function revokeMcpToken(env,account){
 const fresh=await read(env,'website-accounts/account/'+account.id+'.json');
 if(!fresh||fresh.deleted)return;
 if(fresh.mcpTokenHash)await env.BUCKET.delete(key(fresh.mcpTokenHash));
 const {mcpTokenHash,...rest}=fresh;await env.BUCKET.put('website-accounts/account/'+account.id+'.json',JSON.stringify(rest));
}
// Legacy bearer credentials deliberately fail closed. They cannot distinguish a
// supported connector session from a copied development token.
export async function externalMcpAccount(){return null;}
