import {wecTyreAllocations} from './wec-tyre-allocations.js';
// Official event-level schedule snapshot. Reviewed 2026-10-30 (Asia/Seoul).
// Date-only ranges are venue-local calendar dates, not fabricated midnight race times.
// raceStart, where present, is an independently confirmed timestamp for local-time display.
// Session-level timetables are joined from session-schedule.js. Unknown measurements remain null.
export const calendarReviewedAt = '2026-11-03';
export const calendarSources = {
 f1:'https://www.formula1.com/en/racing/2026',
 wec:'https://www.fiawec.com/en/page/homepage-world-endurance-championship/1',
 imsa:'https://www.imsa.com/weathertech/weathertech-2026-schedule/',
 'formula-e':'https://www.fiaformulae.com/en/calendar',
 nls:'https://www.nuerburgring-langstrecken-serie.de/language/de/termine-adac-ravenol-nuerburgring-langstrecken-serie-2026/',
 elms:'https://www.europeanlemansseries.com/en/page/elms-home',
 alms:'https://www.asianlemansseries.com/en/news/maximum-47-car-grid-for-2026-27-asian-le-mans-series-in-europe/13834',
 'gtwc-europe':'https://gt-world-challenge-europe.com/calendar',
 'gtwc-asia':'https://www.gt-world-challenge-asia.com/calendar',
 'gtwc-america':'https://www.gt-world-challenge-america.com/calendar',
 'gtwc-australia':'https://www.gt-world-challenge-australia.com/calendar',
 wrc:'https://www.wrc.com/en/calendar/wrc-2026',
 'super-taikyu':'https://supertaikyu.com/',
 '24h-series':'https://www.24hseries.com/races',
 nascar:'https://www.nascar.com/news-media/2025/11/12/nascar-announces-start-times-networks-for-2026-national-series-races/',
 igtc:'https://www.intercontinentalgtchallenge.com/calendar',
 'british-gt':'https://www.britishgt.com/calendar',
 'super-gt':'https://supergt.net/en/calendar',
 dakar:'https://www.dakar.com/en/',
 macau:'https://www.macau.grandprix.gov.mo/en/news/event/1880'
};
const events=[];
function add(series,timezone,rows,year='2026') {
 for(const [circuit,name,nameEn,start,end,extra={}] of rows){
  const date=s=>s.length===5?year+'-'+s:s;
  events.push({id:series+'-'+date(start)+'-'+circuit,series,name,nameEn,circuit,start:date(start),end:date(end||start),timezone,url:calendarSources[series],precision:'date',reviewedAt:calendarReviewedAt,...extra});
 }
}
add('f1','Australia/Melbourne', [['albert-park','호주 그랑프리','Australian Grand Prix','03-06','03-08']]);
add('f1','Asia/Shanghai', [['shanghai','중국 그랑프리','Chinese Grand Prix','03-13','03-15']]);
add('f1','Asia/Tokyo', [['suzuka','일본 그랑프리','Japanese Grand Prix','03-27','03-29']]);
add('f1','America/New_York', [['miami','마이애미 그랑프리','Miami Grand Prix','05-01','05-03']]);
add('f1','America/Toronto', [['montreal','캐나다 그랑프리','Canadian Grand Prix','05-22','05-24']]);
add('f1','Europe/Monaco', [['monaco','모나코 그랑프리','Monaco Grand Prix','06-05','06-07']]);
add('f1','Europe/Madrid', [['barcelona','바르셀로나-카탈루냐 그랑프리','Barcelona-Catalunya Grand Prix','06-12','06-14'],['madrid','스페인 그랑프리','Spanish Grand Prix','09-11','09-13']]);
add('f1','Europe/Vienna', [['red-bull-ring','오스트리아 그랑프리','Austrian Grand Prix','06-26','06-28']]);
add('f1','Europe/London', [['silverstone','영국 그랑프리','British Grand Prix','07-03','07-05']]);
add('f1','Europe/Brussels', [['spa','벨기에 그랑프리','Belgian Grand Prix','07-17','07-19']]);
add('f1','Europe/Budapest', [['hungaroring','헝가리 그랑프리','Hungarian Grand Prix','07-24','07-26']]);
add('f1','Europe/Amsterdam', [['zandvoort','네덜란드 그랑프리','Dutch Grand Prix','08-21','08-23']]);
add('f1','Europe/Rome', [['monza','이탈리아 그랑프리','Italian Grand Prix','09-04','09-06']]);
add('f1','Asia/Baku', [['baku','아제르바이잔 그랑프리','Azerbaijan Grand Prix','09-24','09-26']]);
add('f1','Asia/Kuala_Lumpur', [['sepang','바레인 그랑프리 인 말레이시아','Bahrain Grand Prix in Malaysia','10-02','10-04']]);
add('f1','Asia/Singapore', [['singapore','싱가포르 그랑프리','Singapore Grand Prix','10-09','10-11']]);
add('f1','America/Chicago', [['cota','미국 그랑프리','United States Grand Prix','10-23','10-25']]);
add('f1','America/Mexico_City', [['mexico','멕시코시티 그랑프리','Mexico City Grand Prix','10-30','11-01',{
 raceStart:'2026-11-01T14:00:00-06:00',raceTimeSource:'https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_competition_visa.pdf',
 tyres:'C3 하드 · C4 미디엄 · C5 소프트',tyresEn:'C3 Hard · C4 Medium · C5 Soft',tyreSource:'https://press.pirelli.com/mexico-new-asphalt-and-the-softest-compound-trio/',
 strategy:'예상: 미디엄·소프트 중심 2스톱 가능성. 열화가 낮으면 1스톱, 그레이닝이 심하면 하드 활용. 새 아스팔트의 실제 거동과 주말 데이터에 따라 변경.',strategyEn:'Forecast: a two-stop using medium/soft is possible; lower degradation could favour one stop, while graining could bring the hard into play. Reassess after running on the new asphalt.',strategySource:'https://www.williamsf1.com/articles/60ecccf9-a3d4-43b1-8696-e8fe0b9d1b5e/technical-brief-mexico-city',strategyType:'forecast'
 }]]);
add('f1','America/Sao_Paulo', [['interlagos','상파울루 그랑프리','São Paulo Grand Prix','11-06','11-08']]);
add('f1','America/Los_Angeles', [['las-vegas','라스베이거스 그랑프리','Las Vegas Grand Prix','11-19','11-21']]);
add('f1','Asia/Qatar', [['lusail','카타르 그랑프리','Qatar Grand Prix','11-27','11-29']]);
add('f1','Asia/Dubai', [['yas-marina','아부다비 그랑프리','Abu Dhabi Grand Prix','12-04','12-06']]);
add('wec','Europe/Rome', [['imola','이몰라 6시간','6 Hours of Imola','04-17','04-19'],['monza','몬자 6시간','6 Hours of Monza','11-06','11-08',{raceStart:'2026-11-08T11:00:00+01:00',raceTimeSource:'https://www.fiawec.com/en/page/homepage-during-event-1'}]]);
add('wec','Europe/Brussels', [['spa','스파 6시간','6 Hours of Spa-Francorchamps','05-07','05-09']]);
add('wec','Europe/Paris', [['le-mans','르망 24시간','24 Hours of Le Mans','06-10','06-14']]);
add('wec','America/Sao_Paulo', [['interlagos','상파울루 6시간','6 Hours of São Paulo','07-10','07-12']]);
add('wec','America/Chicago', [['cota','론스타 르망','Lone Star Le Mans','09-04','09-06']]);
add('wec','Asia/Tokyo', [['fuji','후지 6시간','6 Hours of Fuji','09-25','09-27']]);
add('wec','Europe/Madrid', [['barcelona','바르셀로나 6시간','6 Hours of Barcelona','10-16','10-18']]);
add('imsa','America/New_York', [
 ['daytona','데이토나 24시간','Rolex 24 at Daytona','01-21','01-25'],['sebring','세브링 12시간','12 Hours of Sebring','03-18','03-21'],['detroit','디트로이트 스포츠카 클래식','Detroit Sports Car Classic','05-29','05-30'],['watkins-glen','왓킨스글렌 6시간','Six Hours of The Glen','06-25','06-28'],['vir','버지니아 GT 챌린지','GT Challenge at VIR','08-21','08-23'],['indianapolis','배틀 온 더 브릭스','Battle on the Bricks','09-18','09-20'],['road-atlanta','쁘띠 르망','Petit Le Mans','09-30','10-03']]);
add('imsa','America/Los_Angeles', [['long-beach','롱비치 그랑프리','Grand Prix of Long Beach','04-17','04-19'],['laguna-seca','라구나 세카','Laguna Seca','05-01','05-03']]);
add('imsa','America/Toronto', [['ctmp','셰보레 그랑프리','Chevrolet Grand Prix','07-10','07-12']]);
add('imsa','America/Chicago', [['road-america','로드 아메리카 6시간','Road America 6 Hours','07-30','08-02']]);
add('elms','Europe/Madrid', [['barcelona','바르셀로나 4시간','4 Hours of Barcelona','04-10','04-12']]);
add('elms','Europe/Paris', [['paul-ricard','르 카스텔레 4시간','4 Hours of Le Castellet','05-01','05-03']]);
add('elms','Europe/Rome', [['imola','이몰라 4시간','4 Hours of Imola','07-03','07-05']]);
add('elms','Europe/Brussels', [['spa','스파 4시간','4 Hours of Spa-Francorchamps','08-21','08-23']]);
add('elms','Europe/London', [['silverstone','실버스톤 4시간','4 Hours of Silverstone','09-11','09-13']]);
// The current series homepage lists 8–10 October; older announcement pages differ.
add('elms','Europe/Lisbon', [['portimao','포르티망 4시간','4 Hours of Portimão','10-08','10-10']]);
add('alms','Europe/Paris', [['paul-ricard','르 카스텔레','Le Castellet','11-13','11-15',{url:'https://www.asianlemansseries.com/en/race/4-hours-of-le-castellet-by-alms-2026'}]]);
add('alms','Europe/Madrid', [['jerez','헤레스','Jerez','2027-01-15','2027-01-17']]);
add('alms','Europe/Lisbon', [['portimao','포르티망','Portimão','2027-02-19','2027-02-21']]);
add('nls','Europe/Berlin', [
 ['nurburgring-nls','NLS 1 · 베스트팔렌파르트','NLS 1 · Westfalenfahrt','03-14'],['nurburgring-nls','NLS 2 · 바르바로사프라이스','NLS 2 · Barbarossapreis','03-21'],['nurburgring-nls','NLS 3 · 아데나워 트로피','NLS 3 · Adenauer Trophy','04-11'],['nurburgring-24h','뉘르부르크링 24h 퀄리파이어','Nürburgring 24h Qualifiers','04-18','04-19'],['nurburgring-nls','NLS 6 · 아이펠 트로피','NLS 6 · Eifel Trophy','06-20'],['nurburgring-nls','NLS 7 · 6시간','NLS 7 · 6 Hours','08-01'],['nurburgring-nls','NLS 더블헤더','NLS Double-header','09-12','09-13'],['nurburgring-nls','NLS 10 · 슈포르트바르테 트로피','NLS 10 · Sportwarte Trophy','10-10']]);
add('gtwc-europe','Europe/Paris', [['paul-ricard','GTWC 유럽 · 폴 리카르','GTWC Europe · Paul Ricard','04-10','04-12'],['magny-cours','GTWC 유럽 · 마니쿠르','GTWC Europe · Magny-Cours','07-30','08-02']]);
add('gtwc-europe','Europe/London', [['brands-hatch','GTWC 유럽 · 브랜즈 해치','GTWC Europe · Brands Hatch','05-02','05-03']]);
add('gtwc-europe','Europe/Rome', [['monza','GTWC 유럽 · 몬자','GTWC Europe · Monza','05-28','05-31'],['misano','GTWC 유럽 · 미사노','GTWC Europe · Misano','07-16','07-19']]);
add('gtwc-europe','Europe/Brussels', [['spa','스파 24시간','24 Hours of Spa','06-23','06-28',{seriesAliases:['igtc'],dedupeKey:'2026-spa-24h'}]]);
add('gtwc-europe','Europe/Berlin', [['nurburgring-gp','GTWC 유럽 · 뉘르부르크링','GTWC Europe · Nürburgring','08-28','08-30']]);
add('gtwc-europe','Europe/Amsterdam', [['zandvoort','GTWC 유럽 · 잔드보르트','GTWC Europe · Zandvoort','09-17','09-20']]);
add('gtwc-europe','Europe/Madrid', [['barcelona','GTWC 유럽 · 바르셀로나','GTWC Europe · Barcelona','10-01','10-04']]);
add('gtwc-europe','Europe/Lisbon', [['portimao','GTWC 유럽 · 포르티망','GTWC Europe · Portimão','10-14','10-18']]);
add('gtwc-asia','Asia/Kuala_Lumpur', [['sepang','GTWC 아시아 · 세팡','GTWC Asia · Sepang','04-03','04-05']]);
add('gtwc-asia','Asia/Makassar', [['mandalika','GTWC 아시아 · 만달리카','GTWC Asia · Mandalika','05-01','05-03']]);
add('gtwc-asia','Asia/Tokyo', [['fuji','GTWC 아시아 · 후지','GTWC Asia · Fuji','07-09','07-12'],['okayama','GTWC 아시아 · 오카야마','GTWC Asia · Okayama','08-27','08-30']]);
add('gtwc-asia','Asia/Shanghai', [['beijing','GTWC 아시아 · 베이징','GTWC Asia · Beijing','10-02','10-04'],['shanghai','GTWC 아시아 · 상하이','GTWC Asia · Shanghai','10-30','11-01',{url:'https://www.gt-world-challenge-asia.com/event/90/shanghai-international-circuit',raceStart:'2026-10-31T12:50:00+08:00',raceTimeSource:'https://www.gt-world-challenge-asia.com/event/90/shanghai-international-circuit',raceStarts:['2026-10-31T12:50:00+08:00','2026-11-01T13:05:00+08:00']}]]);
add('gtwc-america','America/Los_Angeles', [['sonoma','GTWC 아메리카 · 소노마','GTWC America · Sonoma','03-27','03-29']]);
add('gtwc-america','America/Chicago', [['cota','GTWC 아메리카 · COTA','GTWC America · COTA','04-24','04-26'],['road-america','GTWC 아메리카 · 로드 아메리카','GTWC America · Road America','08-28','08-30'],['barber','GTWC 아메리카 · 바버','GTWC America · Barber','09-25','09-27']]);
add('gtwc-america','America/New_York', [['sebring','GTWC 아메리카 · 세브링','GTWC America · Sebring','05-08','05-10'],['road-atlanta','GTWC 아메리카 · 로드 애틀랜타','GTWC America · Road Atlanta','06-12','06-14']]);
// Shared IGTC / GTWC America race: use the specific official IGTC event range rather than stale general calendar.
add('igtc','America/Indiana/Indianapolis', [['indianapolis','인디애나폴리스 8시간','Indianapolis 8 Hour','10-08','10-10',{seriesAliases:['gtwc-america'],dedupeKey:'2026-indianapolis-8h',url:'https://www.intercontinentalgtchallenge.com/event/153/Indianapolis%208%20Hour'}]]);
add('igtc','Australia/Sydney', [['bathurst','배서스트 12시간','Bathurst 12 Hour','02-11','02-15']]);
add('igtc','Europe/Berlin', [['nurburgring-24h','뉘르부르크링 24시간','Nürburgring 24 Hours','05-14','05-17']]);
add('igtc','Asia/Tokyo', [['suzuka','스즈카 1000km','Suzuka 1000km','09-11','09-13']]);
add('gtwc-australia','Australia/Melbourne', [['phillip-island','GTWC 호주 · 필립 아일랜드','GTWC Australia · Phillip Island','03-27','03-29']]);
add('gtwc-australia','Australia/Adelaide', [['the-bend','GTWC 호주 · 더 벤드','GTWC Australia · The Bend','05-08','05-10'],['adelaide','GTWC 호주 · 애들레이드','GTWC Australia · Adelaide','11-26','11-29',{url:'https://www.gt-world-challenge-australia.com/event/28/adelaide-grand-final'}]]);
add('gtwc-australia','Australia/Brisbane', [['queensland','GTWC 호주 · 퀸즐랜드','GTWC Australia · Queensland','06-12','06-14']]);
add('gtwc-australia','Australia/Darwin', [['darwin','GTWC 호주 · 다윈','GTWC Australia · Darwin','07-24','07-26']]);
add('gtwc-australia','Australia/Sydney', [['sydney','GTWC 호주 · 시드니','GTWC Australia · Sydney','09-18','09-20']]);
add('british-gt','Europe/London', [['silverstone','영국 GT · 실버스톤 500','British GT · Silverstone 500','04-24','04-26'],['oulton-park','영국 GT · 올턴 파크','British GT · Oulton Park','05-22','05-25'],['snetterton','영국 GT · 스네터턴','British GT · Snetterton','08-14','08-16'],['donington','영국 GT · 도닝턴 파크','British GT · Donington Park','09-05','09-06'],['brands-hatch','영국 GT · 브랜즈 해치','British GT · Brands Hatch','09-26','09-27']]);
add('british-gt','Europe/Brussels', [['spa','영국 GT · 스파','British GT · Spa','06-19','06-21']]);
add('super-gt','Asia/Tokyo', [['okayama','슈퍼 GT · 오카야마','Super GT · Okayama','04-11','04-12'],['fuji','슈퍼 GT · 후지','Super GT · Fuji','05-03','05-04'],['fuji','슈퍼 GT · 후지','Super GT · Fuji','08-01','08-02'],['suzuka','슈퍼 GT · 스즈카','Super GT · Suzuka','08-22','08-23'],['sugo','슈퍼 GT · 스고','Super GT · Sugo','09-19','09-20'],['autopolis','슈퍼 GT · 오토폴리스','Super GT · Autopolis','10-17','10-18'],['motegi','슈퍼 GT · 모테기','Super GT · Motegi','11-06','11-08',{rounds:[3,8]}]]);
add('macau','Asia/Macau', [['guia','마카오 그랑프리','Macau Grand Prix','11-19','11-22']]);
// Organiser homepage and 2027 relocation announcement checked 2026-10-31.
add('dakar','Europe/Lisbon', [['dakar-route','다카르 랠리','Dakar Rally','2027-01-09','2027-01-23',{reviewedAt:'2026-10-31',url:'https://www.dakar.com/en/news/2027/portugal-and-morocco-to-exceptionally-host-the-49th-edition/208359',scheduleOnly:true,location:'Portugal · Morocco'}]]);
add('nascar','America/New_York', [
 ['martinsville','NASCAR · 마틴스빌','NASCAR · Martinsville','10-30','11-01',{seriesNames:['Cup','O’Reilly Auto Parts','Craftsman Truck'],raceStart:'2026-11-01T14:00:00-05:00',raceTimeSource:calendarSources.nascar}],
 ['homestead','NASCAR · 홈스테드 챔피언십','NASCAR · Homestead Championship','11-06','11-08',{seriesNames:['Cup','O’Reilly Auto Parts','Craftsman Truck'],raceStart:'2026-11-08T15:00:00-05:00',raceTimeSource:calendarSources.nascar}]
]);
add('24h-series','Asia/Dubai', [['yas-marina','아부다비 6시간','6H Abu Dhabi','01-09','01-10'],['dubai','두바이 24시간','24H Dubai','01-16','01-18']]);
add('24h-series','Europe/Rome', [['mugello','무젤로 12시간','12H Mugello','03-20','03-22']]);
add('24h-series','Europe/Brussels', [['spa','스파 12시간','12H Spa','04-17','04-19']]);
add('24h-series','Europe/Paris', [['paul-ricard','폴 리카르 12시간','12H Paul Ricard','06-05','06-07']]);
add('24h-series','Europe/Berlin', [['nurburgring-gp','뉘르부르크링 12시간','12H Nürburgring','07-03','07-05']]);
add('24h-series','Europe/Madrid', [['barcelona','바르셀로나 24시간','24H Barcelona','09-18','09-20']]);
add('24h-series','Africa/Johannesburg', [['kyalami','키알라미 24시간','24H Kyalami','2027-01-08','2027-01-10']]);
add('formula-e','Asia/Riyadh', [['jeddah-fe','제다 E-Prix','Jeddah E-Prix','2027-04-16','2027-04-17']]);
add('formula-e','America/Mexico_City', [['mexico-fe','멕시코시티 E-Prix','Mexico City E-Prix','2027-01-16']]);
add('formula-e','America/Chicago', [['cota-fe','오스틴 E-Prix','Austin E-Prix','2027-02-06']]);
add('formula-e','America/New_York', [['miami-fe','마이애미 E-Prix','Miami E-Prix','2027-02-20']]);
add('formula-e','America/Sao_Paulo', [['sao-paulo-fe','상파울루 E-Prix','São Paulo E-Prix','2027-03-13']]);
add('formula-e','Asia/Shanghai', [['sanya','싼야 E-Prix','Sanya E-Prix','2027-04-03'],['shanghai-fe','상하이 E-Prix','Shanghai E-Prix','2027-07-10','2027-07-11']]);
add('formula-e','Europe/Berlin', [['berlin','베를린 E-Prix','Berlin E-Prix','2027-05-08','2027-05-09']]);
add('formula-e','Europe/Monaco', [['monaco-fe','모나코 E-Prix','Monaco E-Prix','2027-05-01','2027-05-02']]);
add('formula-e','Europe/London', [['brands-hatch-fe','런던 E-Prix','London E-Prix','2027-05-29','2027-05-30']]);
add('formula-e','Europe/Amsterdam', [['zandvoort-fe','잔드보르트 E-Prix','Zandvoort E-Prix','2027-06-18','2027-06-19']]);
add('formula-e','Europe/Madrid', [['jarama','마드리드 E-Prix','Madrid E-Prix','2027-06-26','2027-06-27']]);
add('formula-e','Asia/Tokyo', [['tokyo','도쿄 E-Prix','Tokyo E-Prix','2027-07-24','2027-07-25']]);
// Published 2027 endurance schedules, retained separately by event year.
add('wec','Asia/Qatar', [['lusail','카타르 1812km','Qatar 1812km','2027-03-25','2027-03-27']]);
add('wec','Europe/Rome', [['imola','이몰라 6시간','6 Hours of Imola','2027-04-09','2027-04-11']]);
add('wec','Europe/London', [['silverstone','실버스톤 6시간','6 Hours of Silverstone','2027-04-23','2027-04-25']]);
add('wec','Europe/Brussels', [['spa','스파 6시간','6 Hours of Spa-Francorchamps','2027-05-13','2027-05-15']]);
add('wec','Europe/Paris', [['le-mans','르망 24시간','24 Hours of Le Mans','2027-06-06','2027-06-13']]);
add('wec','America/Sao_Paulo', [['interlagos','상파울루 6시간','6 Hours of São Paulo','2027-07-09','2027-07-11']]);
add('wec','America/Chicago', [['cota','론스타 르망','Lone Star Le Mans','2027-09-10','2027-09-12']]);
add('wec','Asia/Tokyo', [['fuji','후지 6시간','6 Hours of Fuji','2027-09-24','2027-09-26']]);
add('wec','Asia/Bahrain', [['bahrain','바레인 8시간','8 Hours of Bahrain','2027-11-04','2027-11-06']]);
const elms2027Source='https://www.europeanlemansseries.com/en/news/2027-season-finale-moves-back-two-weeks/13803';
add('elms','Europe/Madrid', [['barcelona','바르셀로나 4시간','4 Hours of Barcelona','2027-03-12','2027-03-14',{url:elms2027Source}]]);
add('elms','Europe/Paris', [['paul-ricard','르 카스텔레 4시간','4 Hours of Le Castellet','2027-04-30','2027-05-02',{url:elms2027Source}]]);
add('elms','Europe/Rome', [['imola','이몰라 4시간','4 Hours of Imola','2027-07-02','2027-07-04',{url:elms2027Source}]]);
add('elms','Europe/Brussels', [['spa','스파 4시간','4 Hours of Spa-Francorchamps','2027-08-20','2027-08-22',{url:elms2027Source}]]);
add('elms','Europe/London', [['silverstone','실버스톤 4시간','4 Hours of Silverstone','2027-09-03','2027-09-05',{url:elms2027Source}]]);
add('elms','Europe/Lisbon', [['portimao','포르티망 4시간','4 Hours of Portimão','2027-10-14','2027-10-16',{url:elms2027Source}]]);
// Schedule-only series: deliberately excluded from the analysis championship registry.
add('super-taikyu','Asia/Tokyo',[
 ['motegi','모테기','Motegi','03-21','03-22'],['suzuka','스즈카','Suzuka','04-18','04-19'],['fuji','후지 24시간','Fuji 24 Hours','06-05','06-07'],['sugo','스고','SUGO','07-04','07-05'],['autopolis','오토폴리스','Autopolis','07-25','07-26'],['okayama','오카야마 3시간','Okayama 3 Hours','10-24','10-25',{url:'https://supertaikyu.com/race/round_06.html'}],['fuji','후지 4시간','Fuji 4 Hours','11-14','11-15',{url:'https://supertaikyu.com/race/round_07.html'}]]);
add('wrc','Asia/Tokyo',[['rally-japan','랠리 재팬','Rally Japan','05-28','05-31',{url:'https://www.wrc.com/en/events/wrc-rally-japan-2026'}]]);
// The WRC finale moved to Sardinia (1-4 Oct); the rally runs 12-14 Nov as the FIA Middle East Rally Championship finale.
add('wrc','Asia/Riyadh',[['rally-saudi','사우디아라비아 랠리','Saudi Arabia Rally','11-12','11-14',{url:'https://rally-saudiarabia.com/event-programme'}]]);
export const calendarEvents=events.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
// Where the refresher finds each event's own timetable (calendar-refresh.js reads it when the event is near):
// url = ACO race page linking a per-session calendar file; sessionsUrl = organiser timetable page or programme feed.
for(const [series,circuit,start,field,value] of [
 ['alms','jerez','2027-01-15','url','https://www.asianlemansseries.com/en/race/4-hours-of-jerez-by-alms-2027'],
 ['alms','portimao','2027-02-19','url','https://www.asianlemansseries.com/en/race/4-hours-of-portimao-by-alms-2027'],
 ['super-taikyu','fuji','2026-11-14','sessionsUrl','https://supertaikyu.com/race/round_07.html'],
 ['wrc','rally-saudi','2026-11','sessionsUrl','https://rally-saudiarabia.com/event-programme'],
 ['macau','guia','2026-11-19','sessionsUrl','https://www.macau.grandprix.gov.mo/api/game/event_day?_locale=en&year=2026']
]){const event=events.find(e=>e.series===series&&e.circuit===circuit&&e.start.startsWith(start));if(event)event[field]=value;}
const unknown={lengthKm:null,elevationM:null,elevationChangeM:null,offsetM:null,sourceUrl:null,notes:'공식 수치를 추가 확인 중입니다.',notesEn:'Additional official measurements are being verified.'};
export const circuitInfo={
 'dakar-route':{...unknown,name:'Portugal · Morocco',sourceUrl:calendarSources.dakar,notes:'포르투갈·모로코 구간을 이동하는 랠리 레이드. 고정 서킷이 아니며 스테이지별 코스·출발시각은 공식 일정 확인 후 안내합니다.',notesEn:'A rally raid across Portugal and Morocco, not a fixed circuit. Stage routes and start times require the published itinerary.'},
 mexico:{...unknown,name:'Autódromo Hermanos Rodríguez',lengthKm:4.304,elevationM:2240,offsetM:230,sourceUrl:'https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_competition_visa.pdf',sources:['https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_competition_visa.pdf','https://www.mexicogp.mx/noticia/mexico-gp-como-se-llaman-las-curvas-del-autodromo-hermanos-rodriguez/'],notes:'해발고도는 대회 주최 측 표기(약 2,240m). 고도 측정 기준에 따라 다른 출처의 수치와 차이가 있습니다. 오프셋은 2026 F1 대회 문서 기준입니다.',notesEn:'Altitude follows the promoter (approximately 2,240 m); published figures vary with measurement reference. Offset is from the 2026 F1 event document.'},
 interlagos:{...unknown,name:'Autódromo José Carlos Pace',lengthKm:4.309,elevationM:800,elevationChangeM:43,sourceUrl:'https://www.mercedesamgf1.com/races/brazilian-grand-prix-2026',sources:['https://www.mercedesamgf1.com/races/brazilian-grand-prix-2026','https://www.formula1.com/en/latest/article/highs-and-lows-which-f1-track-has-the-most-elevation-changes-.7I9JEcBw3R2AqXbnJ6hyvc.7I9JEcBw3R2AqXbnJ6hyvc'],notes:'해발고도는 약 800m. 고저차 43m는 F1 공식 서킷 소개 기준입니다. 대회별 스타트라인 오프셋은 별도 확인이 필요합니다.',notesEn:'Altitude is approximately 800 m. The 43 m elevation change follows the official F1 circuit guide; event-specific start-line offset remains unverified.'},
 monza:{...unknown,name:'Autodromo Nazionale Monza',lengthKm:5.793,sourceUrl:'https://www.monzanet.it/en/circuit/',notes:'긴 직선과 시케인이 이어지는 고속 서킷. 타이어·피트 전략은 해당 대회 규정과 주말 조건을 확인해 제시합니다.',notesEn:'A high-speed circuit with long straights and chicanes. Tyre and pit strategy require event regulations and weekend conditions.'},
 motegi:{...unknown,name:'Mobility Resort Motegi',lengthKm:4.801379,elevationChangeM:30.4,sourceUrl:'https://www.mr-motegi.jp/eng/course_m/',notes:'로드 코스 기준. 14개 코너와 최장 762m 직선이 있는 서킷입니다.',notesEn:'Road-course configuration: 14 corners and a longest straight of 762 m.'},
 shanghai:{...unknown,name:'Shanghai International Circuit',lengthKm:5.451,sourceUrl:'https://www.gt-world-challenge-asia.com/event/90/shanghai-international-circuit',notes:'GTWC 아시아 공식 이벤트 정보 기준, 16개 코너. 컴파운드·전략은 대회별로 확인합니다.',notesEn:'Official GTWC Asia event specification: 16 corners. Tyres and strategy are event-specific.'},
 guia:{...unknown,name:'Guia Circuit',lengthKm:6.12,elevationChangeM:30,sourceUrl:'https://www.fia.com/news/macau-grand-prix-fast-facts',notes:'좁은 산악 구간과 긴 직선을 잇는 시가지 서킷. 고저차는 FIA 소개 수치이며 세부 경기는 한 대회로 묶어 안내합니다.',notesEn:'A street circuit joining a narrow hillside section to long straights. Elevation change follows FIA guidance; the meeting is shown as one event.'},
 'nurburgring-nls':{...unknown,name:'Nürburgring · NLS',lengthKm:24.358,elevationM:620,elevationChangeM:300,sourceUrl:'https://www.nuerburgring-langstrecken-serie.de/language/en/the-nurburgring/',notes:'NLS 조합 코스. 해발고도 620m는 최고 지점 기준이며 최저 지점은 320m입니다. 24시간 코스와 구별해야 합니다.',notesEn:'NLS combined layout. 620 m is the highest point, with a 320 m low point. Distinct from the 24-hour layout.'}
};
const names={bahrain:'Bahrain International Circuit',
 'albert-park':'Albert Park','miami':'Miami International Autodrome','montreal':'Circuit Gilles-Villeneuve','monaco':'Circuit de Monaco','barcelona':'Circuit de Barcelona-Catalunya','madrid':'MADRING','red-bull-ring':'Red Bull Ring','silverstone':'Silverstone Circuit','spa':'Circuit de Spa-Francorchamps','hungaroring':'Hungaroring','zandvoort':'Circuit Zandvoort','baku':'Baku City Circuit','sepang':'Sepang International Circuit','singapore':'Marina Bay Street Circuit','cota':'Circuit of The Americas','las-vegas':'Las Vegas Strip Circuit','lusail':'Lusail International Circuit','yas-marina':'Yas Marina Circuit','imola':'Autodromo Enzo e Dino Ferrari','le-mans':'Circuit de la Sarthe','fuji':'Fuji Speedway','suzuka':'Suzuka Circuit','daytona':'Daytona International Speedway','sebring':'Sebring International Raceway','detroit':'Detroit Street Circuit','watkins-glen':'Watkins Glen International','vir':'VIRginia International Raceway','indianapolis':'Indianapolis Motor Speedway','road-atlanta':'Michelin Raceway Road Atlanta','long-beach':'Long Beach Street Circuit','laguna-seca':'WeatherTech Raceway Laguna Seca','ctmp':'Canadian Tire Motorsport Park','road-america':'Road America','paul-ricard':'Circuit Paul Ricard','portimao':'Autódromo Internacional do Algarve','jerez':'Circuito de Jerez','nurburgring-24h':'Nürburgring · 24h','nurburgring-gp':'Nürburgring · GP','magny-cours':'Circuit de Nevers Magny-Cours','brands-hatch':'Brands Hatch','misano':'Misano World Circuit','mandalika':'Mandalika International Circuit','okayama':'Okayama International Circuit','beijing':'Beijing Street Circuit','sonoma':'Sonoma Raceway','barber':'Barber Motorsports Park','bathurst':'Mount Panorama','phillip-island':'Phillip Island Grand Prix Circuit','the-bend':'The Bend Motorsport Park','adelaide':'Adelaide Parklands Circuit','queensland':'Queensland Raceway','darwin':'Hidden Valley Raceway','sydney':'Sydney Motorsport Park','oulton-park':'Oulton Park','snetterton':'Snetterton','donington':'Donington Park','sugo':'Sportsland SUGO','autopolis':'Autopolis','martinsville':'Martinsville Speedway','homestead':'Homestead-Miami Speedway','dubai':'Dubai Autodrome','mugello':'Mugello Circuit','kyalami':'Kyalami Grand Prix Circuit','jeddah-fe':'Jeddah Corniche Circuit · Formula E','mexico-fe':'Autódromo Hermanos Rodríguez · Formula E','cota-fe':'Circuit of The Americas · Formula E','miami-fe':'Miami International Autodrome · Formula E','sao-paulo-fe':'Anhembi Sambadrome Circuit','sanya':'Haitang Bay Circuit','shanghai-fe':'Shanghai International Circuit · Formula E','berlin':'Tempelhof Airport Street Circuit','monaco-fe':'Circuit de Monaco · Formula E','brands-hatch-fe':'Brands Hatch · Formula E','zandvoort-fe':'Circuit Zandvoort · Formula E','jarama':'Circuito del Jarama','tokyo':'Tokyo Street Circuit'
};
for(const event of calendarEvents)if(!circuitInfo[event.circuit])circuitInfo[event.circuit]={...unknown,name:names[event.circuit]||event.circuit,sourceUrl:event.url};
// Distances copied from the organiser's 2026 IMSA track specifications; mile values converted to km.
for(const [key,miles] of Object.entries({daytona:3.56,sebring:3.74,'long-beach':1.968,'laguna-seca':2.238,detroit:1.7,'watkins-glen':3.4,ctmp:2.459,'road-america':4.0,vir:3.27,indianapolis:2.439,'road-atlanta':2.54})){
 Object.assign(circuitInfo[key],{lengthKm:Number((miles*1.609344).toFixed(3)),sourceUrl:calendarSources.imsa,notes:'2026 IMSA 공식 표기의 마일 길이를 km로 환산했습니다. 대회별 사용 레이아웃을 확인하세요.',notesEn:'Converted from the official 2026 IMSA mileage. Check the configuration used by each event.'});
}
for(const [key,lengthKm,url] of [
 ['las-vegas',6.201,'https://www.formula1.com/en/racing/2026/las-vegas'],
 ['lusail',5.419,'https://www.formula1.com/en/racing/2026/qatar'],
 ['yas-marina',5.281,'https://www.formula1.com/en/racing/2026/united-arab-emirates']
])Object.assign(circuitInfo[key],{lengthKm,sourceUrl:url,notes:'2026 F1 공식 서킷 정보 기준. 다른 대회는 사용 레이아웃이 다를 수 있습니다.',notesEn:'Official 2026 F1 configuration. Other championships may use a different layout.'});
// Official race start times verified 2026-10-30. Weekend ranges remain date-only.
const confirmedF1Starts = {
 interlagos: ['2026-11-08T14:00:00-03:00','https://www.formula1.com/en/latest/article/formula-1-msc-cruises-grande-premio-de-sao-paulo-2026.3nFWRAkowAY3uUyvw6O0eJ.3nFWRAkowAY3uUyvw6O0eJ.3nFWRAkowAY3uUyvw6O0eJ.3nFWRAkowAY3uUyvw6O0eJ'],
 'las-vegas': ['2026-11-21T20:00:00-08:00','https://www.formula1.com/en/latest/article/formula-1-heineken-las-vegas-grand-prix-2026.1qmWzcBwKK5hkTbYbhVC22'],
 lusail: ['2026-11-29T19:00:00+03:00','https://www.formula1.com/en/latest/article/formula-1-qatar-airways-qatar-grand-prix-2026.3XJyoYSnpJEcuZovstTdcG'],
 'yas-marina': ['2026-12-06T17:00:00+04:00','https://www.formula1.com/en/latest/article/official-grand-prix-start-times-for-2026-f1-season-confirmed.2UgPfArqH76tzlOYh21jSG.2UgPfArqH76tzlOYh21jSG']
};
for (const event of calendarEvents) {
 const confirmed=event.series==='f1' && event.start.startsWith('2026-') && confirmedF1Starts[event.circuit];
 if(confirmed)Object.assign(event,{raceStart:confirmed[0],raceTimeSource:confirmed[1]});
}
Object.assign(circuitInfo.martinsville,{
 lengthKm:0.847,sourceUrl:'https://www.kauligracing.com/news/2026/october/28/race-advance-xfinity-500',
 notes:'0.526마일(약 0.847km)의 짧은 오벌. 코너 뱅킹은 12도이며 해발고도·고저차와는 별개입니다.',
 notesEn:'A 0.526-mile (approximately 0.847 km) short oval. Corner banking is 12 degrees, distinct from altitude and elevation change.'
});
circuitInfo.monza.elevationChangeM=12.8;
circuitInfo.monza.sources=[circuitInfo.monza.sourceUrl,'https://www.formula1.com/en/latest/article/highs-and-lows-which-f1-track-has-the-most-elevation-changes-.7I9JEcBw3R2AqXbnJ6hyvc.7I9JEcBw3R2AqXbnJ6hyvc'];

// Track-specification gaps researched against FIA/organiser sources on 2026-10-30.
// Layout-specific values only: never copy an F1/GP distance into an unconfirmed FE layout.
const fiaCircuitList='https://www.fia.com/sites/default/files/circuits_fia20260331_0.pdf';
const verifiedCircuitLengths={
 'albert-park':5.278,portimao:4.653,bahrain:5.412,baku:6.003,barcelona:4.657,
 dubai:5.39,fuji:4.563,hungaroring:4.381,imola:4.909,jerez:4.428,
 'magny-cours':4.411,miami:5.412,montreal:4.361,mugello:5.245,
 'nurburgring-gp':5.148,sepang:5.543,silverstone:5.891,spa:7.004,zandvoort:4.259,
 autopolis:4.674,barber:3.83,'brands-hatch':3.916,donington:4.003,jarama:3.85,
 misano:4.226,okayama:3.703,sonoma:3.685,sugo:3.704,sydney:3.905,
 'the-bend':4.95,adelaide:3.22,darwin:2.87,mandalika:4.3,bathurst:6.213,
 'oulton-park':4.332,'phillip-island':4.48
};
for(const [key,lengthKm] of Object.entries(verifiedCircuitLengths)){
 if(!circuitInfo[key]||circuitInfo[key].lengthKm!=null)continue;
 Object.assign(circuitInfo[key],{lengthKm,sourceUrl:fiaCircuitList,reviewedAt:'2026-10-30',
  notes:'FIA 공인 서킷 목록(2026-03-31)의 해당 레이아웃 기준. 대회별 계측 길이 및 사용 레이아웃은 공식 경기 문서를 우선합니다.',
  notesEn:'Matching layout from the FIA licensed-circuit list dated 2026-03-31. Event documents take precedence for race-specific measurements and configurations.'});
}
const organiserCircuitFacts=[
 ['suzuka',5.807,'https://www.suzukacircuit.jp/eng/course_s/','4륜 그랑프리 코스 기준.','Four-wheel Grand Prix configuration.'],
 ['le-mans',13.626,'https://www.fiawec.com/en/race/24-hours-of-le-mans-2026','르망 24시간 풀 코스이며 부가티 서킷과 다릅니다.','Full 24 Hours layout, distinct from the Bugatti circuit.'],
 ['red-bull-ring',4.318,'https://www.formula1.com/en/information/austria-red-bull-ring-spielberg.1s7EC2bGta7o1thZkVPbbq','F1 공식 계측 길이 기준.','Official F1 measured lap distance.'],
 ['singapore',4.94,'https://www.mercedesamgf1.com/news/what-are-the-tyre-options-for-the-2026-singapore-gp','2026 싱가포르 GP 팀 프리뷰의 현재 레이아웃 기준.','Current layout from the team’s 2026 Singapore GP preview.'],
 ['cota',5.513,'https://www.lamborghini.com/en-en/motorsport/super-trofeo/calendar-%26-results/circuit-of-the-americas','20개 코너의 그랑프리 코스. 단축 코스와 구분합니다.','20-turn Grand Prix course, distinct from short configurations.'],
 ['queensland',3.126,'https://www.qldraceways.com.au/about','내셔널 코스 기준.','National circuit configuration.'],
 ['homestead',2.414,'https://www.homesteadmiamispeedway.com/track-history/','NASCAR 1.5마일 오벌을 km로 환산했습니다. 인필드 로드 코스와 다릅니다.','NASCAR 1.5-mile oval converted to km; not the infield road course.'],
 ['snetterton',4.78,'https://btcc.net/circuit/snetterton/','300 코스의 공식 2.97마일을 km로 환산·반올림했습니다.','Official 2.97-mile 300 circuit converted and rounded to km.']
];
for(const [key,lengthKm,sourceUrl,notes,notesEn] of organiserCircuitFacts){
 if(circuitInfo[key])Object.assign(circuitInfo[key],{lengthKm,sourceUrl,notes,notesEn,reviewedAt:'2026-10-30'});
}
for(const [key,lengthKm,sourceUrl,notes,notesEn] of [
 ['monaco',3.337,'https://www.formula1.com/en/information/monaco-circuit-de-monaco-monte-carlo.2ZWRtIcSI6ZzVGX1uGRpkJ','F1 공식 계측 길이 기준.','Official F1 measured lap distance.'],
 ['madrid',5.474,'https://www.mclaren.com/racing/formula-1/2026/spanish-grand-prix/','2026 스페인 GP 팀 프리뷰 기준.','From the team’s 2026 Spanish GP preview.'],
 ['nurburgring-24h',25.378,'https://www.24h-rennen.de/en/2026/05/11/festival-week-2026/','24시간 레이스 조합 코스이며 NLS 정규 코스와 다릅니다.','24-hour combined configuration, distinct from the regular NLS layout.'],
 ['paul-ricard',5.771,'https://www.gt-world-challenge-europe.com/documents/notice/9013/78-67f9622482414f5975e34ee8-11-04-2025-18-40.pdf','GTWC 공식 브리핑의 레이아웃 길이. 대회별 시케인 구성을 확인하세요.','Layout distance from the official GTWC briefing; verify event-specific chicane configuration.']
])Object.assign(circuitInfo[key],{lengthKm,sourceUrl,notes,notesEn,reviewedAt:'2026-10-30'});

for(const event of events){const allocation=wecTyreAllocations(event);if(allocation)event.tyreAllocations=allocation;}

