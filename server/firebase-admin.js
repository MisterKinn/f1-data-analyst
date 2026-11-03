import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

function credential(){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw)return applicationDefault();
 let value;
 try{value=JSON.parse(raw);}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON');}
 return cert(value);
}

export function firebaseAdmin(){
 const app=getApps()[0]||initializeApp({credential:credential(),projectId:process.env.FIREBASE_PROJECT_ID||process.env.GCLOUD_PROJECT});
 return {app,auth:getAuth(app),firestore:getFirestore(app)};
}
