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
//     ├ 꽃송이 꾹 누르기 ─▶ 눌린 곳이 쏙 들어감 → 손 떼면 탄성으로 튕겨 나오며 향기가 피어오름
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

    // ---------- 향기: 꽃송이를 누르면 "향기"가 보이게 ----------
    //   (2026-11-18 바꿈: 꽃잎 조각 → 꼬불선(냄새처럼 보임) → 지금의 "향기 리본")
    //
    //   누름 ──────── 꾹 누르고 있기 ──────────── 놓음 ─────────────────── 사라짐
    //    │               │                          │                          │
    //   꽃이 쏙          반짝이가 소용돌이치며         빛이 "팡" 퍼지고            밖으로 가며
    //   들어감           꽃으로 빨려 듦 (마법 모으기)   향기 리본이 여러 방향으로    옅어지며 사라짐
    //                   + 꽃 뒤에 빛이 차오름         고리를 그리며 감겨 나감
    //                   오래 누를수록 charge↑ → 더 많이·더 빠르게   + 리본을 따라 흐르는 반짝이
    //
    //   리본 모양 = 위로 올라가면서 동시에 빙글빙글 도는 점의 자취 (필기체 ℓ처럼 고리가 생김)
    //       ↑ 올라가는 속도보다 도는 원이 크면 고리가 생긴다. 위로 갈수록 원이 커져서 위쪽에 고리가 많음
    //
    //   가만히 있을 때: 향기가 센 장미(scent ≥ 0.6)는 몇 초마다 옅은 리본 한 줄기가 저절로 피어오름
    //   향기 세기(item.scent 0~1, 설명 문장에서 읽은 값)가 클수록: 리본 수(3~8)·길이·머무는 시간·반짝이 수 ↑
    const SCENT = {
      CHARGE_TIME: 1.0,      // 이만큼(초) 꾹 누르면 향기를 다 모음 (charge = 1)
      SEG: 64,               // 리본 한 줄기를 몇 마디로 나눠 그릴지 (고리가 매끈하게 보이도록 넉넉히)
      TURNS: 1.6,            // 리본이 끝까지 올라가는 동안 도는 바퀴 수
      IDLE_MIN: 3.5,         // 가만히 있을 때 저절로 피어오르는 간격 (초, 최소~최대)
      IDLE_MAX: 6.5,
      IDLE_SCENT: 0.6,       // 이 세기 이상인 장미만 저절로 피어오름
      FAN: 2.0               // 놓을 때 리본이 퍼지는 범위 (위쪽 기준 좌우 각도, 라디안. 2.0 ≈ 115°)
    };

    // 꽃 색으로 향기 색 만들기: 크림색 배경 위에서도 보이게 밝기를 0.5~0.68로 맞춤
    //   흰 꽃(채도 거의 0)은 그대로 쓰면 배경에 묻혀서 따뜻한 베이지로, 노란 꽃은 살짝 주황 쪽으로 (이름표 색 규칙과 같은 생각)
    function scentTone(item) {
      const cols = (item.blob && item.blob.colors) || {};
      const hsl = {};
      new THREE.Color(cols.outer || cols.center || '#E86B86').getHSL(hsl);
      let { h, s, l } = hsl;
      if (s < 0.12) { h = 0.09; s = 0.4; }
      else if (h > 0.1 && h < 0.2) h -= 0.03;
      s = Math.max(s, 0.38);
      l = Math.min(0.68, Math.max(0.5, l * 0.85));
      return {
        line: new THREE.Color().setHSL(h, s, l),                    // 리본 아래쪽(꽃 가까이)·파동
        light: new THREE.Color().setHSL(h, s * 0.8, Math.min(0.86, l + 0.2)),  // 리본 위쪽: 옅은 빛깔로 흩어짐
        spark: new THREE.Color().setHSL(h, s, l - 0.1)              // 반짝이 (조금 더 진하게)
      };
    }

    // (1) 향기 리본: 마디마다 양옆 두 점 = 얇은 띠. 매 프레임 점 위치를 다시 계산해서 감기며 올라감
    //     ShaderMaterial = 아주 짧은 그림 규칙: 점마다 "투명도"와 "아래색→위색 섞는 비율"만 정함
    const ribbonMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color() }, color2: { value: new THREE.Color() }, opacity: { value: 1 } },
      vertexShader: 'attribute float alpha; attribute float grad; varying float vA; varying float vG; void main(){ vA = alpha; vG = grad; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 color; uniform vec3 color2; uniform float opacity; varying float vA; varying float vG; void main(){ gl_FragColor = vec4(mix(color, color2, vG), vA * opacity); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const ribbons = [];
    for (let k = 0; k < 20; k++) {
      const n = SCENT.SEG + 1;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
      geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n * 2), 1));
      geo.setAttribute('grad', new THREE.BufferAttribute(new Float32Array(n * 2), 1));
      const index = [];
      for (let i = 0; i < SCENT.SEG; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geo.setIndex(index);
      const mesh = new THREE.Mesh(geo, ribbonMat.clone());
      mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
      scene.add(mesh);
      ribbons.push({ mesh, age: 0, life: 0, base: new THREE.Vector3(), dir: 0, height: 1, width: 0.03, spin: 1, flow: 0, phase: 0, size: 1, alpha: 1, headV: 0 });
    }
    // 리본 위의 한 점 (v = 0 꽃 쪽 ~ 1 끝) → out
    //   먼저 "위로 뻗는 리본"으로 계산한 다음(lx, ly), 리본 방향(R.dir)만큼 돌려서 여러 방향으로 뻗게 함
    function ribbonPoint(R, v, out) {
      const s = R.size;
      const ang = R.spin * (Math.PI * 2 * SCENT.TURNS * v - R.age * 0.8) + R.phase;   // 도는 각도 (시간이 지나면 리본 전체가 천천히 돎)
      const rad = s * (0.12 + 0.34 * v);                       // 원 크기: 끝으로 갈수록 커짐 → 끝쪽에 고리
      const lx = rad * Math.sin(ang) + R.flow * v * v * s * 0.6;   // + 끝으로 갈수록 한쪽으로 흘러감 (바람에 실리듯)
      const ly = v * R.height + rad * 0.6 * (Math.cos(ang) - 1) + s * 0.1 * R.age;   // 원의 움직임이 고리를 만듦 + 전체가 천천히 뻗어 나감
      const z = rad * Math.cos(ang) * 0.6;                     // 앞뒤로도 돌아서 꽃 뒤로 살짝 숨었다 나옴
      const c = Math.cos(R.dir), sn = Math.sin(R.dir);         // 리본 방향: 0 = 위, + = 왼쪽으로 기울어짐
      return out.set(R.base.x + lx * c - ly * sn, R.base.y + lx * sn + ly * c + s * 0.06 * R.age, R.base.z + z);  // 향기는 전체적으로 살짝 떠오름
    }

    // (2) 반짝이: 네 갈래 별 모양 그림(캔버스로 한 번 그림)을 붙인 작은 판. 색은 꽃마다 바꿈
    const sparkTex = (function () {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      g.translate(32, 32); g.fillStyle = '#fff';
      g.beginPath();                                   // 가운데가 오목한 네 갈래 별
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        g.quadraticCurveTo(0, 0, Math.cos(a) * 30, Math.sin(a) * 30);
        g.quadraticCurveTo(0, 0, Math.cos(a + Math.PI / 4) * 7, Math.sin(a + Math.PI / 4) * 7);
      }
      g.fill();
      return new THREE.CanvasTexture(c);
    })();
    const sparks = [];
    for (let k = 0; k < 260; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false }));
      sp.visible = false; sp.renderOrder = 3;
      scene.add(sp);
      sparks.push({ sp, age: 0, life: 0, vel: new THREE.Vector3(), orbit: null, r0: 0, a0: 0, w: 0, rib: null, back: 0, size: 1, turn: 0 });
    }

    // (3) 빛: 꽃 뒤에서 차오르는 동그란 빛무리 (가운데가 진하고 바깥으로 옅어지는 그림)
    //     꽃보다 뒤에 두어서 꽃 가장자리 둘레로만 은은하게 보임. 놓는 순간 "팡" 커지며 사라짐
    const glowTex = (function () {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const glow = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false })), level: 0, burst: 0, blob: null };
    glow.sp.visible = false; glow.sp.renderOrder = 1;
    scene.add(glow.sp);

    let nextRibbon = 0, nextSpark = 0;
    function scentOf(b) { return typeof b.item.scent === 'number' ? b.item.scent : 0.5; }
    function toneOf(b) { return b.scentTone || (b.scentTone = scentTone(b.item)); }   // 꽃마다 한 번만 계산
    function flowerTop(b, out) {               // 향기가 피어오르기 시작하는 곳: 꽃송이 위쪽, 살짝 앞
      const s = b.curScale;
      return out.set(b.mesh.position.x, b.mesh.position.y + s * 0.65, b.mesh.position.z + s * 0.35);
    }
    function useSpark(b, size, life) {         // 반짝이 하나 꺼내서 기본값 채우기
      const p = sparks[nextSpark++ % sparks.length];
      p.sp.material.color.copy(toneOf(b).spark).convertSRGBToLinear();
      p.orbit = null; p.rib = null; p.size = size; p.turn = (Math.random() - 0.5) * 4;
      p.age = 0; p.life = life; p.sp.visible = true;
      return p;
    }

    // 누를 때: 향기 모으기 시작 (누른 자리 동그란 파동은 2026-11-18 사용자 요청으로 뺌)
    function scentPress(b) {
      b.charge = 0; b.gatherT = 0;
      b.swirl = Math.random() < 0.5 ? 1 : -1;                 // 소용돌이 도는 방향 (누를 때마다 랜덤)
      glow.blob = b; glow.burst = 0;
    }

    // 놓을 때: 모은 만큼 빛이 "팡" + 향기 리본이 여러 방향으로 + 반짝이가 사방으로
    function scentRelease(b) {
      const scent = scentOf(b), charge = b.charge || 0;
      const amount = 0.35 + 0.65 * charge;                    // 톡 눌러도 조금은 나옴, 꾹 누를수록 많이
      const count = 3 + Math.round(5 * scent * amount);         // 리본 3~8줄기 (향기 세고 꾹 누를수록 많이)
      spawnRibbons(b, count, amount, false);
      const s = b.curScale, c = b.mesh.position;
      const n = Math.round((10 + 25 * scent) * amount);        // 리본과 따로 사방으로 톡톡 흩어지는 반짝이 (최대 35개)
      for (let k = 0; k < n; k++) {
        const p = useSpark(b, s * (0.12 + Math.random() * 0.12), 0.8 + Math.random() * 0.7);
        const a = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;   // 위쪽 위주로 넓게 (아래로는 덜)
        p.sp.position.set(c.x + Math.cos(a) * s * 0.4, c.y + Math.sin(a) * s * 0.4, c.z + s * 0.4);
        p.vel.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(s * (1.6 + Math.random() * 1.8));
      }
      if (glow.blob === b) { glow.level = Math.max(glow.level, 0.35 + 0.65 * charge); glow.burst = 0.001; }   // 빛: 모은 만큼 "팡" 커지며 사라짐
      b.charge = 0;
    }

    // 리본 count줄기 만들기. faint = 가만히 있을 때 저절로 나오는 옅은 한 줄기 (위쪽으로만)
    function spawnRibbons(b, count, amount, faint) {
      const scent = scentOf(b), s = b.curScale, c = b.mesh.position;
      const turn = (Math.random() - 0.5) * 0.4;                 // 부채꼴 전체를 살짝 랜덤하게 돌림
      for (let i = 0; i < count; i++) {
        const R = ribbons[nextRibbon++ % ribbons.length];
        // 방향: 여러 줄기면 위쪽 기준 좌우 부채꼴(±FAN)로 고르게 + 살짝 흔듦. 한 줄기(가만히)면 위로
        const dir = faint ? (Math.random() - 0.5) * 0.5 : (count === 1 ? 0 : (i / (count - 1) * 2 - 1) * SCENT.FAN) + turn + (Math.random() - 0.5) * 0.25;
        R.dir = dir;
        R.mesh.material.uniforms.color.value.copy(toneOf(b).line);
        R.mesh.material.uniforms.color2.value.copy(toneOf(b).light);
        // 출발점: 꽃 가운데에서 그 방향으로 꽃 가장자리쯤
        R.base.set(c.x - Math.sin(dir) * s * 0.55, c.y + Math.cos(dir) * s * 0.6, c.z + s * 0.35);
        R.spin = i % 2 ? 1 : -1;                                // 이웃한 리본은 반대로 감김
        R.phase = Math.random() * 6.28;
        R.flow = (Math.random() - 0.5) * 0.8;
        const sideways = 0.7 + 0.3 * Math.cos(dir);               // 옆으로 가는 리본은 조금 짧게 (화면 밖으로 덜 나가게)
        R.height = s * (0.8 + 0.7 * scent) * (0.6 + 0.4 * amount) * (faint ? 1 : sideways * (0.85 + Math.random() * 0.3));
        R.width = s * (faint ? 0.02 : 0.03);
        R.alpha = faint ? 0.5 : 0.95;
        R.size = s;
        R.life = (2.4 + 1.2 * scent) * (faint ? 1.3 : 1);
        R.age = faint ? 0 : -Math.random() * 0.12;               // 거의 동시에 "팡"
        R.headV = 0;
        R.mesh.visible = true;
        // 리본을 따라 흐르는 반짝이: 리본 앞쪽 끝을 조금 뒤에서 따라감
        const m = faint ? 1 : Math.round((2 + 4 * scent) * amount);   // 리본마다 최대 6개
        for (let k = 0; k < m; k++) {
          const p = useSpark(b, s * (faint ? 0.1 : 0.13 + Math.random() * 0.06), R.life * (0.55 + Math.random() * 0.25));
          p.rib = R; p.back = 0.04 + k * 0.1 + Math.random() * 0.04;
          ribbonPoint(R, 0, p.sp.position);
        }
      }
    }

    const tmpScent = new THREE.Vector3(), tmpA = new THREE.Vector3();
    function updateScent(dt, t) {
      // 꾹 누르고 있는 동안: charge가 차오르고, 반짝이가 꽃 쪽으로 모여듦
      if (mode === 'detail' && active && active.mode === 'tap' && active.part === 'head' && active.blob) {
        const b = active.blob, s = b.curScale;
        b.charge = Math.min(1, (b.charge || 0) + dt / SCENT.CHARGE_TIME);
        b.gatherT = (b.gatherT || 0) - dt;
        while (b.charge < 1 && b.gatherT <= 0) {                // (한 프레임에 여러 개가 나올 수도 있어서 while)
          // 나오는 간격: 향기가 셀수록, 그리고 오래 누를수록(charge↑) 짧아짐 → 점점 많이 빨려 듦
          b.gatherT += (0.16 - 0.08 * scentOf(b)) / (5.5 + 5.5 * b.charge);   // (2026-11-18 조금 더 많이: 4 → 5.5)
          const p = useSpark(b, s * (0.12 + Math.random() * 0.16), 0.6 + Math.random() * 0.25);  // 크기 섞음 (평균 0.2)
          p.orbit = b.mesh.position.clone(); p.orbit.z += s * 0.4; // 이 점(꽃 가운데)을 중심으로 돌며 빨려 듦
          p.r0 = s * (1.2 + Math.random() * 0.8);                 // 처음 거리
          p.a0 = Math.random() * Math.PI * 2;                      // 처음 각도
          p.w = b.swirl * (3.5 + Math.random() * 2.5);             // 도는 빠르기 (모두 같은 방향 = 소용돌이)
          p.turn = 3;
        }
      }
      // 가만히 있을 때: 향기가 센 장미는 가끔 저절로 한 줄기
      if (mode === 'detail' && selected >= 0 && !active) {
        const b = blobs[selected];
        if (scentOf(b) >= SCENT.IDLE_SCENT && !b.settle && b.stemGrow > 0.9) {
          if (b.idleT === undefined) b.idleT = 1.5;
          b.idleT -= dt;
          if (b.idleT <= 0) { spawnRibbons(b, 1, 0.5, true); b.idleT = SCENT.IDLE_MIN + Math.random() * (SCENT.IDLE_MAX - SCENT.IDLE_MIN); }
        }
      }

      // 리본 움직이기
      ribbons.forEach(R => {
        if (!R.mesh.visible) return;
        R.age += dt;
        if (R.age >= R.life) { R.mesh.visible = false; return; }
        if (R.age < 0) { R.mesh.material.uniforms.opacity.value = 0; return; }
        const u = R.age / R.life;
        const head = 1 - Math.pow(1 - Math.min(1, u / 0.6), 3);   // 앞쪽 끝: 처음엔 쭉, 갈수록 나긋하게
        const tail = Math.pow(Math.max(0, (u - 0.35) / 0.65), 1.3); // 뒤쪽 끝: 조금 뒤부터 따라 올라감 → 리본이 위로 떠나며 사라짐
        R.headV = head;
        const pos = R.mesh.geometry.attributes.position.array;
        const alp = R.mesh.geometry.attributes.alpha.array;
        const grd = R.mesh.geometry.attributes.grad.array;
        const N = SCENT.SEG;
        let px = 0, py = 0;
        for (let i = 0; i <= N; i++) {
          const f = i / N;                                        // 0 = 뒤쪽 끝, 1 = 앞쪽 끝
          const v = tail + (head - tail) * f;                     // 전체 높이 중 어디쯤인지 (0 = 꽃, 1 = 꼭대기)
          ribbonPoint(R, v, tmpA);
          // 띠의 폭 방향 = 화면에서 리본이 가는 방향에 수직
          let nx = 1, ny = 0;
          if (i > 0) { const dx = tmpA.x - px, dy = tmpA.y - py, len = Math.hypot(dx, dy) || 1; nx = dy / len; ny = -dx / len; }
          else { ribbonPoint(R, v + 0.002, tmpScent); const dx = tmpScent.x - tmpA.x, dy = tmpScent.y - tmpA.y, len = Math.hypot(dx, dy) || 1; nx = dy / len; ny = -dx / len; }
          px = tmpA.x; py = tmpA.y;
          const w = R.width * Math.pow(Math.sin(Math.PI * f), 0.7) * (1.15 - 0.4 * v);   // 양 끝은 가늘게, 위로 갈수록 살짝 가늘게
          const j = i * 6;
          pos[j] = tmpA.x - nx * w; pos[j + 1] = tmpA.y - ny * w; pos[j + 2] = tmpA.z;
          pos[j + 3] = tmpA.x + nx * w; pos[j + 4] = tmpA.y + ny * w; pos[j + 5] = tmpA.z;
          const a = Math.pow(Math.sin(Math.PI * f), 0.6) * (1 - 0.45 * v);   // 양 끝 옅게 + 위로 갈수록 옅게
          alp[i * 2] = alp[i * 2 + 1] = a;
          grd[i * 2] = grd[i * 2 + 1] = Math.min(1, v * 1.2);  // 아래는 꽃 색, 위로 갈수록 옅은 빛깔
        }
        R.mesh.geometry.attributes.position.needsUpdate = true;
        R.mesh.geometry.attributes.alpha.needsUpdate = true;
        R.mesh.geometry.attributes.grad.needsUpdate = true;
        R.mesh.material.uniforms.opacity.value = R.alpha * Math.min(1, (1 - u) * 3) * Math.min(1, R.age * 6);
      });

      // 반짝이 움직이기
      sparks.forEach(p => {
        if (!p.sp.visible) return;
        p.age += dt;
        if (p.age >= p.life) { p.sp.visible = false; return; }
        const u = p.age / p.life;
        if (p.rib) {                                                     // 리본 반짝이: 리본 앞쪽 끝을 따라 흐름
          if (!p.rib.mesh.visible || p.rib.age < 0) { p.sp.material.opacity = 0; return; }
          ribbonPoint(p.rib, Math.max(0, p.rib.headV - p.back), p.sp.position);
        } else if (p.orbit) {                                            // 모으는 반짝이: 소용돌이치며 꽃 가운데로
          const r = p.r0 * (1 - u * u);                                  // 처음엔 천천히, 끝에 확 빨려 듦
          const a = p.a0 + p.w * p.age * (1 + u);                        // 가까워질수록 빨리 돎
          p.sp.position.set(p.orbit.x + Math.cos(a) * r, p.orbit.y + Math.sin(a) * r * 0.85, p.orbit.z);
        } else { p.vel.multiplyScalar(Math.pow(0.3, dt)); p.sp.position.addScaledVector(p.vel, dt); }
        p.sp.material.rotation += p.turn * dt;
        const pop = Math.sin(Math.PI * u);                               // 커졌다 작아짐 (반짝)
        const twinkle = p.rib ? 0.75 + 0.25 * Math.sin(t * 14 + p.back * 40) : 1;   // 리본 반짝이는 깜빡깜빡
        p.sp.scale.setScalar(p.size * (0.4 + 0.8 * pop) * twinkle);
        p.sp.material.opacity = Math.min(1, pop * 1.6);
      });

      // 빛: 누르고 있는 동안 charge만큼 차오르고, 놓으면 "팡" 커지며 사라짐
      const gb = glow.blob;
      if (gb && mode === 'detail') {
        const s = gb.curScale, holding = active && active.blob === gb && active.mode === 'tap' && active.part === 'head';
        if (holding) glow.level = gb.charge || 0;
        if (glow.burst > 0) {                                            // 팡: 0.4초 동안 커지며 옅어짐
          glow.burst += dt / 0.4;
          if (glow.burst >= 1.4) { glow.burst = 0; glow.level = 0; glow.blob = null; }
        } else if (!holding) glow.level = Math.max(0, glow.level - dt * 3);  // 돌리기로 바뀌는 등: 스르르 꺼짐
        const lv = glow.level, bu = glow.burst;
        const pulse = 1 + 0.06 * Math.sin(t * (8 + 10 * lv));          // 차오를수록 빨리 두근두근
        const size = bu > 0 ? s * (1.6 + 1.8 * lv) * (1 + 1.2 * Math.min(1, bu)) : s * (1.2 + 1.8 * lv) * pulse;
        const op = bu > 0 ? 0.55 * lv * Math.max(0, 1 - bu) : 0.5 * lv;
        glow.sp.visible = op > 0.005;
        glow.sp.material.color.copy(toneOf(gb).line).convertSRGBToLinear();
        glow.sp.material.opacity = op;
        glow.sp.scale.setScalar(size);
        glow.sp.position.set(gb.mesh.position.x, gb.mesh.position.y, gb.mesh.position.z - s * 0.4);   // 꽃 뒤 → 가장자리로 빛이 새어 나옴
      } else glow.sp.visible = false;
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
        if (hit.part === 'head') {                 // 꽃송이: 쏙 들어감 + 향기 모으기 시작
          setPressPoint(hit.blob, hit.point);
          hit.blob.pressTarget = 1;
          hit.blob.awake = true;
          scentPress(hit.blob);
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
        if (active.blob) { active.blob.pressTarget = 0; active.blob.charge = 0; if (mode === 'list') { active.blob.held = true; wake(active.blob); } } // 돌리기로 바뀌면 모으던 향기는 취소
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
        if (active.part === 'head') scentRelease(b);                      // 놓는 순간 모은 만큼 향기가 피어오름
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
            rotateBy(b, b.spin.x + dt * 0.1, b.spin.y);    // 가만히 있을 때 저절로 도는 빠르기 (처음 0.15 → 0.1, 2026-11-18 사용자 결정)
            b.spin.multiplyScalar(Math.pow(0.05, dt));      // 돌리고 놓은 뒤 관성: 1초 뒤 5% 남음 (처음 4%)
          }
        }
        // 전체 출렁임 (용수철)
        b.wobbleV += (-K * 0.6 * (b.wobble - 1) - C * 0.7 * b.wobbleV) * dt;
        b.wobble += b.wobbleV * dt;

        const s = b.curScale;
        const bob = mode === 'detail' ? Math.sin(t * 1.4 + b.phase) * 0.05 * s : 0; // 상세에서만 둥실
        b.mesh.position.set(b.cur.x, b.cur.y + bob, b.cur.z);
        b.mesh.scale.set(s * b.wobble, s * (2 - b.wobble), s * b.wobble); // 납작해지면 옆으로 퍼짐
        const shadowY = (b.stemPivot && b.stemGrow > 0.5) ? window.FlowerBlob.stemBottom(b.item.blob || {}) * 0.95 : -1.05; // 줄기가 있으면 그 장미의 줄기 끝 아래
        b.shadow.position.set(b.cur.x, b.cur.y + shadowY * s, -0.9 * s);
        b.shadow.scale.setScalar(Math.max(0, s - bob * 1.5));

        if (b.awake && b.full) updateSurface(b, dt);
        if (SHOW_LIST_LABELS) updateLabel(b, labels[i]);
      });
      updateScent(dt, t);
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
