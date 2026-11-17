// 말랑한 도형 인터랙션. 공통 형태 아이템 배열만 받는다 — 장미인지 들꽃인지 모른다.
//
// 한 화면 안에 두 가지 모드가 있다:
//
//   [목록 모드 = 장미 더미]  공들이 중력으로 바닥에 쌓여 있음
//     ├ 마우스 올림      ─▶ 살짝 출렁
//     ├ 공을 잡고 끌기    ─▶ 공이 손을 따라오며 다른 공을 밀어냄 (놓으면 던져짐)
//     ├ 빈 곳을 쓸기      ─▶ 쓴 방향으로 주변 공들이 밀려남
//     └ 공을 톡 누르기    ─▶ onOpen(index) 호출 → 바깥(페이지)이 상세 모드로 바꿔 줌
//
//   [상세 모드]  하나만 크게, 줄기가 쑥 자라나며 똑바로 선 장미 한 송이
//     ├ 꽃송이 꾹 누르기 ─▶ 눌린 곳이 쏙 들어감 → 손 떼면 탄성으로 튕겨 나옴
//     ├ 줄기·잎 누르기   ─▶ 줄기가 휘청 흔들림
//     └ 끌기            ─▶ 돌리기 (손 떼면 관성으로 조금 더 돎)
//
// 블롭 모양(꽃송이 + 줄기 + 잎)은 js/blobShapes.js 의 FlowerBlob 이 만든다.
// 목록에서는 가벼운 꽃송이(lite, 같은 디자인끼리 공유)만 쓰고, 상세에 들어간 꽃만 촘촘한 꽃송이(full)와
// 줄기를 새로 만들어 붙인다. 목록으로 돌아가면 다시 가벼운 버전으로 바꿔 메모리를 아낀다.
// 어떤 모양·색으로 만들지는 item.blob 설정(구역별 디자인 파일)이 정한다. 이 파일은 그 내용을 모른다.
//
// 말랑함의 원리 = "용수철": 구의 점(꼭짓점)마다 '목표 위치'로 끌려가는 힘(K)과
// 흔들림을 줄이는 힘(C)을 준다. C를 일부러 약하게 해서 목표를 지나쳤다 돌아오며 출렁인다.
//
// 더미의 원리 = 아주 단순한 2D 물리: 매 프레임 ① 중력으로 떨어뜨리고 ② 겹친 공끼리 밀어내고
// ③ 벽·바닥·천장에서 튕긴다. 공은 화면 밖으로 나가지 않는다.
// 블롭끼리는 찌그러지지 않고 단단하게 부딪힌다 (누르기는 상세 모드의 몫).

(function () {
  // ----- 말랑함 -----
  const K = 170;           // 용수철 세기: 클수록 빨리 돌아옴
  const C = 8;             // 감쇠: 작을수록 더 출렁거림
  const DENT_DEPTH = 0.42; // 최대로 들어가는 깊이 (반지름 1 기준)
  const DENT_RADIUS = 0.55;// 눌림이 퍼지는 넓이
  // ----- 더미 물리 -----
  const GRAVITY = 18;      // 떨어지는 힘
  const BOUNCE = 0.35;     // 부딪힐 때 튕기는 정도 (0~1)
  const PILE_FILL = 0.64;  // 꽃들이 화면 넓이의 몇 %를 차지할지 (꽃 크기 결정). 겹치지 않고 쌓여도 화면 안에 다 들어가는 값
  const MAX_RADIUS = 1.15; // 공이 적을 때 너무 커지지 않게
  // ----- 조작 -----
  const DRAG_THRESHOLD = 6;// 이만큼(px) 움직이면 '누르기'가 아니라 '끌기'
  const MOVE_SPEED = 7;    // 모드 전환 때 움직이는 빠르기
  // ----- 줄기 -----
  const SWAY_K = 45, SWAY_C = 2.2;   // 줄기 휘청임 용수철 (세기, 감쇠) — 감쇠를 낮춰 오래 출렁이게
  const SWAY_AMP = 0.75;             // 휘청임 크기 (클수록 크게 휨)
  const UPRIGHT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.62, 0, -0.08)); // 상세: 꽃 얼굴이 살짝 보이게 선 자세
  const FACE = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.25, 0, 0)); // 목록: 꽃 얼굴이 화면을 향함
  const SHOW_LIST_LABELS = false; // 목록에서 이름표 보이기 (지금은 숨김)

  // 상세 모드 꽃 자리 두 가지 (interaction.html의 CSS와 같은 값)
  //   시트 닫힘: 머리글 아래 ~ TMI 버튼 위, 화면 가운데에 크게
  //   시트 열림: 위쪽 58%만 꽃 자리 (아래는 설명 시트)
  const DETAIL_SPLIT = 0.58;
  const HEADER_PX = 64;
  const LIST_TOP_PX = 84;      // 목록: 유리 돔 꼭대기 높이 (손잡이가 제목 아래 안내 문구와 겹치지 않게)
  const BUTTON_ZONE_PX = 110; // 아래 TMI 버튼이 차지하는 높이
  const CAMERA_Z = 12;

  window.createSquishyScene = function (container, items, { onOpen } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_Z);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cdb8, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1e0, 0.35);
    rim.position.set(4, -2, -3);
    scene.add(rim);

    const shadowTex = makeShadowTexture();

    // ---------- 향기 입자: 꽃송이를 꾹 누르면 작은 꽃잎이 퍼져 위로 흩날림 ----------
    //   item.scent(0~1, 데이터에서 읽은 향기 세기)만큼 개수·높이가 달라짐. 색은 그 꽃의 디자인 색.
    const SCENT_BURST = 26;                    // 향기 1.0일 때 한 번에 나오는 꽃잎 수
    const petalGeo = new THREE.SphereGeometry(1, 8, 6);
    petalGeo.scale(1, 0.32, 0.62);             // 납작한 꽃잎 모양
    const particles = [];                      // 미리 만들어 두고 돌려 씀 (매번 새로 만들지 않음)
    for (let k = 0; k < 90; k++) {
      const m = new THREE.Mesh(petalGeo, new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      particles.push({ mesh: m, life: 0, max: 1, vel: new THREE.Vector3(), spin: new THREE.Vector3(), size: 1 });
    }
    let nextParticle = 0;
    function spawnScent(b, worldPoint, amount) {
      const scent = typeof b.item.scent === 'number' ? b.item.scent : 0.5;
      const n = Math.round(SCENT_BURST * scent * amount);
      if (n <= 0) return;
      const cols = (b.item.blob && b.item.blob.colors) || {};
      const palette = [cols.center, cols.edge, cols.center, cols.outer].filter(Boolean); // 진한 색 위주 (배경에 묻히지 않게)
      const out = worldPoint.clone().sub(b.mesh.position).normalize();       // 누른 곳의 바깥 방향
      const s = b.curScale;
      for (let k = 0; k < n; k++) {
        const pt = particles[nextParticle++ % particles.length];
        pt.mesh.material.color.set(palette[k % palette.length] || '#F7A9B8').convertSRGBToLinear();
        pt.mesh.position.copy(worldPoint).addScaledVector(out, s * 0.12);   // 꽃 표면보다 살짝 앞에서 출발
        pt.mesh.position.z += s * 0.25;
        pt.size = s * (0.13 + Math.random() * 0.09);
        const spread = 0.9 + 1.6 * scent;                                     // 향기가 셀수록 멀리
        pt.vel.set(
          out.x * spread + (Math.random() - 0.5) * 1.6,
          out.y * spread + 0.8 + Math.random() * 1.2 * (0.5 + scent),
          out.z * spread + 0.6 + Math.random() * 0.8
        ).multiplyScalar(s);
        pt.spin.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
        pt.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        pt.max = pt.life = 1.1 + Math.random() * 0.9 + scent * 0.8;          // 향기가 셀수록 오래
        pt.mesh.visible = true;
      }
    }
    function updateParticles(dt, t) {
      particles.forEach(pt => {
        if (pt.life <= 0) return;
        pt.life -= dt;
        if (pt.life <= 0) { pt.mesh.visible = false; return; }
        pt.vel.multiplyScalar(Math.pow(0.35, dt));                             // 공기 저항
        pt.vel.y += 0.35 * dt;                                                 // 향기처럼 살짝 떠오름
        pt.mesh.position.addScaledVector(pt.vel, dt);
        pt.mesh.position.x += Math.sin(t * 3 + pt.max * 10) * 0.004;           // 하늘하늘
        pt.mesh.rotation.x += pt.spin.x * dt; pt.mesh.rotation.y += pt.spin.y * dt; pt.mesh.rotation.z += pt.spin.z * dt;
        const a = pt.life / pt.max;
        pt.mesh.material.opacity = Math.min(1, a * 2.2);                       // 끝에 갈수록 사라짐
        pt.mesh.scale.setScalar(pt.size * (0.6 + 0.4 * Math.min(1, (1 - a) * 6)));
      });
    }
    const blobs = items.map((item, i) => makeBlob(item, i));
    const labels = blobs.map(b => {
      const el = document.createElement('div');
      el.className = 'blob-label';
      if (!SHOW_LIST_LABELS) el.style.display = 'none';
      el.textContent = b.item.name;
      container.appendChild(el);
      return el;
    });

    let mode = 'list';     // 'list' | 'detail'
    let selected = -1;     // 상세 모드에서 보여주는 도형 번호
    let sheetOpen = false; // 상세 모드: 설명 시트가 열려 있나
    const view = { w: 1, h: 1, W: 1, H: 1, wpp: 1 };            // 화면 크기(px)와 3D 크기, 1px당 3D 길이
    const walls = { left: -1, right: 1, bottom: -1, top: 1 };  // 더미를 가두는 벽 (top = 유리 돔 꼭대기)
    // 유리 돔: 옆벽은 곧게, 윗부분은 둥근 천장(타원). cx·cy = 타원 중심, ax·ay = 가로·세로 반지름
    const dome = { cx: 0, cy: 0, ax: 1, ay: 1 };
    const detailFull = { pos: new THREE.Vector3(), scale: 1 }; // 상세: 시트 닫힘 (가운데, 크게)
    const detailSplit = { pos: new THREE.Vector3(), scale: 1 };// 상세: 시트 열림 (위쪽)
    const detailNow = () => (sheetOpen ? detailSplit : detailFull);

    // ---------- 도형 하나 만들기 ----------
    function makeBlob(item, i) {
      // 목록용 가벼운 꽃송이 (같은 디자인이면 모양 데이터를 함께 씀). 줄기는 상세에 들어갈 때 만듦
      const lite = window.FlowerBlob.head(item.blob || {}, 'lite');
      const head = new THREE.Mesh(lite.geo, window.FlowerBlob.material);
      const mesh = new THREE.Group();            // 위치·크기·회전은 통째로 (줄기도 나중에 여기 붙음)
      mesh.add(head);
      // 꽃 얼굴이 화면을 향하게 + 동전처럼 제각각 돌아간 상태로 시작
      mesh.quaternion.copy(FACE).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
      scene.add(mesh);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.55), // 납작한 타원 그림자 (상세 모드에서만)
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
      );
      scene.add(shadow);

      return {
        item, mesh, shadow,
        head, liteGeo: lite.geo, full: false,          // full: 상세용 촘촘한 버전으로 바뀌었나
        base: null, dirs: null, stemPivot: null,         // (full일 때만 채워짐)
        faceSettle: false,                              // 상세에서 돌아와 다시 얼굴이 화면을 향하는 중
        stemGrow: 0,                                    // 줄기 자라남 (0 목록 → 1 상세)
        sway: new THREE.Vector2(), swayV: new THREE.Vector2(), // 줄기 휘청임 (각도, 속도)
        settle: false,                                  // 상세에 들어올 때 똑바로 서는 중
        // 말랑함
        d: null, v: null,                               // 각 점이 밀린 정도와 그 속도 (full일 때만)
        press: 0, pressTarget: 0,                       // 누르는 세기 (0~1)
        pressPoint: new THREE.Vector3(0, 0, 1),
        wobble: 1, wobbleV: 0,                          // 전체가 통통 튀는 출렁임
        spin: new THREE.Vector2(0, 0),                  // 상세 모드: 손 뗀 뒤 관성 회전
        awake: false,
        // 더미 물리 (목록 모드)
        p: new THREE.Vector2(), vel: new THREE.Vector2(), // 위치·속도
        sizeJitter: 0.88 + Math.random() * 0.24,          // 공마다 크기를 조금씩 다르게
        r: 1,                                             // 반지름 (layout에서 계산)
        held: false, holdTarget: new THREE.Vector2(),
        asleep: false, sleepT: 0,                         // 자리 잡고 멈춘 꽃 = 잠듦 (작게 밀려도 꿈쩍 안 함 → 떨림 없음)
        entered: false,                                   // 처음 위에서 떨어져 화면 안으로 들어왔나 (들어온 뒤부터 천장 적용)
        follow: true,                                     // true = 화면 위치가 물리 위치를 바로 따라감
        // 화면에 그려지는 위치·크기 (모드 전환 때 부드럽게 이동)
        cur: new THREE.Vector3(), curScale: 0,
        tgt: new THREE.Vector3(), tgtScale: 1,
        phase: Math.random() * 6.28
      };
    }

    // ---------- 유리 돔 그림 (목록 모드에서만 보임, 꽃밭 위에 겹쳐 그리지만 터치는 통과) ----------
    const SVGNS = 'http://www.w3.org/2000/svg';
    const glass = document.createElementNS(SVGNS, 'svg');
    glass.setAttribute('class', 'glass-dome');
    glass.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transition:opacity .4s';
    container.appendChild(glass);
    function drawDome() {
      const w = view.w, h = view.h, k = 1 / view.wpp;              // 3D 길이 → px
      const X = x => (x + view.W / 2) * k, Y = y => (view.H / 2 - y) * k;
      const L = X(walls.left), R = X(walls.right), B = Y(walls.bottom), C = Y(dome.cy), T = Y(walls.top);
      const ax = dome.ax * k, ay = dome.ay * k, mid = X(dome.cx);
      // 안쪽 반사광: 돔 왼쪽 위 곡면을 따라 짧게
      const arcPt = (ang, inset) => [mid + (ax - inset) * Math.cos(ang), C - (ay - inset) * Math.sin(ang)];
      const [h1x, h1y] = arcPt(Math.PI * 0.86, 9), [h2x, h2y] = arcPt(Math.PI * 0.62, 9);
      glass.setAttribute('viewBox', `0 0 ${w} ${h}`);
      glass.innerHTML = `
        <path d="M${L} ${B} L${L} ${C} A${ax} ${ay} 0 0 1 ${R} ${C} L${R} ${B}"
              fill="rgba(205,228,240,0.10)" stroke="rgba(120,165,200,0.55)" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M${h1x} ${h1y} A${ax - 9} ${ay - 9} 0 0 1 ${h2x} ${h2y}"
              fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="4" stroke-linecap="round"/>
        <line x1="${L + 9}" y1="${C + 12}" x2="${L + 9}" y2="${C + (B - C) * 0.45}"
              stroke="rgba(255,255,255,0.6)" stroke-width="4" stroke-linecap="round"/>
        <line x1="${R - 8}" y1="${C + 24}" x2="${R - 8}" y2="${C + (B - C) * 0.22}"
              stroke="rgba(255,255,255,0.45)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${mid}" cy="${T - 7}" r="7" fill="rgba(205,228,240,0.7)" stroke="rgba(120,165,200,0.6)" stroke-width="2"/>
        <rect x="${L - 10}" y="${B + 1}" width="${R - L + 20}" height="11" rx="5.5"
              fill="#DCCBAE" stroke="rgba(150,120,80,0.35)" stroke-width="1"/>`;
    }

    // ---------- 상세에 들어갈 때만: 촘촘한 꽃송이 + 줄기 ----------
    function ensureFull(b) {
      if (b.full) return;
      const f = window.FlowerBlob.head(b.item.blob || {}, 'full');
      b.head.geometry = f.geo;
      b.base = f.base; b.dirs = f.dirs;
      b.d = new Float32Array(f.count); b.v = new Float32Array(f.count);
      b.stemPivot = window.FlowerBlob.stem(b.item.blob || {});
      b.stemPivot.scale.setScalar(0.0001); b.stemPivot.visible = false;
      b.mesh.add(b.stemPivot);
      b.stemGrow = 0; b.sway.set(0, 0); b.swayV.set(0, 0);
      b.full = true;
    }
    function releaseFull(b) {                    // 목록으로 돌아가면 다시 가벼운 버전으로 (메모리 아낌)
      if (!b.full) return;
      b.head.geometry.dispose();
      b.head.geometry = b.liteGeo;
      b.stemPivot.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      b.mesh.remove(b.stemPivot);
      b.stemPivot = null; b.base = b.dirs = b.d = b.v = null;
      b.press = b.pressTarget = 0; b.awake = false;
      b.full = false;
    }

    // ---------- 배치 계산 (처음 + 화면 크기가 바뀔 때마다) ----------
    function layout() {
      blobs.forEach(wake);                    // 화면 크기가 바뀌면 다시 자리 잡도록 모두 깨움
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      view.w = w; view.h = h;
      view.H = 2 * CAMERA_Z * Math.tan(halfFov);
      view.W = view.H * camera.aspect;
      view.wpp = view.H / h;

      // 더미: 벽은 화면 양옆과 바닥. 공 크기는 공 개수에 맞춰 화면을 적당히 채우도록
      const usableH = view.H - LIST_TOP_PX * view.wpp;
      const sumJ2 = blobs.reduce((s, b) => s + b.sizeJitter * b.sizeJitter, 0);
      const base = Math.min(MAX_RADIUS, Math.sqrt(PILE_FILL * view.W * usableH / (Math.PI * sumJ2)), view.W / 5);
      // 원근 때문에 가장자리 공이 조금 커 보여서, 벽을 화면 끝보다 살짝 안쪽에 둔다
      const margin = 14 * view.wpp + base * 0.18;
      walls.left = -view.W / 2 + margin; walls.right = view.W / 2 - margin; walls.bottom = -view.H / 2 + margin;
      walls.top = view.H / 2 - LIST_TOP_PX * view.wpp; // 돔 꼭대기: 제목·안내 문구 아래
      // 돔 모양: 세로 화면이면 반원, 가로로 넓은 화면이면 낮고 넓은 타원 (화면 밖으로 넘치지 않게)
      dome.ax = (walls.right - walls.left) / 2;
      dome.cx = (walls.right + walls.left) / 2;
      dome.ay = Math.min(dome.ax, (walls.top - walls.bottom) * 0.35);
      dome.cy = walls.top - dome.ay;
      drawDome();
      blobs.forEach(b => {
        b.r = base * b.sizeJitter;
        b.p.x = THREE.MathUtils.clamp(b.p.x, walls.left + b.r, walls.right - b.r);
      });

      // 상세 모드: 줄기까지 포함한 장미 한 송이가 정해진 영역(위~아래 px)에 들어가도록
      //   꽃송이 반지름을 r이라 하면 장미 전체 세로 길이 = (위 끝 - 아래 끝) × r
      const EXT = window.FLOWER_BLOB_EXTENT, tall = (EXT.top - EXT.bottom) * 0.95; // 0.95: 살짝 기울어진 만큼
      function fitArea(target, areaTop, areaBottom, maxFrac) {
        const radiusPx = Math.max(24, Math.min((areaBottom - areaTop) * 0.92 / tall, w * maxFrac));
        const midPx = (areaTop + areaBottom) / 2;
        const headPx = midPx - ((EXT.top + EXT.bottom) / 2) * -radiusPx * 0.95; // 장미 가운데를 영역 가운데에
        target.pos.set(0, (h / 2 - headPx) * view.wpp, 0);
        target.scale = radiusPx * view.wpp;
      }
      fitArea(detailFull, HEADER_PX + 20, h - BUTTON_ZONE_PX, 0.3);
      fitArea(detailSplit, HEADER_PX, h * DETAIL_SPLIT, 0.22);

      applyTargets(false);
    }

    // ---------- 모드에 따라 각 도형이 갈 곳 정하기 ----------
    function applyTargets(fromNav, dir = 0) {
      blobs.forEach((b, i) => {
        b.pressTarget = 0;
        if (mode === 'list') {
          wake(b);                              // 목록으로 돌아오면 다시 자리 잡도록 깨움
          b.follow = false;                     // 물리 위치로 부드럽게 돌아간 뒤 따라가기 시작
          if (b.curScale < 0.01) b.cur.set(b.p.x, b.p.y, 0); // 숨어 있던 공은 제자리에서 자라남
          b.tgtScale = b.r;
        } else if (i === selected) {
          const d = detailNow();
          if (fromNav && dir) { // 이전/다음: 옆에서 미끄러져 들어옴
            b.cur.copy(d.pos); b.cur.x += dir * view.W * 0.55; b.curScale = d.scale * 0.4;
          }
          b.tgt.copy(d.pos); b.tgtScale = d.scale;
        } else {
          b.tgt.copy(b.cur);
          if (fromNav && dir && b.curScale > 0.01) { // 이전 꽃은 반대쪽으로 빠져나감
            b.tgt.copy(detailNow().pos); b.tgt.x -= dir * view.W * 0.55;
          }
          b.tgtScale = 0;
        }
      });
      labels.forEach(el => el.classList.toggle('hidden', mode !== 'list'));
      glass.style.opacity = mode === 'list' ? 1 : 0;   // 유리 돔은 목록에서만
    }

    layout();
    // 첫 등장: 꽃들을 화면 위쪽부터 촘촘히 줄 세워 두고(서로 살짝 떨어지게) 한꺼번에 떨어뜨림
    //   → 위에서 '우수수' 쏟아져 쌓이는 연출. 처음부터 모두 화면 안이라 밖에 걸리는 꽃이 없음
    (function spawn() {
      const maxR = blobs.reduce((m, b) => Math.max(m, b.r), 0) || 1;
      const gap = maxR * 2.06;                                    // 한 칸 (지름보다 조금 넓게)
      const perRow = Math.max(1, Math.floor((walls.right - walls.left) / gap));
      const rows = Math.ceil(blobs.length / perRow);
      const spawnTop = dome.cy;                                   // 돔 둥근 부분 아래부터 줄 세움
      const rowGap = Math.min(gap, (spawnTop - walls.bottom - 2 * maxR) / Math.max(1, rows - 1));
      const order = blobs.map((b, i) => i).sort(() => Math.random() - 0.5); // 대표 꽃이 한쪽에 몰리지 않게 섞음
      order.forEach((bi, k) => {
        const b = blobs[bi];
        const row = Math.floor(k / perRow), col = k % perRow;
        const inRow = Math.min(perRow, blobs.length - row * perRow);
        const x = (col - (inRow - 1) / 2) * gap + (row % 2 ? gap * 0.25 : -gap * 0.25);
        b.p.set(
          THREE.MathUtils.clamp(x, walls.left + b.r, walls.right - b.r),
          spawnTop - maxR - row * rowGap
        );
        b.vel.set((Math.random() - 0.5) * 0.4, -Math.random() * 0.5);
        b.entered = true;
        b.cur.set(b.p.x, b.p.y, 0); b.curScale = b.r; b.follow = true;
      });
    })();
    window.addEventListener('resize', layout);

    // ---------- 포인터 (마우스·터치 공통) ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pWorld = new THREE.Vector2();   // 포인터의 3D 평면 위치
    let active = null;                    // 누르고 있는 중인 정보
    let hovered = null;

    function toWorld(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return pWorld.set(ndc.x * view.W / 2, ndc.y * view.H / 2);
    }

    // 목록: 포인터 아래에 있는 공 (2D 거리로 찾기)
    function ballAt(e) {
      const w = toWorld(e);
      let best = null, bestD = Infinity;
      blobs.forEach(b => {
        const d = b.p.distanceTo(w);
        if (d < b.r && d < bestD) { best = b; bestD = d; }
      });
      return best;
    }
    // 상세: 가운데 장미의 어디를 눌렀는지 (3D 광선으로 찾기) — part: 'head' 꽃송이 / 'stem' 줄기·잎
    function detailHit(e) {
      toWorld(e);
      ray.setFromCamera(ndc, camera);
      const b = blobs[selected];
      const hit = ray.intersectObject(b.mesh, true)[0];
      return hit ? { blob: b, point: hit.point, part: hit.object === b.head ? 'head' : 'stem' } : null;
    }
    function setPressPoint(blob, worldPoint) {
      blob.pressPoint.copy(blob.head.worldToLocal(worldPoint.clone())).normalize();
    }

    const canvas = renderer.domElement;
    // 길게 누를 때 브라우저 기본 동작(글자 선택, 메뉴) 막기
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('selectstart', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 일부 환경에서 실패해도 진행 */ }
      const base = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, mode: 'tap', lastT: performance.now() };
      if (mode === 'list') {
        const b = ballAt(e);
        active = { ...base, blob: b, grabOffset: b ? b.p.clone().sub(pWorld) : null }; // b가 없으면 '빈 곳 쓸기'
      } else {
        const hit = detailHit(e);
        if (!hit) return;
        active = { ...base, blob: hit.blob, part: hit.part };
        hit.blob.spin.set(0, 0);
        hit.blob.settle = false;
        if (hit.part === 'head') {                 // 꽃송이: 쏙 들어감 + 향기 꽃잎이 퐁
          setPressPoint(hit.blob, hit.point);
          hit.blob.pressTarget = 1;
          hit.blob.awake = true;
          spawnScent(hit.blob, hit.point, 1);
        } else {                                   // 줄기·잎: 누른 쪽 반대로 휘청
          const side = Math.sign(pWorld.x - hit.blob.cur.x) || 1;
          hit.blob.swayV.x += -side * 5.5;
          hit.blob.swayV.y += 2.4;
        }
      }
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', e => {
      if (!active) {
        if (mode === 'list') {
          const over = ballAt(e);
          if (over && over !== hovered && e.pointerType === 'mouse') over.wobbleV += 1.6; // 새로 올라간 공 출렁
          hovered = over;
          canvas.style.cursor = over ? 'pointer' : 'grab';
        } else {
          canvas.style.cursor = detailHit(e) ? 'grab' : 'default';
        }
        return;
      }
      const moved = Math.hypot(e.clientX - active.startX, e.clientY - active.startY);
      if (active.mode === 'tap' && moved > DRAG_THRESHOLD) {
        active.mode = 'drag';
        if (active.blob) { active.blob.pressTarget = 0; if (mode === 'list') { active.blob.held = true; wake(active.blob); } }
      }
      const dx = e.clientX - active.lastX, dy = e.clientY - active.lastY;
      if (mode === 'list') {
        const w = toWorld(e);
        if (active.mode === 'drag' && active.blob) {
          active.blob.holdTarget.copy(w).add(active.grabOffset);      // 잡은 공이 손을 따라옴
        } else if (active.mode === 'drag') {
          stir(w, dx * view.wpp, -dy * view.wpp);                      // 빈 곳 쓸기
        }
      } else {
        const b = active.blob;
        if (active.mode === 'tap') {
          const hit = detailHit(e);
          if (hit && hit.blob === b && hit.part === 'head' && active.part === 'head') setPressPoint(b, hit.point); // 누른 채 미끄러지면 자국도 따라감
        } else {
          rotateBy(b, dx * 0.012, dy * 0.012);
          const now = performance.now(), dt = Math.max(1, now - active.lastT);
          b.spin.set(dx * 0.012 / dt * 16, dy * 0.012 / dt * 16);
          active.lastT = now;
        }
      }
      active.lastX = e.clientX; active.lastY = e.clientY;
    });

    function release(e) {
      if (!active) return;
      const b = active.blob;
      if (mode === 'list') {
        if (b) b.held = false;                          // 놓으면 그 순간 속도로 던져짐
        if (active.mode === 'tap' && b && e.type === 'pointerup') onOpen && onOpen(blobs.indexOf(b));
      } else if (active.mode === 'tap') {
        b.pressTarget = 0;
        b.wobbleV += 2.2 * b.press; // 놓는 순간 몸 전체가 '통' 하고 튐
        if (active.part === 'head' && b.press > 0.3) {                     // 꾹 누를수록 놓을 때 향기가 한 번 더
          tmp.copy(b.pressPoint).applyMatrix4(b.head.matrixWorld);
          spawnScent(b, tmp, 0.5 * b.press);
        }
      }
      active = null;
      canvas.style.cursor = 'default';
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    // 빈 곳을 쓸면: 손가락 근처 공들에 쓴 방향의 힘을 줌
    function stir(at, mvx, mvy) {
      blobs.forEach(b => {
        const d = b.p.distanceTo(at), reach = b.r * 2.2;
        if (d < reach) {
          const k = (1 - d / reach) * 30;
          wake(b);
          b.vel.x += mvx * k; b.vel.y += mvy * k;
        }
      });
    }

    const qTmp = new THREE.Quaternion();
    const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1);
    function rotateBy(b, ax, ay) {
      qTmp.setFromAxisAngle(axisY, ax); b.mesh.quaternion.premultiply(qTmp);
      qTmp.setFromAxisAngle(axisX, ay); b.mesh.quaternion.premultiply(qTmp);
    }

    // ---------- 더미 물리 한 걸음 ----------
    const nTmp = new THREE.Vector2();
    // 안정적으로 쌓이게 하는 방식 (위치 기반):
    //   ① 속도대로 옮겨 보고 → ② 겹친 것·벽을 '위치'로 여러 번 바로잡고 → ③ 실제로 움직인 거리로 속도를 다시 정함
    //   이렇게 하면 밀어낸 만큼 속도도 같이 줄어서, 많이 쌓여도 아래쪽이 계속 들썩이지 않는다.
    //   한 프레임을 작은 걸음(1/120초) 여러 번으로 나눠 계산 → 휴대폰처럼 프레임이 느려도 덜 겹침.
    const SUB_DT = 1 / 120, ITER = 8;
    const CONTACT_DAMP = 4;      // 다른 꽃에 닿아 있으면 이만큼 빨리 느려짐 (자리 잡기)
    const SLEEP_SPEED = 0.25;    // 받쳐져 있고 이보다 느리면 '멈추는 중'
    const SLEEP_AFTER = 0.25;    // 그 상태로 이만큼(초) 있으면 잠듦
    const WAKE_PUSH = 0.04;      // 잠든 꽃은 지름의 4%보다 깊게 눌려야 깨어남 (그보다 작은 겹침은 무시 → 덜덜 떨림 없음)
    // 떨림을 없애는 원리:
    //   꽃이 빽빽하면 겹침이 매 순간 조금씩 남아서, '밀어내기 ↔ 중력'이 아주 작게 반복되며 떨려 보였음.
    //   → 자리 잡은 꽃은 재워서(움직이지 않게) 작은 겹침은 그냥 두고, 크게 밀릴 때만 깨워 움직이게 함.
    function wake(b) { b.asleep = false; b.sleepT = 0; }
    // 받침이 어느 쪽에 있는지 기록 (sx: 받침이 있는 쪽의 가로 방향, -1 왼쪽 … +1 오른쪽)
    function markSupport(b, sx) { if (sx < -0.25) b.supL = true; else if (sx > 0.25) b.supR = true; else b.supC = true; }
    // 굴러떨어지지 않고 버틸 수 있나: 바닥 위, 바로 아래 받침, 양쪽 받침, 또는 한쪽 받침 + 반대쪽 벽
    function stable(b) {
      const nearL = b.p.x - b.r < walls.left + 0.03 * b.r, nearR = b.p.x + b.r > walls.right - 0.03 * b.r;
      const onFloor = b.p.y - b.r < walls.bottom + 0.03 * b.r;
      return onFloor || b.supC || ((b.supL || nearL) && (b.supR || nearR));
    }
    const prevP = new THREE.Vector2();
    function physics(dt) {
      const steps = Math.max(1, Math.ceil(dt / SUB_DT)), h = dt / steps;
      for (let s = 0; s < steps; s++) physicsStep(h);
      // 굴러가는 만큼 돌기 — 실제로 굴러갈 때만 (작은 떨림으로 빙글빙글 돌지 않게)
      blobs.forEach(b => {
        if (!b.asleep && Math.abs(b.vel.x) > 0.8 && !b.faceSettle) {   // 작게 흔들릴 땐 돌지 않게 (0.25 → 0.8)
          qTmp.setFromAxisAngle(axisZ, -b.vel.x / b.r * dt);
          b.mesh.quaternion.premultiply(qTmp);
        }
      });
    }
    function physicsStep(h) {
      // ① 속도대로 옮겨 보기
      blobs.forEach(b => {
        b.prev = b.prev || new THREE.Vector2();
        b.prev.copy(b.p);
        b.contacts = 0; b.supported = false; b.wallHitX = 0; b.wallHitY = 0; b.domeHit = false;
        b.supL = false; b.supR = false; b.supC = false;   // 받침이 왼쪽 아래 / 오른쪽 아래 / 바로 아래에 있나
        if (b.held) {
          // 잡힌 공: 손 위치로 용수철처럼 끌려감 → 놓을 때 이 속도가 남아 '던지기'가 됨
          b.vel.copy(b.holdTarget).sub(b.p).multiplyScalar(18);
        } else if (b.asleep) {
          b.vel.set(0, 0);                        // 잠든 꽃: 중력도 받지 않고 제자리
        } else {
          b.vel.y -= GRAVITY * h;
          b.vel.multiplyScalar(Math.pow(0.7, h)); // 공기 저항 조금
        }
        b.p.addScaledVector(b.vel, h);
      });
      // ② 겹친 것·벽을 위치로 바로잡기 (가까운 것끼리만 비교하려고 화면을 칸으로 나눔)
      let maxR = 0; blobs.forEach(b => { if (b.r > maxR) maxR = b.r; });
      const cell = maxR * 2 || 1;
      for (let iter = 0; iter < ITER; iter++) {
        const grid = new Map();
        blobs.forEach((b, i) => {
          const key = Math.floor(b.p.x / cell) + ',' + Math.floor(b.p.y / cell);
          (grid.get(key) || grid.set(key, []).get(key)).push(i);
        });
        for (let i = 0; i < blobs.length; i++) {
          const gx = Math.floor(blobs[i].p.x / cell), gy = Math.floor(blobs[i].p.y / cell);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const list = grid.get((gx + ox) + ',' + (gy + oy));
            if (!list) continue;
            for (const j of list) {
              if (j <= i) continue;
              const a = blobs[i], c = blobs[j];
              nTmp.copy(c.p).sub(a.p);
              const dist = nTmp.length(), minD = a.r + c.r;
              if (dist >= minD * 1.02 || dist === 0) continue;   // 2% 여유: 딱 맞닿아 있어도 '받침'으로 셈
              nTmp.divideScalar(dist);
              const overlap = minD - dist;
              if (iter === 0) {
                a.contacts++; c.contacts++;
                // 아래에서 받쳐 주는 꽃이 있나 (떠 있는 꽃끼리 닿은 건 받침이 아님)
                if (nTmp.y > 0.4) { c.supported = true; markSupport(c, -nTmp.x); }  // c가 a 위에 얹힘 (받침 a는 c에서 -n 방향)
                if (nTmp.y < -0.4) { a.supported = true; markSupport(a, nTmp.x); }  // a가 c 위에 얹힘
              }
              if (overlap <= 0) continue;               // 맞닿기만 했으면 밀어낼 필요 없음
              // 잡은 공이 밀 때: 잡은 공은 25%만 밀리고(버티는 느낌) 나머지는 밀린 공이 비켜남
              //   (속도는 ③에서 움직인 거리로 정해져서, 밀린 공이 자연스럽게 따라 밀려남)
              let wa = a.held ? 0.25 : c.held ? 0.75 : 0.5;
              // 잠든 꽃: 작은 겹침이면 꿈쩍 안 하고(상대만 비켜남), 깊게 눌리면 깨어나서 같이 움직임
              if (a.asleep || c.asleep) {
                if (overlap > WAKE_PUSH * minD) { if (a.asleep) wake(a); if (c.asleep) wake(c); }
                else if (a.asleep && c.asleep) continue;         // 둘 다 잠들었고 살짝 겹침 → 그대로 둠
                else wa = a.asleep ? 0 : 1;                      // 잠든 쪽은 벽처럼 버팀
              }
              a.p.addScaledVector(nTmp, -overlap * wa);
              c.p.addScaledVector(nTmp, overlap * (1 - wa));
            }
          }
        }
        // 벽·바닥·천장
        blobs.forEach(b => {
          if (b.p.x - b.r < walls.left) { b.p.x = walls.left + b.r; b.wallHitX = 1; }
          if (b.p.x + b.r > walls.right) { b.p.x = walls.right - b.r; b.wallHitX = -1; }
          // 유리 돔 둥근 천장: 타원 안쪽(꽃 반지름만큼 줄인 타원)을 벗어나면 곡면 위로 되돌림
          if (!b.entered && b.p.y + b.r <= walls.top) b.entered = true;
          if (b.entered && b.p.y > dome.cy) {
            const A = dome.ax - b.r, B = dome.ay - b.r, dx = b.p.x - dome.cx, dy = b.p.y - dome.cy;
            const e = (dx * dx) / (A * A) + (dy * dy) / (B * B);
            if (e > 1) {
              const k = 1 / Math.sqrt(e);
              b.p.x = dome.cx + dx * k; b.p.y = dome.cy + dy * k;
              const nx = dx / (A * A), ny = dy / (B * B), L = Math.hypot(nx, ny) || 1;
              b.domeN = b.domeN || new THREE.Vector2();
              b.domeN.set(nx / L, ny / L);                 // 돔 곡면의 바깥 방향
              b.domeHit = true;
            }
          }
          if (b.p.y - b.r < walls.bottom) { b.p.y = walls.bottom + b.r; b.wallHitY = 1; b.contacts++; b.supported = true; }
        });
      }
      // ③ 실제로 움직인 거리로 속도 다시 정하기 + 자리 잡기
      blobs.forEach(b => {
        if (b.held) return;
        const vx0 = b.vel.x, vy0 = b.vel.y;                 // 바로잡기 전 속도 (벽에 튕길 때 씀)
        prevP.copy(b.prev);
        b.vel.copy(b.p).sub(prevP).divideScalar(h);
        // 벽·천장·바닥에 세게 부딪혔으면 살짝 튕겨 나옴 (던지기 손맛)
        if (b.wallHitX && Math.abs(vx0) > 1.5) b.vel.x = -vx0 * BOUNCE;
        if (b.wallHitY && Math.abs(vy0) > 2.5) b.vel.y = -vy0 * BOUNCE;
        if (b.domeHit) {                                    // 돔 곡면에 세게 부딪히면 곡면 방향으로 튕김
          const vn = vx0 * b.domeN.x + vy0 * b.domeN.y;
          if (vn > 2) { b.vel.set(vx0 - (1 + BOUNCE) * vn * b.domeN.x, vy0 - (1 + BOUNCE) * vn * b.domeN.y); }
        }
        if (b.asleep && !stable(b)) wake(b);                // 받쳐 주던 꽃이 빠지면 깨어나서 떨어지거나 굴러감
        if (b.wallHitY > 0) b.vel.x *= Math.pow(0.2, h);    // 바닥 마찰
        if (b.supported) {                                  // 바닥이나 다른 꽃 위에 얹혀 있을 때만 (떨어지는 중엔 X)
          b.vel.multiplyScalar(Math.exp(-h * CONTACT_DAMP)); // 받쳐져 있으면 점점 느려짐
          if (b.vel.lengthSq() < SLEEP_SPEED * SLEEP_SPEED) {
            b.vel.multiplyScalar(0.5);
            b.sleepT += h;
            if (b.sleepT > SLEEP_AFTER && stable(b)) { b.asleep = true; b.vel.set(0, 0); }  // 한동안 거의 멈춰 있고 안정하면 재움
          } else b.sleepT = 0;
        } else b.sleepT = 0;
      });
    }
    // (목록에서는 부딪혀도 찌그러지지 않음 — 2026-11-15 사용자 요청으로 부딪힘 출렁임 제거)

    // ---------- 매 프레임 ----------
    const tmp = new THREE.Vector3();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const ease = 1 - Math.exp(-dt * MOVE_SPEED);
      if (mode === 'list') physics(dt);

      blobs.forEach((b, i) => {
        // 화면 위치: 목록이면 물리 위치를 따라가고, 상세면 정해진 곳으로
        if (mode === 'list') {
          b.tgt.set(b.p.x, b.p.y, 0);
          // 화면 위치는 물리 위치를 아주 살짝 늦게 따라감 (남은 미세한 흔들림을 걸러 줌). 잡은 꽃은 손을 바로 따라감
          if (b.follow) { if (b.held) b.cur.copy(b.tgt); else b.cur.lerp(b.tgt, 1 - Math.exp(-dt * 25)); }
          else { b.cur.lerp(b.tgt, ease); if (b.cur.distanceTo(b.tgt) < 0.02) b.follow = true; }
          b.tgtScale = b.r;
        } else {
          b.cur.lerp(b.tgt, ease);
        }
        b.curScale += (b.tgtScale - b.curScale) * ease;
        const visible = b.curScale > 0.005;
        b.mesh.visible = visible;
        b.shadow.visible = visible && mode === 'detail';
        // 줄기: 상세에서 보고 있는 장미만 쑥 자라남, 목록에서는 쏙 들어감
        if (b.stemPivot) {
          const growTo = (mode === 'detail' && i === selected) ? 1 : 0;
          b.stemGrow += (growTo - b.stemGrow) * (1 - Math.exp(-dt * (growTo ? 4 : 10)));
          b.stemPivot.visible = b.stemGrow > 0.01;
          b.stemPivot.scale.set(Math.max(0.0001, Math.min(1, b.stemGrow * 1.3)), Math.max(0.0001, b.stemGrow), Math.max(0.0001, Math.min(1, b.stemGrow * 1.3)));
          // 줄기 휘청임 (용수철)
          b.swayV.x += (-SWAY_K * b.sway.x - SWAY_C * b.swayV.x) * dt;
          b.swayV.y += (-SWAY_K * b.sway.y - SWAY_C * b.swayV.y) * dt;
          b.sway.addScaledVector(b.swayV, dt);
          b.stemPivot.rotation.set(b.sway.y * SWAY_AMP, 0, b.sway.x * SWAY_AMP);
          // 상세에서 빠져나와 줄기가 다 들어가면 다시 가벼운 버전으로
          if (i !== selected && b.stemGrow < 0.01) releaseFull(b);
        }
        // 목록으로 돌아온 꽃: 얼굴이 다시 화면을 향하도록
        if (mode === 'list' && b.faceSettle) {
          b.mesh.quaternion.slerp(FACE, 1 - Math.exp(-dt * 5));
          if (b.mesh.quaternion.angleTo(FACE) < 0.02) b.faceSettle = false;
        }
        if (!visible) { labels[i].style.opacity = 0; return; }
        labels[i].style.opacity = '';

        // 상세 모드: 누르는 세기·관성 회전·느린 자전
        // 누르기(찌그러짐)는 상세 모드에서만. 목록에서는 블롭끼리 눌리지 않음
        b.press += (b.pressTarget - b.press) * (b.pressTarget > b.press ? 1 - Math.exp(-dt * 6) : 1);
        if (mode === 'detail' && (!active || active.blob !== b)) {
          if (b.settle) {                          // 상세에 막 들어옴: 굴러다니던 꽃이 똑바로 섬
            b.mesh.quaternion.slerp(UPRIGHT, 1 - Math.exp(-dt * 5));
            if (b.mesh.quaternion.angleTo(UPRIGHT) < 0.01) b.settle = false;
          } else {
            rotateBy(b, b.spin.x + dt * 0.15, b.spin.y);
            b.spin.multiplyScalar(Math.pow(0.04, dt));
          }
        }
        // 전체 출렁임 (용수철)
        b.wobbleV += (-K * 0.6 * (b.wobble - 1) - C * 0.7 * b.wobbleV) * dt;
        b.wobble += b.wobbleV * dt;

        const s = b.curScale;
        const bob = mode === 'detail' ? Math.sin(t * 1.4 + b.phase) * 0.05 * s : 0; // 상세에서만 둥실
        b.mesh.position.set(b.cur.x, b.cur.y + bob, b.cur.z);
        b.mesh.scale.set(s * b.wobble, s * (2 - b.wobble), s * b.wobble); // 납작해지면 옆으로 퍼짐
        const shadowY = (b.stemPivot && b.stemGrow > 0.5) ? window.FLOWER_BLOB_EXTENT.bottom * 0.95 : -1.05; // 줄기가 있으면 줄기 끝 아래
        b.shadow.position.set(b.cur.x, b.cur.y + shadowY * s, -0.9 * s);
        b.shadow.scale.setScalar(Math.max(0, s - bob * 1.5));

        if (b.awake && b.full) updateSurface(b, dt);
        if (SHOW_LIST_LABELS) updateLabel(b, labels[i]);
      });
      updateParticles(dt, t);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    // 꽃송이 표면 누르기: 각 점을 '꽃송이 중심에서 바깥 방향'으로 밀고 당긴다.
    //   눌린 곳과 가까운지는 각 점의 방향(dirs)과 누른 방향을 비교해서 정함 (꽃잎 울퉁불퉁과 상관없이)
    function updateSurface(b, dt) {
      const attr = b.head.geometry.attributes.position;
      const arr = attr.array, base = b.base, dirs = b.dirs, d = b.d, v = b.v;
      const p = b.pressPoint, depth = DENT_DEPTH * b.press;
      let energy = 0;
      for (let k = 0, n = d.length; k < n; k++) {
        const x = base[k * 3], y = base[k * 3 + 1], z = base[k * 3 + 2];
        const dist2 = (dirs[k * 3] - p.x) ** 2 + (dirs[k * 3 + 1] - p.y) ** 2 + (dirs[k * 3 + 2] - p.z) ** 2;
        const fall = Math.exp(-dist2 / (DENT_RADIUS * DENT_RADIUS));
        // 눌린 곳은 들어가고, 나머지는 살짝 부풀어 오름 (부피가 보존되는 느낌)
        const target = -depth * fall + depth * 0.12 * (1 - fall);
        v[k] += (K * (target - d[k]) - C * v[k]) * dt;
        d[k] += v[k] * dt;
        energy += Math.abs(v[k]) + Math.abs(target - d[k]);
        const s = 1 + d[k];
        arr[k * 3] = x * s; arr[k * 3 + 1] = y * s; arr[k * 3 + 2] = z * s;
      }
      attr.needsUpdate = true;
      b.head.geometry.computeVertexNormals();
      // 완전히 멈추면 계산 쉬기 (배터리 절약)
      b.awake = energy > 0.002 * d.length || b.pressTarget > 0;
    }

    // 이름표: 목록에서는 공 한가운데 아래쪽에
    function updateLabel(b, el) {
      tmp.set(b.cur.x, b.cur.y - b.curScale * 0.35, 0).project(camera);
      el.style.transform = `translate(-50%, -50%) translate(${(tmp.x + 1) / 2 * view.w}px, ${(1 - tmp.y) / 2 * view.h}px)`;
    }

    requestAnimationFrame(frame);

    // ---------- 바깥(페이지)에서 쓰는 조작 버튼 ----------
    return {
      showList() {
        if (selected >= 0) blobs[selected].faceSettle = true; // 보던 꽃은 다시 얼굴이 화면을 향하게
        mode = 'list'; selected = -1;
        applyTargets(false);
      },
      // dir: 0 = 목록에서 들어옴, +1 = 다음(오른쪽에서 등장), -1 = 이전(왼쪽에서 등장)
      showDetail(index, dir = 0) {
        mode = 'detail'; selected = index;
        blobs.forEach(b => { b.held = false; });
        ensureFull(blobs[index]);        // 이 꽃만 촘촘한 버전 + 줄기
        blobs[index].settle = true;      // 똑바로 서기
        blobs[index].spin.set(0, 0);
        applyTargets(true, dir);
      },
      // 설명 시트가 열리면 꽃이 위로 비켜 올라가고, 닫히면 다시 가운데로
      setSheet(open) {
        sheetOpen = !!open;
        if (mode !== 'detail') return;
        const b = blobs[selected], d = detailNow();
        b.tgt.copy(d.pos); b.tgtScale = d.scale;
      }
    };
  };

  function smooth(t) { return t * t * (3 - 2 * t); }

  function makeShadowTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(60,50,30,0.28)');
    grd.addColorStop(1, 'rgba(60,50,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }
})();
