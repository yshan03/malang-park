// 장미 블롭 디자인 설정 — "장미"에 관한 디자인 지식은 여기에만 둔다.
//   대표 5개는 공원 사진·설명을 참고해 하나씩 꼼꼼하게 (사진을 입히지는 않음, 참고만)
//   나머지 장미들은 공통 샘플 모양 하나에 장미 색만 돌려 씀
//
// 조절 값의 뜻은 js/blobShapes.js 맨 위 설명 참고.
// 색은 API 데이터가 아니라 '디자인으로 정한 색'이다 (API 꽃색 필드는 비어 있음).

(function () {
  const BY_NAME = {
    // 꽃잎이 아주 많고 물결치듯 겹겹이 말린 둥근 컵 — "화려한 노란색 물결"
    '에버골드': {
      petals: 11, rings: 5, open: 0.4, spread: 0.6, flare: 0.3, pointy: 0.1, height: 0, ruffle: 0.9, spiral: 0.8,
      colors: { center: '#F2C14E', outer: '#F8E39A' }
    },
    // 크게 활짝, 가운데는 단단한 소용돌이, 바깥 꽃잎은 끝이 뾰족하게 젖혀짐 — 크림 → 복숭아
    '폴리카르드': {
      petals: 9, rings: 4, open: 0.75, spread: 0.95, flare: 0.9, pointy: 0.7, height: 0.1, ruffle: 0.1, spiral: 1.1,
      colors: { center: '#F2A57E', outer: '#FCF0E6' }
    },
    // 꽃잎이 적고 납작하게 활짝 열린 꽃, 가운데 노란 수술 — 진분홍에 흰 흐림
    '린': {
      petals: 6, rings: 2, open: 1.0, spread: 1.0, flare: 0.35, pointy: 0.15, height: 0, ruffle: 0.25, spiral: 0.3,
      colors: { center: '#FBE3EA', outer: '#EE6F95', stamen: '#F2C230' }
    },
    // 가운데가 높이 솟은 반쯤 핀 모양, 끝이 뾰족 — 노랑 바탕에 꽃잎 끝만 빨강
    '데저트 피스': {
      petals: 7, rings: 4, open: 0.3, spread: 0.55, flare: 0.65, pointy: 0.9, height: 0.85, ruffle: 0, spiral: 1.0,
      colors: { center: '#F5C443', outer: '#F7D86A', edge: '#E2454F' }
    },
    // 크고 꽃잎이 풍성한 둥근 장미, 가운데가 살짝 높음 — 연분홍 → 가운데 살구빛
    '엘르': {
      petals: 10, rings: 5, open: 0.5, spread: 0.75, flare: 0.45, pointy: 0.25, height: 0.3, ruffle: 0.3, spiral: 0.9,
      colors: { center: '#F2A08E', outer: '#F7C6C8' }
    }
  };

  // 공통 샘플: 중간 정도로 핀 기본 장미 모양 하나
  const SAMPLE_SHAPE = { petals: 8, rings: 4, open: 0.5, spread: 0.75, flare: 0.5, pointy: 0.4, height: 0.15, ruffle: 0.1, spiral: 0.8 };
  // 공통 샘플이 돌려 쓰는 장미 색 (가운데, 바깥)
  const SAMPLE_COLORS = [
    { center: '#C8203A', outer: '#E5566F' }, // 빨강
    { center: '#E86B86', outer: '#F7B3C2' }, // 분홍
    { center: '#F2C14E', outer: '#F8E39A' }, // 노랑
    { center: '#EFE6D6', outer: '#FFFBF4' }, // 흰색
    { center: '#F29B78', outer: '#F8C9A8' }, // 살구
    { center: '#9B2F5C', outer: '#C9587F' }, // 진홍
    { center: '#D98CC0', outer: '#EFC3E0' }  // 연보라 분홍
  ];

  window.roseBlobDesign = function (item, index) {
    const own = BY_NAME[item.name];
    if (own) return Object.assign({ kind: 'featured' }, own);
    return Object.assign({ kind: 'sample' }, SAMPLE_SHAPE, { colors: SAMPLE_COLORS[index % SAMPLE_COLORS.length] });
  };
})();
