import './mexico-sector-map.js';
import {trackMaps} from './track-map-data.js';
// Source facts checked 2026-10-30. Preview is explicitly not live data.
export const expandedCases=[{
 chart:'map',series:'F1',session:'F1 · Mexico City · 2026 · Technical preview',
 questionKo:'이번 멕시코시티 GP 맵을 기술적으로 읽어줘. 어디서 승부가 갈릴 것 같아?',
 questionEn:'Read this Mexico City GP map technically. Where is performance likely to be won?',
 answerKo:'긴 직선의 최고속도만큼 S2 연결과 S3 탈출이 중요할 것 같습니다. 고지대에서는 공력 하중·냉각이 줄고, 재포장 구간은 그립 변화가 클 수 있습니다. C3·C4·C5와 낮은 타이어 부담은 1스톱을 지지하지만 단정할 수 없습니다. 첫 롱런의 노면 온도·슬립·페이스 추세로 판단을 갱신해야 합니다.',
 answerEn:'S2 flow and S3 exits may matter as much as top speed. Altitude cuts aero load and cooling; new asphalt adds grip uncertainty. C3/C4/C5 and low tyre severity favour one stop, but not conclusively. Track temperature, slip and first long runs could change that outlook.',
 titleKo:'4.304 km · 3개 섹터를 읽는 법',titleEn:'4.304 km · reading three sectors',
 unitKo:'S1 빨강 · S2 파랑 · S3 노랑 · 길이 비율 기반 개략도, 정확한 경계는 FIA 도면',unitEn:'S1 red · S2 blue · S3 yellow · length-based schematic; exact boundaries: FIA map',
 imageUrl:trackMaps.mexico.imageUrl,sourceUrl:trackMaps.mexico.officialMapUrl,
 links:[{label:'Pirelli · 28 Oct',url:'https://press.pirelli.com/mexico-new-asphalt-and-the-softest-compound-trio/'},{label:'F1 · circuit guide',url:'https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-autodromo-hermanos-rodriguez.4D4Jzu2UDBia3HHmFa50zv'}],
 table:{headersKo:['구간','길이','해석 포인트'],headersEn:['Sector','Length','Focus'],rows:[['S1','1.914 km','직선·제동','Straights / braking'],['S2','1.494 km','연속 코너·균형','Corner flow / balance'],['S3','0.896 km','저속 탈출·접지력','Slow exits / traction']]},
 factsKo:[['OT 감지 / 활성화','T15 중간 / T17 중간'],['SM 일반 그립','T17+70m · T3+150m · T11+70m'],['재포장','T7–T16 · T16–T1'],['분석 시점','세션 전 전망 · 실시간 온도 없음']],
 factsEn:[['OT detection / activation','Mid-T15 / Mid-T17'],['SM normal grip','T17+70m · T3+150m · T11+70m'],['Resurfaced','T7–T16 · T16–T1'],['Context','Pre-session · no live temperatures']],
}];
