// Source clocks, not receipt clocks, establish whether timing is current.
export function sourceTimestamp(value) {
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value))return null;
 const time=Date.parse(value);return Number.isFinite(time)?time:null;
}

export function sourceFreshness(snapshot,now=Date.now()) {
 const times=snapshot.topic_times??{};
 const age=topic=>{
  if(!Object.hasOwn(snapshot.topics??{},topic))return null;
  const entry=times[topic];
  if(!entry||entry.initial_snapshot!==false)return null;
  const stamp=sourceTimestamp(entry.source_time);
  return stamp===null?null:(now-stamp)/1000;
 };
 const clocks=['Heartbeat','ExtrapolatedClock'].map(age).filter(Number.isFinite);
 const clock=clocks.length?Math.min(...clocks):null,timing=age('TimingData');
 const valid=value=>Number.isFinite(value)&&value>=-10&&value<=45;
 return {source_fresh:valid(clock)&&valid(timing),clock_source_age_seconds:clock,
  timing_source_age_seconds:timing,source_stale_after_seconds:45,
  source_status:clock===null||timing===null?'unverified':valid(clock)&&valid(timing)?'current':'stale_or_clock_skew'};
}
