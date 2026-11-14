// 구역 연결표 — 지도 페이지와 인터랙션 페이지가 함께 쓰는 "단 하나의 표".
// 새 구역에 데이터를 연결하려면: source에 데이터 소스 이름을 적고, SOURCES에 한 줄 추가.
// id는 지도 SVG의 data-zone 값과 같아야 한다.
// (누를 수 없는 회색 장식 — 세계평화의 문, KSPO DOME, 몽촌해자 — 은 여기 없고 지도 그림에만 있다.)
// 지도에서 구역을 누르면 뜨는 소개 카드: icon · name · scenic(9경 번호) · intro(한두 줄 소개)
//   intro는 공식 누리집 내용을 참고해 짧게 새로 쓴 문장이다 (그대로 옮기지 않음).
window.ZONES = [
  { id: 'rose',       name: '장미광장',        source: 'roseApi', icon: '🌹', scenic: '9경',  // 남동
    intro: '165종의 장미가 모여 피는 커다란 장미 정원이에요.' },
  { id: 'wildflower', name: '들꽃마루',        source: null, icon: '🌼', scenic: '8경',       // 남동, 장미광장 옆
    intro: '계절마다 다른 들꽃이 언덕을 덮어요. 봄에는 꽃양귀비와 수레국화, 가을에는 코스모스.' },
  { id: 'wildlab',    name: '야생화학습장',    source: null, icon: '🌸', scenic: '',          // 토성 남동쪽 자락
    intro: '우리 들과 산에서 자라는 야생화를 가까이에서 보고 배울 수 있는 꽃밭이에요.' },
  { id: 'tosung',     name: '몽촌토성 산책로', source: null, icon: '🌳', scenic: '5경',       // 가운데~서쪽 큰 언덕
    intro: '백제 사람들이 흙으로 쌓은 성이에요. 지금은 부드러운 언덕을 따라 걷는 산책길이 되었어요.' },
  { id: 'lonetree',   name: '나홀로나무',      source: null, icon: '🌲', scenic: '6경',       // 토성 위 서쪽
    intro: '넓은 잔디 언덕 위에 홀로 선 측백나무. 사진 찍으러 많이들 찾아오는 곳이에요.' },
  { id: 'stream',     name: '성내천',          source: null, icon: '🌾', scenic: '',          // 북동쪽 가장자리 물길
    intro: '메말랐던 도심 하천이 습지로 되살아났어요. 창포, 붓꽃, 갈대 사이로 왜가리가 쉬어 가요.' }
];

// 데이터 소스 목록
//   saved   : 미리 받아 둔 API 데이터 (tools/fetch-roses.py 가 만든 data/rose-api.js)
//   pick    : 그중 화면에 보여줄 것만 고르기 (없으면 전부)
//   sample  : 저장본이 없을 때 대신 보여줄 샘플
//   adapter : 공통 형태로 바꾸는 변환기
window.SOURCES = {
  roseApi: {
    saved: () => window.ROSE_API,
    fetched: () => window.ROSE_API_FETCHED,
    dedupe: raw => window.roseDedupe(raw), // 같은 이름은 하나만 (규칙은 roseAdapter.js)
    // pick 없음 → 중복을 합친 153개 전부 보여줌 (2026-11-15 확장).
    //   대표 5개(에버골드·폴리카르드·린·데저트 피스·엘르)는 디자인 파일에서 이름으로 알아보고 고유 모양을 씀.
    //   (참고: 예전에 5개만 고를 때는 list_no 1111·1116·1118·1119·1124였고, 중복 합치기 규칙이 같은 것을 고른다)
    sample: () => window.ROSE_SAMPLE,
    adapter: (item, i) => window.roseAdapter(item, i),
    design: (item, i) => window.roseBlobDesign(item, i) // 블롭 모양·색 (js/designs/roseBlobs.js)
  }
};

window.findZone = id => window.ZONES.find(z => z.id === id);
