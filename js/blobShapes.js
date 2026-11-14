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
//   colors  { center 가운데, outer 바깥, edge 꽃잎 끝(선택), stamen 수술(선택) }
//   stem / leaf  줄기·잎 색

(function () {
  const DEFAULTS = {
    petals: 9, rings: 4, open: 0.5, spread: 0.8, flare: 0.4, pointy: 0.3, height: 0, ruffle: 0, spiral: 0.6,
    colors: { center: '#E86B86', outer: '#F7A9B8', edge: null, stamen: null },
    stem: '#5F8F4A', leaf: '#6FAE5A'
  };
  const STEM_LENGTH = 4.0;   // 꽃송이 지름(2)의 2배 → 꽃:줄기 = 1:2
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
      const n = Math.max(3, Math.round(P.petals * (0.5 + 0.5 * outer)));
      const L = (0.62 + 0.5 * outer) * (1 + P.height * 0.55 * (1 - outer)); // 꽃잎 길이
      const r0 = 0.04 + 0.16 * outer, y0 = -0.32 + 0.06 * (1 - outer);       // 꽃잎이 붙는 자리
      const tilt0 = Math.min(1.45, 0.06 + 0.9 * P.open * Math.pow(outer, 1.2) + 0.5 * P.spread * outer); // 기울기
      const curl = P.flare * 1.1 * Math.pow(outer, 1.5) + P.spread * 0.35 * outer;              // 끝 젖힘
      const span = (2 * Math.PI / n) * (2.1 - 0.5 * outer);                // 꽃잎 폭 (옆 꽃잎과 넉넉히 겹치게)
      const cup = 0.5 * (1 - outer) + 0.15 - P.flare * 0.45 * outer;       // 오목함 (+ 안쪽으로 감쌈, - 바깥으로 젖힘)
      const off = k * (Math.PI / n) + P.spiral * k * 0.45;

      for (let j = 0; j < n; j++) {
        const az = off + j * 2 * Math.PI / n;
        const start = positions.length / 3;
        for (let iv = 0; iv <= V; iv++) {
          for (let iu = 0; iu <= U; iu++) {
            const u = iu / U, v = iv / V, w2 = (2 * u - 1) * (2 * u - 1);
            // 꽃잎 윤곽: 가장자리일수록 덜 뻗음 → 둥근 끝 (pointy면 뾰족한 끝)
            const ve = v * (1 - (0.16 + 0.55 * P.pointy) * w2);
            // 꽃잎 길이 방향 곡선: 아래에서 시작해 기울기 + 끝 젖힘만큼 휘며 뻗음
            let rad = r0, y = y0;
            for (let s = 1; s <= steps; s++) {
              const vv = ve * s / steps, th = tilt0 + curl * vv * vv;
              rad += Math.sin(th) * L * ve / steps;
              y += Math.cos(th) * L * ve / steps;
            }
            const width = Math.pow(Math.sin(Math.PI * (0.18 + 0.66 * ve)), 0.3);  // 둥글고 넓은 꽃잎
            const phi = az + (u - 0.5) * span * width;
            rad -= cup * 0.2 * w2 * (0.3 + ve);                            // 오목하게
            rad += P.ruffle * 0.035 * Math.sin(u * Math.PI * 6 + k) * ve * ve; // 가장자리 물결
            // 색: 꽃잎 아래쪽·안쪽 고리 = 가운데 색, 꽃잎 끝·바깥 고리 = 바깥 색
            c.copy(cCenter).lerp(cOuter, smooth(0, 1, 0.35 * outer + 0.75 * ve));
            c.multiplyScalar(0.82 + 0.18 * smooth(0, 0.5, ve));            // 꽃잎 밑동은 살짝 그늘
            if (cEdge) c.lerp(cEdge, smooth(0.55, 1, ve) * (0.35 + 0.65 * outer));
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
    ball(0, -0.05, 0, 0.17, 0.2, (y, ph) => c.copy(coreCol).multiplyScalar(cStamen ? 0.85 + 0.15 * Math.sin(ph * 9) : 0.9));
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

  // 줄기 + 잎 2장 (상세에 들어갈 때만 만듦)
  function buildStem(settings) {
    const P = Object.assign({}, DEFAULTS, settings);
    const stemPivot = new THREE.Group();     // 꽃송이 아래 붙는 점 = 휘청거리는 중심
    stemPivot.position.set(0, STEM_TOP, 0);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.15, 0),
      new THREE.Vector3(0.05, -STEM_LENGTH * 0.33, 0.02),
      new THREE.Vector3(-0.05, -STEM_LENGTH * 0.66, -0.01),
      new THREE.Vector3(0.04, -STEM_LENGTH, 0.02)
    ]);
    const stemMat = new THREE.MeshPhysicalMaterial({ color: lin(P.stem), roughness: 0.5, clearcoat: 0.3 });
    stemPivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.11, 12, false), stemMat));

    const leafMat = new THREE.MeshPhysicalMaterial({ color: lin(P.leaf), roughness: 0.45, clearcoat: 0.45 });
    const leafGeo = new THREE.SphereGeometry(1, 28, 14);
    leafGeo.scale(0.6, 0.07, 0.27);
    leafGeo.translate(0.62, 0, 0);           // 잎자루 쪽이 줄기에 붙도록
    const midY = -STEM_LENGTH * 0.5;          // 줄기 중간
    [1, -1].forEach((side, i) => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0, midY + (i ? -0.25 : 0.1), 0);
      leaf.rotation.set(0.25 * side, side > 0 ? 0 : Math.PI, 0.45);  // 위쪽으로 살짝 들린 잎
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
    // 모든 꽃송이가 함께 쓰는 재질 (꽃잎은 얇은 면이라 양쪽 다 그림)
    material: new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.45, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.35,
      side: THREE.DoubleSide
    })
  };

  // 줄기까지 포함한 블롭의 세로 길이 (꽃송이 반지름 1 기준) — 상세 화면 배치에 씀
  window.FLOWER_BLOB_EXTENT = { top: 1, bottom: STEM_TOP - STEM_LENGTH };
})();
