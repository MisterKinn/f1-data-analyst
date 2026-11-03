// Small factual extracts from official 2026 session records; checked 2026-10-30.
// Historical replay only. Sector rows below belong to each car's actual best lap.
export const demoCases=[
  {
    "session": "F1 · Australia · 2026-03-07 · Q3",
    "questionKo": "Q3가 끝났어. 러셀과 안토넬리의 차이는 얼마나 나?",
    "questionEn": "Q3 is over. How close are Russell and Antonelli?",
    "answerKo": "러셀은 1:18.518, 안토넬리는 1:18.811로 0.293초 차이입니다. 하자르는 1:19.303으로 러셀보다 0.785초 뒤입니다. 이 기록은 Q3 최고 랩이며, 레이스 페이스를 뜻하지는 않습니다.",
    "answerEn": "Russell records 1:18.518 and Antonelli 1:18.811, a 0.293s gap. Hadjar’s 1:19.303 is 0.785s behind Russell. These are Q3 best laps, not race pace.",
    "titleKo": "Q3 최고 랩",
    "titleEn": "Q3 best laps",
    "unitKo": "랩타임 · 낮을수록 빠름",
    "unitEn": "Lap time · lower is faster",
    "sourceUrl": "https://www.formula1.com/en/results/2026/races/1279/australia/qualifying",
    "values": [
      {
        "label": "George Russell",
        "value": 78.518,
        "display": "1:18.518",
        "color": "#27F4D2"
      },
      {
        "label": "Kimi Antonelli",
        "value": 78.811,
        "display": "1:18.811",
        "color": "#27F4D2"
      },
      {
        "label": "Isack Hadjar",
        "value": 79.303,
        "display": "1:19.303",
        "color": "#4781D7"
      }
    ]
  },
  {
    "session": "WEC · Imola · 2026-04-18 · Hyperpole",
    "questionKo": "하이퍼폴 선두 페라리 #51과 토요타 #8, 얼마나 접전이야?",
    "questionEn": "How close are Ferrari #51 and Toyota #8 in Hyperpole?",
    "answerKo": "조비나치의 #51은 1:30.127, 히라카와의 #8은 1:30.138입니다. 차이는 0.011초. #50 페라리는 1:30.167로 선두와 0.040초 차이입니다.",
    "answerEn": "Giovinazzi’s #51 records 1:30.127; Hirakawa’s #8 posts 1:30.138, only 0.011s apart. Ferrari #50 is 0.040s off pole at 1:30.167.",
    "titleKo": "하이퍼폴 최고 랩",
    "titleEn": "Hyperpole best laps",
    "unitKo": "랩타임 · 낮을수록 빠름",
    "unitEn": "Lap time · lower is faster",
    "sourceUrl": "https://fiawec.alkamelsystems.com/Results/15_2026/01_IMOLA/645_FIA%20WEC/202604181530_Hyperpole%20HYPERCAR/13_BestSectors_Hyperpole%20HYPERCAR.PDF",
    "values": [
      {
        "label": "#51 · Giovinazzi",
        "value": 90.127,
        "display": "1:30.127",
        "color": "#E8002D"
      },
      {
        "label": "#8 · Hirakawa",
        "value": 90.138,
        "display": "1:30.138",
        "color": "#FFFFFF"
      },
      {
        "label": "#50 · Fuoco",
        "value": 90.167,
        "display": "1:30.167",
        "color": "#E8002D"
      }
    ]
  },
  {
    "session": "WEC · Imola · 2026-04-18 · Hyperpole",
    "questionKo": "#51과 #8은 어느 섹터에서 차이가 났어?",
    "questionEn": "Which sector separates #51 and #8?",
    "answerKo": "각 차량의 실제 최고 랩을 비교하면 #51은 S1에서 0.046초, S3에서 0.053초 느렸지만 S2에서 0.110초 빨랐습니다. 합계 0.011초 우위입니다. 서로 다른 랩의 최고 섹터를 합친 가상 랩과 구분했습니다.",
    "answerEn": "On their actual best laps, #51 loses 0.046s in S1 and 0.053s in S3 but gains 0.110s in S2: 0.011s faster overall. These are matched-lap sectors, not an ideal lap assembled from different laps.",
    "titleKo": "최고 랩의 S2 비교",
    "titleEn": "S2 on each actual best lap",
    "unitKo": "S2 · 초 · 낮을수록 빠름",
    "unitEn": "S2 · seconds · lower is faster",
    "sourceUrl": "https://fiawec.alkamelsystems.com/Results/15_2026/01_IMOLA/645_FIA%20WEC/202604181530_Hyperpole%20HYPERCAR/23_Analysis_Hyperpole%20HYPERCAR.PDF",
    "values": [
      {
        "label": "#51 · Lap 7 · S2",
        "value": 29.591,
        "display": "29.591s",
        "color": "#E8002D"
      },
      {
        "label": "#8 · Lap 6 · S2",
        "value": 29.701,
        "display": "29.701s",
        "color": "#FFFFFF"
      }
    ]
  },
  {
    "session": "F1 · Australia · 2026-03-08 · Race · Lap 12",
    "questionKo": "방금 함께 들어간 메르세데스 두 대, 피트 구간 시간 차이는?",
    "questionEn": "Both Mercedes cars just pitted. What is the pit-lane time gap?",
    "answerKo": "12랩 공식 피트 기록은 러셀 17.794초, 안토넬리 20.985초로 3.191초 차이입니다. 피트 구간 시간이며 타이어 교체 정차 시간과는 다릅니다. 이 숫자만으로 작업 지연 원인을 단정할 수는 없습니다.",
    "answerEn": "The official lap-12 pit records show 17.794s for Russell and 20.985s for Antonelli, a 3.191s difference. These are pit-lane times, not stationary tyre-change times; they do not alone establish the cause.",
    "titleKo": "12랩 피트 구간",
    "titleEn": "Lap-12 pit-lane times",
    "unitKo": "초 · 정차 작업 시간 아님",
    "unitEn": "Seconds · not stationary service time",
    "sourceUrl": "https://www.formula1.com/en/results/2026/races/1279/australia/pit-stop-summary",
    "values": [
      {
        "label": "George Russell",
        "value": 17.794,
        "display": "17.794s",
        "color": "#27F4D2"
      },
      {
        "label": "Kimi Antonelli",
        "value": 20.985,
        "display": "20.985s",
        "color": "#27F4D2"
      }
    ]
  }
];
