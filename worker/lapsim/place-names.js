// Map names that are not tied to a turn number (owner 2026-11-17).
// lapsimStraights: named straights, drawn halfway between two numbered corners of the F1 / main layout.
// lapsimNamesKo: Korean for the OpenStreetMap corner names (corner-names-data.js), so a Korean page shows Korean names only
// (owner 2026-11-17: "Korean names on the Korean page, English on the English page"). A name without an entry stays as written.
export const lapsimStraights = {
  silverstone: [{between: [18, 1], ko: '해밀턴 스트레이트', en: 'Hamilton Straight'}, {between: [5, 6], ko: '웰링턴 스트레이트', en: 'Wellington Straight'},
    {between: [8, 9], ko: '내셔널 스트레이트', en: 'National Straight'}, {between: [14, 15], ko: '행어 스트레이트', en: 'Hangar Straight'}],
  interlagos: [{between: [3, 4], ko: '헤타 오포스타', en: 'Reta Oposta'}, {between: [13, 14], ko: '수비다 도스 복시스', en: 'Subida dos Boxes'}],
  'le-mans': [{between: [6, 7], ko: '뮬산 스트레이트', en: 'Mulsanne Straight'}],
  sebring: [{between: [16, 17], ko: '울만 스트레이트', en: 'Ulmann Straight'}],
  singapore: [{between: [12, 13], ko: '앤더슨 브리지', en: 'Anderson Bridge'}, {between: [13, 14], ko: '에스플러네이드 브리지', en: 'Esplanade Bridge'}],
};

export const lapsimNamesKo = {
  'Curva Carlos Checa': '쿠르바 카를로스 체카',
  Redgate: '레드게이트', Hollywood: '할리우드', 'Craner Curves': '크레이너 커브', 'Old Hairpin': '올드 헤어핀', "Starkey's Bridge": '스타키스 브리지', McLeans: '맥린스',
  Coppice: '코피스', "Fogarty's": '포가티스', 'Melbourne Loop (down)': '멜버른 루프 (내리막)', 'Melbourne Hairpin': '멜버른 헤어핀', 'Melbourne Loop (up)': '멜버른 루프 (오르막)', Goddards: '고다즈',
  'Curva 1': '쿠르바 1', 'Curva 2': '쿠르바 2', 'Curva 3': '쿠르바 3', 'Curva VIP': '쿠르바 VIP', 'Parabólica Interior': '파라볼리카 인테리오르', Orelha: '오렐랴',
  'Variante (Gancho)': '바리안트 (간슈)', Esses: '에스', 'Parabólica Ayrton Senna': '파라볼리카 아이르통 세나',
  'Bernie-Ecclestone-Kurve': '버니 에클스턴 쿠르베', 'Einfahrt Parabolika': '파라볼리카 입구', 'Mobil 1 Kurve': '모빌 1 쿠르베', 'Sachs-Kurve': '작스 쿠르베', 'Südkurve': '쥐트쿠르베',
  "Curva Expo '92": '쿠르바 엑스포 92', 'Curva Michelin': '쿠르바 미쉐린', 'Curva Sito Pons': '쿠르바 시토 폰스', 'Curva Dry Sac': '쿠르바 드라이 삭', 'Curva Aspar': '쿠르바 아스파르',
  'Curva Angel Nieto': '쿠르바 앙헬 니에토', 'Curva Peluqui': '쿠르바 펠루키', 'Chicane Senna': '시케인 세나', 'Curva Ferrari': '쿠르바 페라리', 'Curva Lorenzo': '쿠르바 로렌소',
  'Pangkor Laut Chicane': '팡코르 라우트 시케인', 'Langkawi Curve': '랑카위 커브', 'Genting Curve': '겐팅 커브', 'KLIA Curve': 'KLIA 커브', 'Berjaya Tioman Corner': '베르자야 티오만 코너',
  'Kenyir Lake Corner': '케니르 레이크 코너', 'Sunway Lagoon Corner': '선웨이 라군 코너',
  'The Kink': '더 킹크', Crowthorne: '크로손', 'Juksei Sweep': '죽세이 스윕', Barbeque: '바비큐', Sunset: '선셋', Clubhouse: '클럽하우스', 'The Esses': '에스', Leeukop: '레우콥',
  Mineshaft: '마인샤프트', 'The Crocodiles': '크로커다일스', Cheetah: '치타', Ingwe: '잉궤',
  'The Keyhole': '키홀', 'Thunder Valley': '선더 밸리', Carousel: '캐러셀',
  'Variante del Parco': '바리안테 델 파르코', 'Curva del Rio': '쿠르바 델 리오', 'Variante Arena': '바리안테 아레나', 'Curva Quercia': '쿠르바 쿠에르차', 'Curva Tramonto': '쿠르바 트라몬토',
  Curvone: '쿠르보네', 'Curva del Carro': '쿠르바 델 카로', 'Curva Misano': '쿠르바 미사노',
  'Ford-Kurve': '포드 쿠르베', 'Goodyear-Kehre': '굿이어 케레', 'Michael-Schumacher-S': '미하엘 슈마허 S', 'Sabine-Schmitz-Kurve': '자비네 슈미츠 쿠르베', Hatzenbogen: '하첸보겐',
  Hatzenbach: '하첸바흐', Hocheichen: '호흐아이헨', 'Quiddelbacher Höhe': '크비델바허 회에', Aremberg: '아렘베르크', 'Adenauer Forst': '아데나워 포르스트', Kallenhard: '칼렌하르트',
  Spiegelkurve: '슈피겔쿠르베', 'Dreifach-Rechts': '드라이파흐 레히츠', Wehrseifen: '베어자이펜', 'Exmühle': '엑스뮐레', 'Lauda-Links': '라우다 링크스', Bergwerk: '베르크베르크',
  Mutkurve: '무트쿠르베', Klostertal: '클로스터탈', Karussell: '카루셀', 'Hedwigshöhe': '헤트비히스회에', Wippermann: '비퍼만', Eschbach: '에슈바흐', 'Brünnchen': '브륀헨',
  Eiskurve: '아이스쿠르베', 'Sprunghügel': '슈프룽휘겔', 'Stefan-Bellof-S': '슈테판 벨로프 S', Schwalbenschwanz: '슈발벤슈반츠', 'Mini-Karussell': '미니 카루셀',
  'Nürburgring Nordschleife': '뉘르부르크링 노르트슐라이페', Antoniusbuche: '안토니우스부헤', Tiergarten: '티어가르텐', Hohenrain: '호엔라인', 'Hohenrain-Schikane': '호엔라인 시케인', Galgenkopf: '갈겐코프',
  'Döttinger Höhe': '되팅거 회에', Pflanzgarten: '플란츠가르텐', Fuchsröhre: '푹스뢰레', Metzgesfeld: '메츠게스펠트', 'Hohe Acht': '호에 아흐트', Steilstrecke: '슈타일슈트레케',
  Variante: '바리안테', Triple: '트리플', Schikane: '시케인', 'Zeppelin-Kurve': '체펠린 쿠르베',
  'Old Hall Corner': '올드 홀 코너', 'The Avenue': '애비뉴', "Denton's": '덴턴스', Cascades: '캐스케이즈', Lakeside: '레이크사이드', 'Island Bend': '아일랜드 벤드',
  'Shell Oils Corner': '셸 오일스 코너', "Britten's": '브리튼스', Hilltop: '힐탑', Knickerbrook: '니커브룩', 'Clay Hill': '클레이 힐', 'Water Tower': '워터 타워', 'Druids Corner': '드루이즈 코너',
  'Warwick Bridge': '워릭 브리지', 'Lodge Corner': '로지 코너',
  Riches: '리치스', Montreal: '몬트리올', Palmer: '파머', Agostini: '아고스티니', Hamilton: '해밀턴', Oggies: '오기스', Williams: '윌리엄스', Brundle: '브런들', Nelson: '넬슨',
  'Bomb Hole': '밤 홀', Coram: '코람', Murrays: '머리스',
  'PWC lower hairpin': 'PWC 로어 헤어핀',
  'Cimini 1': '치미니 1', 'Cimini 2': '치미니 2', Campagnano: '캄파냐노', Soratte: '소라테', Trincea: '트린체아', Semaforo: '세마포로', Tornantino: '토르난티노', Esse: '에세', Roma: '로마',
  'Eerste linkse': '에어스터 링크서', Sterrenwacht: '스테렌바흐트', Kanaalbocht: '카날복트', 'Lucien Bianchi': '뤼시앵 비앙키', Sacramentsheuvel: '사크라멘츠회벌',
  'Gilles Villeneuve': '질 빌뇌브', Terlamen: '테를라먼', Bolderberg: '볼더베르흐', 'Jochen Rindt': '요헨 린트', 'Jacky Ickx': '재키 익스',
};
