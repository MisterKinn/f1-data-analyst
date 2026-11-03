// Concise editorial interpretations of the recorded samples, not model output.
export const interpretations=[
 ['노리스가 베르스타펜에게 계속 밀릴까? 최근 10랩과 마지막 3랩을 같이 봐줘.','Will Norris keep losing to Verstappen? Compare the ten-lap window with its last three laps.',
 '이 추세라면 당장은 비슷한 페이스일 것 같습니다. 베르스타펜은 10랩 평균 0.263초 빨랐지만, 마지막 3랩 차이는 0.011초로 줄었습니다. 타이어 종류·사용량과 트래픽이 달라 열화 원인으로 단정할 수 없습니다. 다음 클린 랩에서도 격차가 작으면 추격 속도는 둔화될 전망입니다.',
 'Near-term pace looks close: Verstappen’s 0.263s advantage over ten laps shrinks to 0.011s over the last three. Different compounds, ages and traffic prevent a wear diagnosis. If the next clean laps stay close, the closing rate should ease.'],
 ['해밀턴의 페이스 우위가 이어질까, 르클레르가 다시 따라올까?','Is Hamilton’s pace advantage likely to last, or can Leclerc respond?',
 '동일한 조건이 이어지면 해밀턴이 당분간 유리할 것 같습니다. 10랩 평균 0.290초, 마지막 3랩도 0.313초 빠릅니다. 두 차량 모두 하드지만 연료·타이어 나이·트래픽은 보정하지 않아 순수 성능 차이로 단정할 수 없습니다. 르클레르가 클린 에어에서 회복하는지 보겠습니다.',
 'Hamilton looks better placed over the next few comparable laps: 0.290s faster over ten laps and 0.313s over the last three. Both use hards, but fuel, tyre age and traffic are uncorrected. Leclerc recovering in clear air would weaken this forecast.'],
 ['노리스와 르클레르, Q3 시간차가 어느 구간에서 바뀌고 다음 시도는 누가 유리할까?','Where does the Norris–Leclerc Q3 gap change, and who looks better placed for another attempt?',
 '르클레르는 0.148초 빨랐고, 거리 보간 델타도 약 1~2km에서 노리스 우위가 뒤집힙니다. 비슷한 타이어 준비라면 르클레르가 다시 앞설 여지가 있습니다. 다만 제동 압력·에너지 사용은 없어 원인을 단정할 수 없습니다. 그 구간의 탈출 속도와 델타가 다음 랩에도 함께 개선되는지 확인하겠습니다.',
 'Leclerc is 0.148s faster; the interpolated delta also reverses Norris’s early advantage around 1–2km. Similar tyre preparation could favour Leclerc again. Brake pressure and energy use are unknown: check whether exit speed and delta improve together on another lap.'],
 ['하자르와 르클레르의 0.024초 차이, 다음 Q3 랩에서는 순서가 바뀔까?','Could Hadjar and Leclerc swap places on another Q3 lap after a 0.024s gap?',
 '순서가 뒤집혀도 이상하지 않을 접전입니다. 하자르가 0.024초 앞섰지만 델타의 부호가 랩 중 여러 번 바뀌어 서로 다른 구간에서 만회합니다. 타이어 준비·트래픽 차이가 비슷한 규모의 변동을 만들 수 있어 고정된 우열로 단정할 수 없습니다. 다음 시도에서는 제동 이후의 시간차 유지 여부가 관건입니다.',
 'A reversal looks plausible: Hadjar leads by just 0.024s, while the delta changes sign repeatedly. They recover time in different places. Tyre preparation or traffic could alter that balance; watch whether gains survive corner exit, rather than declaring a stable hierarchy.'],
 ['러셀과 안토넬리, 평균은 비슷한데 지금 누가 더 빨라질 흐름이야?','Russell and Antonelli have similar averages—but whose recent pace looks stronger?',
 '최근 흐름은 안토넬리 쪽입니다. 10랩 평균은 0.004초 차이지만 마지막 3랩은 안토넬리가 0.420초 빠릅니다. 조건이 유지되면 다음 몇 랩도 유리할 것 같습니다. 중간의 느린 랩을 실수나 열화로 단정할 수 없으므로 트래픽·타이어 이력을 확인하며 판단을 갱신하겠습니다.',
 'Recent pace favours Antonelli: only 0.004s separates the ten-lap averages, but he is 0.420s faster over the last three. Comparable conditions could preserve that advantage briefly. A slow lap alone does not prove an error or wear; traffic and stint history could change the assessment.'],
 ['러셀의 Q3 0.293초 우위, 최고속도보다 코너 구간이 중요했을까?','Was Russell’s 0.293s Q3 advantage more about the corner sequence than peak speed?',
 '후반 구간의 누적 이득이 중요했을 것 같습니다. 거리 보간 델타에서 안토넬리의 손실은 약 3km의 0.15초에서 4km의 0.38초로 커진 뒤 줄어듭니다. 다음 시도도 그 구간을 안정적으로 연결하면 러셀이 유리할 수 있습니다. 제동 압력·세팅은 없어 원인을 단정할 수 없고, 보간 델타는 공식 최종 격차와 다릅니다.',
 'The later sequence looks important: Antonelli’s interpolated loss grows from about 0.15s at 3km to 0.38s at 4km, then falls. Repeating that sequence could favour Russell. Pressure and setup are unknown; this distance-aligned delta is not the official finishing gap.']
];
export const researchLinks={pace:{label:'Heilmeier et al. · 페이스·전략',labelEn:'Heilmeier et al. · pace / strategy',url:'https://www.mdpi.com/2076-3417/10/21/7805'},telemetry:{label:'Chindamo et al. · 타이어 해석',labelEn:'Chindamo et al. · tyre interpretation',url:'https://www.mdpi.com/1996-1073/14/16/5118'}};
