# 모터스포츠 연구 지식팩 전체 점검 — 2026-10-29

검토 브랜치의 catalog v1.4 기준: **설명 근거 19편 / 검토 후보 4편 / 권리·접근 보류 12편**, 총 35개 등록 자료. 기존 승인 15편의 주요 방법·결과·한계를 다시 열람하여 카드와 대조했고 4편을 추가했다. 모든 방정식 재유도·재실험·논문 코드 실행을 마쳤다는 뜻은 아니다. 원문 전체를 저장하거나 기반 모델을 재훈련하지 않았다.

## 라이브타이밍 적용 범위

| 분석 대상 | 현재 가능한 범위 | 추가로 필요한 것 / 금지되는 단정 |
|---|---|---|
| 페이스·스틴트 | 같은 세션의 유효 랩·타이어 나이·트래픽·플래그를 대조한 추세와 조건부 전망 | 정제된 랩 이력; 미보정 추세를 순수 타이어 열화율로 부르지 않음 |
| 피트 비교 | C02 식 (6)–(9)의 선형 손실 합산으로 pit-now/stay-out 가정 비교 | 명시적 계수·피트 및 워밍업 손실; 최적 전략·실측 예측은 아님 |
| 마모·열관리 | K03–K05/K10으로 가능한 원인을 설명하고 대안 비교 | 온도·압력·슬립·하중·고무 물성 없이는 과열·마모량 확정 불가 |
| 공력·추월 | K01/K02/K13/K14로 직선 이득과 코너 손실의 상충관계 설명 | 위치·속도·횡간격·차고·공력 맵; 갭만으로 다운포스 손실·추월 확률 계산 불가 |
| 안전차·경기 전략 | K08/K12로 SC 발생/미발생과 상대 반응에 따른 시나리오 설명 | 시대·서킷별 확률 보정과 별도 실행기; 현재 수치 확률 출력 근거 없음 |
| Formula E·전기 레이스카 | K07/K11/C01/C04로 에너지·열·회생의 제약 설명 | SOC·전류·전압·온도·규정 버전; 타이밍만으로 잔여 에너지 추정 불가 |
| 주행선·ML 검증 | K06/K15/C07로 모델 지표와 적용 분포를 검토 | 트랙·차량별 학습/검증; 위치 오차를 랩타임 오차로 바꾸지 않음 |

관측 → 논문에 근거한 조건부 해석 → 다음 관측으로 확인/반박할 기준의 순서로 답한다. 데이터로 설명의 우열을 가릴 수 있으면 방향·기간·가정·근거 있는 정성적 신뢰도를 제시한다. 원인 식별이 안 되면 분기 시나리오를 제시하며 숫자 확률을 만들어내지 않는다. 갱신 시각·세션·랩을 대조하고 오래되거나 끊긴 데이터는 현재 관측으로 쓰지 않는다.

`research_lookup`은 승인 카드 19편을 ID/검색어/주제로 조회한다. `fastf1_live_snapshot.research_context`는 기존의 고정 체크리스트이며 모든 논문이 매번 자동 첨부되는 것은 아니다. `research_pit_scenario`만 제한된 수식을 계산한다. 이번 변경에는 새 신경망·CFD·열모델·Monte Carlo 실행기가 없다.

## 승인된 전체 19편

각 항목은 저자·원문·라이선스 출처를 포함한다. 모두 지정 버전의 CC BY 4.0 본문을 바탕으로 한 한국어 요약이며 출처·라이선스 링크·변경 표시를 유지한다. 별도 권리의 그림·사진·코드·데이터·모델 가중치는 승인 범위 밖이다. 아래 적용 판단은 Kongboda의 보수적 해석이며 저자의 보증이 아니다.

### K01 — Open wheel competition car rear wing placement and underbody aerodynamic interactions: Aerodynamic design for a competitive advantage in motorsports

Rosie Joslin; George Brinklow (2025). DOI: [10.1177/17543371251384445](https://doi.org/10.1177/17543371251384445). [원문/확인 버전](https://journals.sagepub.com/doi/10.1177/17543371251384445) · [라이선스 표시 출처](https://journals.sagepub.com/doi/10.1177/17543371251384445) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** F1을 본뜬 단순화 CFD에서 리어윙 위치·각도와 언더바디의 상호작용을 조사했다. 부품 단독의 최적 조건과 차량 전체의 최적 조건은 다를 수 있고, DRS 변화도 바닥 유동에 영향을 준다. Kongboda에서는 직선 속도와 코너 성능의 상충관계를 설명하는 근거로 쓸 수 있다. 정지 바퀴·slip ground·특정 속도와 형상 등의 가정이 있으므로 실제 팀의 다운포스나 최신 차량의 성능을 역산하는 계수로 사용하지 않는다.

**활용:** 윙·바닥 상호작용 설명

**필요 입력:** 차량 형상, 공력 맵, 속도, 차고/자세.

**한계:** 단순화 CFD, 실제 팀 차량 검증 아님

**재검토/확인 위치:** CFD 형상·속도·지면 가정; 결과 및 결론 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K02 — Drag reduction by application of aerodynamic devices in a race car

Devang S. Nath; Prashant Chandra Pujari; Amit Jain; Vikas Rastogi (2021). DOI: [10.1186/s42774-020-00054-7](https://doi.org/10.1186/s42774-020-00054-7). [원문/확인 버전](https://link.springer.com/article/10.1186/s42774-020-00054-7) · [라이선스 표시 출처](https://link.springer.com/article/10.1186/s42774-020-00054-7) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 레이스카 모델의 윙·스포일러·디퓨저 조합을 CFD로 비교한다. 항력 감소와 다운포스 증대가 항상 동시에 일어나지 않는다는 교육용 근거다. 이동 지면과 특정 난류 모델을 사용한 형상별 비교이며, 보고된 항력 감소율을 실제 F1·WEC 랩타임 개선율로 바꾸면 안 된다. 원문의 속도 관련 표현을 그대로 재사용하지 않고, 계수가 일정할 때 공력은 속도의 제곱에 비례한다는 물리 조건을 명시한다. 제3자 자동차 사진은 이 자료집에 복제하지 않았다.

**활용:** 공력 장치별 역할과 trade-off 설명

**필요 입력:** 형상, 속도, 항력·양력 계수.

**한계:** 수치해석 형상 한정; 사진 별도 권리

**재검토/확인 위치:** Sections 3.2–3.3 and 4–5 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K03 — Sensitivity of Racing Tire Sliding Energy to Major Setup Changes: An Estimate Based on Standard Sensors

Daniel Chindamo; Marco Gadola; Emanuele Bonera; Paolo Magri (2021). DOI: [10.3390/en14165118](https://doi.org/10.3390/en14165118). [원문/확인 버전](https://psecommunity.org/wp-content/plugins/wpor/includes/file/2304/LAPSE-2023.34048-1v1.pdf) · [라이선스 표시 출처](https://mdpi-res.com/d_attachment/energies/energies-14-05118/article_deploy/energies-14-05118.pdf) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 타이어 힘과 슬립으로 소산 에너지를 추정하고 공력·롤 강성 등 셋업 변화의 영향을 비교한다. 표준 센서를 쓰지만 차체 제원과 타이어 모델도 필요하다. 시뮬레이터와의 비교 오차를 실제 마모량 예측 오차로 오인하면 안 된다. Kongboda에서 코너 종류와 좌우 하중에 따른 타이어 부담을 설명하는 데 유용하다. 슬라이딩 에너지, 트레드 마모, 타이어 온도, 랩타임 저하는 서로 다른 변수이며 공개 랩타임만으로 이 모델을 실행할 수 없다.

**활용:** 타이어 부담과 셋업 민감도 설명

**필요 입력:** 가속도, 휠 속도, 차량 제원, 공력 맵, Pacejka 타이어 모델.

**한계:** 준정상 모델; 댐퍼 영향 생략; 실제 마모 직접 예측 아님

**재검토/확인 위치:** 준정상 모델; 설정 민감도; 상용 시뮬레이터와 비교 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K04 — Integrated Thermomechanical Analysis of Tires and Brakes for Vehicle Dynamics and Safety

Andrea Stefanelli; Marco Aprea; Fabio Carbone; Fabio Romagnuolo; Pietro Caresia; Raffaele Suero (2024). DOI: [10.3390/vehicles6030077](https://doi.org/10.3390/vehicles6030077). [원문/확인 버전](https://www.megaride.eu/wp-content/uploads/2024/09/vehicles-06-00077-v2.pdf) · [라이선스 표시 출처](https://www.megaride.eu/wp-content/uploads/2024/09/vehicles-06-00077-v2.pdf) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 브레이크·림·내부 공기·타이어 사이의 열 전달을 결합하고 센서 실험과 비교한다. 안전차 뒤 재출발, 워밍업, 압력 변화의 가능한 기전을 설명할 근거다. 힘·슬립·캠버·온도·트레드 두께 등 많은 입력이 필요하고 특정 Toyo 타이어 실험이므로 최적 온도를 F1 타이어에 전용하지 않는다. 논문 공개가 thermoRIDE 소프트웨어나 원시 실험 데이터의 이용 허가를 뜻하지 않는다.

**활용:** 열관리 설명 및 관측 불확실성 표시

**필요 입력:** 타이어 힘/슬립, 캠버, 브레이크 온도, 외기/노면 온도, 압력, 트레드 두께.

**한계:** 특정 시험 타이어; 소프트웨어 별도 권리

**재검토/확인 위치:** 계측·보정 방법; Section 4 Results Validation 및 결론 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K05 — Tyre wear model: A fusion of rubber viscoelasticity, road roughness, and thermodynamic state

Aleksandr Sakhnevych; Andrea Genovese (2024). DOI: [10.1016/j.wear.2024.205291](https://doi.org/10.1016/j.wear.2024.205291). [원문/확인 버전](https://www.megaride.eu/wp-content/uploads/2024/05/1-s2.0-S0043164824000565-main.pdf) · [라이선스 표시 출처](https://www.megaride.eu/wp-content/uploads/2024/05/1-s2.0-S0043164824000565-main.pdf) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 고무 점탄성, 노면 거칠기, 온도와 누적 피로를 연결해 트레드 마모를 계산하고 여러 차종 데이터와 비교한다. 같은 랩 수라도 마모가 달라지는 이유를 설명할 수 있다. 원시 데이터는 비공개이며 화학적·열기계적 열화의 모든 물성 변화를 다루지 않는다. 결과표의 평균 오차와 개별 바퀴 오차를 구분해야 한다. 표에 7% 값도 있어 모든 경우 오차가 5% 미만이라고 홍보해서는 안 된다. 트레드 감소량 모델을 곧바로 랩타임 열화 모델로 부르면 안 된다.

**활용:** 물리적 마모와 성능 열화 구분

**필요 입력:** 고무 물성, 노면 거칠기 스펙트럼, 접촉 응력, 온도 이력.

**한계:** 비공개 데이터; 모든 열화 기전 포함 아님

**재검토/확인 위치:** 열·접촉 모델; Table 2 및 Section 5 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K06 — Comparing driving behavior of humans and autonomous driving in a professional racing simulator

Adrian Remonda; Eduardo Veas; Granit Luzhnica (2021). DOI: [10.1371/journal.pone.0245320](https://doi.org/10.1371/journal.pone.0245320). [원문/확인 버전](https://pmc.ncbi.nlm.nih.gov/articles/PMC7857611/) · [라이선스 표시 출처](https://pmc.ncbi.nlm.nih.gov/articles/PMC7857611/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 시뮬레이터에서 사람의 조작 특징과 랩타임 관계 및 강화학습 운전을 분석한다. 13명·258랩에서 선형 회귀의 평균 절대 오차가 약 3.64초였으며, 타이어 마모와 연료 소비는 비활성화했다. 이 결과를 실제 F1 레이스 예측 정확도 97%라고 제시하면 안 된다. 브레이킹·스로틀·조향 특징을 설명하는 데 유용하지만 사람 모델이 다른 운전 정책에 일반화되는지 별도로 확인해야 한다.

**활용:** 랩타임과 운전 특징의 관계 설명

**필요 입력:** 브레이크, 스로틀, 조향, RPM, 랩 구간.

**한계:** 시뮬레이터; 연료/타이어 변화 미포함; 실전 검증 아님

**재검토/확인 위치:** 시뮬레이터 조건; 회귀 평가; fuel/wear disabled 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K07 — Formula-E race strategy development using artificial neural networks and Monte Carlo tree search

Xuze Liu; Abbas Fotouhi (2020). DOI: [10.1007/s00521-020-04871-1](https://doi.org/10.1007/s00521-020-04871-1). [원문/확인 버전](https://link.springer.com/article/10.1007/s00521-020-04871-1) · [라이선스 표시 출처](https://link.springer.com/article/10.1007/s00521-020-04871-1) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 차량 시뮬레이션으로 만든 데이터를 신경망 대리모델로 압축하고, 랩타임·SOC·온도를 고려해 MCTS로 에너지 전략을 탐색한다. 코스팅·회생·공격 타이밍의 상충관계를 다루는 Formula E 확장의 핵심 근거다. 과거 Gen2 기반 설정이며 최신 시즌의 출력·열 제한으로 사용하면 안 된다. 타이어·노면·상대 차량 위치를 충분히 다루지 않고 전역 최적을 보장하지 않는다. 실제 SOC와 온도가 없으면 전략 시나리오만 제시한다.

**활용:** Formula E 에너지와 시간 trade-off

**필요 입력:** SOC, 배터리 온도, 출력, 회생, 코스팅, 트랙, 규정 버전.

**한계:** 과거 세대 시뮬레이션; 현행 규정 별도 검증

**재검토/확인 위치:** ANN/MCTS 구성 및 결론 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K08 — Race Strategy Reinforcement Learning: Optimising Pitstop Strategy with Emergent Tactics in Formula One

Devin Thomas; Junqi Jiang; Avinash Kori; Aaron Russo; Steffen Winkler; Stuart Sale; Joseph McMillan; Francesco Belardinelli; Antonio Rago (2026). DOI: [10.1007/s10994-026-07081-3](https://doi.org/10.1007/s10994-026-07081-3). [원문/확인 버전](https://link.springer.com/article/10.1007/s10994-026-07081-3) · [라이선스 표시 출처](https://link.springer.com/article/10.1007/s10994-026-07081-3) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** Mercedes의 비공개 시뮬레이터에서 부분 관측 상태를 이용한 DRQN 피트 전략을 비교한다. 비교 시 동일 난수 조건을 사용하는 방법은 평가 설계에 유용하다. 실제 학습 데이터는 비공개이며 연결된 코드의 라이선스는 별도 확인해야 한다. 설명용 결정트리의 높은 전체 정확도는 드문 피트 결정을 잘 설명한다는 뜻이 아니다. Kongboda에서는 전략별 분포와 불확실성을 비교하되 이 논문의 성능을 자사 모델 성능으로 제시하지 않는다.

**활용:** 피트 시나리오 비교·설명 평가

**필요 입력:** 랩, 타이어, 간격, 안전차 상태, 경주 시뮬레이터.

**한계:** 비공개 데이터; 코드 사용권 미검증

**재검토/확인 위치:** 모델 선택·평가·설명 대리모형·한계 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K09 — Upstream wind tunnel model mounting: The forgotten method for road vehicle aerodynamics

Aleksandra Anna Rejniak; Alvin Gatto (2021). DOI: [10.1177/0954407020978017](https://doi.org/10.1177/0954407020978017). [원문/확인 버전](https://journals.sagepub.com/doi/10.1177/0954407020978017) · [라이선스 표시 출처](https://journals.sagepub.com/doi/10.1177/0954407020978017) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 축소 트럭 모델의 풍동 지지대 배치가 평균 유동과 비정상 후류에 미치는 영향을 비교한다. 평균 항력만 비슷해도 국소 난류와 휠 후류가 달라질 수 있다는 검증 방법론이다. Kongboda에서는 CFD·풍동·트랙 결과의 차이를 설명하는 보조 자료로 쓸 수 있다. 경주차 연구 자체는 아니므로 트럭의 수치나 앞쪽 지지대 결과를 F1에 직접 적용하지 않는다.

**활용:** 공력 측정과 검증의 한계 설명

**필요 입력:** 풍동 지지 방식, 지면/바퀴 조건, 측정 불확실성, 후류 측정.

**한계:** HGV 축소 모형; 모터스포츠 간접 관련

**재검토/확인 위치:** 실험 조건; 지지대별 유동·항력·후류 비교 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### C02 — Virtual Strategy Engineer: Using Artificial Neural Networks for Making Race Strategy Decisions in Circuit Motorsport

Alexander Heilmeier; André Thomaser; Michael Graf; Johannes Betz (2020). DOI: [10.3390/app10217805](https://doi.org/10.3390/app10217805). [원문/확인 버전](https://mdpi-res.com/d_attachment/applsci/applsci-10-07805/article_deploy/applsci-10-07805-with-cover.pdf?version=1689159926) · [라이선스 표시 출처](https://mdpi-res.com/d_attachment/applsci/applsci-10-07805/article_deploy/applsci-10-07805-with-cover.pdf?version=1689159926) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 랩타임을 기본 페이스·연료·타이어·피트 손실 등으로 나누고, 상대와 교통이 없는 단순 조건에서 컴파운드별 선형 타이어 손실을 스틴트 전체에 합산한다. 실제 전략은 상대 위치와 중립화에 따라 달라지며 신경망도 일부 운전자에서는 결과를 악화시켰다. 여기서는 식 (6)–(9)의 합산만 독립 구현한다. 신경망·훈련 데이터·코드를 가져오거나 재훈련하지 않았다.

**활용:** 명시한 가정 아래 유지와 즉시 피트의 타이어 시간손실 시나리오 비교

**필요 입력:** 컴파운드별 오프셋과 기울기, 타이어 시작 사용 랩수, 남은 랩수, 피트 총 시간손실, 워밍업 손실.

**한계:** 교통·SC/VSC·날씨·상대 대응 미포함. 현재 세션에 보정한 계수 필요. 2014–2019 규정이나 성능 수치를 현재에 전용하지 않음.

**재검토/확인 위치:** 두 신경망 구성; scalar model; 2019 오스트리아 사례 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** C02의 선형 시나리오 수식만 구현됨.

### C01 — Optimization-Based Real-Time-Capable Energy Strategy for Autonomous Electric Race Cars

Thomas Herrmann; Florian Sauerbeck; Maximilian Bayerlein; Johannes Betz; Markus Lienkamp (2022). DOI: [10.4271/12-05-01-0005](https://doi.org/10.4271/12-05-01-0005). [원문/확인 버전](https://www.researchgate.net/publication/357848786_Optimization-Based_Real-Time-Capable_Energy_Strategy_for_Autonomous_Electric_Race_Cars) · [라이선스 표시 출처](https://www.researchgate.net/publication/357848786_Optimization-Based_Real-Time-Capable_Energy_Strategy_for_Autonomous_Electric_Race_Cars) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 배터리·모터·인버터의 에너지와 열 제약을 넣은 다중 랩 최적제어를 SQP로 풀고 측정 상태에 따라 재계산한다. 논문 시뮬레이션에서는 에너지가 충분해도 모터 온도 제한 때문에 페이스가 제한될 수 있었다. Kongboda는 이를 Formula E의 조건부 에너지·열관리 설명에만 사용한다. 컴포넌트 측정 비교와 최적화기 비교가 있으며, 전략 전체의 실차 검증은 후속 과제로 남았다. 공개 타이밍만으로 SOC·온도·최적 출력을 추정하지 않는다.

**활용:** 에너지 잔량과 열 제약을 별개 가설로 구분하고 전체 레이스와 단일 랩 목표의 차이 설명

**필요 입력:** 트랙 곡률·남은 거리, 배터리 SOC, 배터리·모터·인버터 온도, 효율·손실·냉각 모델, 차량 동역학·출력 제한.

**한계:** Roborace 기반 모델; Formula E 실전 검증 아님. 현재 규정·차량·센서 확인 필수. 계산시간은 저자 환경 결과이며 서비스 지연 보장 아님.

**재검토/확인 위치:** SQP/HPIPM 구성; solver comparison; conclusion 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### C04 — Driving Profile Optimization for Energy Management in the Formula Student Técnico Prototype

Tomás R. Pires; João F. P. Fernandes; Paulo J. Costa Branco (2024). DOI: [10.3390/en17246313](https://doi.org/10.3390/en17246313). [원문/확인 버전](https://www.researchgate.net/publication/387115388_Driving_Profile_Optimization_for_Energy_Management_in_the_Formula_Student_Tecnico_Prototype) · [라이선스 표시 출처](https://www.researchgate.net/publication/387115388_Driving_Profile_Optimization_for_Energy_Management_in_the_Formula_Student_Tecnico_Prototype) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 차량·트랙 모델로 Formula Student 점수를 최적화한 에너지 기준선을 만들고, 실제 소비량과의 오차를 PI 제어기로 보정해 최대 출력을 조절한다. FST12의 Alverca 시험은 기준 에너지 추종을 보였지만 경쟁차 기준은 가정이었다. 표 7의 1522.1 s와 1574.6 s는 표기된 시간 오차 1.4%와 불일치하므로 그 정확도 주장은 사용하지 않는다. Formula E에는 사전 계획과 실제 소비량을 대조하는 원리만 전용한다.

**활용:** 목표 에너지 대비 소비 차이와 페이스 조정의 조건부 설명

**필요 입력:** 보정된 차량·타이어 모델, 트랙·위치/주행거리, 실측 소비 에너지, 배터리 사용 가능 용량, 대회 채점식·출력 제한.

**한계:** Formula Student 특정 차량·시험장·채점 규칙. 표 7 시간 오차 불일치. Formula E 최적 전략이나 예측 정확도 근거로 사용 금지; SOC·온도는 타이밍으로 추정 불가.

**재검토/확인 위치:** 모형·에너지 추종; Table 7; 결론·실전 교란 한계 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### C07 — CarBench: A comprehensive benchmark for neural surrogates on high-fidelity 3D car aerodynamics

Mohamed Elrefaie; Dule Shu; Matt Klenk; Faez Ahmed (2025). DOI: [10.48550/arXiv.2512.07847](https://doi.org/10.48550/arXiv.2512.07847). [원문/확인 버전](https://arxiv.org/html/2512.07847v3) · [라이선스 표시 출처](https://arxiv.org/abs/2512.07847v3) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 고정 유동 조건의 승용차 CFD 표면압력을 대상으로 11개 모델 구성을 같은 분할·지표로 비교하고 차체 유형 간 일반화와 부트스트랩 평가를 수행했다. 다른 형상으로의 전이는 학습 분포에 민감했고 데이터 규모와 다양성의 효과는 분리되지 않았다. 단일 학습 실행의 평가 불확실성은 반복 학습 변동이나 실제 공력 오차를 포함하지 않는다. 라이브타이밍만으로 다운포스·항력을 역산하는 근거가 아니다. 승인 대상은 CC BY인 arXiv v3의 설명이며 데이터·가중치는 제외한다.

**활용:** 공력 예측 모델의 검증 범위·분포 이동·불확실성 구분

**필요 입력:** 차량 형상, 동일 조건 CFD 참조값, 형상별 독립 시험 분할, 평가 지표·리샘플링 단위.

**한계:** 승용차·고정 조건 정상 RANS·표면압력; 양항력/요각/비정상 유동 일반화 미검증. DrivAerNet++는 CC BY-NC 4.0. 코드 MIT 표기와 데이터/가중치 권리는 별도; 도입·훈련·추론 실행 없음.

**재검토/확인 위치:** v3 지표·형상 전이·Limitations 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K10 — Tire Wear Sensitivity Analysis and Modeling Based on a Statistical Multidisciplinary Approach for High-Performance Vehicles

Guido Napolitano Dell’Annunziata; Giovanni Adiletta; Flavio Farroni; Aleksandr Sakhnevych; Francesco Timpone (2023). DOI: [10.3390/lubricants11070269](https://doi.org/10.3390/lubricants11070269). [원문/확인 버전](https://www.researchgate.net/publication/371776992_Tire_Wear_Sensitivity_Analysis_and_Modeling_Based_on_a_Statistical_Multidisciplinary_Approach_for_High-Performance_Vehicles) · [라이선스 표시 출처](https://www.researchgate.net/publication/371776992_Tire_Wear_Sensitivity_Analysis_and_Modeling_Based_on_a_Statistical_Multidisciplinary_Approach_for_High-Performance_Vehicles) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 텔레메트리·노면·고무 물성을 결합해 ANN, PCA 회귀, 물리 상관 기반 회귀를 비교했다. 구성용 200개와 시험용 80개 관측을 사용했다. 마지막 방법의 시험 R²는 후륜 0.5242, 전륜 0.3381로, 전륜 불규칙 마모에는 추가 지표가 필요했다.

**활용:** 마모 설명에서 온도·노면·전후륜 차이를 함께 검토하는 근거

**필요 입력:** 마찰 소산 지표, 타이어 표면 온도, 노면 거칠기, 접촉면·고무 물성, 마모 측정값.

**한계:** 마모량 모델이며 초/랩 열화 모델이 아니다. 공개 타이밍만으로 입력을 확보할 수 없고, 다른 타이어·서킷의 예측 정확도를 보장하지 않는다. 원시 데이터 재사용 권한은 별도 확인 필요.

**재검토/확인 위치:** 물리 상관 회귀; Table 11; 결론 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K11 — Battery Model Impact on Time-Optimal Codesign for Electric Racing Cars: Review and Application

Giorgio Riva; Stefano Radrizzani; Giulio Panzani (2025). DOI: [10.1109/TTE.2024.3403930](https://doi.org/10.1109/TTE.2024.3403930). [원문/확인 버전](https://www.researchgate.net/publication/380828658_Battery_model_impact_on_time-optimal_co-design_for_electric_racing_cars_review_and_application) · [라이선스 표시 출처](https://www.researchgate.net/publication/380828658_Battery_model_impact_on_time-optimal_co-design_for_electric_racing_cars_review_and_application) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 고정 주행선 최적화에서 정전압, SOC 의존 전압, RC 동특성 배터리 모델을 비교한다. Gen3 매개변수와 2021 로마 23랩 사례에서 용량 선정은 비슷했지만 전압·전류 궤적은 달랐다. 완화된 볼록 모델은 비물리적 손실을 허용할 수 있다.

**활용:** 에너지 전략을 설명할 때 랩타임 적합성과 내부 배터리 상태 추정의 신뢰도를 구분

**필요 입력:** 차량·트랙 모델, 실측 SOC·전압·전류, 식별한 셀 매개변수, 회생·출력 제한.

**한계:** 오프라인 시뮬레이션이며 냉각이 충분하다고 가정한다. 현행 Formula E 규정·배터리나 실시간 예측 검증이 아니다. 타이밍만으로 SOC·온도·회생량을 역산하지 않는다.

**재검토/확인 위치:** 전기 등가회로·냉각 가정; Section IV; 결론 재열람·기존 카드 대조; 재실험 없음. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K12 — Application of Monte Carlo Methods to Consider Probabilistic Effects in a Race Simulation for Circuit Motorsport

Alexander Heilmeier; Michael Graf; Johannes Betz; Markus Lienkamp (2020). DOI: [10.3390/app10124229](https://doi.org/10.3390/app10124229). [원문/확인 버전](https://www.researchgate.net/publication/342319061_Application_of_Monte_Carlo_Methods_to_Consider_Probabilistic_Effects_in_a_Race_Simulation_for_Circuit_Motorsport) · [라이선스 표시 출처](https://www.researchgate.net/publication/342319061_Application_of_Monte_Carlo_Methods_to_Consider_Probabilistic_Effects_in_a_Race_Simulation_for_Circuit_Motorsport) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 랩 단위 시뮬레이션에 출발·피트 시간·사고·고장·SC/VSC 변동을 넣어 전략별 순위 분포를 비교한다. 2018 중국 GP 안전차 구간 비교는 실제 발령 시점을 지정한 재현 사례다. 정오표는 Formula 1이 Equation (1)로 바뀐 조판 오류를 바로잡으며 연구 결과는 바꾸지 않는다.

**활용:** 안전차 유무와 피트 손실 변화에 따라 전략 평가가 달라지는 조건부 시나리오 설명

**필요 입력:** 정제한 랩·피트 이력, 서킷·시즌별 사건 분포, SC/VSC 구간, 차량별 페이스·전략 모형.

**한계:** 2014–2019 자료의 확률을 현재 경기 확률로 사용하지 않는다. 랩 단위 모델은 랩 회복·복수 차량 사고 표현에 한계가 있다. 서비스에 Monte Carlo 실행기나 보정된 확률 모델을 추가한 것이 아니다.

**재검토/확인 위치:** Sections 2–5; Appendix A; p.21 license; erratum 10.3390/app10175745. **실행 상태:** 설명 근거; 논문 모델 미실행.

[정오표](https://doi.org/10.3390/app10175745)와 [TUM 확인 레코드](https://portal.fis.tum.de/en/publications/erratum-application-of-monte-carlo-methods-to-consider-probabilis/)를 함께 대조했다.

### K13 — Optimal Control of Overtaking Trajectories Under Aerodynamic Wake Effects in Motorsport

Telmo Prego; Aydin Azizi (2026). DOI: [10.3390/math14030467](https://doi.org/10.3390/math14030467). [원문/확인 버전](https://www.researchgate.net/publication/400228670_Optimal_Control_of_Overtaking_Trajectories_Under_Aerodynamic_Wake_Effects_in_Motorsport) · [라이선스 표시 출처](https://www.researchgate.net/publication/400228670_Optimal_Control_of_Overtaking_Trajectories_Under_Aerodynamic_Wake_Effects_in_Motorsport) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** F3 텔레메트리로 보정한 평면 차량과 거리·횡방향 위치별 후류 모델을 Dymos 최적제어에 결합했다. 사례에서 직선의 항력 감소와 제동·코너 탈출 전 후류 이탈에 따른 다운포스 회복을 함께 이용했다.

**활용:** 직선에서 접근해도 코너에서 추월이 어려울 수 있는 공력 상충관계 설명

**필요 입력:** 차량 속도·위치·횡방향 간격, 트랙 경계, 보정한 타이어·공력 모델, 앞차 주행 궤적.

**한계:** 앞차는 방어하지 않는 고정 궤적이며 공력은 준정상, 기어비는 고정이다. 공통 비교 구간 시간은 실측 75.540초 대 모형 71.466초로 차이가 있다. 타이밍의 초 단위 간격만으로 후류 손실·추월 확률·최적 진로를 계산하지 않는다.

**재검토/확인 위치:** Sections 2.2–2.3; Table 3; Sections 3–4; p.1 license. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K14 — Effects of Wheel-Ground Conditions on Racing Car Aerodynamics Under Ride-Height-Related Attitude Variations

Xiaojing Ma; Jie Li; Kun Zhang; Yi Zou; Matteo Massaro (2026). DOI: [10.3390/app16020874](https://doi.org/10.3390/app16020874). [원문/확인 버전](https://www.researchgate.net/publication/399786448_Effects_of_Wheel-Ground_Conditions_on_Racing_Car_Aerodynamics_Under_Ride-Height-Related_Attitude_Variations) · [라이선스 표시 출처](https://www.researchgate.net/publication/399786448_Effects_of_Wheel-Ground_Conditions_on_Racing_Car_Aerodynamics_Under_Ride-Height-Related_Attitude_Variations) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 풍동 기준 사례와 대조한 CFD로 이동 지면·회전 바퀴, 이동 지면·정지 바퀴, 정지 지면·정지 바퀴를 피치·롤 변화에 따라 비교했다. 해당 형상에서는 바퀴와 디퓨저 상호작용이 항력에, 지면 조건과 자세가 다운포스·전후 균형에 영향을 주었다.

**활용:** 공력 연구를 실제 차에 적용할 때 시험 경계조건과 자세를 대조하는 근거

**필요 입력:** 차량 형상, 차고·피치·롤, 속도·회전 바퀴 조건, 지면 경계조건.

**한계:** 특정 형상의 realizable k-epsilon CFD와 기준 풍동 비교다. 모든 자세의 실차 검증이나 현행 F1 공력 맵이 아니다. 초/랩 자료만으로 차고·다운포스·밸런스를 식별하지 않는다.

**재검토/확인 위치:** Sections 2.1–2.4, 3.1–3.2 and 4; p.1 license. **실행 상태:** 설명 근거; 논문 모델 미실행.

### K15 — Real-Time Optimal Trajectory Planning for Autonomous Vehicles and Lap Time Simulation Using Machine Learning

Sam Garlick; Andrew Bradley (2021). DOI: [10.48550/arXiv.2102.02315](https://doi.org/10.48550/arXiv.2102.02315). [원문/확인 버전](https://arxiv.org/pdf/2102.02315) · [라이선스 표시 출처](https://arxiv.org/abs/2102.02315v4) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**연구 근거:** 82개 서킷을 증강한 최적제어 주행선으로 신경망을 훈련하고, 보지 않은 실제 서킷 9개와 그 증강본으로 시험했다. 평균 0.27m는 주행선 위치 오차이며 랩타임 오차가 아니다.

**활용:** 레이싱 라인 예측과 랩타임 예측을 구분하고 학습 분포 밖 적용을 점검하는 근거

**필요 입력:** 정밀 트랙 경계, 차량별 최적제어 주행선, 검증용 실제 위치·속도 궤적.

**한계:** 검토본은 2021-09-15 arXiv v4로 한정한다. 고정 차량 설정이며 날씨·노면 상태·차량 설정 변화는 다루지 않는다. 복잡한 비전형 코너에서 오차가 커진다. 모델·데이터·코드 권리를 별도 확인하지 않았고 서비스에서 신경망을 실행하지 않는다.

**재검토/확인 위치:** arXiv v4 license; PDF Sections 2.1, 3 and 4, Table 1. **실행 상태:** 설명 근거; 논문 모델 미실행.

승인 범위는 arXiv v4이다. 관련 학술지 DOI 10.1080/00423114.2021.2011929의 출판본 권리를 대신 승인하지 않는다.

## 승인하지 않은 등록 자료 16편

아래 항목은 검색 메타데이터/후속 검토 대상으로만 저장된다. `include_pending=true`일 때도 `eligible_for_analysis=false`이며 분석 요약으로 반환되지 않는다. 기존 후보·보류 자료는 승인으로 바꾸지 않았다.

| ID | 논문 | 계속 보류하는 이유 |
|---|---|---|
| C03 | [Tyre and brake thermal management in NASCAR](https://www.tandfonline.com/doi/full/10.1080/00423114.2024.2342534) — 10.1080/00423114.2024.2342534 | 출판사 PDF 색인에서 CC BY 4.0, HTML 색인에서 결론 일부 확인. 직접 본문/PDF 요청 403으로 연속 본문 검토 미완료; 승인 근거로 사용하지 않음. |
| C05 | [Local wind effects on race car lap time dynamics](https://eprints.soton.ac.uk/508996/) — 10.1016/j.awe.2026.100133 | 출판사 색인에서 방법·결과·한계 일부 확인. 기관 레코드는 파일을 등록 사용자 전용으로 표시하며 CC Attribution이라고만 표시. 출판본의 정확한 라이선스 및 연속 본문 확인이 남아 미승인. |
| C06 | [A basic study on hybrid systems for small race car to improve dynamic performance using lap time simulation](https://umpir.ump.edu.my/id/eprint/34881/) — 10.3390/act11070173 | 기관 레코드의 CC Attribution 및 출판사 색인에서 방법·결론 일부 확인. 기관 요청 timeout, 출판사 전체 본문 확보 실패; 개별 출판본 라이선스 세부 확인도 남음. |
| C08 | [Methodology for obtaining tyre rubber friction characteristics from flat-track data](https://openresearch.surrey.ac.uk/esploro/outputs/journalArticle/Methodology-for-obtaining-tyre-rubber-friction/99996266402346) — 10.1080/00423114.2025.2501989 | 기관 표기에 더해 출판사 PDF 색인의 CC BY 4.0 문구 확인. 방법 개요·결론 일부는 읽었으나 직접 PDF/HTML 요청 403으로 연속 본문 검토 미완료; 미승인 유지. |
| R01 | [A state-space approach to modeling tire degradation in formula 1 racing](https://journals.sagepub.com/doi/pdf/10.1177/22150218261446170) — 10.1177/22150218261446170 | 출판본 CC BY-NC. 다른 버전의 표시로 출판본 사용권을 대체하지 않음. |
| R02 | [Constitutive modeling and validation of a racing slick tire model in a finite element environment](https://journals.sagepub.com/doi/full/10.1177/09544070251376489) — 10.1177/09544070251376489 | CC BY-NC 4.0. |
| R03 | [Optimal adaptive race strategy for a Formula-E car](https://journals.sagepub.com/doi/10.1177/09544070211047343) — 10.1177/09544070211047343 | 기관에 공개 AAM이 추가 경로로 확인되나 라이선스가 Creative commons로만 표시됨. 출판본은 제한. 정확한 AAM 권리 확인 전 보류. |
| R04 | [Optimal energy management for formula-E cars with regulatory limits and thermal constraints](https://doi.org/10.1016/j.apenergy.2020.115805) — 10.1016/j.apenergy.2020.115805 | 공개 저자 원고 CC BY-NC-ND 4.0. |
| R05 | [Formula-E race strategy development](https://doi.org/10.1016/j.knosys.2021.106781) — 10.1016/j.knosys.2021.106781 | 공개 저자 원고 CC BY-NC-ND 4.0. |
| R06 | [Tire multiphysical modeling for the analysis of thermal and wear sensitivity on vehicle objective dynamics and racing performances](https://www.iris.unina.it/handle/11588/878575) — 10.1016/j.simpat.2022.102517 | 상업 재사용 라이선스 미확인; 원문 권한 제한. |
| R07 | [Moving Ground Simulation for High Performance Race Cars in an Automotive Wind Tunnel](https://www.jstage.jst.go.jp/article/jsaeijae/8/1/8_20174088/_article/-char/en) — 10.20485/jsaeijae.8.1_15 | CC BY-NC-SA. |
| R08 | [Race Car Aerodynamics Simulation and Transmitted Tire Reaction Forces](https://www.jstage.jst.go.jp/article/jsaeijae/13/4/13_20224548/_article) — 10.20485/jsaeijae.13.4_169 | CC BY-NC-SA. |
| R09 | [Application of advanced tree search and proximal policy optimization on formula-E race strategy development](https://www.sciencedirect.com/science/article/pii/S0957417422001932) — 10.1016/j.eswa.2022.116718 | 기관 저장소의 원문 색인에 CC BY-NC-ND 4.0 표시. 공개 열람과 상업적 재사용을 구분하여 보류. |
| R10 | [Energy-optimal overtaking manoeuvres of Formula-E cars](https://www.tandfonline.com/doi/pdf/10.1080/00423114.2022.2096082) — 10.1080/00423114.2022.2096082 | 출판사 PDF 첫 페이지의 검색 색인에서 CC BY-NC-ND 4.0 확인. 공개 열람 가능 표시가 상업적 재사용을 허용하지 않음. |
| R11 | [Maximum-distance race strategies for a fully electric endurance race car](https://research.tue.nl/en/publications/maximum-distance-race-strategies-for-a-fully-electric-endurance-r-2/) — 10.1016/j.ejcon.2022.100679 | TU/e 기관 레코드가 최종 출판본을 CC BY-NC-ND로 표시. 충전·스틴트 연구의 상업 지식팩 편입 보류. |
| R12 | [On the optimization of pit stop strategies via dynamic programming](https://link.springer.com/article/10.1007/s10100-022-00806-4) — 10.1007/s10100-022-00806-4 | 출판사 구독 미리보기만 확인. 본문·상업 재사용 권리 미확인. 정정 DOI 10.1007/s10100-022-00810-8도 승인 전 대조 필요. |

## 탐색 범위와 아직 끝나지 않은 부분

IMechE/SAGE 밖으로 SAE, Springer Nature, Elsevier, IEEE, MDPI, PLOS, arXiv와 TUM·Cranfield·TU/e·Padova·Oxford Brookes·Surrey·Southampton 등의 기관 레코드를 탐색했다. ResearchGate에서는 출판사가 제공한 본문 또는 명시적 라이선스의 저자 원고를 대조했다. 검색어는 motorsport/racing tyre wear, thermal management, wake/overtaking, wheel-ground/ride height, lap time/trajectory, Monte Carlo/pit strategy, Formula E energy/battery/endurance를 조합하고 관련 논문의 참고문헌을 추적했다.

사용자의 IMechE 로그인 세션은 현재 조사 환경에 공유되지 않아 기관 구독 본문을 확인했다고 보고하지 않는다. 공개 경로만 사용했으며 403/429/크기 제한은 그 자체로 유료 또는 로그인 필요라는 뜻이 아니다. 이번에는 대체 공개 본문으로 K14의 큰 PDF 접근 문제를 해결했다.

추가 발견했지만 이번 승인용 본문 대조를 완료하지 않은 후속 탐색 항목: [Time-Optimal Trajectory Planning and Tracking for Autonomous Vehicles](https://pmc.ncbi.nlm.nih.gov/articles/PMC11174940/) (10.3390/s24113281), [A Hierarchical Autonomous Driver for a Racing Car](https://doi.org/10.3390/en14196008), [NASCAR 공력 관련 연구](https://doi.org/10.3390/vehicles6030073), [전기 레이스카 CFD 연구](https://doi.org/10.3390/wevj15050192). 이들은 승인 19편이나 등록 35편 집계에 포함하지 않으며 현재 분석 근거로 사용하지 않는다.

이는 공개 접근·상업 본문 재사용·라이브 해설 관련성을 우선한 탐색이다. 전 세계 모든 논문을 수집한 체계적 문헌고찰이나 “발견한 자료 전부 학습 완료”로 표현하지 않는다. C03/C05/C06/C08은 전체 방법·결과 대조가 남았고, NC/권리 미확인 자료는 별도 허락 또는 허용 버전이 확인되어야 승격할 수 있다.

## 실제 반영과 검증

이번 회차는 K12–K15 설명 카드 4개, R10–R12 제외 기록 3개, 기존 승인 15편의 재검토 위치·라이브타이밍 적용 범위를 추가했다. 앞선 회차의 C01/C04/C07/K10/K11을 합쳐 PR #8 전체는 main의 승인 10편에서 19편으로 확장한다. 기존 분석 도구·수집기·인증·배포 체계는 변경하지 않았다.

Node 13개·Python 25개 회귀 검사가 통과했다. 빌드 및 산출물 검사도 통과했다. 이 검사는 논문 결과 재현 또는 실제 레이스 예측 정확도 검증이 아니다. PR 저장·CI 통과·main 병합·운영 배포·실시간 경기 검증은 서로 다른 상태이며 [PR #8](https://github.com/kangjeongmin1229/f1-data-analyst/pull/8)에 변경을 모은다.
