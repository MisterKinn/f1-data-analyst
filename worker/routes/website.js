import {firebaseAuthDomain} from '../firebase-auth-domain.js';
import {hasCrewAccess} from '../crew.js';
import {accountIdentity} from '../accounts.js';
import {googleConfigured} from '../google-auth.js';
import {setupLive} from '../setup-live.js';
import {alertsPageBody} from '../doc-alerts-web.js';
import {websiteRoute} from '../website.js';
import {aiConnectionStatus} from '../ai-connections.js';
import {findLinkCode,isOwner} from '../collector-fleet.js';
import {simulationStart} from './simulation.js';

export async function websitePageRoute(request,env,{google,alertsOwner}){
 const path=new URL(request.url).pathname;
 const accountInfo=!path.startsWith('/assets/')&&!path.startsWith('/api/')&&(google||request.headers.get('oai-authenticated-user-id'))?await accountIdentity(request,env,google,{create:true}):null;
 const googleReady=env.FIREBASE_AUTH_CONFIGURED==='true'||googleConfigured(env);
 const firebaseConfig=googleReady?{apiKey:env.FIREBASE_WEB_API_KEY,authDomain:firebaseAuthDomain(env,new URL(request.url).host),projectId:env.FIREBASE_PROJECT_ID,appId:env.FIREBASE_WEB_APP_ID}:null;
 const aiConnections=path==='/account'&&request.method==='GET'&&google?.sub&&accountInfo?.account&&!accountInfo.account.deleted?await aiConnectionStatus(env,google.sub).catch(()=>null):null;
 const linkCode=path==='/account'&&request.method==='GET'?new URL(request.url).searchParams.get('host_link'):null;
 const hostLink=linkCode?{code:linkCode,host:await findLinkCode(env,linkCode.toUpperCase()).catch(()=>null)}:null;
 const website=websiteRoute(request,{setupLive:path==='/setup'&&request.method==='GET'?await setupLive(Object.fromEntries(new URL(request.url).searchParams),env).catch(()=>null):undefined,...(path==='/simulation'&&request.method==='GET'?await simulationStart(request):{}),alertsBody:path==='/alerts'&&request.method==='GET'&&alertsOwner?await alertsPageBody(env,{google,owner:alertsOwner}):undefined,hostLink,hostLinked:path==='/account'?new URL(request.url).searchParams.get('host_linked'):null,aiConnections,google,googleReady,firebaseConfig,firebaseCsrf:request.headers.get('x-kongboda-firebase-csrf'),accountInfo,crewRegistered:hasCrewAccess(accountInfo?.account,env),isOwner:path==='/account'&&google?await isOwner(env,google):false});return website;
}
