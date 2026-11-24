// 장미 블롭 디자인 설정 — "장미"에 관한 디자인 지식은 여기에만 둔다.
//   대표 5개는 공원 사진·설명을 참고해 하나씩 꼼꼼하게 (사진을 입히지는 않음, 참고만)
//   나머지 장미들은 모양 종류 4가지 중 하나(data/rose-shapes.js) + 사진에서 뽑은 그 장미의 색 (data/rose-colors.js)
//   (사진 색이 없는 장미는 아래 SAMPLE_COLORS 7가지를 돌려 씀)
//
// 조절 값의 뜻은 js/blobShapes.js 맨 위 설명 참고.
// 색은 API 데이터가 아니라 '디자인으로 정한 색'이다 (API 꽃색 필드는 비어 있음).

(function () {
  const BY_NAME = {
    // 2026-11-24 한 송이씩 다듬기: 둥근(공 모양) 틀로 바꿈 — 노랑 공, 접힌 끝은 연노랑
    '에버골드': {"dense": 0.8, "flare": -0.6, "height": 0, "innerOpen": 0.3, "open": 0.56, "petalWidth": 1.2, "petals": 7, "pointy": 0, "quarter": 0.2, "rimOpen": 0.2, "ringShade": 0.8, "rings": 8, "ruffle": 0.6, "seams": 0.6, "spiral": 0.78, "spread": 0.6, "ball": 1, "ballWalls": 3, "ballFill": 1, "ballDome": 0.6, "messy": 0.3, "natAsym": 0.2, "ballRoll": 0.9, "ballOpen": 0.85, "ballFold": 0.45, "ballRim": 0.35, "ballPeel": 0.5, "colors": {"center": "#F0BE3E", "outer": "#F8DC66", "edge": "#FCF1B4", "name": "#CF9A10"}},
    // 2026-11-24 한 송이씩 다듬기: 컵 틀로 바꿈 — 크림 바깥, 위층일수록 살구빛
    '폴리카르드': {"bud": 0.83, "budReach": 0.7, "dense": 0.5, "flare": 0.35, "height": 0.1, "layerShade": 0.25, "open": 0.57, "outerPointy": 0, "petalWidth": 1.18, "petals": 8, "pointy": 0, "reflex": 0, "rimOpen": 0.15, "ringShade": 0.4, "rings": 8, "ruffle": 0.1, "seams": 1.035, "spiral": 1.42, "spread": 0.71, "tip": 0, "ringTint": 0.85, "outline": 0.3, "colors": {"center": "#F2A276", "outer": "#FCF2E8", "outline": "#E8CDB8", "name": "#E08E68"}},
    // 2026-11-24 한 송이씩 다듬기: 날개형 틀(마틸다 방식)로 바꿈 — 밑동 흰빛 → 분홍 끝, 노란 수술
    '린': {"flare": 0.6, "height": 0.35, "innerOpen": 0.55, "layerShade": 0.2, "messy": 0.5, "open": 0.75, "petalWidth": 1.25, "petals": 7, "pointy": 0.25, "ringShade": 0.3, "rings": 3, "ruffle": 0.6, "seams": 1.022, "spiral": 1, "spread": 0.85, "natEdge": 1, "natPetal": 0.9, "innerLight": 0.3, "centerEdge": 0, "outline": 0.35, "threads": 1, "core": 0.8, "stamenSpread": 0.6, "stamenThick": 0.5, "stamenSize": 0.8, "rimOpen": 0, "crease": 1, "creaseDir": 1, "reflex": 0.9, "ringsSkip": 1, "colors": {"center": "#FBEFF2", "outer": "#EE5C8A", "outline": "#E4588A", "stamen": "#E9B23A", "filament": "#F6C9D6", "name": "#E04C80"}},
    // 가운데가 높이 솟은 반쯤 핀 모양, 끝이 뾰족 — 노랑 바탕에 꽃잎 끝만 빨강
    '데저트 피스': {
      petals: 7, rings: 4, open: 0.3, spread: 0.55, flare: 0.65, pointy: 0.9, height: 0.85, ruffle: 0, spiral: 1.0,
      colors: { center: '#F5C443', outer: '#F7D86A', edge: '#E2454F' }
    },
    // 2026-11-24 한 송이씩 다듬기: 날개형 틀(피스 방식)로 바꿈 — 복숭아빛 밑동 → 연어빛 분홍
    '엘르': {"flare": 0.6, "height": 0.4, "innerOpen": 0.45, "layerShade": 0.25, "messy": 0.5, "open": 0.75, "petalWidth": 1.25, "petals": 7, "pointy": 0.25, "ringShade": 0.35, "rings": 4, "ruffle": 0.6, "seams": 0.99, "spiral": 1, "spread": 0.85, "rimOpen": 0, "natEdge": 1, "natPetal": 0.9, "innerLight": 0.15, "centerEdge": 0, "crease": 1, "creaseDir": 1, "reflex": 0.9, "threads": 0, "colors": {"center": "#F7CDB8", "outer": "#F3A6B0", "name": "#E0828E"}}
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
  function shapeVariant(type, name, table) {
    const vary = (table || SHAPE_VARY)[type];   // table: 어느 범위표를 쓸지 (없으면 예전 SHAPE_VARY)
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
  // ---------- 새 분류로 만드는 틀 (2026-11-23, 1차: 평평 · 컵·하이센터) ----------
  //   분류는 data/rose-forms.js (사진을 보며 사용자와 함께 정함)
  //
  //   장미 ─▶ 모양(form) + 꽃잎 겹 수(layers) ─▶ 가운데 틀 (FORM_TYPES)      ← 같은 분류는 가운데 패턴을 함께 씀
  //        └▶ 바깥층 꽃잎 끝(tip)            ─▶ 바깥층만 바꾸는 값 (TIP_LAYER) ← 장미끼리 차이는 주로 여기서
  //        └▶ 이름으로 정해지는 작은 흔들림     ─▶ FORM_VARY (범위를 좁게: 가운데 패턴이 흐트러지지 않게)
  const FORM_TYPES = {
    // 평평 — 꽃잎이 옆으로 펼쳐져 접시처럼 납작. 겹 수에 따라 틀이 셋
    flat1: { petals: 5, rings: 1, open: 0.65, spread: 0.65, flare: 0.2,  pointy: 0,    height: 0, ruffle: 0.2,  spiral: 0.3, core: 2.2, petalWidth: 0.72, threads: 1, seams: 1 },   // 홑: 한 겹, 수술 크게
    // 반겹: 두 겹, 수술 보임. 안쪽 겹이 뜨지 않고 바깥 겹과 포개지게 (layerEven), 안쪽도 바깥만큼 눕힘 (innerOpen) — 2026-11-23 사용자 피드백
    //   (2차 피드백: 안쪽 겹을 더 크게(evenRatio 0.97) · 더 눕혀 바깥 겹에 더 포개지게(innerOpen 1.3) · 겹 경계 그늘 ringShade)
    //   (3차 피드백: 라벤더 드림·안젤라 "녹아웃처럼 위층" → 가운데 색이 안쪽 겹을 덮어 뿌옇던 것을 centerSpread 0으로: 안쪽 겹도 꽃잎 색)
    flat2: { petals: 6, rings: 2, open: 0.7,  spread: 0.75, flare: 0.25, pointy: 0.05, height: 0, ruffle: 0.25, spiral: 0.6, core: 1.5, petalWidth: 0.85, threads: 1, seams: 0.6, innerOpen: 1.3, layerEven: 1, evenRatio: 0.97, ringShade: 0.8, centerSpread: 0 },
    flat3: { petals: 8, rings: 4, open: 0.75, spread: 0.85, flare: 0.3,  pointy: 0.1,  height: 0, ruffle: 0.3,  spiral: 1.0, petalWidth: 1.0, innerOpen: 0.6, ringShade: 0.8 },        // 겹: 여러 겹이 넓게 (겹 경계 그늘)
    // 컵·하이센터 — 안쪽층은 모두 비슷: 가운데를 봉오리처럼 감싸고, 바깥 꽃잎이 위로 감싸 높이가 있음
    //   (2026-11-23 사용자 피드백: 안쪽을 더 빽빽하게 여러 겹 감기게 → 겹 9·봉오리 0.9·dense, 꽃잎은 넓게, 꽃잎끼리 구분되게 seams)
    cup:   { petals: 8, rings: 9, open: 0.6,  spread: 0.72, flare: 0.6,  pointy: 0,    height: 0.1, ruffle: 0.1, spiral: 1.3, petalWidth: 1.2, bud: 0.9, budReach: 0.7, dense: 0.5, rimOpen: 0.15, seams: 0.8, ringShade: 0.8 }   // ringShade: 층과 층이 갈라져 보이게 (2차 피드백)
  };
  // 둥근 · 이게뭐고 안의 패턴 (2026-11-23 사용자 분류, data/rose-forms.js 의 pattern)
  //   quarter     패턴 1 "안이 4등분" — 바깥 꽃잎이 공처럼 감싸고, 안쪽 꽃잎이 네 무리로 나뉨
  //   quarterOpen 패턴 2 "4등분되지만 더 펴짐" — 같은 4등분, 바깥 겹이 낮게 벌어져 납작
  //   wing        패턴 4 "펼쳐진 날개형" — 크고 물결진 꽃잎이 장마다 다르게 흐트러져 펼쳐짐
  FORM_TYPES.quarter     = { petals: 9, rings: 7, open: 0.5,  spread: 0.6,  flare: -0.6, pointy: 0,    height: 0, ruffle: 0.2, spiral: 0.9, petalWidth: 1.1,  dense: 0.8, innerOpen: 0.3, rimOpen: 0.2, quarter: 1, ringShade: 0.8, seams: 0.8 };
  FORM_TYPES.quarterOpen = { petals: 9, rings: 6, open: 0.75, spread: 0.8,  flare: -0.1, pointy: 0,    height: 0, ruffle: 0.25, spiral: 0.9, petalWidth: 1.1, dense: 0.7, innerOpen: 0.5, rimOpen: 0.6, quarter: 1, ringShade: 0.8, seams: 0.8 };
  FORM_TYPES.wing        = { petals: 7, rings: 4, open: 0.7,  spread: 0.85, flare: 0.45, pointy: 0.1,  height: 0, ruffle: 0.8, spiral: 1.0, petalWidth: 1.15, innerOpen: 0.5, messy: 0.8, ringShade: 0.6, seams: 0.5 };
  //   stripeCup / stripeFlat  패턴 3 "색이 반반·섞임" = 줄무늬 장미 4송이. 모양은 컵·하이센터 / 평평 겹 틀을 그대로 쓰고 줄무늬만 더함
  const PATTERN_TYPE = { quarter: 'quarter', quarterOpen: 'quarterOpen', wing: 'wing', stripeCup: 'cup', stripeFlat: 'flat3' };
  // 줄무늬 장미마다 줄 모양 (사진 보고 정함): stripes 줄무늬 양 · stripeScale 굵기 (0 가는 줄·점 … 1 굵은 줄)
  const STRIPE_STYLE = {
    '맛쯔리':         { stripes: 0.55, stripeScale: 0.9, stripeMode: 0 },   // 굵은 크림색 줄이 꽃잎을 반반
    '카렌':           { stripes: 0.45, stripeScale: 0.1, stripeMode: 1 },   // 꽃잎 끄트머리만 불규칙하게 흰색 (피드백)
    '퍼플타이거':     { stripes: 0.5,  stripeScale: 0.5, stripeMode: 2 },   // 구역에 연분홍이 몰려 있고 나머지는 진분홍 (피드백)
    '오렌지스플래쉬': { stripes: 0.45, stripeScale: 0.4, stripeMode: 1 }    // 카렌과 같은 방식 (피드백)
  };
  const STRIPE_DEFAULT = { stripes: 0.45, stripeScale: 0.5 };

  // 바깥층 꽃잎 끝 (컵·하이센터): 안쪽층은 그대로, 바깥 1~2겹의 끝 모양만 바꿈
  //   outerPointy 끝 뾰족함 · reflex 양옆이 뒤로 말림 · tip 끝을 한 점으로 모음 · flareAdd 끝 젖힘을 더하거나 뺌 · widthAdd 꽃잎 폭을 더함
  const TIP_LAYER = {
    // 뾰족 (더 뾰족하되 꽃잎은 넓게 — 2026-11-23 피드백). 꽃잎이 넓으면 옆 꽃잎에 끝이 묻혀서, 끝을 한 점으로 더 모으고(tip 1) 더 젖힘
    pointed: { outerPointy: 1,    reflex: 1.6, tip: 1.0,  flareAdd: 0.6,  widthAdd: 0.1 },
    between: { outerPointy: 0.45, reflex: 0.4, tip: 0.12, flareAdd: 0,    widthAdd: 0 },    // 애매
    rounded: { outerPointy: 0,    reflex: 0,   tip: 0,    flareAdd: -0.25, widthAdd: 0 }    // 둥근
  };
  // 같은 틀 안에서 장미마다 조금씩 (예전 SHAPE_VARY보다 범위를 좁게)
  const FORM_VARY = {
    flat1: { petals: [5, 6, true], petalWidth: [0.6, 0.85], ruffle: [0, 0.4], core: [1.8, 2.6], spiral: [0.1, 0.6] },
    flat2: { petals: [6, 8, true], petalWidth: [0.75, 0.95], ruffle: [0.1, 0.45], innerOpen: [1.2, 1.4], spiral: [0.4, 0.9] },
    flat3: { petals: [7, 9, true], rings: [4, 6, true], petalWidth: [0.9, 1.1], ruffle: [0.15, 0.5], spread: [0.75, 0.9], spiral: [0.8, 1.2] },
    cup:   { petals: [7, 9, true], rings: [8, 10, true], petalWidth: [1.1, 1.3], open: [0.52, 0.68], spread: [0.65, 0.8], bud: [0.8, 1.0], spiral: [1.1, 1.5] },
    quarter:     { petals: [8, 10, true], rings: [6, 8, true], petalWidth: [1.0, 1.2], open: [0.42, 0.58], spiral: [0.7, 1.1] },
    quarterOpen: { petals: [8, 10, true], rings: [5, 7, true], petalWidth: [1.0, 1.2], open: [0.68, 0.82], spiral: [0.7, 1.1] },
    wing:        { petals: [6, 8, true], rings: [3, 5, true], petalWidth: [1.05, 1.25], ruffle: [0.6, 1.0], messy: [0.6, 1.0], spread: [0.78, 0.92] }
  };
  // 장미 이름 + 분류 → 모양 값 (색은 빼고). 없으면 null → 예전 방식으로
  function formShapeOf(name, colors) {
    const f = (window.ROSE_FORMS || {})[name];
    if (!f) return null;
    let type = null;
    if (f.form === 'flat') type = 'flat' + Math.min(3, Math.max(1, f.layers || 3));
    else if (f.form === 'cup') type = 'cup';
    else if (f.pattern && PATTERN_TYPE[f.pattern]) type = PATTERN_TYPE[f.pattern];   // 둥근·이게뭐고 중 패턴이 정해진 장미
    if (!type) return null;                                   // 패턴이 없는 둥근·이게뭐고(보류·줄무늬)는 아직 예전 방식
    const shape = Object.assign({}, FORM_TYPES[type], shapeVariant(type, name, FORM_VARY));
    shape.seed = Math.floor(seededRandom('messy:' + name)() * 1000);   // 흐트러짐(messy)·줄무늬 위치가 장미마다 다르게
    if (colors && colors.stripe) Object.assign(shape, STRIPE_STYLE[name] || STRIPE_DEFAULT);   // 줄무늬 장미
    // 평평 겹꽃: 수술 색이 있는 장미만 가운데를 열어 수술을 보여 줌 (예전 'open'과 같은 규칙)
    if (type === 'flat3' && colors && colors.stamen) { shape.innerOpen = 0.75; shape.core = 1.3; shape.threads = 1; }
    if (type === 'cup') {
      const layer = TIP_LAYER[f.tip] || TIP_LAYER.between;    // 꽃잎 끝을 모르면 '애매'
      shape.outerPointy = layer.outerPointy;
      shape.reflex = layer.reflex;
      shape.tip = layer.tip;
      shape.flare = shape.flare + layer.flareAdd;
      shape.petalWidth = shape.petalWidth + (layer.widthAdd || 0);
    }
    // 수술이 보이는 평평(홑·반겹)인데 수술 색이 따로 없는 장미: 사진의 '가운데 색'은 사실 수술 색이라 꽃잎(특히 안쪽 겹)이 그 색으로 물듦
    //   → 가운데 색은 수술로 옮기고, 꽃잎 가운데 색은 바깥 색 쪽으로 (2026-11-23 피드백: 라벤더 드림 "녹아웃처럼 위층")
    if ((type === 'flat1' || type === 'flat2') && colors && !colors.stamen && colors.center && colors.outer) {
      const petalCenter = '#' + new THREE.Color(colors.center).lerp(new THREE.Color(colors.outer), 0.8).getHexString();
      shape.colorsFix = Object.assign({}, colors, { stamen: colors.center, center: petalCenter });
    }
    // 하얀(아주 밝은) 장미: 그늘이 잘 안 보여 층끼리 구분이 안 됨 → 겹 경계 그늘·꽃잎 경계선을 더 진하게 (2026-11-23 피드백: 아이스버그·크리스탈훼어리)
    if (shape.ringShade && colors && colors.outer) {
      const hsl = {}; new THREE.Color(colors.outer).getHSL(hsl);
      if (hsl.l > 0.8) {
        const k = Math.min(1, (hsl.l - 0.8) / 0.12);                // 0.8 → 0.92 밝을수록 더 진하게
        shape.ringShade = shape.ringShade + 0.7 * k;
        shape.seams = Math.max(shape.seams || 0, 0.8 + 0.4 * k);
        shape.layerShade = 0.7 + 0.3 * k;
      }
    }
    shape.formType = type + (type === 'cup' ? '·' + (f.tip || 'between') : '');   // 확인용 이름
    return shape;
  }
  window.ROSE_FORM_TYPES = FORM_TYPES;     // 비교 페이지에서 값을 바꿔 보며 맞춤
  window.ROSE_TIP_LAYER = TIP_LAYER;
  window.ROSE_FORM_VARY = FORM_VARY;
  window.ROSE_STRIPE_STYLE = STRIPE_STYLE;   // 비교 페이지에서 줄 모양을 바꿔 보며 맞춤
  window.roseFormShape = formShapeOf;

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
      // 줄무늬 장미: 바탕색으로 칠하고, 줄무늬 색은 틀이 꽃잎마다 줄로 그림 (2026-11-23 줄무늬 작업)
      colors.center = c.base;
      colors.outer = c.base;
      colors.stripe = c.stripe;
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
    const colors = photoColors(item.name);
    // 2) 장미 카드(data/rose-cards.js)가 있으면 카드 값 그대로 — 장미마다 따로 손볼 수 있게 (2026-11-23)
    const card = (window.ROSE_CARDS || {})[item.name];
    if (card && colors) {
      const shape = Object.assign({}, card);
      const useColors = shape.colorsFix || colors;   // 카드에 손본 색이 있으면 그것
      delete shape.colorsFix;
      return Object.assign({ kind: 'card' }, shape, { colors: useColors });
    }
    // 3) 카드가 없으면 계산기: 새 분류(data/rose-forms.js)가 있는 평평 · 컵·하이센터: 가운데 틀 + 바깥층 꽃잎 끝 + 사진 색 (2026-11-23)
    const formShape = colors ? formShapeOf(item.name, colors) : null;
    if (formShape) {
      const useColors = formShape.colorsFix || colors;   // 틀에 맞춰 손본 색이 있으면 그것 (예: 수술 색 옮기기)
      delete formShape.colorsFix;
      return Object.assign({ kind: 'sample', shapeType: formShape.formType }, formShape, { colors: useColors });
    }
    // 4) 나머지: 그 장미의 예전 모양 종류(data/rose-shapes.js) + 사진에서 뽑은 색
    const type = (window.ROSE_SHAPES || {})[item.name];
    //    종류 기본 모양 → 장미마다 조금씩 다른 값(shapeVariant) → 확인 페이지에서 손으로 고친 값(ROSE_SHAPE_FIX, 있으면)
    if (colors && type && SHAPE_TYPES[type]) {
      const fix = (window.ROSE_SHAPE_FIX || {})[item.name] || {};
      return Object.assign({ kind: 'sample', shapeType: type }, shapeOf(type, colors), shapeVariant(type, item.name), fix, { colors: colors });
    }
    if (colors) return Object.assign({ kind: 'sample' }, SAMPLE_SHAPE, { colors: colors });   // 모양 종류가 없으면 공통 모양
    // 5) 사진 색도 없으면: 공통 모양 + 7가지 색 중 하나
    return Object.assign({ kind: 'sample' }, SAMPLE_SHAPE, { colors: SAMPLE_COLORS[index % SAMPLE_COLORS.length] });
  }
})();
