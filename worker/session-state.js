// Schedule indicators only; they do not assert a connected timing feed.
export function sessionState(session,event={},now=Date.now()){
 const start=Date.parse(session.start),clock=Number(now);
 if(!Number.isFinite(start)||!Number.isFinite(clock))return {phase:'unknown',start:null,end:null};
 let end=Date.parse(session.end),basis='published';
 if(!Number.isFinite(end)||end<=start){
  let minutes=Number(session.durationMinutes);
  if(!(minutes>0)){
   const name=String(session.nameEn||session.name||'');
   // Standard schedule windows, not evidence of actual chequered-flag times.
   if(event.series==='f1')minutes=/^(FP[123]|Practice [123])$/i.test(name)?60:/qualifying|퀄리파잉|예선/i.test(name)?60:/sprint|스프린트/i.test(name)?60:/^(race|레이스)$/i.test(name)?120:0;
   else if(event.series==='wec'&&/race|레이스/i.test(name)){
    const hours=String(event.nameEn||event.name||'').match(/(\d+(?:\.\d+)?)\s*(?:Hours?|시간)/i);
    minutes=hours?Number(hours[1])*60:0;
   }
  }
  end=minutes>0?start+minutes*60000:NaN;basis='schedule';
 }
 const liveWindowKnown=Number.isFinite(end);
 const day=t=>new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
 if(!liveWindowKnown&&clock>=start&&day(clock)>day(start))return {phase:'finished',start,end:null,basis:'date-only'};
 const next=(event.sessions||[]).map(s=>Date.parse(s.start)).filter(t=>t>start).sort((a,b)=>a-b)[0];
 if(Number.isFinite(next)&&(!Number.isFinite(end)||next<end)){end=next;basis='next-session';}
 if(clock<start)return {phase:liveWindowKnown&&clock>=start-10*60000?'starting-soon':'upcoming',start,end:Number.isFinite(end)?end:null,basis};
 if(Number.isFinite(end))return {phase:clock<end?(liveWindowKnown?'live':'unknown'):'finished',start,end,basis};
 // No invented LIVE duration for a start-only record. A previous calendar day
 // cannot remain highlighted indefinitely; no exact end time is claimed.
 return {phase:day(clock)>day(start)?'finished':'unknown',start,end:null,basis:'date-only'};
}
