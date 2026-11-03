// Crew membership grants use of the operator's collector, not general AI access.
export function hasCrewAccess(account,env){return !!(account&&!account.deleted&&account.liveAnalysisAccess?.activatedAt&&account.liveAnalysisAccess.revision===(env.LIVE_ANALYSIS_KEY_REVISION||'1'));}
export async function readMemberCrew(env,account,args={}){
 if(!hasCrewAccess(account,env))throw Error('비밀키를 등록한 현재 선원만 목록을 확인할 수 있습니다.');
 if(!env.BUCKET?.list)throw Error('계정 저장소를 사용할 수 없습니다.');
 if(args.cursor!==undefined&&(typeof args.cursor!=='string'||args.cursor.length>2048))throw Error('잘못된 목록 위치입니다.');
 const page=await env.BUCKET.list({prefix:'website-accounts/account/',limit:100,...(args.cursor?{cursor:args.cursor}:{})});
 const crew=[];
 for(const item of page.objects){const object=await env.BUCKET.get(item.key);if(!object)continue;const a=await object.json();if(!hasCrewAccess(a,env))continue;crew.push({name:typeof a.name==='string'&&a.name.trim()?a.name.trim().slice(0,100):'이름 미등록 선원',is_self:a.id===account.id});}
 return {crew,next_cursor:page.truncated?page.cursor:null};
}
export const CREW_TOOLS=[{name:'kongboda_list_crew',description:'Owner-only: list accounts that registered the secret key (선원), with name, email, registration date and current shared-collector access status. Contains private account data. Only call when the owner asks for the crew roster. Follow next_cursor until null for a complete list. Never expose credentials.',inputSchema:{type:'object',properties:{cursor:{type:'string',maxLength:2048}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}];
export async function listCrew(request,env,args={}){
 const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!id||!email||!env.DEPLOY_OWNER_EMAIL||email.toLowerCase()!==env.DEPLOY_OWNER_EMAIL.toLowerCase())throw Error('선원 명단은 운영자만 조회할 수 있습니다.');
 if(!env.BUCKET?.list)throw Error('계정 저장소를 사용할 수 없습니다.');
 if(args.cursor!==undefined&&(typeof args.cursor!=='string'||args.cursor.length>2048))throw Error('Invalid cursor');
 const page=await env.BUCKET.list({prefix:'website-accounts/account/',limit:100,...(args.cursor?{cursor:args.cursor}:{})});
 const crew=[];
 for(const item of page.objects){const object=await env.BUCKET.get(item.key);if(!object)continue;const a=await object.json();if(a.deleted||!a.liveAnalysisAccess?.activatedAt)continue;crew.push({name:a.name||null,email:a.email||null,registered_at:new Date(a.liveAnalysisAccess.activatedAt).toISOString(),shared_collector_access:a.liveAnalysisAccess.revision===(env.LIVE_ANALYSIS_KEY_REVISION||'1')});}
 return {content:[{type:'text',text:JSON.stringify({crew,next_cursor:page.truncated?page.cursor:null})}],isError:false};
}
