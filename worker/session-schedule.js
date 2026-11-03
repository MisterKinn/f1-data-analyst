// Independently checked official session starts, 2026-11-03. Explicit offsets preserve DST.
// YouTube IDs are linked by the organiser's /videos page; no unofficial rebroadcasts.
const f1Source='https://www.formula1.com/en/latest/article/formula-1-gran-premio-de-la-ciudad-de-mexico-2026.14b3wTWzNNLJ5Wd8cG7HCQ';
const gtSource='https://www.gt-world-challenge-asia.com/event/90/shanghai-international-circuit';
const nascarSource='https://www.nascar.com/weekend-schedule/weekend-schedule-for-2026-martinsville-speedway-chase-race/';
const rows=(source,items)=>items.map(([name,nameEn,start,youtubeId])=>({name,nameEn,start,source,...(youtubeId?{watchUrl:'https://www.youtube.com/watch?v='+youtubeId,watchSource:'https://www.gt-world-challenge-asia.com/videos'}:{})}));
export const sessionSchedule={
 'f1-2026-10-30-mexico':rows(f1Source,[
  ['FP1','FP1','2026-10-30T12:30:00-06:00'],['FP2','FP2','2026-10-30T16:00:00-06:00'],['FP3','FP3','2026-10-31T11:30:00-06:00'],['퀄리파잉','Qualifying','2026-10-31T15:00:00-06:00'],['레이스','Race','2026-11-01T14:00:00-06:00']
 ]),
 // Full remaining F1 weekends, official Formula 1 timetables; circuit-local offsets.
 'f1-2026-11-06-interlagos':rows('https://www.formula1.com/en/latest/article/formula-1-msc-cruises-grande-premio-de-sao-paulo-2026.3nFWRAkowAY3uUyvw6O0eJ.3nFWRAkowAY3uUyvw6O0eJ.3nFWRAkowAY3uUyvw6O0eJ.3nFWRAkowAY3uUyvw6O0eJ',[
  ['FP1','FP1','2026-11-06T12:30:00-03:00'],['FP2','FP2','2026-11-06T16:00:00-03:00'],['FP3','FP3','2026-11-07T11:30:00-03:00'],['퀄리파잉','Qualifying','2026-11-07T15:00:00-03:00'],['레이스','Race','2026-11-08T14:00:00-03:00']
 ]),
 'f1-2026-11-19-las-vegas':rows('https://www.formula1.com/en/latest/article/formula-1-heineken-las-vegas-grand-prix-2026.1qmWzcBwKK5hkTbYbhVC22',[
  ['FP1','FP1','2026-11-19T16:30:00-08:00'],['FP2','FP2','2026-11-19T20:00:00-08:00'],['FP3','FP3','2026-11-20T16:30:00-08:00'],['퀄리파잉','Qualifying','2026-11-20T20:00:00-08:00'],['레이스','Race','2026-11-21T20:00:00-08:00']
 ]),
 'f1-2026-11-27-lusail':rows('https://www.formula1.com/en/latest/article/formula-1-qatar-airways-qatar-grand-prix-2026.3XJyoYSnpJEcuZovstTdcG',[
  ['FP1','FP1','2026-11-27T16:30:00+03:00'],['FP2','FP2','2026-11-27T20:00:00+03:00'],['FP3','FP3','2026-11-28T17:30:00+03:00'],['퀄리파잉','Qualifying','2026-11-28T21:00:00+03:00'],['레이스','Race','2026-11-29T19:00:00+03:00']
 ]),
 // Race page lists UTC; +04:00 local offsets below are the same instants.
 'f1-2026-12-04-yas-marina':rows('https://www.formula1.com/en/racing/2026/united-arab-emirates',[
  ['FP1','FP1','2026-12-04T13:30:00+04:00'],['FP2','FP2','2026-12-04T17:00:00+04:00'],['FP3','FP3','2026-12-05T14:30:00+04:00'],['퀄리파잉','Qualifying','2026-12-05T18:00:00+04:00'],['레이스','Race','2026-12-06T17:00:00+04:00']
 ]),
 'gtwc-asia-2026-10-30-shanghai':rows(gtSource,[
  ['공식 테스트','Official test','2026-10-30T08:30:00+08:00'],['공식 연습','Official practice','2026-10-30T10:48:00+08:00'],['브론즈 세션','Bronze session','2026-10-30T11:55:00+08:00'],['프리 퀄리파잉','Pre-qualifying','2026-10-30T14:55:00+08:00'],['퀄리파잉 1','Qualifying 1','2026-10-31T09:35:00+08:00','6SgbGMvRLHQ'],['퀄리파잉 2','Qualifying 2','2026-10-31T09:57:00+08:00','6SgbGMvRLHQ'],['레이스 1','Race 1','2026-10-31T12:50:00+08:00','aBoh1l00hFg'],['레이스 2','Race 2','2026-11-01T13:05:00+08:00','-W7hBM0O_tE']
 ]),
 'nascar-2026-10-30-martinsville':rows(nascarSource,[
  ['트럭 · 연습','Truck · practice','2026-10-30T12:30:00-04:00'],['트럭 · 예선','Truck · qualifying','2026-10-30T13:35:00-04:00'],['오라일리 · 연습','O’Reilly · practice','2026-10-30T15:00:00-04:00'],['오라일리 · 예선','O’Reilly · qualifying','2026-10-30T16:05:00-04:00'],['트럭 · 레이스','Truck · race','2026-10-30T18:00:00-04:00'],['컵 · 연습','Cup · practice','2026-10-31T13:00:00-04:00'],['컵 · 예선','Cup · qualifying','2026-10-31T14:05:00-04:00'],['오라일리 · 레이스','O’Reilly · race','2026-10-31T16:00:00-04:00'],['컵 · 레이스','Cup · race','2026-11-01T14:00:00-05:00']
 ])
};

// Past-race records also power isolated visual QA; production still filters the actual week.
sessionSchedule['24h-series-2026-09-18-barcelona']=rows('https://www.24hseries.com/races/michelin-24h-barcelona-2026',[
 ['FP','FP','2026-09-18T12:00:00+02:00'],['GT3 Q1','GT3 Q1','2026-09-18T17:15:00+02:00'],['GT3 Q2','GT3 Q2','2026-09-18T17:35:00+02:00'],['GT3 Q3','GT3 Q3','2026-09-18T17:55:00+02:00'],['야간 FP','Night FP','2026-09-18T20:00:00+02:00'],['레이스','Race','2026-09-19T12:00:00+02:00']]);
sessionSchedule['super-taikyu-2026-10-24-okayama']=rows('https://supertaikyu.com/race/round_06.html',[
 ['Gr.2 FP','Gr.2 FP','2026-10-24T09:40:00+09:00'],['Gr.1 FP','Gr.1 FP','2026-10-24T10:20:00+09:00'],['A 퀄리파잉','A Qualifying','2026-10-24T13:40:00+09:00'],['B 퀄리파잉','B Qualifying','2026-10-24T14:35:00+09:00'],['C 퀄리파잉','C Qualifying','2026-10-24T15:30:00+09:00'],['D 퀄리파잉','D Qualifying','2026-10-24T16:10:00+09:00'],['Gr.2 레이스','Gr.2 Race','2026-10-25T08:30:00+09:00'],['Gr.1 레이스','Gr.1 Race','2026-10-25T13:30:00+09:00']]);
const japanItinerary='https://webassets.redbull.com/media/r8TgPyrsRmdqyJWdNYQiE8/WRC/WRC%20events%202026/ITINERARY_JAPAN_2026_V2.pdf';
sessionSchedule['wrc-2026-05-28-rally-japan']=rows(japanItinerary,[
 ['셰이크다운','Shakedown','2026-05-28T08:01:00+09:00'],
 ...[['29','08:03'],['29','08:46'],['29','10:09'],['29','13:57'],['29','14:40'],['29','16:03'],['30','07:41'],['30','08:54'],['30','10:35'],['30','13:05'],['30','14:38'],['30','15:56'],['30','17:15'],['30','17:38'],['31','08:14'],['31','09:05'],['31','10:13'],['31','10:32'],['31','12:30'],['31','14:15']].map(([day,time],i)=>['SS'+(i+1),'SS'+(i+1),'2026-05-'+day+'T'+time+':00+09:00'])]);

for(const [name,id] of [['Gr.2 레이스','0r_VxfaJvtQ'],['Gr.1 레이스','gnIDWUee52o']]){const row=sessionSchedule['super-taikyu-2026-10-24-okayama'].find(s=>s.name===name);row.watchUrl='https://www.youtube.com/watch?v='+id;row.watchSource='https://supertaikyu.com/';}


// Published start/end times; Rome is CET and Japan shares Korea's UTC+09:00.
const timedRows=(source,items)=>items.map(([name,nameEn,start,end])=>({name,nameEn,start,end,source}));
sessionSchedule['wec-2026-11-06-monza']=timedRows('https://www.fiawec.com/en/race/document/download/2832',[
 ['FP1','FP1','2026-11-06T10:30:00+01:00','2026-11-06T12:00:00+01:00'],
 ['FP2','FP2','2026-11-06T14:30:00+01:00','2026-11-06T16:00:00+01:00'],
 ['FP3','FP3','2026-11-07T10:30:00+01:00','2026-11-07T11:30:00+01:00'],
 ['LMGT3 퀄리파잉','LMGT3 Qualifying','2026-11-07T14:20:00+01:00','2026-11-07T14:32:00+01:00'],
 ['LMGT3 하이퍼폴','LMGT3 Hyperpole','2026-11-07T14:40:00+01:00','2026-11-07T14:50:00+01:00'],
 ['하이퍼카 퀄리파잉','Hypercar Qualifying','2026-11-07T15:00:00+01:00','2026-11-07T15:12:00+01:00'],
 ['하이퍼카 하이퍼폴','Hypercar Hyperpole','2026-11-07T15:20:00+01:00','2026-11-07T15:30:00+01:00'],
 ['레이스','Race','2026-11-08T11:00:00+01:00','2026-11-08T17:00:00+01:00']
]);
sessionSchedule['super-gt-2026-11-06-motegi']=timedRows('https://www.mr-motegi.jp/supergt_m/',[
 ['전용 연습','Exclusive practice','2026-11-06T09:30:00+09:00','2026-11-06T11:00:00+09:00'],
 ['Rd.3 GT300 퀄리파잉','Rd.3 GT300 Qualifying','2026-11-07T09:00:00+09:00','2026-11-07T09:20:00+09:00'],
 ['Rd.3 GT500 퀄리파잉','Rd.3 GT500 Qualifying','2026-11-07T09:30:00+09:00','2026-11-07T09:45:00+09:00'],
 ['Rd.3 웜업','Rd.3 Warm-up','2026-11-07T12:30:00+09:00','2026-11-07T12:50:00+09:00'],
 ['Rd.3 레이스','Rd.3 Race','2026-11-07T14:00:00+09:00','2026-11-07T15:45:00+09:00'],
 ['Rd.8 GT300 퀄리파잉','Rd.8 GT300 Qualifying','2026-11-08T09:45:00+09:00','2026-11-08T10:05:00+09:00'],
 ['Rd.8 GT500 퀄리파잉','Rd.8 GT500 Qualifying','2026-11-08T10:15:00+09:00','2026-11-08T10:30:00+09:00'],
 ['Rd.8 웜업','Rd.8 Warm-up','2026-11-08T12:30:00+09:00','2026-11-08T12:50:00+09:00'],
 ['Rd.8 레이스','Rd.8 Race','2026-11-08T14:00:00+09:00','2026-11-08T15:45:00+09:00']
]);
