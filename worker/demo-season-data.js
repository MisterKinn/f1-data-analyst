// Official Formula 1 / FIA records checked 2026-10-30.
export const seasonCases=[
  {
    "id": "us-2026-q3-temperature",
    "chart": "table",
    "session": "F1 · 2026 United States GP · Qualifying",
    "questionKo": "Q2 선두 르클레르가 Q3에서 밀린 건 차가 갑자기 느려져서일까?",
    "questionEn": "Why did Leclerc fall back in Q3 after topping Q2? Did Ferrari suddenly lose pace?",
    "answerKo": "차의 기본 성능보다 타이어 준비와 돌풍의 영향이 컸을 것 같습니다. 르클레르는 Q2보다 0.069초 느려졌고 안토넬리는 0.243초 개선했습니다. 르클레르도 Q3 워밍업 문제를 언급했습니다. 온도가 안정되면 격차가 줄 가능성은 있지만, 타이어 실측 없이 원인을 단정할 수는 없습니다.",
    "answerEn": "Tyre preparation and gusts likely mattered more than a sudden loss of car pace. Leclerc lost 0.069s from Q2 while Antonelli gained 0.243s; Leclerc reported Q3 warm-up trouble. More stable preparation could narrow the gap, but this does not establish tyre temperature or guarantee the order.",
    "titleKo": "Q2 → Q3 기록 변화",
    "titleEn": "Q2 → Q3 best-lap changes",
    "table": {
      "headersKo": [
        "드라이버",
        "Q2",
        "Q3",
        "변화"
      ],
      "headersEn": [
        "Driver",
        "Q2",
        "Q3",
        "Change"
      ],
      "rows": [
        [
          "ANT",
          "1:34.278",
          "1:34.035",
          "−0.243s"
        ],
        [
          "VER",
          "1:34.471",
          "1:34.214",
          "−0.257s"
        ],
        [
          "HAD",
          "1:34.887",
          "1:34.250",
          "−0.637s"
        ],
        [
          "LEC",
          "1:34.198",
          "1:34.267",
          "+0.069s"
        ],
        [
          "HAM",
          "1:34.833",
          "1:34.311",
          "−0.522s"
        ],
        [
          "RUS",
          "1:34.305",
          "1:34.476",
          "+0.171s"
        ]
      ]
    },
    "factsKo": [
      [
        "관측",
        "Q3 폴 격차 0.179초"
      ],
      [
        "해석",
        "음수 = Q2보다 개선"
      ],
      [
        "해석",
        "돌풍·타이어 준비 영향 검토"
      ]
    ],
    "factsEn": [
      [
        "Evidence",
        "Pole margin 0.179s"
      ],
      [
        "Context",
        "Negative = faster than Q2"
      ],
      [
        "Context",
        "Check gusts and tyre preparation"
      ]
    ],
    "unitKo": "단계별 최고 기록 · 타이어·노면 미보정",
    "unitEn": "Segment bests · tyre / track differences uncorrected",
    "sourceUrl": "https://www.formula1.com/en/results/2026/races/1297/united-states/qualifying",
    "links": [
      {
        "label": "FIA · Driver evidence",
        "url": "https://api.fia.com/news/f1-2026-united-states-grand-prix-post-race-press-conference-transcript"
      },
      {
        "label": "F1 · Qualifying report",
        "url": "https://www.formula1.com/en/latest/article/antonelli-seizes-pole-position-ahead-of-verstappen-in-qualifying-at-the-united-states-gp.4xdH4w09GhNDOJdknowRAk"
      }
    ],
    "series": "F1"
  },
  {
    "id": "us-2026-one-stop",
    "chart": "table",
    "session": "F1 · 2026 United States GP · Race",
    "questionKo": "안토넬리의 원스톱은 왜 통했고, 노리스는 왜 후반에 밀렸을까?",
    "questionEn": "Why did Antonelli make one stop work while Norris faded late in the race?",
    "answerKo": "원스톱 자체보다 첫 스틴트를 얼마나 버텼는지가 중요했을 것 같습니다. 안토넬리는 24랩, 노리스는 16랩에 교체해 마지막 스틴트 길이가 8랩 달랐습니다. 하드가 버텨주면 정차를 줄이는 편이 유리하지만, 열화·트래픽이 커지면 뒤집힙니다. 타이어 나이만으로 원인을 단정할 수는 없습니다.",
    "answerEn": "First-stint length likely helped: Antonelli stopped on lap 24, Norris on lap 16, leaving an eight-lap difference in final-stint length. Avoiding another stop pays if pace holds; degradation or traffic can reverse that trade-off. Tyre age alone cannot establish the cause.",
    "titleKo": "정차 시점과 최종 결과",
    "titleEn": "Stop timing and race outcome",
    "table": {
      "headersKo": [
        "드라이버",
        "정차 랩",
        "정차 수",
        "최종 격차"
      ],
      "headersEn": [
        "Driver",
        "Stop laps",
        "Stops",
        "Final gap"
      ],
      "rows": [
        [
          "ANT",
          "24",
          "1",
          "Winner"
        ],
        [
          "LEC",
          "15 · 39",
          "2",
          "+13.078s"
        ],
        [
          "VER",
          "13 · 31",
          "2",
          "+17.485s"
        ],
        [
          "HAM",
          "14 · 38",
          "2",
          "+18.515s"
        ],
        [
          "NOR",
          "16",
          "1",
          "+30.521s"
        ],
        [
          "HAD",
          "25",
          "1",
          "+34.373s"
        ]
      ]
    },
    "factsKo": [
      [
        "관측",
        "총 56랩"
      ],
      [
        "해석",
        "ANT 최종 스틴트 32랩"
      ],
      [
        "해석",
        "NOR 최종 스틴트 40랩"
      ]
    ],
    "factsEn": [
      [
        "Evidence",
        "56 laps"
      ],
      [
        "Context",
        "ANT final stint 32 laps"
      ],
      [
        "Context",
        "NOR final stint 40 laps"
      ]
    ],
    "unitKo": "공식 정차·결과 · 최종 격차 ≠ 순수 페이스",
    "unitEn": "Official stops / results · final gap ≠ pure pace",
    "sourceUrl": "https://www.formula1.com/en/results/2026/races/1297/united-states/pit-stop-summary",
    "links": [
      {
        "label": "F1 · Race result",
        "url": "https://www.formula1.com/en/results/2026/races/1297/united-states/race-result"
      },
      {
        "label": "FIA · Race report",
        "url": "https://api.fia.com/news/f1-antonelli-takes-controlled-cota-win-ahead-leclerc-and-verstappen-close-f1-drivers-title"
      }
    ],
    "series": "F1"
  },
  {
    "id": "japan-2026-mclaren",
    "chart": "table",
    "session": "F1 · 2026 Japanese GP · Qualifying",
    "questionKo": "스즈카에서 피아스트리가 러셀에 0.056초 차이인데, 맥라렌도 우승을 노릴 만할까?",
    "questionEn": "Piastri is only 0.056s behind Russell at Suzuka. Can McLaren challenge for victory?",
    "answerKo": "포디엄 경쟁은 충분히 가능하지만, 정면 승부에서는 메르세데스가 유리할 것 같습니다. 피아스트리는 러셀과 0.056초 차이지만 안토넬리와는 0.354초입니다. 노리스는 고연료 주행도 부족했습니다. 맥라렌이 첫 스틴트에서 따라붙고 열화를 억제하면 전략 기회가 생기겠지만, 퀄리파잉만으로 우승 페이스를 단정할 수는 없습니다.",
    "answerEn": "A podium challenge looks realistic, but Mercedes remains the stronger baseline: Piastri is 0.056s behind Russell and 0.354s behind Antonelli. Norris also lacks high-fuel preparation. Staying close with controlled degradation could open a strategic chance; qualifying alone cannot establish winning race pace.",
    "titleKo": "스즈카 Q3 상위 6명",
    "titleEn": "Suzuka Q3 top six",
    "table": {
      "headersKo": [
        "드라이버",
        "팀",
        "Q3",
        "폴 대비"
      ],
      "headersEn": [
        "Driver",
        "Team",
        "Q3",
        "To pole"
      ],
      "rows": [
        [
          "ANT",
          "Mercedes",
          "1:28.778",
          "—"
        ],
        [
          "RUS",
          "Mercedes",
          "1:29.076",
          "+0.298s"
        ],
        [
          "PIA",
          "McLaren",
          "1:29.132",
          "+0.354s"
        ],
        [
          "LEC",
          "Ferrari",
          "1:29.405",
          "+0.627s"
        ],
        [
          "NOR",
          "McLaren",
          "1:29.409",
          "+0.631s"
        ],
        [
          "HAM",
          "Ferrari",
          "1:29.567",
          "+0.789s"
        ]
      ]
    },
    "factsKo": [
      [
        "관측",
        "PIA ↔ RUS 0.056초"
      ],
      [
        "해석",
        "PIA ↔ ANT 0.354초"
      ],
      [
        "해석",
        "노리스 고연료 주행 부족"
      ]
    ],
    "factsEn": [
      [
        "Evidence",
        "PIA ↔ RUS 0.056s"
      ],
      [
        "Context",
        "PIA ↔ ANT 0.354s"
      ],
      [
        "Context",
        "Norris lacked high-fuel running"
      ]
    ],
    "unitKo": "퀄리파잉 종료 시점의 조건부 전망. 레이스 결과를 예측 근거로 소급 사용하지 않습니다.",
    "unitEn": "Conditional outlook at qualifying end; race results are not used retrospectively as prediction evidence.",
    "sourceUrl": "https://www.formula1.com/en/results/2026/races/1281/japan/qualifying",
    "links": [
      {
        "label": "F1 · Team reports",
        "url": "https://www.formula1.com/en/latest/article/what-the-teams-said-qualifying-in-japan-2026.uxt6saBn0UBNt1LEszAYt.uxt6saBn0UBNt1LEszAYt"
      },
      {
        "label": "Research · C02",
        "url": "https://www.mdpi.com/2076-3417/10/21/7805"
      }
    ],
    "series": "F1"
  }
];
