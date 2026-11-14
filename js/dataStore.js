// 데이터 창고: 구역에 맞는 아이템을 꺼내 준다.
//
//   getItems('rose')
//     ├─ 미리 받아 둔 API 데이터(data/rose-api.js) 있음? ── 예 ─▶ 보여줄 것만 고르고(pick) 변환해서 반환
//     └─ 아니오 ─▶ 샘플 데이터(data/rose-sample.js) 반환
//
// 왜 브라우저에서 API를 직접 부르지 않나?
//  - 배포된 사이트에서 브라우저가 API를 부르려면 인증키가 사이트 안에 들어가야 해서 누구나 볼 수 있다.
//  - 그래서 내 컴퓨터에서 tools/fetch-roses.py 로 미리 받아 저장하고, 사이트는 저장본만 읽는다.

(function () {
  // 공통 형태로 바꾼 뒤, 블롭 디자인 설정(item.blob)을 붙임 — 디자인이 없는 소스면 기본 블롭
  function finish(source, raw) {
    return raw.map(source.adapter).map((item, i) => {
      if (source.design) item.blob = source.design(item, i);
      return item;
    });
  }

  // 반환: { items: [공통 형태...], from: 'api' | 'sample' | 'none', fetched: '받은 날짜' }
  window.getItems = async function (zoneId) {
    const zone = window.findZone(zoneId);
    const source = zone && window.SOURCES[zone.source];
    if (!source) return { items: [], from: 'none' };

    const saved = source.saved && source.saved();
    if (Array.isArray(saved) && saved.length) {
      const unique = source.dedupe ? source.dedupe(saved) : saved; // 중복 합치기
      const chosen = source.pick ? source.pick(unique) : unique;   // 보여줄 것 고르기
      if (chosen.length) {
        return { items: finish(source, chosen), from: 'api', fetched: source.fetched && source.fetched() };
      }
    }
    return { items: finish(source, source.sample()), from: 'sample' };
  };
})();
