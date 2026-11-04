// Dependency-free so the daily GitHub workflow can import it without npm install.
// Upcoming events that still lack a session-level timetable. Used by tests and the
// daily workflow so a race-only card is reported instead of silently published.
export function missingSessionCoverage(events,now=Date.now(),days=10,minimum=2){
 const from=new Date(now).toISOString().slice(0,10),to=new Date(now+days*86400000).toISOString().slice(0,10);
 return events.filter(e=>e.start<=to&&(e.end||e.start)>=from&&(e.sessions||[]).length<minimum&&!SCHEDULE_ONLY_COVERAGE.has(e.series)).map(e=>({id:e.id,series:e.series,start:e.start,sessions:(e.sessions||[]).length}));
}
// Multi-week rallies publish stage itineraries late; their date range is shown instead.
const SCHEDULE_ONLY_COVERAGE=new Set(['dakar']);
