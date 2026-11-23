// 꽃 블롭 만드는 틀 — "장미"를 모른다. 조절 값만 받아서 꽃송이 + 줄기 + 잎 블롭을 만든다.
//
//   FlowerBlob.head(설정, 'lite' | 'full') ─▶ { geo, base, dirs, count }   꽃송이 모양 데이터
//   FlowerBlob.stem(설정)                  ─▶ stemPivot (줄기 + 잎 2장, 휘청거리는 중심)
//   FlowerBlob.material                    모든 꽃송이가 함께 쓰는 재질
//
//   'lite' = 목록용 가벼운 버전 (점이 적음). 같은 설정이면 모양 데이터를 함께 씀(캐시) → 153개도 가벼움
//   'full' = 상세용 촘촘한 버전. 꾹 누르면 모양이 바뀌므로 블롭마다 따로 만듦
//
// 꽃송이 모양의 원리 (진짜 장미처럼 꽃잎을 한 장씩 만들어 겹겹이 두름):
//
//        안쪽 고리: 꽃잎이 거의 똑바로 서서 서로 감쌈 (봉오리)
//        바깥 고리: 꽃잎이 바깥으로 기울어 벌어지고, 끝이 젖혀짐
//
//   꽃잎 한 장 = 숟가락처럼 오목한 곡면. 아래(꽃받침)에서 시작해 위·바깥으로 뻗으며 휘어짐.
//   고리마다 꽃잎 위치를 엇갈리게 놓아 소용돌이처럼 보이게 함.
//
// 조절 값 (모두 선택, 없으면 기본값):
//   petals  바깥 고리의 꽃잎 수            rings   꽃잎 고리 겹 수
//   open    바깥 꽃잎이 기울어진 정도 (0 오므림 … 1 활짝)
//   spread  꽃잎이 벌어진 정도 (바깥 고리로 갈수록 더 벌어짐)
//   flare   꽃잎 끝이 바깥으로 젖혀지는 정도   pointy  꽃잎 끝이 뾰족한 정도 (0 둥글게)
//   outerPointy 바깥층 꽃잎 끝만 뾰족하게 (0 기본 … 1 뾰족). 안쪽층은 그대로 두고 바깥층 끝 모양으로만 장미를 구분할 때 씀
//               (2026-11-23: "안쪽층은 다 비슷하고 바깥층 꽃잎 끝에서 차이가 난다"는 분류 결과에서 추가)
//   layerEven   안쪽 겹을 바깥 겹과 비슷하게 (0 기본: 안쪽 꽃잎은 짧고 조금 위에 붙음 … 1 바깥보다 조금만 짧고 같은 높이에 붙어 포개짐, 반겹)
//   evenRatio   layerEven일 때 가장 안쪽 겹 꽃잎 길이 ÷ 바깥 겹 꽃잎 길이 (0.88 기본 … 1이면 같은 크기)
//   quarter     안쪽 꽃잎을 네 무리로 모음 (0 기본 … 1 안쪽이 4등분되어 네 덩어리, 무리 사이 골이 어둡게. 옛날 장미의 4등분 모양)
//   messy       꽃잎마다 기울기·길이·자리를 조금씩 다르게 (0 기본: 고르게 … 1 날개처럼 흐트러지게)
//   seed        messy의 '가짜 무작위' 씨앗 (장미마다 다른 수를 주면 흐트러진 모양도 장미마다 다름)
//   stripes     줄무늬 양 (0 기본: 없음 … 1 줄무늬 색이 많이). colors.stripe가 있을 때만
//   stripeScale 줄 굵기 (0 가는 줄·점 … 1 굵은 줄이 꽃잎을 반반 나눔). 줄은 꽃잎 밑동 → 끝 방향으로 흐르고, 꽃잎마다 위치가 다름
//   stamenSpread 수술이 바깥으로 퍼지는 정도 (1 기본: 발산하듯 퍼짐 … 0.3 가운데에 조밀하게 모여 위로 솟음)
//   stamenCount 수술 가닥 수 배율 (1 기본: 상세 28 · 밭 12) · stamenSize 꽃밥 크기 배율 (1 기본)
//   centerEdge  가운데 색이 끝나는 곳 (0 기본: 꺼짐, centerSpread 방식 … 0.3 = 꽃잎 밑동부터 30%까지만 가운데 색, 그 뒤는 바깥 색)
//   stripeMode  줄무늬 방식 (0 줄 · 1 꽃잎 끝에만 불규칙한 얼룩 · 2 꽃 전체를 큰 구역으로 나눈 얼룩)
//   ringShade   겹 경계 그늘 (0 기본 … 1 꽃잎 밑동은 어둡게·끝은 살짝 밝게 → 위 겹의 밝은 끝이 아래 겹의 어두운 밑동 위에 놓여 층이 갈라져 보임)
//   height  안쪽 꽃잎이 길게 솟은 정도 (하이브리드 티처럼 가운데가 높은 모양)
//   ruffle  꽃잎 가장자리 물결              spiral  고리마다 엇갈리는 정도 (소용돌이)
//   core    가운데 심(수술) 크기 (1 기본, 홑꽃처럼 수술이 크게 보이는 꽃은 더 크게)
//   innerOpen  안쪽 고리도 벌어지는 정도 (0 기본: 가운데가 봉오리처럼 섬 … 1 안쪽까지 활짝, 반겹꽃)
//   petalWidth 꽃잎 폭 (1 기본: 옆 꽃잎과 넉넉히 겹침 … 작을수록 한 장씩 또렷, 홑꽃)
//   bud     가운데 봉오리를 꽉 말아 감싸는 정도 (0 기본 … 1 하이센터처럼 소용돌이 봉오리)
//   budReach 봉오리처럼 서는 꽃잎이 바깥 겹까지 얼마나 이어지는지 (1 기본 … 작을수록 중간 겹도 봉오리를 감싸며 서서히 눕음)
//   dense   안쪽을 짧은 꽃잎으로 빽빽하게 채우는 정도 (0 기본 … 1 컵 장미처럼 꽉 참)
//   threads 수술을 실처럼 (0 기본: 둥근 심 하나 … 1 가운데에서 수술대가 한 가닥씩 올라오고 끝에 꽃밥, 홑꽃)
//   seams   꽃잎과 꽃잎 사이 경계선 (0 기본 … 1 꽃잎 양옆 가장자리가 살짝 어두워져 한 장씩 나뉘어 보임)
//   reflex  바깥 꽃잎 양옆이 뒤로 말리는 정도 (0 기본 … 1 끝이 뾰족하게 뒤로 젖혀진 하이센터 꽃잎)
//   tip     맨 바깥 꽃잎 끝을 좁혀 뾰족하게 모으는 정도 (0 기본 … 1 끝이 한 점으로 모임)
//   rimOpen 맨 바깥 겹만 더 눕히는 정도 (0 기본 … 1 바깥 겹이 낮게 벌어져 안쪽 겹들이 옆에서도 보임, 컵)
//   centerSpread 가운데 색이 꽃잎 위쪽까지 퍼지는 정도 (0: 금방 바깥 색으로 … 1 꽃잎 중간까지 가운데 색. 기본 0.7)
//   layerShade   겹 그늘 (0 … 1 안쪽 겹·꽃잎 밑동일수록 어둡게 → 겹이 포개진 깊이가 보임. 기본 0.7)
//   colors  { center 가운데, outer 바깥, edge 꽃잎 끝(선택), stamen 수술(선택) }
//   stem / leaf  줄기·잎 색
//   stemLength   줄기 길이 (없으면 STEM_LENGTH)
//   leaves       잎 목록 [{ t 줄기 위→아래 위치 0~1, yaw 줄기를 도는 방향(라디안), lift 들린 정도, size 크기 }]
//                (없으면 줄기 중간에 양쪽으로 2장)

(function () {
  const DEFAULTS = {
    petals: 9, rings: 4, open: 0.5, spread: 0.8, flare: 0.4, pointy: 0.3, height: 0, ruffle: 0, spiral: 0.6, core: 1, innerOpen: 0, petalWidth: 1, bud: 0, budReach: 1, dense: 0, threads: 0, seams: 0, reflex: 0, tip: 0, rimOpen: 0, outerPointy: 0, layerEven: 0, evenRatio: 0.88, ringShade: 0, quarter: 0, messy: 0, seed: 0, stripes: 0, stripeScale: 0.5, stripeMode: 0, centerEdge: 0, stamenSpread: 1, stamenCount: 1, stamenSize: 1, centerSpread: 0.7, layerShade: 0.7,   // 칠하기 (2026-11-18 비교 페이지에서 사용자 확정)
    colors: { center: '#E86B86', outer: '#F7A9B8', edge: null, stamen: null },
    stem: '#5F8F4A', leaf: '#6FAE5A'
  };
  const STEM_LENGTH = 2.6;   // 꽃송이 지름(2)의 1.3배 → 꽃이 부각되게 (예전 4.0 = 1:2에서 줄임, 2026-11-18)
  const STEM_TOP = -0.5;     // 줄기가 꽃송이(반지름 1로 맞춘 뒤) 아래에 붙는 높이
  // 촘촘함: full = 상세(누르기용), lite = 목록(가볍게)
  const QUALITY = {
    full: { U: 11, V: 10, steps: 8, ballW: 18, ballH: 12 },
    lite: { U: 4, V: 4, steps: 4, ballW: 8, ballH: 5 }
  };

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const WHITE = new THREE.Color(1, 1, 1);   // 겹 경계 그늘에서 꽃잎 끝을 살짝 밝힐 때 씀

  function buildHead(settings, quality) {
    const { U, V, steps } = QUALITY[quality];
    const P = Object.assign({}, DEFAULTS, settings);
    P.colors = Object.assign({}, DEFAULTS.colors, settings.colors || {});
    const cCenter = lin(P.colors.center), cOuter = lin(P.colors.outer);
    const cEdge = P.colors.edge ? lin(P.colors.edge) : null;
    const cStamen = P.colors.stamen ? lin(P.colors.stamen) : null;
    const cStripe = P.colors.stripe && P.stripes > 0 ? lin(P.colors.stripe) : null;   // 줄무늬 색 (줄무늬 장미만)
    const cGreen = lin(P.stem).lerp(lin(P.leaf), 0.4);
    // 바깥 색이 얼마나 하얀가 (0 보통 … 1 아주 하얌): 겹 경계 그늘(ringShade)을 하얀 꽃에 맞게 바꿀 때 씀
    const lightK = smooth(0.55, 0.8, (cOuter.r + cOuter.g + cOuter.b) / 3);

    const positions = [], colors = [], indices = [];
    const c = new THREE.Color();
    const push = (x, y, z, col) => { positions.push(x, y, z); colors.push(col.r, col.g, col.b); return positions.length / 3 - 1; };

    // ---------- 꽃잎들 ----------
    const R = Math.max(1, P.rings);
    for (let k = 0; k < R; k++) {
      const outer = R > 1 ? k / (R - 1) : 1;                         // 0 안쪽 고리 … 1 바깥 고리
      const inner = 1 - outer;
      const budK = P.bud * Math.pow(inner, P.budReach);              // 이 고리가 봉오리처럼 말리는 정도 (안 → 바깥으로 서서히 줄어듦)
      const denseK = P.dense * inner;                                // 이 고리가 짧은 꽃잎으로 빽빽한 정도
      const n = Math.max(3, Math.round(P.petals * (0.5 + 0.5 * outer) * (1 + denseK)));
      // 꽃잎 길이: 기본은 안쪽일수록 짧음 (0.62 … 1.12). layerEven만큼 '바깥보다 조금만 짧게'(안쪽 끝 0.88배) 쪽으로 당김
      const baseLen = (0.62 + 0.5 * outer) * (1 - P.layerEven) + 1.12 * (1 - (1 - P.evenRatio) * inner) * P.layerEven;
      const L = baseLen * (1 + P.height * 0.55 * inner) * (1 - 0.25 * denseK); // 꽃잎 길이
      const r0 = 0.04 + 0.16 * outer;                                          // 꽃잎이 붙는 자리 (가운데에서 떨어진 거리)
      const y0 = -0.32 + 0.06 * inner * (1 - P.layerEven) + 0.18 * denseK;     //   높이: 안쪽 겹은 조금 위 (layerEven이면 바깥과 같은 높이) · 빽빽한 안쪽은 위로 올려 컵을 채움
      const tilt0 = Math.min(1.45, 0.06 + 0.9 * P.open * Math.pow(outer, 1.2) + 0.5 * P.spread * outer
                             + P.innerOpen * 0.9 * inner) * (1 - 0.85 * budK)   // 기울기 (안쪽 고리: innerOpen만큼 벌어짐, bud만큼 곧게 섬)
                             + P.rimOpen * 0.45 * Math.pow(outer, 8);           //        (맨 바깥 고리: rimOpen만큼 더 눕힘)
      const curl = P.flare * 1.1 * Math.pow(outer, 1.5) + P.spread * 0.35 * outer
                   - 1.6 * budK                                                          // 끝 젖힘 (봉오리 꽃잎은 끝이 안쪽으로 말려 가운데를 덮음)
                   + P.rimOpen * 1.0 * Math.pow(outer, 8);                               //        (맨 바깥 고리는 안으로 오므리지 않게)
      const span = (2 * Math.PI / n) * (2.1 - 0.5 * outer) * P.petalWidth * (1 + 0.9 * budK); // 꽃잎 폭 (봉오리는 넓게 감쌈)
      const cup = 0.5 * inner + 0.15 - P.flare * 0.45 * outer + 0.7 * budK  // 오목함 (+ 안쪽으로 감쌈, - 바깥으로 젖힘)
                + 0.8 * denseK;                                             // 빽빽한 안쪽 꽃잎은 숟가락처럼 오목하게 → 겹마다 작은 컵
      const pointy = Math.min(1, P.pointy * (1 - budK)                      // 봉오리 꽃잎은 둥글게 (뾰족함은 바깥 꽃잎만)
                   + P.outerPointy * Math.pow(outer, 6));                   // 바깥층(바깥 1~2겹)만 끝을 더 뾰족하게 (outer^6: 안쪽 겹엔 거의 안 걸림)
      const off = k * (Math.PI / n) + P.spiral * k * 0.45;

      // 4등분 (quarter): 안쪽 겹일수록 강하게. 꽃잎을 네 무리로 모으고, 무리 사이에 접힌 골을 만듦
      const qK = P.quarter * smooth(0.2, 0.85, inner);
      for (let j = 0; j < n; j++) {
        let az = off + j * 2 * Math.PI / n;
        // 흐트러짐 (messy): 꽃잎마다 '가짜 무작위' 3개 → 기울기·길이·위치를 조금씩 다르게 (같은 장미는 늘 같은 모양)
        const rnd = i => { const x = Math.sin((k * 31 + j) * 12.9898 + i * 78.233 + P.seed * 0.618) * 43758.5453; return x - Math.floor(x) - 0.5; };
        const tiltJ = tilt0 + P.messy * 0.45 * rnd(1) * (0.3 + outer);
        const LJ = L * (1 + P.messy * 0.3 * rnd(2));
        az += P.messy * 0.3 * (2 * Math.PI / n) * rnd(3);
        // 4등분: 가장 가까운 '4분의 1 중심선'(qc)으로 꽃잎 자리를 당김. qEdge = 무리 가장자리일수록 1 (골 그늘에 씀)
        let qEdge = 0;
        if (qK > 0) {
          const QUAD = Math.PI / 2, qOff = Math.PI / 4;
          const qc = qOff + Math.round((az - qOff) / QUAD) * QUAD;
          qEdge = Math.min(1, Math.abs(az - qc) / (QUAD / 2));
          az += (qc - az) * 0.8 * qK;
        }
        const start = positions.length / 3;
        for (let iv = 0; iv <= V; iv++) {
          for (let iu = 0; iu <= U; iu++) {
            const u = iu / U, v = iv / V, w2 = (2 * u - 1) * (2 * u - 1);
            // 꽃잎 윤곽: 가장자리일수록 덜 뻗음 → 둥근 끝 (pointy면 뾰족한 끝)
            const ve = v * (1 - (0.16 + 0.55 * pointy) * w2);
            // 꽃잎 길이 방향 곡선: 아래에서 시작해 기울기 + 끝 젖힘만큼 휘며 뻗음
            let rad = r0, y = y0;
            for (let s = 1; s <= steps; s++) {
              const vv = ve * s / steps, th = tiltJ + curl * vv * vv;
              rad += Math.sin(th) * LJ * ve / steps;
              y += Math.cos(th) * LJ * ve / steps;
            }
            const width = Math.pow(Math.sin(Math.PI * (0.18 + 0.66 * ve)), 0.3);  // 둥글고 넓은 꽃잎
            // 맨 바깥 고리(pow 8)만: 몸통은 넓게 해서 옆 꽃잎과 겹치게 하고, 끝(v → 1) 가까이에서만 좁혀 한 점으로 모음 (tip)
            const tipK = P.tip * Math.pow(outer, 8);
            const taper = (1 + 0.45 * tipK) * (1 - 0.9 * tipK * Math.pow(smooth(0.6, 1, v), 1.6));
            const phi = az + (u - 0.5) * span * width * taper;
            rad -= cup * 0.2 * w2 * (0.3 + ve);                            // 오목하게
            rad += P.ruffle * 0.035 * Math.sin(u * Math.PI * 6 + k) * ve * ve; // 가장자리 물결
            // 뒤로 말린 꽃잎: 바깥 고리 꽃잎의 양옆 가장자리가 끝 쪽에서 바깥·아래로 말림 → 가운데 줄기만 남아 끝이 뾰족해 보임
            const roll = P.reflex * Math.pow(outer, 1.5) * w2 * smooth(0.35, 1, ve);
            rad -= roll * 0.14;                                            // 양옆이 안쪽으로 → 위에서 보면 끝이 뾰족한 윤곽
            y -= roll * 0.3;                                               // 양옆이 뒤(아래)로 말림
            // 색: 꽃잎 아래쪽·안쪽 고리 = 가운데 색, 꽃잎 끝·바깥 고리 = 바깥 색
            //   centerSpread만큼 바깥 색으로 바뀌기 시작하는 곳을 꽃잎 위쪽으로 미룸 (가운데 색이 넓게)
            const cs = P.centerSpread;
            if (P.centerEdge > 0) c.copy(cCenter).lerp(cOuter, smooth(P.centerEdge - 0.07, P.centerEdge + 0.07, ve));   // 경계를 정해 칠함: 밑동~centerEdge까지만 가운데 색
            else c.copy(cCenter).lerp(cOuter, smooth(0.3 * cs, 1, (0.35 - 0.2 * cs) * outer + 0.75 * ve));
            // 줄무늬: 꽃잎 폭 방향(u)으로 물결 두 개를 겹쳐 '줄'을 만들고, 끝 방향(ve)으로 살짝 흔들어 자연스럽게
            //   굵은 줄(stripeScale 1) = 꽃잎에 줄 1~2개 … 가는 줄(0) = 줄 여러 개가 끊어지며 점처럼
            //   stripeMode: 0 줄 (밑동 → 끝으로 흐르는 줄) · 1 끝 얼룩 (꽃잎 끄트머리에만 불규칙하게) · 2 구역 (꽃 전체를 큰 구역으로 나눠 한쪽에 몰림)
            //   (2026-11-23 피드백: 카렌·오렌지스플래쉬 "끄트머리만 불규칙하게", 퍼플타이거 "구역에 연분홍이 몰려 있음")
            if (cStripe) {
              const ph = rnd(4) * 7, ph2 = rnd(5) * 11;                           // 꽃잎마다 무늬 위치가 다르게
              const thr = 1 - 1.6 * P.stripes;                                     // 줄무늬 양이 많을수록 문턱이 낮아짐
              let m = 0;                                                           // 이 점이 줄무늬 색인 정도 (0 … 1)
              if (P.stripeMode === 1) {
                // 끝 얼룩: 꽃잎 폭 방향으로 불규칙한 물결 → 끝(ve 1) 쪽에서만, 끝에 가까울수록 더 넓게
                const f = 0.55 * Math.sin((u * 3.1 + ph) * 2 * Math.PI) + 0.45 * Math.sin((u * 7.3 + ph2 + ve * 2) * 2 * Math.PI);
                const reach = smooth(0.45, 1, ve);                                 // 끝 쪽 50%에서만
                m = smooth(thr - 0.15, thr + 0.15, f + reach * 0.9 - 0.45) * reach;
              } else if (P.stripeMode === 2) {
                // 구역: 꽃잎 하나가 아니라 꽃 전체의 방향(phi)과 겹(k)으로 정하는 큰 얼룩 → 이웃 꽃잎이 같은 구역을 나눠 가짐
                const g = Math.sin(phi * 1.0 + P.seed) + 0.6 * Math.sin(phi * 2.3 + k * 0.8 + P.seed * 1.7) + 0.35 * Math.sin(ve * 3 + ph);
                m = smooth(thr - 0.25, thr + 0.25, g * 0.6);
              } else {
                // 줄: 꽃잎 폭 방향(u)으로 물결 두 개를 겹쳐 '줄'을 만들고, 끝 방향(ve)으로 살짝 흔듦
                //   굵은 줄(stripeScale 1) = 꽃잎에 줄 1~2개 … 가는 줄(0) = 줄 여러 개가 끊어지며 점처럼
                const freq = 1.2 + 5 * (1 - P.stripeScale);
                let f = 0.6 * Math.sin((u * freq + ph + 0.25 * Math.sin(ve * 4 + ph2)) * 2 * Math.PI)
                      + 0.4 * Math.sin((u * freq * 2.3 + ph2 + ve * 0.8) * 2 * Math.PI);
                f *= 1 - (1 - P.stripeScale) * 0.6 * smooth(0.2, 0.9, Math.sin(ve * 11 + ph * 3)); // 가는 줄은 중간중간 끊어짐
                m = smooth(thr - 0.1, thr + 0.1, f);
              }
              c.lerp(cStripe, m * smooth(0.05, 0.3, ve));                          // 꽃잎 맨 밑동은 바탕색
            }
            c.multiplyScalar(0.82 + 0.18 * smooth(0, 0.5, ve));            // 꽃잎 밑동은 살짝 그늘
            // 겹 그늘: 안쪽 겹일수록(inner), 꽃잎 밑동일수록(1 - ve) 어둡게 → 바깥 겹 꽃잎 끝은 밝기 그대로
            if (P.layerShade > 0) c.multiplyScalar(1 - P.layerShade * (0.3 * inner * (1 - 0.5 * ve) + 0.18 * Math.pow(1 - ve, 2)));
            // 겹 경계 그늘: 밑동(ve 0 근처, 다음 겹 아래로 들어가는 쪽)은 어둡게, 끝(ve 1 근처)은 살짝 밝게
            //   아주 밝은(하얀) 꽃은 조명에 하얗게 날려서 그늘이 안 보임 → 그늘을 꽃잎 위쪽까지 넓히고, 끝 밝히기는 빼고, 전체를 살짝 낮춤
            if (P.ringShade > 0) {
              c.multiplyScalar(1 - P.ringShade * 0.4 * (1 - smooth(0, 0.55 + 0.3 * lightK, ve)));
              c.lerp(WHITE, P.ringShade * 0.1 * (1 - lightK) * smooth(0.75, 1, ve));
              c.multiplyScalar(1 - 0.12 * lightK);
            }
            if (cEdge) c.lerp(cEdge, smooth(0.55, 1, ve) * (0.35 + 0.65 * outer));
            // 꽃잎 경계선: 꽃잎 양옆 가장자리(u가 0이나 1에 가까운 곳)를 살짝 어둡게 → 옆 꽃잎과 겹치는 곳에 자연스러운 선
            if (P.seams > 0) c.multiplyScalar(1 - P.seams * 0.22 * smooth(0.55, 1, w2) * smooth(0.1, 0.5, ve));
            // 4등분 골: 네 무리 사이(무리 가장자리 꽃잎)를 어둡게 → 안쪽이 네 덩어리로 나뉜 게 보임
            if (qK > 0) c.multiplyScalar(1 - 0.5 * qK * smooth(0.4, 1, qEdge));
            push(rad * Math.cos(phi), y, rad * Math.sin(phi), c);
          }
        }
        for (let iv = 0; iv < V; iv++) {
          for (let iu = 0; iu < U; iu++) {
            const a = start + iv * (U + 1) + iu, b = a + 1, d = a + U + 1, e = d + 1;
            indices.push(a, d, b, b, d, e);
          }
        }
      }
    }

    // ---------- 가운데 심(봉오리 또는 수술)과 아래 꽃받침 ----------
    function ball(cx, cy, cz, rx, ry, colorFn, ws = QUALITY[quality].ballW, hs = QUALITY[quality].ballH) {
      const start = positions.length / 3;
      for (let i = 0; i <= hs; i++) {
        const th = Math.PI * i / hs;
        for (let j = 0; j <= ws; j++) {
          const ph = 2 * Math.PI * j / ws;
          const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
          push(cx + x * rx, cy + y * ry, cz + z * rx, colorFn(y, ph));
        }
      }
      for (let i = 0; i < hs; i++) for (let j = 0; j < ws; j++) {
        const a = start + i * (ws + 1) + j, b = a + 1, d = a + ws + 1, e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    const coreCol = cStamen || cCenter;
    if (cStamen && P.threads > 0) {
      // 수술 (2026-11-23 바꿈: 납작한 판 + 알갱이 → 실제 수술처럼)
      //   꽃 가운데에서 가는 실(수술대)이 한 가닥씩 위·바깥으로 휘어 올라오고, 끝에 꽃밥(작은 구슬)이 달림
      //
      //        o   o  o        ← 꽃밥 (수술 색, 조금 진하게)
      //         \  |  /
      //          \ | /         ← 수술대 (수술 색을 밝게)
      //      ─────●─────       ← 가운데 밑동
      const rr = 0.17 * P.core;
      ball(0, -0.07, 0, rr * 0.45, 0.035, () => c.copy(coreCol).multiplyScalar(0.6));   // 가운데 밑동 (작게)
      const count = Math.max(4, Math.round((quality === 'full' ? 28 : 12) * P.stamenCount));   // 수술 가닥 수 (상세 / 밭) × stamenCount
      const sides = quality === 'full' ? 5 : 3, segs = quality === 'full' ? 4 : 2;   // 실 단면 꼭짓점 수 · 마디 수
      const cFil = coreCol.clone().lerp(WHITE, 0.35);                // 수술대 색: 수술 색을 밝게
      // 늘 같은 결과가 나오는 '가짜 무작위' (블롭을 다시 만들어도 수술 자리가 그대로)
      const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
      for (let i = 0; i < count; i++) {
        // 해바라기 씨앗 배치로 밑동 자리를 고르게 퍼뜨림 (황금각만큼 돌리고 바깥으로 sqrt만큼)
        const a = i * 2.39996 + (rand(i) - 0.5) * 0.4;
        const d0 = rr * 0.35 * Math.sqrt((i + 0.5) / count);        // 밑동: 가운데 가까이
        const reachOut = rr * (0.45 + 0.5 * rand(i + 50)) * P.stamenSpread;   // 바깥으로 뻗는 거리 (stamenSpread가 작을수록 안으로 모임)
        const rise = (0.1 + 0.08 * rand(i + 100)) * Math.sqrt(P.core) * (1 + 0.3 * (1 - P.stamenSpread)); // 위로 올라오는 높이 (모일수록 조금 더 높이)
        const ca = Math.cos(a), sa = Math.sin(a);
        // 실을 따라가는 점: t 0(밑동) … 1(끝). 위로 먼저 솟고 바깥으로 휘어짐
        const at = tt => [ca * (d0 + reachOut * tt * tt), -0.06 + rise * Math.sin(tt * Math.PI / 2), sa * (d0 + reachOut * tt * tt)];
        const rad = 0.007 * Math.sqrt(P.core);                       // 실 굵기
        const start = positions.length / 3;
        for (let s = 0; s <= segs; s++) {
          const [px, py, pz] = at(s / segs);
          for (let q = 0; q < sides; q++) {                          // 실 단면 = 작은 다각형 (옆 방향·바깥 방향으로 둘러쌈)
            const th = 2 * Math.PI * q / sides, ox = Math.cos(th) * rad, oy = Math.sin(th) * rad;
            push(px + (-sa) * ox + ca * oy * 0.5, py + oy, pz + ca * ox + sa * oy * 0.5, cFil);
          }
        }
        for (let s = 0; s < segs; s++) for (let q = 0; q < sides; q++) {
          const a0 = start + s * sides + q, a1 = start + s * sides + (q + 1) % sides, b0 = a0 + sides, b1 = a1 + sides;
          indices.push(a0, b0, a1, a1, b0, b1);
        }
        const [tx, ty, tz] = at(1);
        const size = (0.022 + 0.006 * rand(i + 150)) * P.core * P.stamenSize;   // 꽃밥 크기 × stamenSize
        ball(tx, ty, tz, size, size * 0.8, () => c.copy(coreCol).multiplyScalar(0.9), 5, 3);
      }
    } else {
      ball(0, -0.05, 0, 0.17 * P.core, 0.2, (y, ph) => c.copy(coreCol).multiplyScalar(cStamen ? 0.85 + 0.15 * Math.sin(ph * 9) : 0.9));
    }
    ball(0, -0.36, 0, 0.26, 0.2, () => c.copy(cGreen));             // 꽃받침 (줄기가 붙는 곳)

    // ---------- 한 덩어리로 합치고 반지름 1 안에 맞춤 ----------
    let maxLen = 0;
    for (let i = 0; i < positions.length; i += 3) maxLen = Math.max(maxLen, Math.hypot(positions[i], positions[i + 1], positions[i + 2]));
    for (let i = 0; i < positions.length; i++) positions[i] /= maxLen;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const n = positions.length / 3;

    const base = Float32Array.from(geo.attributes.position.array);  // 원래 모양 (누르기에서 되돌아갈 자리)
    const dirs = new Float32Array(n * 3);                            // 각 점의 바깥 방향 (누른 곳과의 거리 계산용)
    for (let v = 0; v < n; v++) {
      const L = Math.hypot(base[v * 3], base[v * 3 + 1], base[v * 3 + 2]) || 1;
      dirs[v * 3] = base[v * 3] / L; dirs[v * 3 + 1] = base[v * 3 + 1] / L; dirs[v * 3 + 2] = base[v * 3 + 2] / L;
    }

    return { geo, base, dirs, count: n };
  }

  // 줄기 + 잎 (상세에 들어갈 때만 만듦)
  const DEFAULT_LEAVES = [{ t: 0.47, yaw: 0, lift: 0.25, size: 1 }, { t: 0.6, yaw: Math.PI, lift: 0.25, size: 1 }];
  function buildStem(settings) {
    const P = Object.assign({}, DEFAULTS, settings);
    const len = P.stemLength || STEM_LENGTH;
    const stemPivot = new THREE.Group();     // 꽃송이 아래 붙는 점 = 휘청거리는 중심
    stemPivot.position.set(0, STEM_TOP, 0);
    // 줄기는 흔들리는 중심(꽃송이 아래 한 점)에서 정확히 시작 → 기울어도 윗끝이 옆으로 비켜 나가지 않음
    //   (예전엔 중심보다 0.15 위에서 시작해서, 흔들릴 때 꽃과 이어진 부분이 어긋나 보였음 — 2026-11-19)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.05, -len * 0.33, 0.02),
      new THREE.Vector3(-0.05, -len * 0.66, -0.01),
      new THREE.Vector3(0.04, -len, 0.02)
    ]);
    const stemMat = new THREE.MeshPhysicalMaterial({ color: lin(P.stem), roughness: 0.5, clearcoat: 0.3 });
    stemPivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.11, 12, false), stemMat));
    // 꽃받침(초록 구슬): 흔들리는 중심에 둔 공. 공은 제자리에서 돌아도 모양이 같아서 볼 관절처럼 이음새를 늘 덮어 줌
    const calyxMat = new THREE.MeshPhysicalMaterial({ color: lin(P.stem).lerp(lin(P.leaf), 0.5), roughness: 0.5, clearcoat: 0.3 });
    stemPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), calyxMat));

    const leafMat = new THREE.MeshPhysicalMaterial({ color: lin(P.leaf), roughness: 0.45, clearcoat: 0.45 });
    const leafGeo = new THREE.SphereGeometry(1, 28, 14);
    leafGeo.scale(0.6, 0.07, 0.27);
    leafGeo.translate(0.62, 0, 0);           // 잎자루 쪽이 줄기에 붙도록
    (P.leaves || DEFAULT_LEAVES).forEach(lf => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0, -len * lf.t, 0);                 // 줄기 위에서 t만큼 내려온 곳
      leaf.rotation.set(0.25 * Math.cos(lf.yaw), lf.yaw, 0.2 + lf.lift); // yaw: 줄기를 빙 둘러 어느 쪽, lift: 위로 들린 정도
      leaf.scale.setScalar(lf.size);
      stemPivot.add(leaf);
    });
    return stemPivot;
  }

  const liteCache = new Map();               // 같은 설정의 가벼운 꽃송이는 한 번만 만들어 함께 씀
  window.FlowerBlob = {
    head(settings = {}, quality = 'full') {
      if (quality !== 'lite') return buildHead(settings, 'full');
      const key = JSON.stringify(settings);
      if (!liteCache.has(key)) liteCache.set(key, buildHead(settings, 'lite'));
      return liteCache.get(key);
    },
    stem: buildStem,
    // 줄기 끝 높이 (꽃송이 반지름 1 기준) — 상세 화면에서 그림자를 줄기 끝 아래에 둘 때 씀
    stemBottom(settings = {}) { return STEM_TOP - (settings.stemLength || STEM_LENGTH); },
    // 모든 꽃송이가 함께 쓰는 재질 (꽃잎은 얇은 면이라 양쪽 다 그림)
    material: new THREE.MeshPhysicalMaterial({
      // 유광(clearcoat) 0.4 → 0.15, 표면 0.45 → 0.51: 하얀 반짝임이 꽃 색을 덜 날리게 (2026-11-18)
      vertexColors: true, roughness: 0.51, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.35,
      side: THREE.DoubleSide
    })
  };

  // 상세 화면 배치에 쓰는 세로 길이 (꽃송이 반지름 1 기준)
  //   줄기 길이가 장미마다 달라도 꽃 크기·자리는 같게: 긴 줄기(약 3.3)에 가깝게 3.0으로 맞춤
  //   → 짧은 줄기는 일찍 끝나고, 긴 줄기는 조금 더 아래로 내려감
  window.FLOWER_BLOB_EXTENT = { top: 1, bottom: STEM_TOP - 3.0 };
})();
