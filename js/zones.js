// 구역 연결표 — 지도 페이지와 인터랙션 페이지가 함께 쓰는 "단 하나의 표".
// 새 구역에 데이터를 연결하려면: source에 데이터 소스 이름을 적고, SOURCES에 한 줄 추가.
// id는 지도 SVG의 data-zone 값과 같아야 한다.
window.ZONES = [
  { id: 'rose',       name: '장미광장',        source: 'roseApi' },
  { id: 'wildflower', name: '들꽃마루',        source: null },
  { id: 'lake',       name: '88호수',          source: null },
  { id: 'tosung',     name: '몽촌토성 산책로', source: null },
  { id: 'lonetree',   name: '나홀로나무',      source: null },
  { id: 'sculpture',  name: '조각공원',        source: null },
  { id: 'gate',       name: '세계평화의 문',   source: null }
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
    // 지금은 182건 중 5개만. 같은 이름이 여러 건 있어서 이름이 아니라 API url 속 list_no 번호로 고른다.
    //   에버골드 1111(샘플과 같은 '코르테스' 문장) · 엘르 1124(샘플과 같은 긴 설명)
    pick: raw => [1111, 1116, 1118, 1119, 1124]
      .map(no => raw.find(it => (it.url || '').includes('list_no=' + no + '&')))
      .filter(Boolean),
    sample: () => window.ROSE_SAMPLE,
    adapter: (item, i) => window.roseAdapter(item, i)
  }
};

window.findZone = id => window.ZONES.find(z => z.id === id);
