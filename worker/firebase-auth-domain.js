// Serve the Firebase sign-in handler from the site's own domain.
// iOS Safari (and other storage-partitioned browsers) lose the handler's
// sessionStorage when it runs on *.firebaseapp.com, which shows
// "Unable to process request due to missing initial state".
// vercel.json proxies /__/auth/* to firebaseapp.com, so the handler is
// first-party on these hosts. Other hosts (previews) keep the default domain.
// Each proxied host needs https://<host>/__/auth/handler as an authorized
// redirect URI on the Firebase project's Google OAuth client.
const PROXIED_HOSTS=['kongboda-motorsports.vercel.app'];
export function firebaseAuthDomain(env,host){
 const extra=String(env?.FIREBASE_AUTH_PROXY_HOSTS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
 const value=String(host||'').toLowerCase();
 return value&&[...PROXIED_HOSTS,...extra].includes(value)?value:env?.FIREBASE_WEB_AUTH_DOMAIN;
}
