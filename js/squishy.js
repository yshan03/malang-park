// 말랑한 도형 인터랙션. 공통 형태 아이템 배열만 받는다 — 장미인지 들꽃인지 모른다.
//
// 한 화면 안에 두 가지 모드가 있다:
//
//   [목록 모드]  여러 개를 격자로 보여줌
//     ├ 마우스 올림 ─▶ 살짝 출렁
//     ├ 끌기       ─▶ 돌리기
//     └ 톡 누르기   ─▶ onOpen(index) 호출 → 바깥(페이지)이 상세 모드로 바꿔 줌
//
//   [상세 모드]  하나만 크게 위쪽 가운데에
//     ├ 꾹 누르기   ─▶ 눌린 곳이 쏙 들어감 → 손 떼면 탄성으로 튕겨 나옴
//     └ 끌기       ─▶ 돌리기 (손 떼면 관성으로 조금 더 돎)
//
// 말랑함의 원리 = "용수철": 구의 점(꼭짓점)마다 '목표 위치'로 끌려가는 힘(K)과
// 흔들림을 줄이는 힘(C)을 준다. C를 일부러 약하게 해서 목표를 지나쳤다 돌아오며 출렁인다.

(function () {
  const K = 170;           // 용수철 세기: 클수록 빨리 돌아옴
  const C = 8;             // 감쇠: 작을수록 더 출렁거림
  const DENT_DEPTH = 0.42; // 최대로 들어가는 깊이 (반지름 1 기준)
  const DENT_RADIUS = 0.55;// 눌림이 퍼지는 넓이
  const DRAG_THRESHOLD = 6;// 이만큼(px) 움직이면 '누르기'가 아니라 '돌리기'
  const SPACING = 2.7;     // 목록에서 도형 사이 간격
  const MOVE_SPEED = 7;    // 모드 전환 때 움직이는 빠르기
  // 구의 색: 프로토타입용 임시 도형이라 꽃색과 상관없이 모두 같은 색. (나중에 꽃별 디자인으로 교체 예정)
  const BLOB_COLOR = '#E9E4DA';

  // 상세 모드 화면 나누기: 위쪽 58%는 꽃, 아래는 정보. (interaction.html의 CSS와 같은 값)
  const DETAIL_SPLIT = 0.58;
  const HEADER_PX = 64;

  window.createSquishyScene = function (container, items, { onOpen } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

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
      el.textContent = b.item.name;
      container.appendChild(el);
      return el;
    });

    let mode = 'list';     // 'list' | 'detail'
    let selected = -1;     // 상세 모드에서 보여주는 도형 번호
    const detail = { pos: new THREE.Vector3(), scale: 1, viewW: 10 }; // layout()에서 계산

    // ---------- 도형 하나 만들기 ----------
    function makeBlob(item, i) {
      const geo = new THREE.SphereGeometry(1, 72, 54);
      const pos = geo.attributes.position;
      const base = Float32Array.from(pos.array); // 원래 모양 (반지름 1이라 = 바깥 방향)
      const n = pos.count;

      // 색: 위→아래로 살짝 어두워지는 그라데이션 + 소용돌이 무늬 (돌릴 때 회전이 눈에 보이도록)
      const top = new THREE.Color(BLOB_COLOR).convertSRGBToLinear();
      const bottom = top.clone().multiplyScalar(0.72);
      const colors = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let v = 0; v < n; v++) {
        const x = base[v * 3], y = base[v * 3 + 1], z = base[v * 3 + 2];
        const t = (1 - y) / 2;
        const phi = Math.atan2(z, x);
        const swirl = 0.88 + 0.12 * Math.sin(5 * phi + 7 * y);
        c.copy(top).lerp(bottom, smooth(t)).multiplyScalar(swirl);
        colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true, roughness: 0.38, metalness: 0,
        clearcoat: 0.7, clearcoatRoughness: 0.25
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.index = i;
      mesh.rotation.set(0.3, i * 1.3, 0);
      scene.add(mesh);

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.55), // 납작한 타원 그림자
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
      );
      scene.add(shadow);

      return {
        item, mesh, shadow, base,
        d: new Float32Array(n),   // 각 점이 안쪽(-)/바깥쪽(+)으로 밀린 정도
        v: new Float32Array(n),   // 그 속도
        press: 0, pressTarget: 0, // 누르는 세기 (0~1)
        pressPoint: new THREE.Vector3(0, 0, 1),
        wobble: 1, wobbleV: 0,    // 전체가 통통 튀는 출렁임
        spin: new THREE.Vector2(0, 0), // 손 뗀 뒤 관성 회전
        home: new THREE.Vector3(),     // 목록 모드에서의 자리
        cur: new THREE.Vector3(), curScale: 0,  // 지금 위치·크기
        tgt: new THREE.Vector3(), tgtScale: 1,  // 가려는 위치·크기
        phase: Math.random() * 6.28,
        awake: true
      };
    }

    // ---------- 배치 계산 (화면 크기가 바뀔 때마다) ----------
    function layout() {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;

      // 목록 모드: 화면 비율에 맞춰 격자
      const n = blobs.length;
      const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * camera.aspect * 0.9))));
      const rows = Math.ceil(n / cols);
      blobs.forEach((b, i) => {
        const r = Math.floor(i / cols);
        const inRow = r === rows - 1 ? n - r * cols : cols; // 마지막 줄은 가운데 정렬
        const col = i % cols;
        b.home.set((col - (inRow - 1) / 2) * SPACING, ((rows - 1) / 2 - r) * SPACING * 1.08, 0);
      });
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const W = cols * SPACING, H = rows * SPACING * 1.08 + 0.4;
      const dist = Math.max((H / 2) / Math.tan(halfFov), (W / 2) / (Math.tan(halfFov) * camera.aspect)) * 1.08;
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      // 상세 모드: 화면 픽셀 → 3D 공간 길이로 바꿔서, 위쪽 영역 가운데에 크게
      const viewH = 2 * dist * Math.tan(halfFov);
      const worldPerPx = viewH / h;
      const areaTop = HEADER_PX, areaBottom = h * DETAIL_SPLIT;
      const centerPx = (areaTop + areaBottom) / 2;
      const radiusPx = Math.max(40, Math.min((areaBottom - areaTop) * 0.4, w * 0.3));
      detail.pos.set(0, (h / 2 - centerPx) * worldPerPx, 0);
      detail.scale = radiusPx * worldPerPx;
      detail.viewW = viewH * camera.aspect;

      applyTargets(false);
    }

    // ---------- 모드에 따라 각 도형이 갈 곳 정하기 ----------
    function applyTargets(fromNav, dir = 0) {
      blobs.forEach((b, i) => {
        if (mode === 'list') {
          if (b.curScale < 0.01) { b.cur.copy(b.home); } // 숨어 있던 것은 제자리에서 자라남
          b.tgt.copy(b.home); b.tgtScale = 1;
        } else if (i === selected) {
          if (fromNav && dir) { // 이전/다음: 옆에서 미끄러져 들어옴
            b.cur.copy(detail.pos); b.cur.x += dir * detail.viewW * 0.55; b.curScale = detail.scale * 0.4;
          }
          b.tgt.copy(detail.pos); b.tgtScale = detail.scale;
        } else {
          if (fromNav && dir && b.curScale > 0.01) { // 이전 꽃은 반대쪽으로 빠져나감
            b.tgt.copy(detail.pos); b.tgt.x -= dir * detail.viewW * 0.55;
          }
          b.tgtScale = 0;
        }
        b.pressTarget = 0;
      });
      labels.forEach(el => el.classList.toggle('hidden', mode !== 'list'));
    }

    layout();
    blobs.forEach(b => { b.cur.copy(b.home); b.curScale = 1; });
    window.addEventListener('resize', layout);

    // ---------- 포인터 (마우스·터치 공통) ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let active = null; // 누르고 있는 중인 정보
    let hovered = null;

    function hitTest(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // 상세 모드에서는 가운데 꽃만 만질 수 있음
      const targets = mode === 'detail' ? [blobs[selected].mesh] : blobs.map(b => b.mesh);
      const hit = ray.intersectObjects(targets)[0];
      return hit ? { blob: blobs[hit.object.userData.index], point: hit.point } : null;
    }

    function setPressPoint(blob, worldPoint) {
      blob.pressPoint.copy(blob.mesh.worldToLocal(worldPoint.clone())).normalize();
    }

    renderer.domElement.addEventListener('pointerdown', e => {
      const hit = hitTest(e);
      if (!hit) return;
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { /* 일부 환경에서 실패해도 진행 */ }
      active = { blob: hit.blob, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, mode: 'tap', lastT: performance.now() };
      hit.blob.spin.set(0, 0);
      if (mode === 'detail') { // 상세 모드에서만 꾹 눌림
        setPressPoint(hit.blob, hit.point);
        hit.blob.pressTarget = 1;
        hit.blob.awake = true;
      }
      renderer.domElement.style.cursor = 'grabbing';
    });

    renderer.domElement.addEventListener('pointermove', e => {
      if (!active) {
        const hit = hitTest(e);
        const over = hit ? hit.blob : null;
        // 목록 모드 + 마우스일 때: 새로 올라간 도형이 살짝 출렁
        if (mode === 'list' && over && over !== hovered && e.pointerType === 'mouse') over.wobbleV += 1.6;
        hovered = over;
        renderer.domElement.style.cursor = over ? (mode === 'list' ? 'pointer' : 'grab') : 'default';
        return;
      }
      const b = active.blob;
      const moved = Math.hypot(e.clientX - active.startX, e.clientY - active.startY);
      if (active.mode === 'tap' && moved > DRAG_THRESHOLD) {
        active.mode = 'rotate';
        b.pressTarget = 0; // 돌리기 시작하면 누름은 풀린다
      }
      if (active.mode === 'tap') {
        if (mode === 'detail') {
          const hit = hitTest(e);
          if (hit && hit.blob === b) setPressPoint(b, hit.point); // 누른 채 미끄러지면 자국도 따라감
        }
      } else {
        const dx = e.clientX - active.lastX, dy = e.clientY - active.lastY;
        rotateBy(b, dx * 0.012, dy * 0.012);
        const now = performance.now(), dt = Math.max(1, now - active.lastT);
        b.spin.set(dx * 0.012 / dt * 16, dy * 0.012 / dt * 16);
        active.lastT = now;
      }
      active.lastX = e.clientX; active.lastY = e.clientY;
    });

    function release(e) {
      if (!active) return;
      const b = active.blob;
      if (active.mode === 'tap') {
        if (mode === 'detail') {
          b.pressTarget = 0;
          b.wobbleV += 2.2 * b.press; // 놓는 순간 몸 전체가 '통' 하고 튐
        } else if (e.type === 'pointerup') {
          onOpen && onOpen(blobs.indexOf(b)); // 목록에서 톡 → 상세로
        }
      }
      active = null;
      renderer.domElement.style.cursor = 'default';
    }
    renderer.domElement.addEventListener('pointerup', release);
    renderer.domElement.addEventListener('pointercancel', release);

    const qTmp = new THREE.Quaternion(), axisY = new THREE.Vector3(0, 1, 0), axisX = new THREE.Vector3(1, 0, 0);
    function rotateBy(b, ax, ay) {
      qTmp.setFromAxisAngle(axisY, ax); b.mesh.quaternion.premultiply(qTmp);
      qTmp.setFromAxisAngle(axisX, ay); b.mesh.quaternion.premultiply(qTmp);
    }

    // ---------- 매 프레임 ----------
    const tmp = new THREE.Vector3();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const ease = 1 - Math.exp(-dt * MOVE_SPEED);
      blobs.forEach((b, i) => {
        // 가려는 곳으로 부드럽게 이동·확대
        b.cur.lerp(b.tgt, ease);
        b.curScale += (b.tgtScale - b.curScale) * ease;
        const visible = b.curScale > 0.005;
        b.mesh.visible = b.shadow.visible = visible;
        if (!visible) { updateLabel(b, labels[i]); return; }

        // 누르는 세기는 서서히 올라가고(꾹~) 놓으면 바로 풀림
        b.press += (b.pressTarget - b.press) * (b.pressTarget > b.press ? 1 - Math.exp(-dt * 6) : 1);
        // 관성 회전 + 아무도 안 만질 때 느린 자전
        if (!active || active.blob !== b) {
          rotateBy(b, b.spin.x + dt * 0.15, b.spin.y);
          b.spin.multiplyScalar(Math.pow(0.04, dt));
        }
        // 전체 출렁임 (용수철)
        b.wobbleV += (-K * 0.6 * (b.wobble - 1) - C * 0.7 * b.wobbleV) * dt;
        b.wobble += b.wobbleV * dt;

        const s = b.curScale;
        const bob = Math.sin(t * 1.4 + b.phase) * 0.05 * s;
        b.mesh.position.set(b.cur.x, b.cur.y + bob, b.cur.z);
        b.mesh.scale.set(s * b.wobble, s * (2 - b.wobble), s * b.wobble); // 납작해지면 옆으로 퍼짐
        b.shadow.position.set(b.cur.x, b.cur.y - 1.05 * s, -0.9 * s);
        b.shadow.scale.setScalar(s * (1 - bob * 1.5 / Math.max(s, 0.01)));

        if (b.awake) updateSurface(b, dt);
        updateLabel(b, labels[i]);
      });
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    function updateSurface(b, dt) {
      const attr = b.mesh.geometry.attributes.position;
      const arr = attr.array, base = b.base, d = b.d, v = b.v;
      const p = b.pressPoint, depth = DENT_DEPTH * b.press;
      let energy = 0;
      for (let k = 0, n = d.length; k < n; k++) {
        const x = base[k * 3], y = base[k * 3 + 1], z = base[k * 3 + 2];
        const dist2 = (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2;
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
      b.mesh.geometry.computeVertexNormals();
      // 완전히 멈추면 계산 쉬기 (배터리 절약)
      b.awake = energy > 0.002 * d.length || b.pressTarget > 0;
    }

    function updateLabel(b, el) {
      tmp.copy(b.home); tmp.y -= 1.32;
      tmp.project(camera);
      el.style.transform = `translate(-50%, 0) translate(${(tmp.x + 1) / 2 * container.clientWidth}px, ${(1 - tmp.y) / 2 * container.clientHeight}px)`;
    }

    requestAnimationFrame(frame);

    // ---------- 바깥(페이지)에서 쓰는 조작 버튼 ----------
    return {
      showList() {
        mode = 'list'; selected = -1;
        applyTargets(false);
      },
      // dir: 0 = 목록에서 들어옴, +1 = 다음(오른쪽에서 등장), -1 = 이전(왼쪽에서 등장)
      showDetail(index, dir = 0) {
        mode = 'detail'; selected = index;
        applyTargets(true, dir);
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
