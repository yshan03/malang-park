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
//   height  안쪽 꽃잎이 길게 솟은 정도 (하이브리드 티처럼 가운데가 높은 모양)
//   ruffle  꽃잎 가장자리 물결              spiral  고리마다 엇갈리는 정도 (소용돌이)
//   core    가운데 심(수술) 크기 (1 기본, 홑꽃처럼 수술이 크게 보이는 꽃은 더 크게)
//   innerOpen  안쪽 고리도 벌어지는 정도 (0 기본: 가운데가 봉오리처럼 섬 … 1 안쪽까지 활짝, 반겹꽃)
//   petalWidth 꽃잎 폭 (1 기본: 옆 꽃잎과 넉넉히 겹침 … 작을수록 한 장씩 또렷, 홑꽃)
//   bud     가운데 봉오리를 꽉 말아 감싸는 정도 (0 기본 … 1 하이센터처럼 소용돌이 봉오리)
//   budReach 봉오리처럼 서는 꽃잎이 바깥 겹까지 얼마나 이어지는지 (1 기본 … 작을수록 중간 겹도 봉오리를 감싸며 서서히 눕음)
//   dense   안쪽을 짧은 꽃잎으로 빽빽하게 채우는 정도 (0 기본 … 1 컵 장미처럼 꽉 참)
//   threads 수술을 실처럼 (0 기본: 둥근 심 하나 … 1 납작한 판 위에 작은 꽃밥 알갱이들, 홑꽃)
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
    petals: 9, rings: 4, open: 0.5, spread: 0.8, flare: 0.4, pointy: 0.3, height: 0, ruffle: 0, spiral: 0.6, core: 1, innerOpen: 0, petalWidth: 1, bud: 0, budReach: 1, dense: 0, threads: 0, seams: 0, reflex: 0, tip: 0, rimOpen: 0, centerSpread: 0.7, layerShade: 0.7,   // 칠하기 (2026-11-18 비교 페이지에서 사용자 확정)
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

  function buildHead(settings, quality) {
    const { U, V, steps } = QUALITY[quality];
    const P = Object.assign({}, DEFAULTS, settings);
    P.colors = Object.assign({}, DEFAULTS.colors, settings.colors || {});
    const cCenter = lin(P.colors.center), cOuter = lin(P.colors.outer);
    const cEdge = P.colors.edge ? lin(P.colors.edge) : null;
    const cStamen = P.colors.stamen ? lin(P.colors.stamen) : null;
    const cGreen = lin(P.stem).lerp(lin(P.leaf), 0.4);

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
      const L = (0.62 + 0.5 * outer) * (1 + P.height * 0.55 * inner) * (1 - 0.25 * denseK); // 꽃잎 길이
      const r0 = 0.04 + 0.16 * outer, y0 = -0.32 + 0.06 * inner + 0.18 * denseK;  // 꽃잎이 붙는 자리 (빽빽한 안쪽 꽃잎은 위로 올려 컵을 채움)
      const tilt0 = Math.min(1.45, 0.06 + 0.9 * P.open * Math.pow(outer, 1.2) + 0.5 * P.spread * outer
                             + P.innerOpen * 0.9 * inner) * (1 - 0.85 * budK)   // 기울기 (안쪽 고리: innerOpen만큼 벌어짐, bud만큼 곧게 섬)
                             + P.rimOpen * 0.45 * Math.pow(outer, 8);           //        (맨 바깥 고리: rimOpen만큼 더 눕힘)
      const curl = P.flare * 1.1 * Math.pow(outer, 1.5) + P.spread * 0.35 * outer
                   - 1.6 * budK                                                          // 끝 젖힘 (봉오리 꽃잎은 끝이 안쪽으로 말려 가운데를 덮음)
                   + P.rimOpen * 1.0 * Math.pow(outer, 8);                               //        (맨 바깥 고리는 안으로 오므리지 않게)
      const span = (2 * Math.PI / n) * (2.1 - 0.5 * outer) * P.petalWidth * (1 + 0.9 * budK); // 꽃잎 폭 (봉오리는 넓게 감쌈)
      const cup = 0.5 * inner + 0.15 - P.flare * 0.45 * outer + 0.7 * budK  // 오목함 (+ 안쪽으로 감쌈, - 바깥으로 젖힘)
                + 0.8 * denseK;                                             // 빽빽한 안쪽 꽃잎은 숟가락처럼 오목하게 → 겹마다 작은 컵
      const pointy = P.pointy * (1 - budK);                                 // 봉오리 꽃잎은 둥글게 (뾰족함은 바깥 꽃잎만)
      const off = k * (Math.PI / n) + P.spiral * k * 0.45;

      for (let j = 0; j < n; j++) {
        const az = off + j * 2 * Math.PI / n;
        const start = positions.length / 3;
        for (let iv = 0; iv <= V; iv++) {
          for (let iu = 0; iu <= U; iu++) {
            const u = iu / U, v = iv / V, w2 = (2 * u - 1) * (2 * u - 1);
            // 꽃잎 윤곽: 가장자리일수록 덜 뻗음 → 둥근 끝 (pointy면 뾰족한 끝)
            const ve = v * (1 - (0.16 + 0.55 * pointy) * w2);
            // 꽃잎 길이 방향 곡선: 아래에서 시작해 기울기 + 끝 젖힘만큼 휘며 뻗음
            let rad = r0, y = y0;
            for (let s = 1; s <= steps; s++) {
              const vv = ve * s / steps, th = tilt0 + curl * vv * vv;
              rad += Math.sin(th) * L * ve / steps;
              y += Math.cos(th) * L * ve / steps;
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
            c.copy(cCenter).lerp(cOuter, smooth(0.3 * cs, 1, (0.35 - 0.2 * cs) * outer + 0.75 * ve));
            c.multiplyScalar(0.82 + 0.18 * smooth(0, 0.5, ve));            // 꽃잎 밑동은 살짝 그늘
            // 겹 그늘: 안쪽 겹일수록(inner), 꽃잎 밑동일수록(1 - ve) 어둡게 → 바깥 겹 꽃잎 끝은 밝기 그대로
            if (P.layerShade > 0) c.multiplyScalar(1 - P.layerShade * (0.3 * inner * (1 - 0.5 * ve) + 0.18 * Math.pow(1 - ve, 2)));
            if (cEdge) c.lerp(cEdge, smooth(0.55, 1, ve) * (0.35 + 0.65 * outer));
            // 꽃잎 경계선: 꽃잎 양옆 가장자리(u가 0이나 1에 가까운 곳)를 살짝 어둡게 → 옆 꽃잎과 겹치는 곳에 자연스러운 선
            if (P.seams > 0) c.multiplyScalar(1 - P.seams * 0.22 * smooth(0.55, 1, w2) * smooth(0.1, 0.5, ve));
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
      // 실 같은 수술: 납작한 판(조금 어두운 수술 색) 위에 작은 꽃밥 알갱이를 고리 모양으로 흩뿌림
      const rr = 0.17 * P.core;
      ball(0, -0.06, 0, rr * 0.75, 0.05, () => c.copy(coreCol).multiplyScalar(0.7));
      const count = quality === 'full' ? 16 : 9;     // 꽃밥 알갱이 수 (상세 / 밭)
      // 늘 같은 결과가 나오는 '가짜 무작위' (블롭을 다시 만들어도 알갱이 자리가 그대로)
      const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
      for (let i = 0; i < count; i++) {
        // 해바라기 씨앗 배치: 한 알씩 황금각만큼 돌리고, 바깥으로 갈수록 sqrt만큼 벌림 → 판 전체에 균일하게 퍼짐
        // (줄지어 보이지 않게 방향·거리에 아주 작은 흔들림을 더함)
        const a = i * 2.39996 + (rand(i) - 0.5) * 0.5;
        const d = rr * 0.92 * Math.sqrt((i + 0.5) / count) * (0.94 + 0.12 * rand(i + 50));
        const h = 0.03 + 0.02 * rand(i + 100);                     // 높이는 거의 같게 (살짝만 다르게)
        const size = (0.03 + 0.006 * rand(i + 150)) * P.core;     // 크기도 거의 같게
        ball(d * Math.cos(a), -0.04 + h, d * Math.sin(a), size, size, () => c.copy(coreCol), 5, 3);
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
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.15, 0),
      new THREE.Vector3(0.05, -len * 0.33, 0.02),
      new THREE.Vector3(-0.05, -len * 0.66, -0.01),
      new THREE.Vector3(0.04, -len, 0.02)
    ]);
    const stemMat = new THREE.MeshPhysicalMaterial({ color: lin(P.stem), roughness: 0.5, clearcoat: 0.3 });
    stemPivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.11, 12, false), stemMat));

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
