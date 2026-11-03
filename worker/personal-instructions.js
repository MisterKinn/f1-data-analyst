const key=id=>'website-accounts/instructions/'+id+'.json';
export const MAX_INSTRUCTIONS=4000;
export const DEFAULT_INSTRUCTIONS='F1과 WEC의 주요 FIA 문서를 확인해 핵심 변경사항과 경기 영향을 알림으로 보내줘.';
export function validateInstructions(text){
 if(typeof text!=='string'||text.length>MAX_INSTRUCTIONS||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))throw Error('개인 지침은 4,000자 이하의 텍스트로 입력하세요.');
 return text.trim();
}
export async function readInstructions(env,account){
 if(!account||account.deleted||!env.BUCKET)return {text:'',revision:0,updatedAt:null};
 const object=await env.BUCKET.get(key(account.id));
 if(!object)return {text:DEFAULT_INSTRUCTIONS,revision:0,updatedAt:null};
 const value=await object.json();
 return {text:validateInstructions(value.text),revision:value.revision,updatedAt:value.updatedAt};
}
export async function saveInstructions(env,account,text,expectedRevision){
 if(!account||account.deleted||!env.BUCKET)throw Error('로그인한 계정의 저장소가 필요합니다.');
 text=validateInstructions(text);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('개인 지침을 먼저 조회한 뒤 수정하세요.');
 const storageKey=key(account.id),object=await env.BUCKET.get(storageKey),old=object?await object.json():{revision:0};
 if(old.revision!==expectedRevision)throw Error('개인 지침이 다른 곳에서 변경됐습니다. 다시 불러온 뒤 수정하세요.');
 const value={text,revision:old.revision+1,updatedAt:Date.now()};
 const options=object?.etag?{onlyIf:{etagMatches:object.etag}}:{onlyIf:{etagDoesNotMatch:'*'}};
 const result=await env.BUCKET.put(storageKey,JSON.stringify(value),options);
 if(result===null)throw Error('개인 지침이 다른 곳에서 변경됐습니다. 다시 불러온 뒤 수정하세요.');
 return value;
}
export async function mergeInstructions(env,targetId,sourceId){
 const current=await env.BUCKET.get(key(targetId)),source=await env.BUCKET.get(key(sourceId));
 if(!current&&source)await env.BUCKET.put(key(targetId),JSON.stringify(await source.json()),{onlyIf:{etagDoesNotMatch:'*'}});
 await env.BUCKET.delete(key(sourceId));
}
export const deleteInstructions=(env,id)=>env.BUCKET.delete(key(id));
