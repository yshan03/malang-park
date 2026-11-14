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
  // 반환: { items: [공통 형태...], from: 'api' | 'sample' | 'none', fetched: '받은 날짜' }
  window.getItems = async function (zoneId) {
    const zone = window.findZone(zoneId);
    const source = zone && window.SOURCES[zone.source];
    if (!source) return { items: [], from: 'none' };

    const saved = source.saved && source.saved();
    if (Array.isArray(saved) && saved.length) {
      const chosen = source.pick ? source.pick(saved) : saved;
      if (chosen.length) {
        return { items: chosen.map(source.adapter), from: 'api', fetched: source.fetched && source.fetched() };
      }
    }
    return { items: source.sample().map(source.adapter), from: 'sample' };
  };
})();
