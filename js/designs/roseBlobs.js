// 장미 블롭 디자인 설정 — "장미"에 관한 디자인 지식은 여기에만 둔다.
//   대표 5개는 공원 사진·설명을 참고해 하나씩 꼼꼼하게 (사진을 입히지는 않음, 참고만)
//   나머지 장미들은 모양 종류 4가지 중 하나(data/rose-shapes.js) + 사진에서 뽑은 그 장미의 색 (data/rose-colors.js)
//   (사진 색이 없는 장미는 아래 SAMPLE_COLORS 7가지를 돌려 씀)
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
    // 꽃잎 3겹으로 활짝 열린 꽃, 가운데 노란 수술 — 진분홍에 흰 흐림
    '린': {
      petals: 8, rings: 3, open: 0.85, spread: 0.85, flare: 0.35, pointy: 0.15, height: 0, ruffle: 0.25, spiral: 0.6,
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

  // 모양 종류 4가지 — 같은 종류의 장미는 이 모양을 함께 씀 (색만 각자 사진 색)
  //   single      ① 홑꽃        꽃잎 한 겹(5장 안팎)이 활짝, 가운데 수술이 크게 보임
  //   highCenter  ② 하이센터    가운데가 높이 솟고 바깥 꽃잎 끝이 뾰족하게 젖혀짐 (꽃집 장미)
  //   cup         ③ 컵          꽃잎이 빽빽하게 겹겹이 들어찬 둥근 컵 (flare가 음수 → 꽃잎 끝이 안쪽으로 오므라듦)
  //   open        ④ 활짝 핀 겹꽃 여러 겹이 넓게 펼쳐짐 (반겹꽃도 여기에 합침)
  //                → 수술 색이 있는 장미만 가운데를 열어 수술을 보여 주고, 없으면 가운데를 꽃잎으로 채움 (shapeOf 참고)
  const SHAPE_TYPES = {
    single:    { petals: 5,  rings: 1, open: 0.65, spread: 0.65, flare: 0.2,  pointy: 0,    height: 0,    ruffle: 0.2,  spiral: 0.3, core: 2.2, petalWidth: 0.72, threads: 1, seams: 1 },
    highCenter:{ petals: 8,  rings: 7, open: 0.6,  spread: 0.7,  flare: 0.95, pointy: 0.9,  height: 0.1,  ruffle: 0,    spiral: 1.4, petalWidth: 0.95, bud: 0.8, budReach: 0.55, reflex: 1, tip: 0.35 },
    cup:       { petals: 10, rings: 6, open: 0.85, spread: 0.75, flare: -1.1, pointy: 0,    height: 0,    ruffle: 0.25, spiral: 1.3, innerOpen: 0.15, petalWidth: 1.2, dense: 1, rimOpen: 0.4 },
    open:      { petals: 8,  rings: 6, open: 0.7,  spread: 0.75, flare: 0.35, pointy: 0.15, height: 0,    ruffle: 0.3,  spiral: 1.0, petalWidth: 1.0 }
  };

  // 종류 + 그 장미의 색 → 실제 모양 값. (종류 안에서 장미마다 달라지는 건 이 규칙뿐)
  function shapeOf(type, colors) {
    const shape = Object.assign({}, SHAPE_TYPES[type]);
    if (type === 'open') {
      // 층과 층이 포개져 보이게: 안쪽 겹도 바깥 겹과 비슷하게 기울여 겹 사이 간격을 줄임
      if (colors && colors.stamen) { shape.innerOpen = 0.75; shape.core = 1.3; shape.threads = 1; }  // 수술이 보이는 장미: 가운데를 열어 수술을 보여 줌
      else { shape.innerOpen = 0.6; }                                             // 수술이 안 보이는 장미: 가운데를 꽃잎으로 채움 (수술 처리는 다음 단계에서)
    }
    return shape;
  }
  // ---------- 같은 종류 안에서도 장미마다 조금씩 다르게 (2026-11-18, 자동 1차) ----------
  //   [최소, 최대] 범위 안에서 이름으로 정해지는 '가짜 무작위' 값을 고름 → 같은 장미는 늘 같은 모양
  //   int: true = 정수(꽃잎 장수·겹 수). 꽃잎 장수의 최솟값은 그 종류다움이 유지되는 선에서 정함 (너무 적어지지 않게)
  //   범위는 종류의 기본값(SHAPE_TYPES)을 가운데 두고 앞뒤로 조금씩
  const SHAPE_VARY = {
    // (2026-11-18 2차: 꽃잎 장수는 그대로, 나머지 값의 범위를 넓혀서 장미끼리 차이가 더 드러나게)
    single:     { petals: [5, 6, true], petalWidth: [0.52, 0.92], open: [0.5, 0.8], spread: [0.5, 0.8], ruffle: [0, 0.55], core: [1.6, 2.8], spiral: [0.05, 0.7] },
    highCenter: { petals: [7, 9, true], rings: [5, 9, true], petalWidth: [0.75, 1.15], open: [0.45, 0.72], spread: [0.55, 0.85], flare: [0.65, 1.2], bud: [0.6, 1.0], tip: [0.15, 0.6], spiral: [1.0, 1.8] },
    cup:        { petals: [9, 12, true], rings: [4, 8, true], petalWidth: [0.95, 1.4], open: [0.72, 0.95], flare: [-1.4, -0.75], ruffle: [0.05, 0.55], rimOpen: [0.2, 0.6], spiral: [0.9, 1.7] },
    open:       { petals: [7, 10, true], rings: [4, 8, true], petalWidth: [0.78, 1.22], open: [0.55, 0.85], spread: [0.62, 0.9], flare: [0.15, 0.65], ruffle: [0.1, 0.6], pointy: [0, 0.35], spiral: [0.6, 1.4] }
  };
  function shapeVariant(type, name) {
    const vary = SHAPE_VARY[type];
    if (!vary) return {};
    const rand = seededRandom('shape:' + (name || ''));   // 줄기 무작위와 겹치지 않게 앞에 'shape:'를 붙임
    const out = {};
    Object.keys(vary).forEach(key => {
      const [min, max, int] = vary[key];
      let u = rand();
      // 꽃잎 장수·겹 수(정수)가 아닌 값은 가운데보다 양 끝 쪽으로 밀어서 뽑음 → "다 비슷한 중간값"이 덜 나오고 차이가 잘 보임
      //   u가 0.5에서 멀수록 더 멀리: 0.5 ± (|2u-1|^0.6)/2  (0.6 < 1 이라 끝 쪽으로 쏠림)
      if (!int) u = 0.5 + Math.sign(u - 0.5) * Math.pow(Math.abs(2 * u - 1), 0.6) / 2;
      const v = min + (max - min) * u;
      out[key] = int ? Math.min(max, Math.floor(v + 0.5)) : Math.round(v * 100) / 100;
    });
    return out;
  }
  window.ROSE_SHAPE_VARY = SHAPE_VARY;     // 확인 페이지에서 씀
  window.roseShapeVariant = shapeVariant;

  window.ROSE_SHAPE_TYPES = SHAPE_TYPES;   // 확인용 도감에서도 씀
  window.roseShapeOf = shapeOf;

  // 공통 샘플: 중간 정도로 핀 기본 장미 모양 하나
  const SAMPLE_SHAPE = { petals: 8, rings: 4, open: 0.5, spread: 0.75, flare: 0.5, pointy: 0.4, height: 0.15, ruffle: 0.1, spiral: 0.8 };
  // 사진 색이 없을 때 공통 샘플이 돌려 쓰는 장미 색 (가운데, 바깥)
  const SAMPLE_COLORS = [
    { center: '#C8203A', outer: '#E5566F' }, // 빨강
    { center: '#E86B86', outer: '#F7B3C2' }, // 분홍
    { center: '#F2C14E', outer: '#F8E39A' }, // 노랑
    { center: '#EFE6D6', outer: '#FFFBF4' }, // 흰색
    { center: '#F29B78', outer: '#F8C9A8' }, // 살구
    { center: '#9B2F5C', outer: '#C9587F' }, // 진홍
    { center: '#D98CC0', outer: '#EFC3E0' }  // 연보라 분홍
  ];

  // 사진에서 뽑은 색 찾기 (data/rose-colors.js 의 window.ROSE_COLORS, 장미 이름으로)
  //   돌려주는 값: { center, outer, edge, stamen } — 블롭 틀이 쓰는 색 칸만 골라 담음
  function photoColors(name) {
    const all = window.ROSE_COLORS || {};
    const c = all[name];
    if (!c) return null;                       // 이 장미는 뽑은 색이 없음
    const colors = {};
    if (c.pattern === 'stripe') {
      // 줄무늬 장미: 줄무늬 칠하기는 아직 없어서 우선 바탕색 한 가지로 칠함 (줄무늬는 모양 작업 때)
      colors.center = c.base;
      colors.outer = c.base;
    } else {
      colors.center = c.center;
      colors.outer = c.outer;
    }
    if (c.edge) colors.edge = c.edge;          // 꽃잎 끝 색 (있을 때만)
    if (c.stamen) colors.stamen = c.stamen;    // 수술 색 (있을 때만)
    return colors;
  }

  // ---------- 줄기·잎: 장미마다 다르게 (이름으로 정해지는 '가짜 무작위' → 열 때마다 같음) ----------
  //   줄기 길이 3그룹: 짧게(약 2.0) · 보통(2.6) · 길게(약 3.3)
  //   잎 1~3장: 줄기 위 높이, 둘러 붙는 방향, 들린 정도, 크기를 장미마다 다르게
  function seededRandom(text) {
    let h = 2166136261;                                   // 이름 글자로 시작값 만들기 (FNV 해시)
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {                                  // 부를 때마다 0~1 사이 다음 수
      h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }
  const STEM_GROUPS = [2.0, 2.6, 3.3];
  function stemStyle(name) {
    const rand = seededRandom(name || '');
    const stemLength = STEM_GROUPS[Math.floor(rand() * 3)] + (rand() - 0.5) * 0.15;
    const count = 1 + Math.floor(rand() * 3);              // 잎 1~3장
    const leaves = [];
    let side = rand() < 0.5 ? 0 : Math.PI;                // 첫 잎이 오른쪽(0) / 왼쪽(π)
    for (let i = 0; i < count; i++) {
      leaves.push({
        t: 0.3 + 0.5 * (count === 1 ? rand() : (i + rand() * 0.6) / count),  // 위아래로 고루 흩어지게
        yaw: side + (rand() - 0.5) * 1.2,                  // 대체로 옆으로 (화면 쪽을 정면으로 향하면 고리처럼 보여서 피함)
        lift: 0.1 + rand() * 0.4,
        size: 0.8 + rand() * 0.35
      });
      side += Math.PI;                                     // 다음 잎은 반대쪽 (어긋나게)
    }
    return { stemLength, leaves };
  }

  window.roseBlobDesign = function (item, index) {
    return Object.assign(designOf(item, index), stemStyle(item.name));
  };
  function designOf(item, index) {
    // 1) 대표 5개: 손으로 디자인한 모양과 색
    const own = BY_NAME[item.name];
    if (own) return Object.assign({ kind: 'featured' }, own);
    // 2) 나머지: 그 장미의 모양 종류(data/rose-shapes.js) + 사진에서 뽑은 색
    const colors = photoColors(item.name);
    const type = (window.ROSE_SHAPES || {})[item.name];
    //    종류 기본 모양 → 장미마다 조금씩 다른 값(shapeVariant) → 확인 페이지에서 손으로 고친 값(ROSE_SHAPE_FIX, 있으면)
    if (colors && type && SHAPE_TYPES[type]) {
      const fix = (window.ROSE_SHAPE_FIX || {})[item.name] || {};
      return Object.assign({ kind: 'sample', shapeType: type }, shapeOf(type, colors), shapeVariant(type, item.name), fix, { colors: colors });
    }
    if (colors) return Object.assign({ kind: 'sample' }, SAMPLE_SHAPE, { colors: colors });   // 모양 종류가 없으면 공통 모양
    // 3) 사진 색도 없으면: 공통 모양 + 7가지 색 중 하나
    return Object.assign({ kind: 'sample' }, SAMPLE_SHAPE, { colors: SAMPLE_COLORS[index % SAMPLE_COLORS.length] });
  }
})();
