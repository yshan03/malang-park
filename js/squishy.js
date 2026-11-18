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
  const PILE_FILL = 0.72;  // 꽃들이 병 몸통 넓이의 몇 %를 차지할지 (꽃 크기 결정). 쌓이면 병 어깨(높이의 약 88%)까지 가득 참
  // ----- 종이학 유리병 (2026-11-18: 유리 돔 → 둥근 배 병) -----
  //   몸통 = "슈퍼타원": |x/a|^n + |y/b|^n = 1. n=2면 그냥 타원, 클수록 네모에 가까워짐.
  //   n=2.6 = 통통하게 둥글면서 바닥은 살짝 평평 → 장미가 바닥에 안정적으로 쌓이고, 타원보다 넓이도 넓음
  const JAR_N = 2.6;
  const JAR_CORK_PX = 56, JAR_NECK_PX = 46; // 코르크·병목 높이(px). 몸통은 그 아래부터 (2026-11-18: 코르크 30 → 56, 병목 22 → 46으로 키움)
  const JAR_NECK_W = 0.36;                  // 병목 폭 = 몸통 폭의 몇 배
  const JAR_SHRINK = 0.88;                  // 병 폭을 화면보다 조금 좁게 → 병 옆 틈이 꽃 지름보다 넓어 꽃이 옆으로 흘러내려 바닥에 쌓임 (0.93이면 틈에 끼임)
  // ----- 코르크 뽑기 (2026-11-18) -----
  //   코르크를 위로 끌면 조금 버티다가 "뽕!" 하고 빠짐 → 손을 따라다니다 놓으면 떨어져 병 옆에 놓임
  //   빠진 코르크를 끌어다 병 입구에 가져가면 "쏙" 다시 꽂힘. 병이 열려 있는 동안은 꽃이 병목으로 드나듦
  const CORK_POP_PX = 26;                   // 이만큼(px) 끌어 올리면 빠짐
  const CORK_SNAP_PX = 22;                  // 빠진 코르크가 입구에서 이만큼(px) 안으로 오면 다시 꽂힘
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
  const LIST_TOP_PX = 84;      // 목록: 유리병 코르크 꼭대기 높이 (제목 아래 안내 문구와 겹치지 않게)
  const BUTTON_ZONE_PX = 110; // 아래 TMI 버튼이 차지하는 높이
  const CAMERA_Z = 12;

  window.createSquishyScene = function (container, items, { onOpen } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // 캔버스 바탕을 페이지 바탕색으로 꽉 칠함 (투명 X). 투명하면 휴대폰(아이폰 사파리)에서 빛무리·향기처럼 아주 옅게 사라지는 부분에
    //   색 정밀도가 깨져 알록달록한 점이 보였음 (2026-11-18). 페이지 바탕이 한 가지 색이라 겉보기는 똑같음
    renderer.setClearColor(new THREE.Color(getComputedStyle(document.body).backgroundColor || '#f6f1e7'), 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_Z);

    // 조명: 전체 밝기를 85%로 낮춤 → 꽃 색이 하얗게 뜨지 않게 (2026-11-18, 예전 0.85 / 0.75 / 0.35)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cdb8, 0.72));
    const key = new THREE.DirectionalLight(0xffffff, 0.64);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1e0, 0.3);
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
    const walls = { left: -1, right: 1, bottom: -1, top: 1 };  // 병 몸통을 감싸는 네모 (처음 줄 세울 때·화면 크기 바뀔 때 씀)
    // 병 몸통(슈퍼타원): cx·cy = 가운데, ax·ay = 가로·세로 반지름. 실제 벽은 이 곡면
    const jar = { cx: 0, cy: 0, ax: 1, ay: 1, neckTop: 1, neckHalf: 0.1, wall: 0.02, shoulderY: 1, corkPx: null };
    // 코르크 상태: 'in' 꽂힘(pull = 끌어 올린 길이) / 'held' 손에 들림 / 'free' 떨어져 굴러다니거나 놓여 있음
    //   p = 코르크 무게중심(3D 길이), v = 속도, a = 기울기(라디안)
    const cork = { state: 'in', pull: 0, p: new THREE.Vector2(), v: new THREE.Vector2(), a: 0, r: 0.2 };
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
    // ---------- 종이학 유리병 그림 (목록 모드에서만 보임, 꽃밭 위에 겹쳐 그리지만 터치는 통과) ----------
    //   몸통(슈퍼타원) + 병목 + 코르크(꽂힌 부분·머리) + 와인색 병목 리본 + 손글씨 이름 태그 + 유리 반사광 + 바닥 그림자
    function jarPoint(t, inset) {              // 몸통 둘레의 한 점 (t = 각도, inset = 안쪽으로 줄이는 3D 길이)
      const c = Math.cos(t), sn = Math.sin(t), e = 2 / JAR_N;
      return [jar.cx + Math.sign(c) * Math.pow(Math.abs(c), e) * (jar.ax - inset),
              jar.cy + Math.sign(sn) * Math.pow(Math.abs(sn), e) * (jar.ay - inset)];
    }
    function drawJar() {
      const w = view.w, h = view.h, k = 1 / view.wpp;              // 3D 길이 → px
      const X = x => (x + view.W / 2) * k, Y = y => (view.H / 2 - y) * k;
      const P = (pt) => `${X(pt[0]).toFixed(1)} ${Y(pt[1]).toFixed(1)}`;
      const neckHalf = jar.ax * JAR_NECK_W / 2;
      // 몸통이 병목과 만나는 각도: 슈퍼타원 위쪽에서 x = 병목 반폭이 되는 곳
      const t0 = Math.acos(Math.pow(neckHalf / jar.ax, JAR_N / 2));
      // 몸통 윤곽: 오른쪽 어깨(t0) → 오른쪽 → 바닥 → 왼쪽 → 왼쪽 어깨(π - t0) 를 촘촘히 이어 그림
      let body = '';
      for (let i = 0, N = 96; i <= N; i++) {
        const t = t0 - i / N * (Math.PI + 2 * t0);     // 오른쪽 어깨(t0)에서 시계 방향으로 왼쪽 어깨(-π - t0)까지
        body += (i ? ' L' : 'M') + P(jarPoint(t, 0));
      }
      const nL = X(jar.cx - neckHalf), nR = X(jar.cx + neckHalf), nT = Y(jar.neckTop);
      const shoulderY = Y(jarPoint(t0, 0)[1]);
      // 코르크 = 두 부분 (2026-11-18: 병 입구에 자연스럽게 꽂혀 보이도록)
      //   ① 꽂힌 부분(plug): 병목 안쪽 폭에 딱 맞는 직사각형. 유리보다 "뒤"에 그려서 유리 너머로 비쳐 보임
      //   ② 머리 부분(top): 병 입구 위로 나온 부분. 위가 넓고 아래(입구)가 좁은 사다리꼴, 입구 테두리 바로 위에 얹힘
      //   그리는 순서: 꽂힌 부분 → 유리 병 → 코르크 머리 → 입구 테두리(코르크가 테두리 안으로 들어가는 것처럼)
      //   코르크는 움직이니까 "코르크 자기 좌표"로 그림: 원점 = 병 입구 가운데(꽂혀 있을 때), 위쪽이 -y
      //     머리: y = -hh(꼭대기) … 0(입구)   꽂힌 부분: y = -2 … plugH
      const cxp = X(jar.cx);
      const topW = (nR - nL) + 36, rimW = (nR - nL) + 8, hh = JAR_CORK_PX * 0.6;
      const plugW = (nR - nL) - 4, plugH = JAR_CORK_PX * 0.45;
      const cy0 = (plugH - hh) / 2;                              // 코르크 전체의 무게중심 (자기 좌표 y)
      jar.corkPx = { topW, rimW, hh, plugW, plugH, cy0 };
      const head = `M${-rimW / 2} 1 L${-topW / 2} ${-hh + 6} Q${-topW / 2} ${-hh} ${-topW / 2 + 6} ${-hh}`
                 + ` L${topW / 2 - 6} ${-hh} Q${topW / 2} ${-hh} ${topW / 2} ${-hh + 6} L${rimW / 2} 1 Z`;
      const plug = `<rect x="${-plugW / 2}" y="-2" width="${plugW}" height="${plugH}" rx="3" fill="#C49A62"/>
                    <rect x="${-plugW / 2}" y="${plugH - 6}" width="${plugW}" height="4" rx="2" fill="rgba(110,80,40,0.25)"/>`;
      const headSvg = `<path d="${head}" fill="#CFA56C" stroke="rgba(130,95,50,0.4)" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M${topW * 0.18} ${-hh + 2} L${topW / 2 - 3} ${-hh + 4} L${rimW / 2 - 1} 0 L${rimW * 0.2} 0 Z" fill="rgba(140,100,50,0.18)"/>
        <ellipse cx="0" cy="${-hh + 4}" rx="${topW / 2 - 4}" ry="3.5" fill="#DDBA84"/>
        ${[[0.22, 0.3], [0.4, 0.62], [0.6, 0.28], [0.78, 0.55], [0.3, 0.82], [0.55, 0.85], [0.7, 0.15], [0.18, 0.6], [0.48, 0.2], [0.66, 0.78]].map(([u, v]) =>
          `<circle cx="${(topW * (u - 0.5) * (1 - 0.6 * v)).toFixed(1)}" cy="${(-hh + 7 + (hh - 10) * v).toFixed(1)}" r="1.9" fill="#A9824F"/>`).join('')}`;
      // 반사광: 왼쪽 어깨에 유리 가장자리를 따라 가는 줄 + 오른쪽 위 짧은 줄
      //   (예전엔 왼쪽 배를 따라 안쪽으로 길게 그렸는데 장미를 가려서, 2026-11-18 가장자리 가까이·짧게·가늘게 바꿈)
      let hl = '', hr = '';
      for (let i = 0; i <= 14; i++) { const t = Math.PI * (0.58 + i / 14 * 0.24); hl += (i ? ' L' : 'M') + P(jarPoint(t, 4 * view.wpp)); }
      for (let i = 0; i <= 8; i++) { const t = Math.PI * (0.22 + i / 8 * 0.14); hr += (i ? ' L' : 'M') + P(jarPoint(t, 12 * view.wpp)); }
      // 바닥 유리 두께: 바닥을 따라 안쪽에 옅은 곡선
      let bt = '';
      for (let i = 0; i <= 16; i++) { const t = -Math.PI * (0.3 + i / 16 * 0.4); bt += (i ? ' L' : 'M') + P(jarPoint(t, 9 * view.wpp)); }
      const bottomY = Y(jar.cy - jar.ay), midX = X(jar.cx);
      // 리본: 병목 가운데를 두르고 오른쪽에 나비 리본 + 늘어진 두 끈. 태그는 리본 끝에 매달림
      const rY = nT + JAR_NECK_PX * 0.72, bx = nR - 2;      // 리본: 병목 아래쪽을 두름
      // 태그: 매듭에서 나온 와인색 끈 고리가 태그 구멍(쇠고리)을 지나 걸림 → 태그가 구멍을 축으로 비스듬히 대롱대롱 (선물 태그처럼)
      const hx = bx + 12, hy = rY + 36;                      // 태그 구멍 자리 (끈이 넉넉히 늘어지도록 매듭보다 꽤 아래)
      glass.setAttribute('viewBox', `0 0 ${w} ${h}`);
      glass.innerHTML = `
        <ellipse cx="${midX}" cy="${bottomY + 4}" rx="${(jar.ax * k * 0.8).toFixed(1)}" ry="8" fill="rgba(120,100,70,0.12)"/>
        <g id="cork-back">${plug}</g>
        <path d="${body} L${nL} ${shoulderY} L${nL} ${nT} L${nR} ${nT} L${nR} ${shoulderY} Z"
              fill="rgba(205,228,240,0.13)" stroke="rgba(120,165,200,0.55)" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="${hl}" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="3" stroke-linecap="round"/>
        <path d="${hr}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="3" stroke-linecap="round"/>
        <path d="${bt}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="3" stroke-linecap="round"/>
        <line x1="${nL + 7}" y1="${nT + 8}" x2="${nL + 7}" y2="${shoulderY - 4}" stroke="rgba(255,255,255,0.6)" stroke-width="3" stroke-linecap="round"/>
        <ellipse id="cork-shadow" cx="${cxp}" cy="${nT + 1}" rx="${rimW / 2 + 2}" ry="2.5" fill="rgba(90,65,35,0.22)"/>
        <rect x="${nL - 4}" y="${nT - 1}" width="${nR - nL + 8}" height="7" rx="3.5" fill="rgba(205,228,240,0.55)" stroke="rgba(120,165,200,0.6)" stroke-width="2"/>
        <path d="M${nL - 1} ${rY} Q ${midX} ${rY + 5} ${nR + 1} ${rY}" fill="none" stroke="#7E2440" stroke-width="5" stroke-linecap="round"/>
        <path d="M${bx} ${rY} C ${bx + 14} ${rY - 14}, ${bx + 24} ${rY - 2}, ${bx + 4} ${rY + 2} C ${bx + 22} ${rY + 6}, ${bx + 14} ${rY + 18}, ${bx} ${rY + 2}"
              fill="#9C3350" stroke="#6A1D35" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M${bx + 1} ${rY + 3} Q ${bx - 2} ${rY + 14} ${bx - 6} ${rY + 20}" fill="none" stroke="#7E2440" stroke-width="3" stroke-linecap="round"/>
        <defs><mask id="jar-tag-hole"><rect x="-20" y="-25" width="120" height="50" fill="#fff"/><circle cx="0" cy="0" r="2.8" fill="#000"/></mask></defs>
        <g transform="translate(${hx} ${hy}) rotate(30)">
          <path d="M-26 -25 C -24 -10, -12 4, 0 0" fill="none" stroke="#5E1A2E" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M-12 0 L-2 -17 L88 -17 Q94 -17 94 -11 L94 11 Q94 17 88 17 L-2 17 Z" mask="url(#jar-tag-hole)"
                fill="#FFF8E8" stroke="#D9C6A5" stroke-width="1.3" stroke-linejoin="round"/>
          <circle cx="0" cy="0" r="4.4" fill="none" stroke="#C9A77A" stroke-width="2"/>
          <path d="M0 0 C 4 9, -10 12, -14 3 C -17 -6, -16 -18, -26 -25" fill="none" stroke="#7E2440" stroke-width="1.8" stroke-linecap="round"/>   
          <text x="47" y="7.5" text-anchor="middle" font-family="Gaegu, 'Apple SD Gothic Neo', sans-serif" font-weight="700" font-size="22" fill="#A82340"
                rotate="-9 7 -6 9" dy="1.5 -3.5 4 -3.5" dx="0 -1 1.5 -1">장미광장</text>
        </g>
        <circle cx="${bx + 2}" cy="${rY + 1}" r="3.2" fill="#6A1D35"/>
        <g id="cork-front"><g id="cork-front-plug">${plug}</g>${headSvg}</g>`;
      corkEls = { back: glass.querySelector('#cork-back'), front: glass.querySelector('#cork-front'),
                  frontPlug: glass.querySelector('#cork-front-plug'), shadow: glass.querySelector('#cork-shadow') };
      drawCork();
    }
    // 코르크 그림 자리 옮기기 (매 프레임): 꽂혀 있으면 입구에서 pull만큼 위로, 빠졌으면 무게중심 p에 기울기 a로
    let corkEls = null;
    function drawCork() {
      if (!corkEls) return;
      const k = 1 / view.wpp, X = x => (x + view.W / 2) * k, Y = y => (view.H / 2 - y) * k;
      const inJar = cork.state === 'in';
      if (inJar) {
        const t = `translate(${X(jar.cx).toFixed(1)} ${(Y(jar.neckTop) - cork.pull * k).toFixed(1)})`;
        corkEls.front.setAttribute('transform', t);
        corkEls.back.setAttribute('transform', t);
      } else {
        corkEls.front.setAttribute('transform', `translate(${X(cork.p.x).toFixed(1)} ${Y(cork.p.y).toFixed(1)}) rotate(${(-cork.a * 180 / Math.PI).toFixed(1)}) translate(0 ${(-jar.corkPx.cy0).toFixed(1)})`);
      }
      corkEls.back.style.display = inJar ? '' : 'none';          // 꽂힌 부분: 꽂혀 있을 땐 유리 뒤에(비쳐 보임)
      corkEls.frontPlug.style.display = inJar ? 'none' : '';     //            빠지면 코르크와 함께 앞에
      corkEls.shadow.style.display = inJar && cork.pull < 2 * view.wpp ? '' : 'none';
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

      // 병 몸통 자리: 코르크 꼭대기는 제목·안내 문구 아래, 몸통은 코르크·병목 아래부터 화면 바닥까지
      //   (원근 때문에 가장자리 공이 조금 커 보여서, 화면 끝보다 살짝 안쪽에 둔다)
      const margin = 16 * view.wpp;
      const corkTop = view.H / 2 - LIST_TOP_PX * view.wpp;
      jar.neckTop = corkTop - JAR_CORK_PX * 0.6 * view.wpp;              // 코르크가 병목에 반쯤 꽂힘
      const bodyTop = jar.neckTop - JAR_NECK_PX * view.wpp;
      const bodyBottom = -view.H / 2 + margin + 10 * view.wpp;            // 아래 그림자 자리 조금
      jar.ay = (bodyTop - bodyBottom) / 2;
      jar.cy = (bodyTop + bodyBottom) / 2;
      jar.ax = Math.min(view.W / 2 - margin, jar.ay * 0.85) * JAR_SHRINK;   // 가로로 넓은 화면에서도 너무 납작해지지 않게 + 바깥 공간 조금
      jar.cx = 0;
      // 병목: 반폭, 유리 두께, 몸통과 병목이 만나는 높이(어깨)
      jar.neckHalf = jar.ax * JAR_NECK_W / 2;
      jar.wall = 3 * view.wpp;
      jar.shoulderY = jar.cy + jar.ay * Math.pow(1 - Math.pow(jar.neckHalf / jar.ax, JAR_N), 1 / JAR_N);
      walls.left = jar.cx - jar.ax; walls.right = jar.cx + jar.ax; walls.bottom = bodyBottom; walls.top = bodyTop;
      // 공 크기: 공 개수에 맞춰 병 몸통 넓이의 PILE_FILL만큼 채우도록
      //   슈퍼타원 넓이 = 4·a·b × Γ(1+1/n)² / Γ(1+2/n)  → n=2.6이면 약 0.853 × 4ab
      const sumJ2 = blobs.reduce((s, b) => s + b.sizeJitter * b.sizeJitter, 0);
      const bodyArea = 4 * jar.ax * jar.ay * 0.853;
      const base = Math.min(MAX_RADIUS, Math.sqrt(PILE_FILL * bodyArea / (Math.PI * sumJ2)), jar.ax / 2.5);
      drawJar();
      blobs.forEach(b => {
        b.r = base * b.sizeJitter;
        if (!b.out) b.p.x = THREE.MathUtils.clamp(b.p.x, walls.left + b.r, walls.right - b.r);   // 병 밖 꽃은 병 밖 규칙이 알아서
      });
      cork.r = Math.max(jar.corkPx.topW, jar.corkPx.hh + jar.corkPx.plugH) * 0.5 * 0.62 * view.wpp;  // 굴러다닐 때 부딪힘 크기

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
      const spawnTop = jar.cy + jar.ay * 0.6;                     // 병 어깨 아래부터 줄 세움 (병 밖으로 나간 꽃은 첫 계산에서 병 안으로 들어옴)
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

    // ---------- 코르크 움직이기 ----------
    //   꽂혀 있으면: 손을 놓으면 끌어 올렸던 만큼(pull) 스르르 제자리로
    //   떨어져 있으면(free): 중력으로 떨어져 병·화면 가장자리에 부딪혀 살짝 튀고, 구르며 멈춤
    const corkPrev = new THREE.Vector2();
    function updateCork(dt) {
      if (cork.state === 'in') {
        if (!(active && active.cork)) cork.pull *= Math.exp(-dt * 14);
        return;
      }
      if (cork.state !== 'free') return;
      cork.v.y -= GRAVITY * dt;
      cork.v.multiplyScalar(Math.pow(0.6, dt));
      corkPrev.copy(cork.p);
      cork.p.addScaledVector(cork.v, dt);
      const res = pushOutside(cork.p, cork.r, { solidMouth: true });
      if (res.hit) {
        const vn = cork.v.x * hitN.x + cork.v.y * hitN.y;
        if (vn < 0) cork.v.addScaledVector(hitN, -(1 + 0.3) * vn);          // 부딪히면 30%만 튀어 오름
        if (res.rest) cork.v.x *= Math.pow(0.15, dt);                        // 바닥·어깨 위에선 마찰로 멈춤
      }
      cork.a -= (cork.p.x - corkPrev.x) / cork.r * (res.rest ? 1 : 0.3);    // 굴러간 만큼 돎
      if (res.rest) cork.a += (Math.round(cork.a / (Math.PI / 2)) * (Math.PI / 2) - cork.a) * (1 - Math.exp(-dt * 3)); // 누운·선 자세로 살며시
    }
    // 코르크를 눌렀나 (3D 길이). 꽂혀 있으면 머리 네모, 빠져 있으면 동그라미로 봄 (손가락이라 넉넉히)
    function corkHit(w) {
      const pad = 10 * view.wpp;
      if (cork.state === 'in') {
        const hw = jar.corkPx.topW / 2 * view.wpp, y0 = jar.neckTop + cork.pull, y1 = y0 + jar.corkPx.hh * view.wpp;
        return Math.abs(w.x - jar.cx) < hw + pad && w.y > y0 - pad && w.y < y1 + pad;
      }
      return w.distanceTo(cork.p) < cork.r * 1.3 + pad;
    }
    // 꽂혀 있을 때의 코르크 무게중심 (빠지는 순간 그 자리에서 손을 따라가기 시작)
    function corkInCenter(out) { return out.set(jar.cx, jar.neckTop + cork.pull - jar.corkPx.cy0 * view.wpp); }
    // 코르크 입구 원점(꽂혔을 때 입구 자리)이 지금 어디인지: 무게중심에서 기울기만큼 돌려 계산
    function corkOrigin(out) {
      const d = jar.corkPx.cy0 * view.wpp;                  // 원점은 무게중심보다 (자기 좌표로) cy0 위 = 3D로는 아래쪽 반대
      return out.set(cork.p.x - Math.sin(cork.a) * d, cork.p.y + Math.cos(cork.a) * d);
    }

    // ---------- 소리: "뽕"(빠질 때) / "쏙"(꽂을 때) — 녹음 파일 없이 그 자리에서 만듦 (Web Audio) ----------
    //   짧게 높은음 → 낮은음으로 떨어지는 소리 + 아주 짧은 "탁" 잡음. 휴대폰은 화면을 만진 뒤에만 소리가 나서 누를 때 만듦
    let audio = null;
    function sound(kind) {
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume();
        const t = audio.currentTime, pop = kind === 'pop';
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(pop ? 900 : 420, t);
        o.frequency.exponentialRampToValueAtTime(pop ? 160 : 110, t + 0.09);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(pop ? 0.6 : 0.35, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.16);
        const len = Math.floor(audio.sampleRate * 0.03), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audio.createBufferSource(), bp = audio.createBiquadFilter(), g2 = audio.createGain();
        src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = pop ? 1800 : 900; g2.gain.value = pop ? 0.5 : 0.25;
        src.connect(bp).connect(g2).connect(audio.destination); src.start(t);
      } catch (_) { /* 소리를 못 내는 환경이면 조용히 넘어감 */ }
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
        const w0 = toWorld(e);
        if (corkHit(w0)) {                                  // 코르크를 잡음 (꽃보다 먼저 봄)
          active = { ...base, cork: true, startY: w0.y, grab: null, lastW: w0.clone(), lastT: performance.now() };
          if (cork.state === 'free') { cork.state = 'held'; active.grab = cork.p.clone().sub(w0); }
          canvas.style.cursor = 'grabbing';
          return;
        }
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
      if (active.cork) { moveCork(e); return; }
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

    const corkTmp = new THREE.Vector2(), mouth = new THREE.Vector2();
    function moveCork(e) {
      const w = toWorld(e), now = performance.now();
      if (cork.state === 'in') {
        if (active.plugged) return;                        // 방금 꽂은 손: 다시 뽑지 않게 (손을 떼야 다시 잡을 수 있음)
        // 위로 끌면 코르크가 따라 올라옴 (조금 버티는 느낌: 손이 간 만큼의 70%만)
        cork.pull = Math.max(0, (w.y - active.startY) * 0.7);
        if (cork.pull > CORK_POP_PX * view.wpp) {          // 뽕!
          corkInCenter(cork.p); cork.a = 0; cork.v.set(0, 0);
          cork.state = 'held'; cork.pull = 0;
          active.grab = cork.p.clone().sub(w);
          sound('pop');
          wakeNearMouth();
        }
      } else if (cork.state === 'held') {
        const dt = Math.max(0.008, (now - active.lastT) / 1000);
        corkPrev.copy(cork.p);
        cork.p.copy(w).add(active.grab);
        cork.v.copy(cork.p).sub(corkPrev).divideScalar(dt).clampLength(0, 25);   // 놓을 때 던지는 속도
        cork.a *= 0.85;                                     // 들고 있으면 똑바로 서게
        // 입구 가까이 가져오면 쏙 꽂힘
        corkOrigin(corkTmp); mouth.set(jar.cx, jar.neckTop);
        if (corkTmp.distanceTo(mouth) < CORK_SNAP_PX * view.wpp && Math.abs(cork.a) < 0.6) plugCork();
      }
      active.lastT = now;
    }
    function plugCork() {
      cork.state = 'in'; cork.pull = 0; cork.a = 0; cork.v.set(0, 0);
      active.plugged = true;
      sound('plug');
      // 병목 안에 있던 꽃은 병 안으로 밀려 내려가게 깨움 (다음 계산에서 병 몸통 안으로 들어감)
      blobs.forEach(b => { if (!b.out && b.p.y > jar.shoulderY - 2 * b.r) wake(b); });
    }
    function wakeNearMouth() {                              // 코르크가 빠지면 입구 근처 꽃이 살짝 들썩
      blobs.forEach(b => { if (!b.out && b.p.y > jar.shoulderY - 6 * b.r && Math.abs(b.p.x - jar.cx) < jar.neckHalf * 3) { wake(b); b.vel.y += 1.5; } });
    }
    function release(e) {
      if (!active) return;
      if (active.cork) {                                    // 코르크를 놓음: 들고 있었으면 떨어짐, 꽂혀 있으면 제자리로
        if (cork.state === 'held') cork.state = 'free';
        active = null; canvas.style.cursor = 'default';
        return;
      }
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
    // 안정한가: 병 바닥에 닿았거나, 바로 아래 받침이 있거나, 양쪽(꽃 또는 병 옆벽)에 걸쳐 있으면 안정
    function stable(b) {
      if (b.out) {                                // 병 밖: 화면 바닥·병 어깨에 얹혔거나 꽃 위에 걸쳐 있으면 안정
        const nearL = b.p.x - b.r < -view.W / 2 + 0.03 * b.r, nearR = b.p.x + b.r > view.W / 2 - 0.03 * b.r;
        return b.outRest || b.supC || ((b.supL || nearL) && (b.supR || nearR));
      }
      const t = jarTouch(b);
      const onFloor = t && t.ny < -0.5, nearL = t && t.nx < -0.4, nearR = t && t.nx > 0.4;
      return onFloor || b.supC || ((b.supL || nearL) && (b.supR || nearR));
    }
    // 병 벽: 꽃 가운데가 "꽃 반지름만큼 줄인 슈퍼타원" 안에 있어야 함
    //   f = |dx/A|^n + |dy/B|^n - 1  (0보다 크면 벽 밖),  g = f를 미분한 방향 = 벽의 바깥 방향
    //   벽까지 거리 ≈ f / |g|  → 벽에 수직으로 그만큼 되돌림 (가운데 쪽으로 당기면 둥근 바닥에서 꽃이 옆으로 밀려 밭이 계속 움직였음)
    const jarN = new THREE.Vector2();
    function jarMeasure(b) {
      const A = jar.ax - b.r, B = jar.ay - b.r, dx = b.p.x - jar.cx, dy = b.p.y - jar.cy;
      const ux = Math.abs(dx) / A, uy = Math.abs(dy) / B;
      const f = Math.pow(ux, JAR_N) + Math.pow(uy, JAR_N) - 1;
      const gx = JAR_N * Math.sign(dx) * Math.pow(ux, JAR_N - 1) / A, gy = JAR_N * Math.sign(dy) * Math.pow(uy, JAR_N - 1) / B;
      const g = Math.hypot(gx, gy) || 1;
      jarN.set(gx / g, gy / g);
      return f / g;                               // 벽까지 거리 (+면 벽 밖으로 나간 만큼)
    }
    // 아무 점·크기에 쓰는 슈퍼타원 거리 (A, B = 가로·세로 반지름). 돌려주는 값: 벽까지 거리(+면 밖), jarN = 바깥 방향
    function superDist(x, y, A, B) {
      const dx = x - jar.cx, dy = y - jar.cy, ux = Math.abs(dx) / A, uy = Math.abs(dy) / B;
      const f = Math.pow(ux, JAR_N) + Math.pow(uy, JAR_N) - 1;
      const gx = JAR_N * Math.sign(dx) * Math.pow(ux, JAR_N - 1) / A, gy = JAR_N * Math.sign(dy) * Math.pow(uy, JAR_N - 1) / B;
      const g = Math.hypot(gx, gy) || 1;
      jarN.set(gx / g, gy / g);
      return f / g;
    }
    // ----- 병목 통로 (코르크가 빠졌을 때만): 병 안 꽃이 병목 폭 안에서 위로 올라가면 통로로 들어감 -----
    //   통로 안에선 양옆 유리벽만 있고 천장이 없음 → 병목 꼭대기를 넘으면 '병 밖' 꽃이 됨
    function neckChannel(b) {
      if (cork.state === 'in') return false;
      const dx = b.p.x - jar.cx, half = jar.neckHalf - jar.wall - b.r;
      if (half <= 0 || Math.abs(dx) > jar.neckHalf - jar.wall || b.p.y < jar.shoulderY - 2 * b.r) return false;
      if (Math.abs(dx) > half) b.p.x = jar.cx + Math.sign(dx) * half;
      if (b.p.y - b.r > jar.neckTop) b.out = true;                     // 병 밖으로 나감
      return true;
    }
    // 동그라미를 네모 밖으로 밀어냄 (병목 유리벽·코르크 머리). 밀었으면 밀어낸 방향을 out에
    function pushOutOfRect(p, r, x0, x1, y0, y1, out) {
      const qx = Math.min(Math.max(p.x, x0), x1), qy = Math.min(Math.max(p.y, y0), y1);
      let dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
      if (d >= r) return false;
      if (d < 1e-6) { dx = 0; dy = 1; d = 0; p.y = y1 + r; }          // 가운데가 네모 안: 위로 꺼냄
      else { p.x = qx + dx / d * r; p.y = qy + dy / d * r; dx /= d; dy /= d; }
      out.set(dx, dy);
      return true;
    }
    // ----- 병 밖 규칙: 화면 가장자리 안 + 병 몸통·병목(+꽂힌 코르크) 밖 -----
    //   돌려주는 값: 위에서 받쳐 주는 면(바닥·병 어깨)에 얹혔으면 true. 마지막으로 부딪힌 방향은 hitN
    const hitN = new THREE.Vector2(), tmpN = new THREE.Vector2();
    function pushOutside(p, r, opts) {
      let rest = false, hit = false;
      const L = -view.W / 2 + r, R = view.W / 2 - r, Bot = -view.H / 2 + r, Top = view.H / 2 - r;
      if (p.x < L) { p.x = L; hit = true; hitN.set(1, 0); }
      if (p.x > R) { p.x = R; hit = true; hitN.set(-1, 0); }
      if (p.y < Bot) { p.y = Bot; hit = true; rest = true; hitN.set(0, 1); }
      if (p.y > Top) { p.y = Top; hit = true; hitN.set(0, -1); }
      // 병목·코르크: 열려 있으면 양옆 유리벽 두 개, 꽂혀 있으면 코르크 머리까지 한 덩어리
      const nh = jar.neckHalf, wl = jar.wall, base = jar.shoulderY - r * 0.5;
      if (cork.state === 'in') {
        const hw = jar.corkPx.topW / 2 * view.wpp, top = jar.neckTop + (jar.corkPx.hh + cork.pull / view.wpp) * view.wpp;
        if (pushOutOfRect(p, r, jar.cx - hw, jar.cx + hw, base, top, tmpN)) { hit = true; hitN.copy(tmpN); if (tmpN.y > 0.4) rest = true; }
      } else {
        if (pushOutOfRect(p, r, jar.cx - nh - wl, jar.cx - nh + wl, base, jar.neckTop, tmpN)) { hit = true; hitN.copy(tmpN); if (tmpN.y > 0.4) rest = true; }
        if (pushOutOfRect(p, r, jar.cx + nh - wl, jar.cx + nh + wl, base, jar.neckTop, tmpN)) { hit = true; hitN.copy(tmpN); if (tmpN.y > 0.4) rest = true; }
      }
      // 병 몸통 (반지름만큼 부풀린 슈퍼타원) 안으로 들어오면 바깥으로 밀어냄. 단 병목 바로 아래(통로 자리)는 빼고
      const inMouth = !opts.solidMouth && cork.state !== 'in' && Math.abs(p.x - jar.cx) < nh - wl && p.y > jar.shoulderY - r;
      if (!inMouth) {
        for (let k = 0; k < 3; k++) {
          const d = superDist(p.x, p.y, jar.ax + r, jar.ay + r);
          if (d >= 0) break;
          p.x -= jarN.x * d; p.y -= jarN.y * d;
          hit = true; hitN.copy(jarN); if (jarN.y > 0.4) rest = true;       // 병 어깨 위에 얹힘
        }
      }
      return { hit, rest, inMouth };
    }
    function outsideConstrain(b) {
      const res = pushOutside(b.p, b.r, { solidMouth: false });
      // 병목 입구로 다시 들어가는 꽃: 열린 입구 폭 안에서 병목 꼭대기 아래로 내려오면 '병 안' 꽃이 됨
      if (res.inMouth && b.p.y < jar.neckTop) { b.out = false; return; }
      if (res.hit) { b.domeN = b.domeN || new THREE.Vector2(); b.domeN.copy(hitN).negate(); b.domeHit = true; }  // domeN = 벽 쪽 방향 (튕길 때 씀)
      if (res.rest) { b.outRest = true; b.wallHitY = 1; b.contacts++; b.supported = true; }
    }
    function jarPush(b) {                         // 벽 밖이면 벽에 수직으로 되돌림 (두세 번 다듬어 곡면에 딱 맞춤). 되돌렸으면 true
      let hit = false;
      for (let k = 0; k < 3; k++) {
        const d = jarMeasure(b);
        if (d <= 0) break;
        b.p.x -= jarN.x * d; b.p.y -= jarN.y * d;
        hit = true;
      }
      return hit;
    }
    function jarTouch(b) {                      // 벽에 닿아 있으면 벽의 바깥 방향, 아니면 null (꽃 반지름의 3%까지는 닿은 걸로)
      return jarMeasure(b) > -0.03 * b.r ? { nx: jarN.x, ny: jarN.y } : null;
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
        b.outRest = false;                                // (병 밖) 바닥·병 어깨에 얹혔나
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
        // 병 벽 (옆·바닥·어깨가 모두 한 곡면): 벽 밖으로 나간 꽃을 곡면 위로 되돌림
        blobs.forEach(b => {
          if (b.out) { outsideConstrain(b); return; }        // 병 밖 꽃
          if (neckChannel(b)) return;                        // 병목 통로 안 꽃 (코르크가 빠졌을 때)
          if (jarPush(b)) {
            b.domeN = b.domeN || new THREE.Vector2();
            b.domeN.copy(jarN);                             // 벽의 바깥 방향 (튕길 때 씀)
            b.domeHit = true;
            if (jarN.y < -0.5) { b.wallHitY = 1; b.contacts++; b.supported = true; }   // 아래쪽 벽 = 바닥 (받침·마찰)
          }
        });
      }
      // ③ 실제로 움직인 거리로 속도 다시 정하기 + 자리 잡기
      blobs.forEach(b => {
        if (b.held) return;
        const vx0 = b.vel.x, vy0 = b.vel.y;                 // 바로잡기 전 속도 (벽에 튕길 때 씀)
        prevP.copy(b.prev);
        b.vel.copy(b.p).sub(prevP).divideScalar(h);
        // 벽·천장·바닥에 세게 부딪혔으면 살짝 튕겨 나옴 (던지기 손맛)
        if (b.domeHit) {                                    // 병 벽에 세게 부딪히면 벽 방향으로 튕김
          const vn = vx0 * b.domeN.x + vy0 * b.domeN.y;
          // 던졌을 때처럼 세게 부딪힐 때만 (3.5 이상). 가만히 쌓인 꽃이 이웃에 밀려 벽에 닿는 정도로는 튕기지 않음
          //   (2였을 때: 둥근 바닥 모서리에서 쌓인 꽃이 계속 위로 튕겨 밭 전체가 끓듯이 움직였음)
          if (vn > 3.5 && b.contacts <= 1) { b.vel.set(vx0 - (1 + BOUNCE) * vn * b.domeN.x, vy0 - (1 + BOUNCE) * vn * b.domeN.y); }
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
      if (mode === 'list') { physics(dt); updateCork(dt); }
      drawCork();

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
