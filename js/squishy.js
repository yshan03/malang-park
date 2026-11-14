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
  const PILE_FILL = 0.55;  // 공들이 화면 넓이의 몇 %를 차지할지 (공 크기 결정)
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
    const walls = { left: -1, right: 1, bottom: -1, top: 1 };  // 더미를 가두는 벽 (위는 머리글 바로 아래 천장)
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
        entered: false,                                   // 처음 위에서 떨어져 화면 안으로 들어왔나 (들어온 뒤부터 천장 적용)
        follow: true,                                     // true = 화면 위치가 물리 위치를 바로 따라감
        // 화면에 그려지는 위치·크기 (모드 전환 때 부드럽게 이동)
        cur: new THREE.Vector3(), curScale: 0,
        tgt: new THREE.Vector3(), tgtScale: 1,
        phase: Math.random() * 6.28
      };
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
      const usableH = view.H - HEADER_PX * view.wpp;
      const sumJ2 = blobs.reduce((s, b) => s + b.sizeJitter * b.sizeJitter, 0);
      const base = Math.min(MAX_RADIUS, Math.sqrt(PILE_FILL * view.W * usableH / (Math.PI * sumJ2)), view.W / 5);
      // 원근 때문에 가장자리 공이 조금 커 보여서, 벽을 화면 끝보다 살짝 안쪽에 둔다
      const margin = 14 * view.wpp + base * 0.18;
      walls.left = -view.W / 2 + margin; walls.right = view.W / 2 - margin; walls.bottom = -view.H / 2 + margin;
      walls.top = view.H / 2 - HEADER_PX * view.wpp; // 천장: 머리글(제목) 바로 아래
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
    }

    layout();
    // 첫 등장: 화면 위에서 하나씩 떨어져 쌓임
    const perRow = Math.max(1, Math.floor((walls.right - walls.left) / (blobs[0] ? blobs[0].r * 2.2 : 1)));
    blobs.forEach((b, i) => {
      b.p.set(
        THREE.MathUtils.lerp(walls.left + b.r, walls.right - b.r, Math.random()),
        view.H / 2 + b.r + Math.floor(i / perRow) * b.r * 2.4 + Math.random() * b.r
      );
      b.cur.set(b.p.x, b.p.y, 0); b.curScale = b.r; b.follow = true;
    });
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
        if (hit.part === 'head') {                 // 꽃송이: 쏙 들어감
          setPressPoint(hit.blob, hit.point);
          hit.blob.pressTarget = 1;
          hit.blob.awake = true;
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
        if (active.blob) { active.blob.pressTarget = 0; if (mode === 'list') active.blob.held = true; }
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
    function physics(dt) {
      blobs.forEach(b => {
        if (b.held) {
          // 잡힌 공: 손 위치로 용수철처럼 끌려감 → 놓을 때 이 속도가 남아 '던지기'가 됨
          b.vel.copy(b.holdTarget).sub(b.p).multiplyScalar(18);
        } else {
          b.vel.y -= GRAVITY * dt;
          b.vel.multiplyScalar(Math.pow(0.7, dt)); // 공기 저항 조금
        }
        b.p.addScaledVector(b.vel, dt);
      });
      // 가까운 것끼리만 비교하려고 화면을 칸으로 나눔 (153개 × 153개를 다 비교하지 않음)
      let maxR = 0; blobs.forEach(b => { if (b.r > maxR) maxR = b.r; });
      const cell = maxR * 2 || 1;
      for (let iter = 0; iter < 4; iter++) {
        const grid = new Map();
        blobs.forEach((b, i) => {
          const key = Math.floor(b.p.x / cell) + ',' + Math.floor(b.p.y / cell);
          (grid.get(key) || grid.set(key, []).get(key)).push(i);
        });
        // 공끼리 겹치면 밀어내기
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
            if (dist >= minD || dist === 0) continue;
            nTmp.divideScalar(dist);
            const overlap = minD - dist;
            // 잡은 공이 다른 공을 밀 때: 찌그러짐 없이 부드럽게 밀어냄
            //   잡은 공도 살짝 밀려서(25%) 버티는 느낌을 주고, 밀린 공은 잡은 공의 속도를 이어받아
            //   겹쳤다가 '팍' 튕기는 순간이동이 생기지 않게 함
            if (a.held || c.held) {
              const h = a.held ? a : c, o = a.held ? c : a;
              const dir = a.held ? 1 : -1;                    // '잡은 공 → 밀린 공' 방향
              const nx = nTmp.x * dir, ny = nTmp.y * dir;
              h.p.x -= nx * overlap * 0.25; h.p.y -= ny * overlap * 0.25;
              o.p.x += nx * overlap * 0.75; o.p.y += ny * overlap * 0.75;
              const vh = h.vel.x * nx + h.vel.y * ny, vo = o.vel.x * nx + o.vel.y * ny;
              if (vo < vh) { o.vel.x += nx * (vh - vo); o.vel.y += ny * (vh - vo); }
              continue;
            }
            const wa = 0.5;                            // 던진 공끼리는 단단하게 반반씩 밀어냄
            a.p.addScaledVector(nTmp, -overlap * wa);
            c.p.addScaledVector(nTmp, overlap * (1 - wa));
            const vn = (c.vel.x - a.vel.x) * nTmp.x + (c.vel.y - a.vel.y) * nTmp.y;
            if (vn < 0) {
              const imp = -(1 + BOUNCE) * vn / 2;
              a.vel.addScaledVector(nTmp, -imp);
              c.vel.addScaledVector(nTmp, imp);
            }
            }
          }
        }
        // 벽과 바닥
        blobs.forEach(b => {
          if (b.p.x - b.r < walls.left) { b.p.x = walls.left + b.r; if (b.vel.x < 0) b.vel.x *= -BOUNCE; }
          if (b.p.x + b.r > walls.right) { b.p.x = walls.right - b.r; if (b.vel.x > 0) b.vel.x *= -BOUNCE; }
          // 천장: 화면 안으로 들어온 공은 위로 던져도 머리글 아래에서 튕겨 돌아옴
          if (!b.entered && b.p.y + b.r <= walls.top) b.entered = true;
          if (b.entered && b.p.y + b.r > walls.top) { b.p.y = walls.top - b.r; if (b.vel.y > 0) b.vel.y *= -BOUNCE; }
          if (b.p.y - b.r < walls.bottom) {
            b.p.y = walls.bottom + b.r;
            if (b.vel.y < 0) b.vel.y *= -BOUNCE;
            b.vel.x *= 0.985; // 바닥 마찰
          }
        });
      }
      // 굴러가는 만큼 실제로 돌기 (오른쪽으로 굴러가면 시계 방향)
      blobs.forEach(b => {
        qTmp.setFromAxisAngle(axisZ, -b.vel.x / b.r * dt);
        b.mesh.quaternion.premultiply(qTmp);
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
          if (b.follow) b.cur.copy(b.tgt);
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
