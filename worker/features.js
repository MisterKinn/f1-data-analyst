// Site feature switches. A switched-off feature is hidden and unusable, but its code stays
// in place so it can come back by flipping the switch (owner decision, 2026-11-07).
//   liveTiming: F1/WEC live timing — /live, FIAWEC+ 연결, live briefing and live MCP tools,
//               collector hosts/kit/status, live upload endpoints. The scheduled GitHub
//               collectors are paused separately by the repository variable
//               LIVE_TIMING_ENABLED (set it to 'true' to run them again).
//   fullSite:   home sections other than "이번 주의 모터스포츠", the 이용 방법 menu/page and
//               the About page text other than the CI.
// Tests (and CI) run with KONGBODA_FEATURES=all so the hidden code stays tested.
const all=typeof process!=='undefined'&&process.env?.KONGBODA_FEATURES==='all';
export const FEATURES={liveTiming:all,fullSite:all};
