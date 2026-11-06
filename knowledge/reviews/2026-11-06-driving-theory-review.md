# 주행 이론 공개 자료 검토 — 2026-11-06

목표: 레이싱 라인·제동과 턴인·트레일 브레이킹·g-g(결합 그립)·드라이버 조작 특성에 관한 무료 자료를 커넥터 지식팩에 넣는다. 기존 원칙대로 **무료 열람과 재사용 권리를 구분**하고, 해당 버전에 CC BY 4.0 문구가 직접 보이는 자료만 승인한다. 모든 페이지는 Firecrawl로 열람했다.

## 승인 (topic: driving)

| ID | 자료 | 라이선스 확인 위치 |
|---|---|---|
| K16 | van Leeuwen et al. 2017, PLOS ONE, DOI 10.1371/journal.pone.0186871 | 기사 Copyright 문단 |
| K17 | Bári & Palkovics 2026, AI Open, DOI 10.1016/j.aiopen.2026.02.007 | 기사 상단 Creative Commons 링크 |
| K18 | Montani et al. 2021, Energies, DOI 10.3390/en14196008 | 본문 끝 라이선스 문구 |
| K19 | Domenighini et al. 2023, Designs, DOI 10.3390/designs7030065 | 본문 끝 라이선스 문구 |
| K20 | Jiménez Elbal et al. 2024, WEVJ, DOI 10.3390/wevj15080366 | 본문 끝 라이선스 문구 |
| K21 | Domina & Tihanyi 2022, Sensors, DOI 10.3390/s22155807 | 본문 끝 라이선스 문구, Crossref |
| K22 | Lappi 2018, Front. Psychol., DOI 10.3389/fpsyg.2018.01294 | Copyright 문단 링크가 /by/4.0/ |
| K23 | Lappi 2015, Front. Hum. Neurosci., DOI 10.3389/fnhum.2015.00635 | Copyright 문단 링크가 /by/4.0/ |

MDPI HTML 메타 태그는 3.0으로 나오지만, 화면에 인쇄된 라이선스 문구와 Crossref가 4.0이므로 4.0으로 기록했다. 기존 K06·K15에도 `driving` 태그를 추가했다. 카드는 한국어 각색 요약이며, 도표·데이터·코드·가중치는 복사하지 않았다.

## 후보 (승인 아님)

- **C09** Kegelman, Harbott, Gerdes 2017 (VSD). 본문은 공개되어 있지만 CC BY 4.0이 Crossref 메타데이터에만 있고, 기사 HTML과 PDF 1–3쪽에서는 CC 문구가 확인되지 않았다. 출판사 Licensing 탭을 직접 확인하면 승격할 수 있다.
- **C10** Lin, Siampis, Velenis 2024 (VSD). 메타데이터상 CC BY 4.0이지만 본문을 확보하지 못했다.

## 보류 (권리 미충족)

R13–R14 van den Eshof et al. arXiv(CC BY-NC-ND 4.0), R15 Kapania et al.(arXiv 비독점 배포·ASME 유료), R16 Heilmeier et al., R17 Christ et al., R18 Lovato & Massaro, R19 Perantoni & Limebeer(이상 T&F 유료), R20–R22 Velenis 트레일 브레이킹 논문(SAE·Elsevier·IEEE), R23 Casanova 학위논문(무료 열람 가능하나 복제 금지 명시), R24 Gabiccini et al. GP2 주행 스타일(Springer 구독).

TUMFTM `global_racetrajectory_optimization` 코드는 LGPL-3.0이며 논문 본문 권리와 별개다. 이번 지식팩에는 코드를 넣지 않았다.

## 수록하지 않은 자료

Going Faster!, Speed Secrets 시리즈, Segers의 데이터 분석서 같은 유료 도서와, Paradigm Shift·Speed Secrets 블로그처럼 무료로 읽을 수 있지만 모든 권리가 유보된 글은 요약 카드로 만들지 않았다.

## 반영 범위

카탈로그 1.5: 승인 27, 후보 6, 보류 24. `research_lookup`에 `driving` 토픽을 추가하고, 주행 질문에서는 공개 텔레메트리(조향각·브레이크 압력·슬립 없음)로 특정 기법을 증명하지 않도록 답변 지침을 보강했다. 모델 실행·재학습은 없다. PR 저장, CI, 운영 배포는 서로 다른 상태다.

## 추가 승인 (같은 날)

- **K24** Kegelman, Harbott, Gerdes 2017 (C09에서 승격). 출판사 Licensing 탭에서 CC BY 4.0 문구를 직접 확인했다. 공개 데이터셋(ODC-By)은 논문과 별도의 권리이며 복제하지 않았다.
