// Official regulations and sources reviewed 2026-10-30.
export const everydayCases = [
  {
    "series": "KONGBODA",
    "logo": "/assets/brand-icon.svg",
    "session": "Weekly schedule · 안내",
    "chart": "table",
    "weekly": true,
    "questionKo": "이번 주 주요 모터스포츠 일정을 공지해줘.",
    "questionEn": "Give me this week’s main motorsport schedule.",
    "answerKo": "공식 일정에서 이번 주 경기를 골라 세션 시작 시간을 한국시간으로 정리할게요. F1뿐 아니라 GT·내구·랠리도 함께 확인할 수 있어요. 방송 시작 시간과 경기 시작 시간은 다를 수 있습니다.",
    "answerEn": "Here are this week’s verified events, with session start times rather than broadcast times. The schedule includes single-seaters, GT, endurance and rally events.",
    "titleKo": "이번 주 주요 일정",
    "titleEn": "This week’s highlights",
    "unitKo": "공식 자료에 확인된 일정 · 기기 현지시간",
    "unitEn": "Verified schedule · your local time",
    "table": {
      "headersKo": [
        "대회",
        "주요 세션"
      ],
      "headersEn": [
        "Event",
        "Key session"
      ],
      "rows": []
    },
    "factsKo": [
      [
        "무엇을 볼까?",
        "관심 대회와 세션부터"
      ],
      [
        "무료 중계",
        "확인된 YouTube 링크 제공"
      ]
    ],
    "factsEn": [
      [
        "Where to start",
        "Pick a series and session"
      ],
      [
        "Free streams",
        "Verified YouTube links"
      ]
    ],
    "sourceUrl": "https://www.formula1.com/en/racing/2026"
  },
  {
    "series": "GTWC",
    "logo": "/assets/gtwc-official.svg",
    "session": "GTWC Europe · 드라이버 등급과 출전 조합",
    "chart": "table",
    "questionKo": "GTWC의 Gold·Silver는 누가 정해? 같은 GT3인데 차량마다 컵이 다른 이유는?",
    "questionEn": "Who assigns Gold and Silver ratings, and why do identical GT3 cars enter different cups?",
    "answerKo": "차량 성능 등급이 아니라 드라이버의 FIA 카테고리입니다. 초기에는 나이와 경력을, 이후에는 실제 레이스 페이스와 성적을 평가합니다. Gold는 직업·주요 대회 경력과 동급 페이스, Silver는 나이·경력·활동과 동급 페이스 등을 종합 판단하므로 ‘Silver=아마추어’로 단정하면 안 됩니다. 차량의 컵은 탑승자 조합으로 정합니다. 오른쪽은 일반 3인 내구전의 최대 조합이며, 스프린트·스파 24시간은 별도 조항을 확인해야 합니다.",
    "answerEn": "These are FIA driver categories, not car specifications. Initial ratings use age and career; later reviews use race pace and results. Gold and Silver involve career, professional activity and comparable performance, so Silver does not simply mean amateur. The car enters a cup according to its driver line-up. The examples show maximum three-driver endurance line-ups; Sprint and Spa have separate provisions.",
    "titleKo": "개인 등급 → 차량의 출전 조합",
    "titleEn": "Driver rating → eligible car line-up",
    "unitKo": "FIA 공개 규정 2025판 §§1.8, 8.3–8.4, 9 · GTWC 2026 §§12, 111 · 요약 · Bronze°: 전직 프로 제한·라인업 승인 조건 적용",
    "unitEn": "FIA published 2025 regulations §§1.8, 8.3–8.4, 9; GTWC 2026 §§12, 111 · summary · Bronze°: former-professional restrictions and line-up approval apply",
    "table": {
      "headersKo": [
        "일반 3인 내구전",
        "최대 조합"
      ],
      "headersEn": [
        "Three-driver endurance",
        "Maximum line-up"
      ],
      "rows": [
        [
          "Pro",
          "등급 제한 없음 / Any rating"
        ],
        [
          "Gold Cup",
          "Gold + Gold + Silver"
        ],
        [
          "Silver Cup",
          "Silver + Silver + Silver"
        ],
        [
          "Bronze Cup",
          "Platinum + Silver + Bronze°"
        ]
      ]
    },
    "factsKo": [
      [
        "AF Corse",
        "페라리와 오랜 파트너십"
      ],
      [
        "관전 포인트",
        "차량 번호 · 드라이버 · 컵"
      ]
    ],
    "factsEn": [
      [
        "AF Corse",
        "Long-standing Ferrari partnership"
      ],
      [
        "Follow",
        "Car number · drivers · cup"
      ]
    ],
    "sourceUrl": "https://europeregs.sporting.gt-world-challenge.com/assets/2026GTWCSportingRegulations.pdf#page=73",
    "links": [
      {
        "label": "FIA · 등급 선정 §§8–9",
        "url": "https://www.fia.com/sites/default/files/driver_categorisation_regulations_2025_0.pdf#page=6"
      },
      {
        "label": "GTWC · SRO 예외 승인 §12",
        "url": "https://europeregs.sporting.gt-world-challenge.com/assets/2026GTWCSportingRegulations.pdf#page=28"
      }
    ]
  },
  {
    "series": "IMSA",
    "logo": "/assets/imsa-official.svg",
    "session": "IMSA · Petit Le Mans · 2026 · 사후분석",
    "chart": "line",
    "questionKo": "프티 르망 마지막 재시작 뒤 #6과 #24의 격차를 그려줘. #6이 계속 더 빨랐던 거야?",
    "questionEn": "Plot the #6–#24 gap after the final Petit Le Mans restart. Was #6 consistently faster?",
    "answerKo": "격차는 한 방향으로 벌어지지 않았습니다. 359→360랩에는 0.304초에서 0.943초로 늘었지만, 364랩에는 0.636초까지 줄었습니다. 마지막에는 1.205초였습니다. 따라서 #6의 지속적인 페이스 우위로 설명하기보다, 재시작 뒤 랩별 이득과 손실을 나눠 봐야 합니다. 그래프는 동일 랩 누적시간 차이입니다. FCY→그린 전환 랩을 포함하며 트래픽·연료·타이어는 미보정입니다.",
    "answerEn": "The gap was 0.304s at the end of lap 359. #6 gained 0.639s on the next lap, but the gap narrowed again to 0.636s by lap 364 before growing to 1.205s at the finish. This was a fluctuating defence, not a uniformly faster run. The plot subtracts elapsed times at the same lap; it does not correct traffic, fuel or tyres.",
    "titleKo": "마지막 10랩 · #24가 #6에 뒤진 시간",
    "titleEn": "Final ten laps · #24 gap behind #6",
    "unitKo": "359랩은 FCY→그린 전환 랩 · 368랩 체커기 · 동일 랩 ELAPSED 차이",
    "unitEn": "Lap 359 is the FCY-to-green transition; lap 368 finish · same-lap ELAPSED difference",
    "table": {
      "headersKo": [
        "구간",
        "격차 변화"
      ],
      "headersEn": [
        "Window",
        "Gap change"
      ],
      "rows": [
        [
          "359 → 360",
          "0.304 → 0.943s"
        ],
        [
          "360 → 364",
          "0.943 → 0.636s"
        ],
        [
          "364 → 368",
          "0.636 → 1.205s"
        ]
      ]
    },
    "factsKo": [
      [
        "계산",
        "#24 ELAPSED − #6 ELAPSED"
      ],
      [
        "비교 범위",
        "359–368랩 · 10개 지점"
      ],
      [
        "자료 한계",
        "트래픽·연료·타이어 미보정"
      ]
    ],
    "factsEn": [
      [
        "Calculation",
        "#24 ELAPSED − #6 ELAPSED"
      ],
      [
        "Window",
        "Laps 359–368 · 10 points"
      ],
      [
        "Limit",
        "Traffic / fuel / tyres uncorrected"
      ]
    ],
    "sourceUrl": "https://imsa.results.alkamelcloud.com/Results/26_2026/21_Road%20Atlanta/01_IMSA%20WeatherTech%20SportsCar%20Championship/202610031210_Race/10_Hour%2010/23_Time%20Cards_Race.CSV",
    "xLabelKo": "랩",
    "xLabelEn": "Lap",
    "yLabelKo": "격차 (초)",
    "yLabelEn": "Gap (s)",
    "yDecimals": 2,
    "tracks": [
      {
        "name": "#24 − #6",
        "color": "#27F4D2",
        "points": [
          [
            359,
            0.304
          ],
          [
            360,
            0.943
          ],
          [
            361,
            0.837
          ],
          [
            362,
            1.066
          ],
          [
            363,
            0.83
          ],
          [
            364,
            0.636
          ],
          [
            365,
            0.914
          ],
          [
            366,
            1.071
          ],
          [
            367,
            1.519
          ],
          [
            368,
            1.205
          ]
        ]
      }
    ]
  },
  {
    "series": "F1",
    "session": "F1 · Haas · 2026 초반 사후분석",
    "chart": "table",
    "questionKo": "하스 같은 중위권 팀은 우승 못 해도 뭘 보면 재미있어?",
    "questionEn": "What makes a midfield team like Haas fun to follow without a win?",
    "answerKo": "10위 싸움도 팀에는 큰 결과예요. 2026 초반 하스는 3경기 모두 득점했고, 일본에서는 오콘의 10위가 팀 포인트를 지켰습니다. 예선 한 랩, 스타트, 피트 후 라이벌 앞에 나오는지를 따라가 보세요. 경쟁 팀들이 촘촘하면 작은 운영 개선이 순위를 바꿀 가능성이 큽니다. 이는 초반 기록에 대한 해석이지 현재 순위 예측은 아닙니다.",
    "answerEn": "The fight for tenth can matter enormously. Haas scored in all three opening rounds of 2026; Ocon’s tenth place kept that run alive in Japan. Watch qualifying, starts and whether a pit stop puts the car ahead of its rival. In a tight midfield, small operational gains can swing positions. This reflects the opening rounds, not a forecast of today’s order.",
    "titleKo": "순위표 밖에서 찾는 관전 포인트",
    "titleEn": "What to watch beyond the winner",
    "unitKo": "2026 초반 3경기 기준",
    "unitEn": "Opening three rounds of 2026",
    "table": {
      "headersKo": [
        "장면",
        "확인할 것"
      ],
      "headersEn": [
        "Moment",
        "Watch for"
      ],
      "rows": [
        [
          "예선 / Qualifying",
          "Q3 진입 · Q3 entry"
        ],
        [
          "스타트 / Start",
          "첫 랩 순위 · Lap-one position"
        ],
        [
          "피트 / Pit stop",
          "라이벌과 위치 · Rival position"
        ],
        [
          "결승 / Finish",
          "10위권 득점 · Top-ten points"
        ]
      ]
    },
    "factsKo": [
      [
        "확인된 결과",
        "일본 GP 오콘 10위"
      ],
      [
        "다음 질문",
        "팀 동료와 클린 랩 비교"
      ]
    ],
    "factsEn": [
      [
        "Verified",
        "Ocon P10 in Japan"
      ],
      [
        "Next question",
        "Compare clean laps with teammate"
      ]
    ],
    "sourceUrl": "https://www.formula1.com/en/latest/article/the-state-of-play-at-haas-after-three-rounds-of-the-2026-season.3G15teoYvJ7j4LxNjtu8dN"
  },
  {
    "series": "NLS",
    "logo": "/assets/nls-official.svg",
    "session": "NLS2 · 21 Mar 2026 · 사후분석",
    "chart": "document",
    "questionKo": "NLS2 #3의 타이어 사용량을 규정 한도와 비교해줘. 어떤 기록으로 위반이 확인됐어?",
    "questionEn": "Compare NLS2 #3 tyre usage with the rule allowance. Which record established the breach?",
    "answerKo": "먼저 체커기를 받아도 규정 위반이 확인되면 공식 우승은 바뀝니다. 2026 DMSB 타이어 규정 III.c(5쪽)는 4시간 대회의 슬릭을 24개, 즉 6세트로 제한합니다. NLS 공식 발표는 #3이 7세트를 사용했고 Tyre App 검사 뒤 실격됐다고 확인했습니다. 허용량보다 1세트 초과한 셈입니다. 규정은 한도를, 공식 발표는 실제 위반과 처분을 뒷받침합니다.",
    "answerEn": "Crossing the line first does not override a rules breach. Article III.c (p5) of the 2026 DMSB tyre procedure limits a four-hour event to 24 slicks, equivalent to six sets. NLS confirmed that #3 used seven sets and was disqualified after the Tyre App check: one set over the limit. The rule establishes the allowance; the official announcement establishes the breach and sanction.",
    "titleKo": "DMSB 타이어 규정 · 해당 조항",
    "titleEn": "DMSB tyre procedure · relevant provisions",
    "unitKo": "원문 발췌와 한국어 번역·요약을 구분 · 적용 대상과 규정판 확인",
    "unitEn": "Original quote, translation and summary distinguished · verify scope and edition",
    "factsKo": [
      [
        "적용 조항",
        "DMSB III.c · 4시간 대회"
      ],
      [
        "기록 관리",
        "IV.a · Tyre App"
      ],
      [
        "처분 근거",
        "NLS 공식 실격 발표"
      ]
    ],
    "factsEn": [
      [
        "Rule",
        "DMSB III.c · four-hour event"
      ],
      [
        "Recording",
        "IV.a · Tyre App"
      ],
      [
        "Sanction evidence",
        "Official NLS announcement"
      ]
    ],
    "sourceUrl": "https://www.24h-information.de/formulare/27/Anhang-1%20zu%20Reifenhst-Antrag_Musterreifenprozedere%202026-%20final.de.pdf#page=5",
    "links": [
      {
        "label": "DMSB · 바코드 식별 원문 · p2",
        "url": "https://www.24h-information.de/formulare/27/Anhang-1%20zu%20Reifenhst-Antrag_Musterreifenprozedere%202026-%20final.de.pdf#page=2"
      },
      {
        "label": "NLS · 공식 실격 발표",
        "url": "https://www.nuerburgring-langstrecken-serie.de/language/en/2026/03/21/mercedes-amg-team-verstappen-racing-disqualified/"
      }
    ],
    "excerpt": {
      "labelKo": "원문 발췌 · I. Kennzeichnung · 2쪽",
      "labelEn": "Original excerpt · I. Identification · p2",
      "text": "Alle Reifen müssen mit je einem FIA-Barcode auf jeder Reifenflanke versehen und identifizierbar sein.",
      "translationKo": "모든 타이어는 각 측면의 FIA 바코드로 식별할 수 있어야 합니다.",
      "translationEn": "Every tyre must be identifiable by an FIA barcode on each sidewall.",
      "summaryKo": "III.c · 5쪽 요약: 해당 4시간 대회 슬릭 한도 24개(6세트). 규정은 허용량을 정하고, NLS 공식 발표는 Tyre App 점검에서 7세트 사용이 확인돼 실격됐음을 설명합니다.",
      "summaryEn": "III.c · p5 summary: 24 slicks (six sets) for the relevant four-hour event. The procedure sets the allowance; the NLS announcement confirms seven sets were used and disqualification followed a Tyre App review."
    }
  },
  {
    "series": "FORMULA E",
    "logo": "/assets/formula-e-official",
    "session": "Formula E · London R17 · 16 Aug 2026 · 사후분석",
    "chart": "line",
    "questionKo": "런던에서 베를라인은 어택 모드인데 왜 31랩이 갑자기 느려졌어?",
    "questionEn": "Why was Wehrlein suddenly slower on lap 31 in London despite Attack Mode?",
    "answerKo": "기록상 손실은 S3에 집중됐습니다. 30→31랩에 랩타임이 11.614초 늘었는데, S3 증가분만 9.716초로 약 84%입니다. 두 랩 모두 CSV의 ATTACK_MODE는 true입니다. 따라서 어택 모드 사용 여부만으로 랩타임을 설명할 수 없고, S3에서 발생한 방해·상황 변화가 우선 확인할 후보입니다. 이 CSV에는 원인이나 배터리 잔량이 없어 에너지 부족으로 단정할 수 없습니다.",
    "answerEn": "The loss is concentrated in S3. Lap 31 is 11.614s slower than lap 30; S3 accounts for 9.716s, about 84%. ATTACK_MODE is true in both rows. Mode status alone cannot explain the lap: a disruption or changed conditions in S3 is the leading area to investigate. The CSV does not establish the cause or battery state of charge.",
    "titleKo": "23–32랩 · 어택 모드 중에도 달라지는 랩타임",
    "titleEn": "Laps 23–32 · lap time varies even in Attack Mode",
    "unitKo": "ATTACK_MODE=true: 표시 구간 중 29–32랩 · 상태 표시는 작동 지속시간이 아님",
    "unitEn": "ATTACK_MODE=true on laps 29–32 in this window · flag is not activation duration",
    "table": {
      "headersKo": [
        "30 → 31랩",
        "늘어난 시간"
      ],
      "headersEn": [
        "Lap 30 → 31",
        "Time increase"
      ],
      "rows": [
        [
          "S1",
          "+0.402s"
        ],
        [
          "S2",
          "+1.496s"
        ],
        [
          "S3",
          "+9.716s"
        ],
        [
          "LAP",
          "+11.614s"
        ]
      ]
    },
    "factsKo": [
      [
        "산출",
        "S3 손실 / 전체 손실 ≈ 84%"
      ],
      [
        "기록 범위",
        "#94 · 23–32랩"
      ],
      [
        "자료 한계",
        "사건 원인·SOC 미포함"
      ]
    ],
    "factsEn": [
      [
        "Derived",
        "S3 / total loss ≈ 84%"
      ],
      [
        "Window",
        "#94 · laps 23–32"
      ],
      [
        "Limit",
        "No incident cause or SOC"
      ]
    ],
    "sourceUrl": "https://results.formulae.fia.com/api/getfile/formula-e/files/results/11_Season%2012%20-%202025-26/17_R17%20London/ABB%20FIA%20Formula%20E%20World%20Championship/202608161505_Race/23_R17%20Analysis_Race.CSV",
    "xLabelKo": "랩",
    "xLabelEn": "Lap",
    "yLabelKo": "랩타임 (초)",
    "yLabelEn": "Lap time (s)",
    "tracks": [
      {
        "name": "WEHRLEIN",
        "color": "#27F4D2",
        "points": [
          [
            23,
            72.282
          ],
          [
            24,
            72.305
          ],
          [
            25,
            72.109
          ],
          [
            26,
            77.384
          ],
          [
            27,
            78.039
          ],
          [
            28,
            73.119
          ],
          [
            29,
            72.611
          ],
          [
            30,
            69.639
          ],
          [
            31,
            81.253
          ],
          [
            32,
            77.099
          ]
        ]
      }
    ]
  }
];
