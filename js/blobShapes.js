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
//   ringsSkip  맨 위(가장 안쪽) 겹을 몇 개 빼고 그릴지 (0 기본). rings를 줄이는 것과 달리 나머지 겹의 모양은 그대로 둠 (2026-11-24 마틸다)
//   open    바깥 꽃잎이 기울어진 정도 (0 오므림 … 1 활짝)
//   spread  꽃잎이 벌어진 정도 (바깥 고리로 갈수록 더 벌어짐)
//   flare   꽃잎 끝이 바깥으로 젖혀지는 정도   pointy  꽃잎 끝이 뾰족한 정도 (0 둥글게)
//   outerPointy 바깥층 꽃잎 끝만 뾰족하게 (0 기본 … 1 뾰족). 안쪽층은 그대로 두고 바깥층 끝 모양으로만 장미를 구분할 때 씀
//               (2026-11-23: "안쪽층은 다 비슷하고 바깥층 꽃잎 끝에서 차이가 난다"는 분류 결과에서 추가)
//   layerEven   안쪽 겹을 바깥 겹과 비슷하게 (0 기본: 안쪽 꽃잎은 짧고 조금 위에 붙음 … 1 바깥보다 조금만 짧고 같은 높이에 붙어 포개짐, 반겹)
//   evenRatio   layerEven일 때 가장 안쪽 겹 꽃잎 길이 ÷ 바깥 겹 꽃잎 길이 (0.88 기본 … 1이면 같은 크기)
//   quarter     안쪽 꽃잎을 네 무리로 모음 (0 기본 … 1 안쪽이 4등분되어 네 덩어리, 무리 사이 골이 어둡게. 옛날 장미의 4등분 모양)
//   quarterN    quarter의 무리 수 (4 기본. 5·6이면 다섯·여섯 무리) (2026-11-24 마리아 테레지아)
//   star        무리를 별 팔처럼 (0 기본: 꺼짐 … 1 무리 가운데 꽃잎은 길게, 무리 가장자리 꽃잎은 짧게 → 위에서 보면 뾰족한 별). quarter가 켜져야 작동
//   contactShade 닿는 그림자 (0 기본: 꺼짐 … 1 또렷이). 위층 꽃잎 끝이 아래층에 닿는 자리에만 가는 그늘 띠 + 꽃잎 끝은 살짝 밝게
//               → 넓은 그늘(layerShade·ringShade) 없이도 층이 나뉘어 보임. 흰 꽃용 (2026-11-24 마리아 테레지아: 사진은 그늘이 '면'이 아니라 '선')
//   eye         가운데 눈 (0 기본: 꺼짐 … 1 또렷이). 가장 안쪽 겹들의 꽃잎 밑동을 colors.eye(없으면 가운데 색을 어둡게)로 칠함
//               → 위에서 보면 별 한가운데에 작고 어두운 구멍이 보임 (2026-11-24 마리아 테레지아: 사진 속 가운데 구멍과 짧은 수술)
//   contactPos  닿는 그림자 띠의 자리 (꽃잎 밑동 0 … 끝 1, 0.7 기본). 위층 꽃잎 끝이 덮는 곳에 맞춤
//   messy       꽃잎마다 기울기·길이·자리를 조금씩 다르게 (0 기본: 고르게 … 1 날개처럼 흐트러지게)
//   seed        messy의 '가짜 무작위' 씨앗 (장미마다 다른 수를 주면 흐트러진 모양도 장미마다 다름)
//   stripes     줄무늬 양 (0 기본: 없음 … 1 줄무늬 색이 많이). colors.stripe가 있을 때만
//   stripeScale 줄 굵기 (0 가는 줄·점 … 1 굵은 줄이 꽃잎을 반반 나눔). 줄은 꽃잎 밑동 → 끝 방향으로 흐르고, 꽃잎마다 위치가 다름
//   stamenSpread 수술이 바깥으로 퍼지는 정도 (1 기본: 발산하듯 퍼짐 … 0.3 가운데에 조밀하게 모여 위로 솟음)
//   stamenCount 수술 가닥 수 배율 (1 기본: 상세 28 · 밭 12) · stamenSize 꽃밥 크기 배율 (1 기본)
//   stamenAge 바깥으로 퍼지는 수술 중 '꽃가루를 다 날린' 수술 비율 (0 기본: 없음 … 0.6이면 바깥 수술 10가닥 중 6가닥쯤)
//             이 수술은 꽃밥이 colors.stamenOld 색(없으면 붉은 갈색)으로, 더 멀리 가늘게 퍼짐 (2026-11-24 안젤라)
//   stamenThick 수술대(실) 굵기 배율 (1 기본 … 0.5 가늘게). 실 색은 colors.filament (없으면 수술 색을 밝게)
//   calyxHide 가운데 아래 초록 꽃받침을 숨김 (1 기본: 꽃잎 밑동 아래로 내려 위에서 안 보임 · 0 예전처럼 솟아 있음)
//             (2026-11-24 사용자: 전체 적용 → 기본값을 1로)
//   stamenMix 가운데에 남는 수술 비율 (0 기본: 모두 퍼짐 … 0.4면 10가닥 중 4가닥쯤은 가운데에 모여 솟음)
//   edgeStart   꽃잎 끝 색이 시작하는 곳 (꽃잎 밑동 0 … 끝 1, 0.55 기본). 0.8이면 끝 20%에만 (2026-11-24 카렌)
//   edgeRandom  꽃잎 끝 색(colors.edge)을 띄엄띄엄 (0 기본: 모든 꽃잎 … 1 꽃잎 열 장 중 서너 장에만) (2026-11-24 카렌)
//   stripeVary  줄 굵기 들쭉날쭉 (0 기본: 줄 굵기가 비슷 … 1 어떤 줄은 두껍고 어떤 줄은 얇게). stripeMode 0에서만 (2026-11-25 퍼플타이거)
//   stripeVein  흰 부분 속 가는 바탕색 줄 (0 기본: 없음 … 1 줄무늬 색이 덮인 곳에 바탕색 줄이 꽃잎당 한두 개). stripeMode 0에서만 (2026-11-25 퍼플타이거)
//   stripeBias  줄무늬를 한쪽으로 몰기 (0 기본: 고르게 … 1 stripeDir 쪽은 줄무늬가 훨씬 많고 반대쪽은 거의 바탕색)
//   stripeDir   몰리는 방향 (위에서 본 화면 기준 각도: 0 위(북) · 90 오른쪽(동) · 180 아래(남) · 270 왼쪽(서)) (2026-11-24 맛쯔리)
//   stripeRandom 무늬를 불규칙하게 (0 기본: 꽃잎마다 비슷하게 … 1 어떤 꽃잎은 거의 없고 어떤 꽃잎은 군데군데 뭉침)
//   innerWidth  안쪽 겹 꽃잎 폭 배율 (1 기본: 그대로 … 0.6 안쪽 꽃잎이 좁아져 한 장씩 떨어져 보임). 바깥 겹으로 갈수록 1로 돌아감
//   ---- 자연스러운 어긋남 (2026-11-24 사용자: "실제 꽃은 규칙이 살짝씩 안 지켜지는데 우리 그림은 이론대로 그린 것 같다") ----
//   모두 0.65 기본 (2026-11-24 사용자가 끔/0.35/0.65/1 비교 후 0.65로 정함. 0이면 꺼짐). 장미마다 seed로 정해진 '가짜 무작위'라 볼 때마다 바뀌지 않음
//   natPetal    꽃잎 한 장씩 차이: 폭·길이·기울기·말림·비틀림이 장마다 조금씩 다름
//   natEdge     가장자리 불규칙: 윤곽이 살짝 울퉁불퉁 + 몇 장은 끝이 패임(하트) + 한쪽 가장자리가 살짝 접힘
//   natAsym     꽃 전체 비대칭: 한쪽이 더 벌어지고 살짝 타원
//   natColor    색 얼룩: 꽃잎마다 진하기가 조금 다르고, 은은한 얼룩
//   natRound    맨 아래층(겉 테두리)은 둥글게 (0.85 기본 … 1 테두리 원). 바깥 겹일수록 길이·기울기·타원 어긋남을 줄여 윤곽이 원에 가깝게.
//               꽃잎 폭·비틀림·가장자리·색 차이는 그대로 (2026-11-24 사용자: "어긋남은 좋은데 겉 테두리는 대체로 원이었으면")
//   natStamen   수술 몰림: 고르게 퍼지지 않고 군데군데 뭉치고 몇 가닥은 삐침
//   ---- 공 모양 (ball) — 둥근 · 4등분 장미 전용 틀 (2026-11-24) ----
//   ball        1이면 고리 꽃잎 대신 공 모양으로 만듦 (0 기본: 예전 고리 방식)
//   ballWalls   벽(아래층) 겹 수 (3 기본). 안쪽 벽일수록 공 윗면으로 더 넘어가 끝남 → 위에서 보면 테두리에 고리가 겹겹이
//   ballOpen    속이 열린 정도 (0 공처럼 닫혀 속이 작음 … 1 속이 넓게 열림, 0.4 기본)
//   ballRim     테두리(말린 고리) 구역 폭 (0.6 기본 … 작을수록 고리 구역이 좁고, 가운데 구겨진 구역이 넓음)
//   ballPeel    맨 바깥 벽 꽃잎 중 몇 장이 바깥으로 벌어지는 정도 (0 기본 … 1 크게 벌어짐)
//   ballRoll    벽 꽃잎 끝이 바깥으로 둥글게 말린 정도 (0.8 기본). 말린 끝은 밝고 그 아래는 어두워 고리 사이 선이 생김
//   ballFill    속 꽃잎 수 배율 (1 기본). 덮는 넓이는 같아서 적으면 꽃잎이 크고, 많으면 작고 자잘함
//   ballDome    속이 돔처럼 솟은 정도 (0.5 기본)
//   ballFold    접힌 가장자리를 밝게 (0.6 기본). 밝은 색은 colors.edge (없으면 바깥 색을 밝게)
//   ringTint    위층일수록 가운데 색으로 물들임 (0 기본: 꺼짐 … 1 위층 절반쯤은 거의 가운데 색). 꽃잎 안/밖과 상관없이 층 기준
//               (2026-11-24 와온: 컵 모양은 위층(봉오리)이 꽃잎 끝만 보여서 가운데 색이 거의 안 보였음)
//   innerLight  겹마다 따로 그라데이션 (0 기본: 꺼짐 … 0.35 = 꽃잎마다 밑동 옅게 → 끝 진하게, 안쪽 겹은 끝 색을 35% 덜 진하게)
//               (2026-11-24 워터멜론아이스: 안쪽 겹도 안쪽은 옅고 바깥쪽은 진함, 다만 바깥 겹보다는 연함)
//   outline     꽃잎 테두리선 (0 기본: 없음 … 1 또렷이). 꽃잎 양옆·끝 둘레만 얇게 진하게 → 흰 꽃처럼 그늘이 안 보이는 꽃도 층이 나뉘어 보임
//               선 색은 colors.outline (없으면 바깥 색을 조금 어둡게)
//   crease      꽃잎 중간쯤이 가로로 살짝 접힌 자국 (0 기본: 없음 … 1 또렷이 꺾임). 접힌 곳에서 꽃잎이 한 번 꺾이고, 접힌 선은 어둡게·그 바로 위는 밝게
//               접히는 위치는 꽃잎마다 조금씩 다름 (2026-11-24 마틸다: 날개형 꽃잎은 중간쯤 접힌 자국이 드러남)
//   creaseDir   접힌 방향 (0 기본: 가로 — 꽃잎이 중간쯤에서 한 번 꺾임 · 1 세로 — 꽃잎 가운데 줄을 따라 V자로 접힘)
//   overlap     꽃잎끼리 바람개비처럼 포개짐 (0 기본: 없음 … 1 또렷이). 꽃잎 한쪽 가장자리는 살짝 들려 옆 꽃잎 위에, 다른 쪽은 옆 꽃잎 아래로 들어가 그늘
//   centerBand  안쪽·바깥 색 경계의 띠 (0 기본: 없음 … 1 진하게). colors.band 색으로, 꽃잎 결을 따라 실처럼 번짐 (centerEdge가 켜져 있을 때만)
//   bandWidth   그 띠의 폭 (0.15 기본)
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
    petals: 9, rings: 4, ringsSkip: 0, open: 0.5, spread: 0.8, flare: 0.4, pointy: 0.3, height: 0, ruffle: 0, spiral: 0.6, core: 1, innerOpen: 0, petalWidth: 1, bud: 0, budReach: 1, dense: 0, threads: 0, seams: 0, reflex: 0, tip: 0, rimOpen: 0, outerPointy: 0, layerEven: 0, evenRatio: 0.88, ringShade: 0, quarter: 0, quarterN: 4, star: 0, contactShade: 0, contactPos: 0.7, eye: 0, messy: 0, seed: 0, stripes: 0, stripeScale: 0.5, stripeMode: 0, centerEdge: 0, stripeRandom: 0, stripeVary: 0, stripeVein: 0, stripeBias: 0, stripeDir: 0, edgeRandom: 0, edgeStart: 0.55, innerWidth: 1, crease: 0, creaseDir: 0, natPetal: 0.65, natEdge: 0.65, natAsym: 0.65, natColor: 0.65, natStamen: 0.65, natRound: 0.85, ball: 0, ballWalls: 3, ballOpen: 0.4, ballRim: 0.6, ballPeel: 0, ballRoll: 0.8, ballFill: 1, ballDome: 0.5, ballFold: 0.6, ringTint: 0, innerLight: 0, outline: 0, overlap: 0, centerBand: 0, bandWidth: 0.15, stamenSpread: 1, stamenCount: 1, stamenSize: 1, stamenMix: 0, stamenAge: 0, stamenThick: 1, calyxHide: 1, centerSpread: 0.7, layerShade: 0.7,   // 칠하기 (2026-11-18 비교 페이지에서 사용자 확정)
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
    let { U, V, steps } = QUALITY[quality];
    const P = Object.assign({}, DEFAULTS, settings);
    P.colors = Object.assign({}, DEFAULTS.colors, settings.colors || {});
    // 줄무늬 꽃은 상세(full)에서 꽃잎 격자를 촘촘하게 (2026-11-24 맛쯔리)
    //   색은 격자 점마다 칠하고 점 사이는 섞여서, 가는 줄이 격자보다 가늘면 뭉개지고 깍두기처럼 보임 → 점을 두 배 가까이
    //   줄무늬 장미 몇 송이의 상세 화면에서만 무거워지고, 밭(lite)은 그대로
    if (quality === 'full' && P.stripes > 0 && P.colors.stripe) { U = 22; V = 18; }
    const cCenter = lin(P.colors.center), cOuter = lin(P.colors.outer);
    const cEdge = P.colors.edge ? lin(P.colors.edge) : null;
    const cStamen = P.colors.stamen ? lin(P.colors.stamen) : null;
    const cStripe = P.colors.stripe && P.stripes > 0 ? lin(P.colors.stripe) : null;   // 줄무늬 색 (줄무늬 장미만)
    const cBand = P.colors.band && P.centerBand > 0 ? lin(P.colors.band) : null;      // 경계 띠 색 (띠가 있는 장미만)
    const cEye = P.eye > 0 ? (P.colors.eye ? lin(P.colors.eye) : cCenter.clone().multiplyScalar(0.45)) : null;   // 가운데 눈 색
    const cLine = P.outline > 0 ? (P.colors.outline ? lin(P.colors.outline) : cOuter.clone().multiplyScalar(0.72)) : null;   // 테두리선 색
    const cGreen = lin(P.stem).lerp(lin(P.leaf), 0.4);
    // 바깥 색이 얼마나 하얀가 (0 보통 … 1 아주 하얌): 겹 경계 그늘(ringShade)을 하얀 꽃에 맞게 바꿀 때 씀
    const lightK = smooth(0.55, 0.8, (cOuter.r + cOuter.g + cOuter.b) / 3);

    const positions = [], colors = [], indices = [];
    const c = new THREE.Color();
    const push = (x, y, z, col) => { positions.push(x, y, z); colors.push(col.r, col.g, col.b); return positions.length / 3 - 1; };

    // ---------- 꽃잎들 ----------
    const R = P.ball > 0 ? 0 : Math.max(1, P.rings);                 // 공 모양(ball)이면 고리 꽃잎 대신 아래 ballPetals()로 만듦
    for (let k = 0; k < R; k++) {
      if (k < P.ringsSkip) continue;                                 // 맨 위 겹 빼기 (나머지 겹 모양은 그대로)
      const outer = R > 1 ? k / (R - 1) : 1;                         // 0 안쪽 고리 … 1 바깥 고리
      const inner = 1 - outer;
      const budK = P.bud * Math.pow(inner, P.budReach);              // 이 고리가 봉오리처럼 말리는 정도 (안 → 바깥으로 서서히 줄어듦)
      const denseK = P.dense * inner;                                // 이 고리가 짧은 꽃잎으로 빽빽한 정도
      const n = Math.max(3, Math.round(P.petals * (0.5 + 0.5 * outer) * (1 + denseK)));
      // 꽃잎 길이: 기본은 안쪽일수록 짧음 (0.62 … 1.12). layerEven만큼 '바깥보다 조금만 짧게'(안쪽 끝 0.88배) 쪽으로 당김
      const baseLen = (0.62 + 0.5 * outer) * (1 - P.layerEven) + 1.12 * (1 - (1 - P.evenRatio) * inner) * P.layerEven;
      const L = baseLen * (1 + P.height * 0.55 * inner) * (1 - 0.25 * denseK); // 꽃잎 길이
      const r0 = 0.04 + 0.16 * outer                                           // 꽃잎이 붙는 자리 (가운데에서 떨어진 거리)
               + P.eye * 0.05 * smooth(0.6, 1, inner);                         //   가운데 눈(eye): 가장 안쪽 겹을 바깥으로 물려 붙여 한가운데에 작은 구멍
      const y0 = -0.32 + 0.06 * inner * (1 - P.layerEven) + 0.18 * denseK;     //   높이: 안쪽 겹은 조금 위 (layerEven이면 바깥과 같은 높이) · 빽빽한 안쪽은 위로 올려 컵을 채움
      const tilt0 = Math.min(1.45, 0.06 + 0.9 * P.open * Math.pow(outer, 1.2) + 0.5 * P.spread * outer
                             + P.innerOpen * 0.9 * inner                        // 기울기 (안쪽 고리: innerOpen만큼 벌어짐, bud만큼 곧게 섬)
                             + P.eye * 0.3 * smooth(0.6, 1, inner)) * (1 - 0.85 * budK)   //   가운데 눈(eye): 가장 안쪽 겹만 살짝 벌려 구멍을 엶
                             + P.rimOpen * 0.45 * Math.pow(outer, 8);           //        (맨 바깥 고리: rimOpen만큼 더 눕힘)
      const curl = P.flare * 1.1 * Math.pow(outer, 1.5) + P.spread * 0.35 * outer
                   - 1.6 * budK                                                          // 끝 젖힘 (봉오리 꽃잎은 끝이 안쪽으로 말려 가운데를 덮음)
                   + P.rimOpen * 1.0 * Math.pow(outer, 8);                               //        (맨 바깥 고리는 안으로 오므리지 않게)
      const span = (2 * Math.PI / n) * (2.1 - 0.5 * outer) * P.petalWidth * (1 + 0.9 * budK)  // 꽃잎 폭 (봉오리는 넓게 감쌈)
                   * (P.innerWidth + (1 - P.innerWidth) * outer);                           //   안쪽 겹만 innerWidth만큼 좁게 (안쪽 고리는 꽃잎 수가 적어 한 덩어리 원처럼 보이기 쉬움)
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
        const roundK = 1 - P.natRound * smooth(0.5, 1, outer);         // 겉 테두리 겹일수록 윤곽 어긋남을 줄임 (natRound)
        const tiltJ = tilt0 + P.messy * 0.45 * rnd(1) * (0.3 + outer) * roundK;
        const LJ = L * (1 + P.messy * 0.3 * rnd(2) * roundK);
        az += P.messy * 0.3 * (2 * Math.PI / n) * rnd(3);
        // 자연스러운 어긋남: 꽃잎 한 장마다 '가짜 무작위'로 조금씩 다르게 (rnd 11~20 = 이 용도)
        const a0 = P.seed * 2.39996 + 1.3;                             // 꽃 전체가 더 벌어지는 방향 (장미마다 다름)
        const asymF = Math.cos(az - a0);                               //   이 꽃잎이 그 방향에 가까울수록 1, 반대쪽 -1
        const tiltN = tiltJ + (P.natPetal * 0.25 * rnd(11) * (0.3 + outer) + P.natAsym * 0.22 * asymF * (0.3 + outer)) * roundK;   // 기울기
        const LN = LJ * (1 + (P.natPetal * 0.18 * rnd(12) + P.natAsym * 0.07 * asymF) * roundK);   // 길이
        const widthN = 1 + P.natPetal * 0.35 * rnd(13);               // 폭
        const curlN = curl + P.natPetal * 0.8 * rnd(14);               // 끝 젖힘
        const twist = P.natPetal * 0.25 * rnd(15);                     // 끝으로 갈수록 옆으로 비틀림
        const notch = rnd(16) > -0.1;                                  // 이 꽃잎은 끝이 패이나? (60%쯤)
        const fold = P.natEdge * rnd(17);                              // 한쪽 가장자리 접힘 (부호 = 어느 쪽)
        const edgePh = rnd(18) * 20, edgePh2 = rnd(19) * 20;           // 울퉁불퉁·얼룩 위치
        const shadeJ = 1 + P.natColor * 0.12 * rnd(20);                // 이 꽃잎 진하기
        // 접힌 자국 (crease): 접히는 위치(꽃잎 길이의 45~65%)와 꺾이는 정도가 장마다 다름. 바깥 겹일수록 또렷
        const creasePos = 0.45 + 0.2 * rnd(21), creaseK = P.crease * (0.6 + 0.8 * (rnd(22) + 0.5)) * (0.4 + 0.6 * outer);
        const creaseAcross = creaseK > 0 && P.creaseDir < 0.5, creaseAlong = creaseK > 0 && P.creaseDir >= 0.5;   // 가로 / 세로
        // 4등분: 가장 가까운 '무리 중심선'(qc)으로 꽃잎 자리를 당김. qEdge = 무리 가장자리일수록 1 (골 그늘에 씀)
        //   무리 수는 quarterN (기본 4 → 한 무리 = 90도)
        let qEdge = 0;
        if (qK > 0) {
          const QUAD = 2 * Math.PI / P.quarterN, qOff = QUAD / 2;
          const qc = qOff + Math.round((az - qOff) / QUAD) * QUAD;
          qEdge = Math.min(1, Math.abs(az - qc) / (QUAD / 2));
          az += (qc - az) * 0.8 * qK;
        }
        // 별 팔 (star): 무리 가운데 꽃잎(qEdge 0)은 길게, 무리 가장자리 꽃잎(qEdge 1)은 짧게 → 무리마다 뾰족한 팔
        const starL = 1 + P.star * qK * (0.35 * (1 - qEdge) - 0.25 * qEdge);
        const LS = LN * starL;
        const start = positions.length / 3;
        for (let iv = 0; iv <= V; iv++) {
          for (let iu = 0; iu <= U; iu++) {
            const u = iu / U, v = iv / V, w2 = (2 * u - 1) * (2 * u - 1);
            // 꽃잎 윤곽: 가장자리일수록 덜 뻗음 → 둥근 끝 (pointy면 뾰족한 끝)
            const ve = v * (1 - (0.16 + 0.55 * pointy) * w2);
            // 꽃잎 길이 방향 곡선: 아래에서 시작해 기울기 + 끝 젖힘만큼 휘며 뻗음
            let rad = r0, y = y0;
            for (let s = 1; s <= steps; s++) {
              const vv = ve * s / steps, th = tiltN + curlN * vv * vv + (creaseAcross ? creaseK * 0.4 * smooth(creasePos - 0.04, creasePos + 0.04, vv) : 0);   // 접힌 곳에서 한 번 꺾임
              rad += Math.sin(th) * LS * ve / steps;
              y += Math.cos(th) * LS * ve / steps;
            }
            const width = Math.pow(Math.sin(Math.PI * (0.18 + 0.66 * ve)), 0.3);  // 둥글고 넓은 꽃잎
            // 맨 바깥 고리(pow 8)만: 몸통은 넓게 해서 옆 꽃잎과 겹치게 하고, 끝(v → 1) 가까이에서만 좁혀 한 점으로 모음 (tip)
            const tipK = P.tip * Math.pow(outer, 8);
            const taper = (1 + 0.45 * tipK) * (1 - 0.9 * tipK * Math.pow(smooth(0.6, 1, v), 1.6));
            const phi = az + (u - 0.5) * span * width * taper * widthN + twist * ve * ve;
            rad -= cup * 0.2 * w2 * (0.3 + ve);                            // 오목하게
            rad += P.ruffle * 0.035 * Math.sin(u * Math.PI * 6 + k) * ve * ve; // 가장자리 물결
            // 뒤로 말린 꽃잎: 바깥 고리 꽃잎의 양옆 가장자리가 끝 쪽에서 바깥·아래로 말림 → 가운데 줄기만 남아 끝이 뾰족해 보임
            const roll = P.reflex * Math.pow(outer, 1.5) * w2 * smooth(0.35, 1, ve);
            rad -= roll * 0.14;                                            // 양옆이 안쪽으로 → 위에서 보면 끝이 뾰족한 윤곽
            y -= roll * 0.3;                                               // 양옆이 뒤(아래)로 말림
            // 포개짐 (overlap): 꽃잎의 u 1 쪽(다음 꽃잎 방향)은 살짝 위로, u 0 쪽(이전 꽃잎 방향)은 살짝 아래로
            //   → 모든 꽃잎이 같은 방향으로 한 장씩 올라탐 (바람개비). 꽃잎 폭이 넓어 옆과 겹칠 때 어느 쪽이 위인지 보임
            if (P.overlap > 0) y += P.overlap * 0.05 * (u - 0.5) * smooth(0.1, 0.6, ve);
            // 세로로 접힌 꽃잎 (creaseDir 1): 가운데 줄(u 0.5)이 골짜기처럼 V자로 내려감
            if (creaseAlong) { const mid = 1 - Math.abs(2 * u - 1); y -= creaseK * 0.07 * mid * mid * smooth(0.1, 0.6, ve); rad += creaseK * 0.03 * mid * mid * smooth(0.1, 0.6, ve); }
            // 가장자리 불규칙 (natEdge): 울퉁불퉁 + 끝 패임 + 한쪽 접힘
            if (P.natEdge > 0) {
              rad += P.natEdge * 0.03 * (0.6 * Math.sin(u * 7 + edgePh) + 0.4 * Math.sin(u * 13 + edgePh2)) * ve * ve;
              if (notch) rad -= P.natEdge * 0.06 * Math.exp(-Math.pow((u - 0.5) / 0.08, 2)) * smooth(0.8, 1, v);
              y += fold * 0.08 * smooth(0.7, 1, fold > 0 ? u : 1 - u) * smooth(0.3, 1, ve);
            }
            // 꽃 전체 비대칭 (natAsym): 위에서 보면 살짝 타원
            if (P.natAsym > 0) rad *= 1 + P.natAsym * 0.06 * Math.cos(2 * (phi - a0)) * roundK;
            // 색: 꽃잎 아래쪽·안쪽 고리 = 가운데 색, 꽃잎 끝·바깥 고리 = 바깥 색
            //   centerSpread만큼 바깥 색으로 바뀌기 시작하는 곳을 꽃잎 위쪽으로 미룸 (가운데 색이 넓게)
            const cs = P.centerSpread;
            if (P.innerLight > 0) c.copy(cCenter).lerp(cOuter, smooth(0.05, 1, ve) * (1 - P.innerLight * inner));   // 겹마다: 밑동 옅게 → 끝 진하게 (안쪽 겹은 덜 진하게)
            else if (P.centerEdge > 0) c.copy(cCenter).lerp(cOuter, smooth(P.centerEdge - 0.07, P.centerEdge + 0.07, ve));   // 경계를 정해 칠함: 밑동~centerEdge까지만 가운데 색
            else c.copy(cCenter).lerp(cOuter, smooth(0.3 * cs, 1, (0.35 - 0.2 * cs) * outer + 0.75 * ve));
            // 위층 물들이기 (ringTint): 층 기준으로 위층일수록 가운데 색 쪽으로
            if (P.ringTint > 0) c.lerp(cCenter, P.ringTint * smooth(0.15, 0.75, inner));
            // 경계 띠: centerEdge 언저리에 띠 색을 칠함. 띠의 안쪽 가장자리는 꽃잎 폭 방향(u)으로 들쭉날쭉 → 결을 따라 실처럼 번져 보임
            //   (2026-11-24 함부르크 휘닉스: 흰 안쪽과 빨강 바깥 사이 분홍 무늬)
            if (cBand && P.centerEdge > 0) {
              const hw = P.bandWidth / 2;
              const feather = 0.5 * hw * (Math.sin(u * 41 + rnd(6) * 9) * 0.6 + Math.sin(u * 97 + rnd(7) * 13) * 0.4);   // 실 같은 들쭉날쭉
              const inS = smooth(P.centerEdge - hw - 0.03, P.centerEdge - hw + 0.03, ve + feather);   // 띠 안쪽 가장자리 (번짐)
              const outS = 1 - smooth(P.centerEdge + hw * 0.4, P.centerEdge + hw * 1.4, ve);          // 띠 바깥: 바깥 색으로 부드럽게
              c.lerp(cBand, P.centerBand * inS * outS);
            }
            // 줄무늬: 꽃잎 폭 방향(u)으로 물결 두 개를 겹쳐 '줄'을 만들고, 끝 방향(ve)으로 살짝 흔들어 자연스럽게
            //   굵은 줄(stripeScale 1) = 꽃잎에 줄 1~2개 … 가는 줄(0) = 줄 여러 개가 끊어지며 점처럼
            //   stripeMode: 0 줄 (밑동 → 끝으로 흐르는 줄) · 1 끝 얼룩 (꽃잎 끄트머리에만 불규칙하게) · 2 구역 (꽃 전체를 큰 구역으로 나눠 한쪽에 몰림)
            //   (2026-11-23 피드백: 카렌·오렌지스플래쉬 "끄트머리만 불규칙하게", 퍼플타이거 "구역에 연분홍이 몰려 있음")
            if (cStripe) {
              const ph = rnd(4) * 7, ph2 = rnd(5) * 11;                           // 꽃잎마다 무늬 위치가 다르게
              let thr = 1 - 1.6 * P.stripes;                                       // 줄무늬 양이 많을수록 문턱이 낮아짐
              // 한쪽으로 몰기 (stripeBias): stripeDir 쪽은 줄무늬가 많고, 반대쪽은 적고, 옆쪽은 그대로
              //   phi = 이 점의 방향. 위에서 본 화면에서 오른쪽(동) = 0, 위쪽(북) = -90도 → stripeDir(0 북, 90 동)을 phi 각도로 바꿈
              if (P.stripeBias > 0) thr -= P.stripeBias * 0.8 * Math.cos(phi - (P.stripeDir - 90) * Math.PI / 180);
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
                // 줄 굵기 들쭉날쭉 (stripeVary): 문턱을 자리마다 다르게 → 문턱이 낮은 자리의 줄은 두껍게, 높은 자리는 얇게
                //   w = 꽃잎 폭 방향으로 천천히 바뀌는 물결(이웃 줄끼리 굵기가 다름) + 꽃잎마다 다른 값(rnd(9))
                //   (2026-11-25 퍼플타이거: "흰 줄이 너무 얇아, 어떤 건 두껍게 어떤 건 얇게")
                let thrS = thr;
                if (P.stripeVary > 0) {
                  const w = 0.6 * Math.sin((u * freq * 0.45 + ph2 * 0.7) * 2 * Math.PI) + 0.8 * rnd(9);
                  thrS = thr - P.stripeVary * (0.08 + 0.3 * w);   // 0.08: 전체적으로 살짝 두껍게
                }
                m = smooth(thrS - 0.1, thrS + 0.1, f);
                // 흰 부분 속 가는 바탕색 줄 (stripeVein): 줄무늬 색이 넓게 덮인 곳에 바탕색 줄을 꽃잎당 한두 개 가늘게 남김
                //   꽃잎 폭 방향으로 물결 하나(꽃잎당 봉우리 1~2개)를 만들고, 봉우리 꼭대기 근처만 바탕색으로 되돌림
                //   (2026-11-25 퍼플타이거: "흰 부분 중간에 보라색을 얇게 한두 군데")
                if (P.stripeVein > 0) {
                  const vl = Math.sin((u * 1.7 + ph * 1.3 + 0.12 * Math.sin(ve * 5 + ph2)) * 2 * Math.PI);
                  m *= 1 - P.stripeVein * smooth(0.72, 0.95, vl);
                }
              }
              // 불규칙하게 (stripeRandom): 꽃잎마다 무늬 양을 다르게(rnd(8)) + 한 꽃잎 안에서도 군데군데 끊기게(물결)
              //   (2026-11-24 핫 파이어: "얼룩이 너무 규칙적이라 불규칙하게")
              if (P.stripeRandom > 0) {
                const keep = smooth(0.25, 0.75, rnd(8) + 0.5 + 0.35 * Math.sin(u * 13 + ve * 9 + ph * 5));
                m *= 1 - P.stripeRandom * (1 - keep);
              }
              c.lerp(cStripe, m * smooth(0.05, 0.3, ve));                          // 꽃잎 맨 밑동은 바탕색
            }
            c.multiplyScalar(0.82 + 0.18 * smooth(0, 0.5, ve));            // 꽃잎 밑동은 살짝 그늘
            // 겹 그늘: 안쪽 겹일수록(inner), 꽃잎 밑동일수록(1 - ve) 어둡게 → 바깥 겹 꽃잎 끝은 밝기 그대로
            if (P.layerShade > 0) c.multiplyScalar(1 - P.layerShade * (0.3 * inner * (1 - 0.5 * ve) + 0.18 * Math.pow(1 - ve, 2)));
            // 색 얼룩 (natColor): 꽃잎마다 진하기 조금씩 + 꽃잎 안에서 은은한 얼룩
            if (P.natColor > 0) c.multiplyScalar(shadeJ * (1 + P.natColor * 0.07 * Math.sin(u * 5 + edgePh) * Math.sin(ve * 4 + edgePh2)));
            // 겹 경계 그늘: 밑동(ve 0 근처, 다음 겹 아래로 들어가는 쪽)은 어둡게, 끝(ve 1 근처)은 살짝 밝게
            //   아주 밝은(하얀) 꽃은 조명에 하얗게 날려서 그늘이 안 보임 → 그늘을 꽃잎 위쪽까지 넓히고, 끝 밝히기는 빼고, 전체를 살짝 낮춤
            if (P.ringShade > 0) {
              c.multiplyScalar(1 - P.ringShade * 0.4 * (1 - smooth(0, 0.55 + 0.3 * lightK, ve)));
              c.lerp(WHITE, P.ringShade * 0.1 * (1 - lightK) * smooth(0.75, 1, ve));
              c.multiplyScalar(1 - 0.12 * lightK);
            }
            // 닿는 그림자 (contactShade): 위층 꽃잎 끝이 덮는 자리(contactPos)에만 가는 그늘 띠
            //   띠 안쪽(밑동 쪽)은 천천히 짙어지고, 바깥쪽(끝 쪽)은 짧게 끊김 → 위층 끝 바로 밑에 '선'처럼 보임
            //   + 꽃잎 끝은 살짝 밝게 (들린 끝이 빛을 받음)
            if (P.contactShade > 0) {
              const cp = P.contactPos;
              const band = smooth(cp - 0.2, cp, ve) * (1 - smooth(cp, cp + 0.08, ve));
              c.multiplyScalar(1 - P.contactShade * 0.35 * band);
              c.lerp(WHITE, P.contactShade * 0.15 * (1 - 0.8 * lightK) * smooth(0.85, 1, v));   // 아주 하얀 꽃은 끝 밝히기를 줄임 (배경에 묻힘)
            }
            // 가운데 눈 (eye): 가장 안쪽 겹들(inner 0.7 이상)의 꽃잎 아래쪽~중간(ve 0.65 아래)을 어둡게 → 별 한가운데 구멍
            //   안쪽 겹은 가운데로 오므려 있어서 밑동은 가려지고 꽃잎 중간이 위에서 보임 → 중간까지 칠함
            //   가장 안쪽 겹(inner 0.85 이상)은 꽃잎 끝 가까이까지 칠함 → 구멍 속 작은 꽃잎이 어둡게 보임
            if (cEye) {
              const reach = 0.65 + 0.3 * smooth(0.8, 0.95, inner);         // 어디까지 칠하나 (안쪽 겹일수록 끝까지)
              c.lerp(cEye, Math.min(1, P.eye * smooth(0.7, 1, inner) * (1 - smooth(reach - 0.3, reach, ve))));
            }
            // 꽃잎 끝 색 (colors.edge). edgeRandom만큼 몇 장은 끝 색을 빼서 띄엄띄엄 (rnd(23) = 꽃잎마다 정해진 가짜 무작위)
            if (cEdge) {
              const edgeOn = 1 - P.edgeRandom * smooth(0.3, 0.45, rnd(23) + 0.5);   // edgeRandom 1이면 꽃잎 열 장 중 예닐곱 장은 끝 색 없음
              c.lerp(cEdge, smooth(P.edgeStart, 1, ve) * (0.35 + 0.65 * outer) * edgeOn);   // edgeStart부터 끝까지 점점 끝 색
            }
            // 꽃잎 경계선: 꽃잎 양옆 가장자리(u가 0이나 1에 가까운 곳)를 살짝 어둡게 → 옆 꽃잎과 겹치는 곳에 자연스러운 선
            if (P.seams > 0) c.multiplyScalar(1 - P.seams * 0.22 * smooth(0.55, 1, w2) * smooth(0.1, 0.5, ve));
            // 테두리선 (outline): 꽃잎 양옆 가장자리(|2u-1| → 1)와 끝(v → 1) 둘레만 선 색으로 → 일러스트 윤곽처럼 층이 나뉘어 보임
            //   (2026-11-24 큐피드인더가든: 흰 꽃은 그늘을 줄이면 옆에서 층 구분이 안 되고, 늘리면 위에서 어두워짐)
            //   밭(lite)은 꽃잎 칸이 굵어서 선이 넓게 번지므로 조금 약하게
            if (cLine) {
              const edgeK = Math.max(smooth(0.85, 1, Math.abs(2 * u - 1)) * smooth(0.1, 0.4, ve), smooth(0.92, 1, v));
              c.lerp(cLine, P.outline * edgeK * (quality === 'full' ? 1 : 0.6));
            }
            // 접힌 자국: 접힌 선은 어둡게, 바로 위(꺾여 빛을 받는 쪽)는 살짝 밝게. 꽃잎 가장자리로 갈수록 흐려짐
            if (creaseAcross) {
              const dC = ve - creasePos, fade = 1 - 0.6 * w2, sw = Math.max(0.05, 1.0 / V);   // 선 굵기는 꽃잎 칸(1/V)보다 넓게 → 칸 사이에 빠지지 않게
              c.lerp(cOuter.clone().multiplyScalar(0.7), Math.min(1, (0.5 + 0.3 * lightK) * creaseK) * Math.exp(-Math.pow(dC / sw, 2)) * fade);   // 접힌 선 (어둡게)
              c.multiplyScalar(1 - 0.1 * creaseK * smooth(-0.15, 0, dC) * (1 - smooth(0, sw * 0.3, dC)) * fade);   // 접힌 선 아래쪽은 그늘이 조금 넓게
              c.lerp(WHITE, 0.15 * creaseK * smooth(0, sw, dC) * (1 - smooth(sw, sw * 3, dC)) * fade);    // 꺾여 빛을 받는 위쪽 (밝게)
            }
            // 세로 접힌 자국: 가운데 줄은 어둡게, 한쪽 면은 빛을 받아 살짝 밝게 (끝으로 갈수록 또렷)
            if (creaseAlong) {
              const du = u - 0.5, swu = Math.max(0.06, 1.2 / U), on = smooth(0.15, 0.55, ve);
              c.lerp(cOuter.clone().multiplyScalar(0.7), Math.min(1, (0.75 + 0.3 * lightK) * creaseK) * Math.exp(-Math.pow(du / swu, 2)) * on);
              c.lerp(WHITE, 0.1 * creaseK * smooth(0.02, 0.2, du) * on);
            }
            // 포개짐 그늘: 옆 꽃잎 아래로 들어간 쪽(u 0 근처)을 어둡게 → 위 꽃잎이 드리운 그림자
            if (P.overlap > 0) c.multiplyScalar(1 - P.overlap * 0.35 * (1 - smooth(0, 0.35, u)) * smooth(0.1, 0.5, ve));
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

    // ---------- 공 모양 (ball) — 둥근 · 4등분 장미 전용 (2026-11-24) ----------
    //   사용자: "아래층은 세워서 공처럼. 옆에서는 벽이 가리니까, 위에서 본 모습(구겨진 속)에 디테일을 모으자"
    //
    //   옆에서:   ╭───────╮   ← (1) 벽: 아래층 큰 꽃잎이 공 표면을 따라 올라가 끝이 안으로 말림
    //            │ ~~~~~ │   ← (2) 속: 공 윗면(돔)에 작은 꽃잎들이 제멋대로 구겨져 얹힘
    //            ╰───────╯   ← (3) 속 채움: 꽃잎 사이 틈으로 공 속이 비어 보이지 않게 어두운 공
    //   위에서:   ◯ 안에 구겨진 꽃잎. 가운데일수록 작고 곧게 서고 진함(단추)
    //
    //   색: 바탕 = colors.outer · 깊은 곳(틈·가운데) = colors.center · 접힌 가장자리 = colors.edge(없으면 바탕을 밝게)
    //   사진 관찰: 밝은 곳은 꽃잎 '끝'이 아니라 접혀서 뒷면이 보이는 가장자리, 어두운 곳은 꽃잎 사이 틈
    if (P.ball > 0) ballPetals();
    function ballPetals() {
      const Rb = 0.78, yc = -0.05;                                   // 공 반지름 · 공 중심 높이
      const W = Math.max(1, Math.round(P.ballWalls));                // 벽 겹 수
      const cDeep = cCenter.clone();                                  // 깊은 곳
      const cGap = cCenter.clone().multiplyScalar(0.75);              // 꽃잎 사이 틈 (조금 어둡게)
      const cFold = cEdge || cOuter.clone().lerp(WHITE, 0.4);       // 접힌 가장자리 (뒷면이 보이는 밝은 색)
      const a0 = P.seed * 2.39996 + 1.3;                             // 비대칭 방향 (장미마다 다름)
      // 늘 같은 결과가 나오는 '가짜 무작위' (-0.5 … 0.5). a = 꽃잎 번호, b = 쓰임새 번호
      const rndOf = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233 + P.seed * 0.618) * 43758.5453; return x - Math.floor(x) - 0.5; };
      // 격자 점들을 삼각형으로 잇기
      const grid = (start, Uq, Vq) => {
        for (let iv = 0; iv < Vq; iv++) for (let iu = 0; iu < Uq; iu++) {
          const a = start + iv * (Uq + 1) + iu, b = a + 1, d = a + Uq + 1, e = d + 1;
          indices.push(a, d, b, b, d, e);
        }
      };

      // (1) 벽: 바깥 벽(t 0)부터 안쪽 벽(t 1)으로 겹겹이. 꽃잎 = 공 표면 한 조각이 아래에서 올라가 공 윗면으로 넘어감
      //     안쪽 벽일수록 공 꼭대기 쪽으로 더 넘어가서 끝남 → 위에서 보면 테두리에 동심원처럼 겹겹이
      //     (2026-11-24 사용자 참고 사진: 위에서 보면 테두리 쪽은 꽃잎이 말린 고리가 겹겹이, 옆에서 보면 닫힌 공)
      //     꽃잎 끝은 바깥으로 김밥처럼 둥글게 말림(ballRoll) → 말린 끝은 뒷면이 보여 밝고, 그 아래(다음 벽 밑)는 어두워 고리 사이 선이 생김
      //
      //        옆에서 본 벽 꽃잎 하나:   ╭─◠  ← 말린 끝 (밝게)
      //                                 │      ← 공 표면을 따라 올라감 (아래는 어둡게)
      //                                 ╰
      const latIn = 1.35 - 0.6 * P.ballOpen;                         // 가장 안쪽 벽 끝 위도 (클수록 공이 닫혀 속이 작음)
      const latOut = latIn - P.ballRim;                               // 가장 바깥 벽 끝 위도 (ballRim = 고리 구역 폭)
      const Vb = quality === 'full' ? V + 4 : V + 1;                  // 말린 끝까지 매끈하게 (벽 꽃잎은 조금 더 촘촘히)
      const ROLL0 = 0.74;                                             // 꽃잎 길이 중 이 뒤로는 말린 끝
      for (let w = 0; w < W; w++) {
        const t = W > 1 ? w / (W - 1) : 1;                           // 0 바깥 벽 … 1 안쪽 벽
        const n = Math.max(5, Math.round(P.petals * (1 - 0.3 * t)));
        const rs = Rb * (1 - 0.06 * t);
        const latS = -1.2 + 0.5 * t;                                   // 안쪽 벽은 조금 위에서 시작 (바깥 벽 뒤에 숨음)
        const latE = latOut + (latIn - latOut) * t;
        const off = w * 1.3 * Math.PI / n + P.seed;
        for (let j = 0; j < n; j++) {
          const r = i => rndOf(w * 37 + j, i);
          const az = off + j * 2 * Math.PI / n + P.messy * 0.25 * (2 * Math.PI / n) * r(1);
          const span = (2 * Math.PI / n) * 1.3 * P.petalWidth * (1 + P.natPetal * 0.3 * r(2));   // 옆 꽃잎과 넉넉히 겹침
          const latEj = latE + P.natPetal * 0.15 * (1 + t) * r(3);    // 꽃잎마다 끝 높이 조금씩 다름 → 고리가 반듯한 동심원이 안 되게 (안쪽 벽일수록 더 들쭉날쭉 → 속과 경계가 자연스럽게)
          // 맨 바깥 벽 꽃잎 중 한 장 건너 한 장은 바깥으로 벌어짐 (ballPeel): 위쪽이 공에서 떨어져 나가며 끝도 조금 낮아짐
          //   (2026-11-24 사용자: 무작위로 고르니 한쪽에 몰림 → 고르게 돌아가며. 벌어지는 정도만 장마다 다르게)
          const peelOn = w === 0 && j % 2 === 0 && !(n % 2 === 1 && j === n - 1);   // 꽃잎 수가 홀수면 마지막 장은 빼서 이웃 둘이 붙지 않게
          const peel = peelOn ? P.ballPeel * (0.6 + 0.8 * (r(9) + 0.5)) : 0;
          const rollJ = P.ballRoll * (0.7 + 0.6 * (r(4) + 0.5));      // 말림 정도 (꽃잎마다 조금씩)
          const rollR = 0.03 + 0.02 * (r(7) + 0.5);                    // 말린 끝의 굵기
          const ph = r(5) * 20, shadeJ = 1 + P.natColor * 0.12 * r(6);
          const start = positions.length / 3;
          for (let iv = 0; iv <= Vb; iv++) for (let iu = 0; iu <= U; iu++) {
            const u = iu / U, v = iv / Vb, w2 = (2 * u - 1) * (2 * u - 1);
            const ve = v * (1 - 0.12 * w2);                           // 끝이 살짝 둥글게
            const body = Math.min(ve, ROLL0) / ROLL0;                  // 0 … 1: 공 표면을 따라 올라가는 부분
            const lat = latS + (latEj - latS) * body - peel * 0.25 * body * body;
            const wv = Math.pow(Math.sin(Math.PI * (0.1 + 0.8 * body)), 0.3);   // 밑동은 좁고, 끝까지 넓게 (말린 끝이 고리처럼 길게)
            const phi = az + (u - 0.5) * span * wv;
            const Rr = rs + 0.03 * (1 - w2) * Math.sin(Math.PI * body)        // 꽃잎 가운데가 살짝 볼록 → 한 장씩 나뉘어 보임
                     + P.ruffle * 0.02 * Math.sin(u * Math.PI * 5 + ph) * body * body    // 물결
                     + peel * 0.16 * smooth(0.35, 1, body);                           // 벌어진 꽃잎은 위쪽이 바깥으로
            // 공 표면 위 점. 그 자리의 방향: T = 위(공 꼭대기 쪽)로 올라가는 쪽, N = 공 바깥 쪽
            const cl = Math.cos(lat), sl = Math.sin(lat), cp = Math.cos(phi), sp = Math.sin(phi);
            let X = Rr * cl * cp, Y = yc + Rr * sl, Z = Rr * cl * sp;
            // 말린 끝: ROLL0 뒤로는 공 표면을 벗어나 바깥으로 둥글게 말림 (앞으로 가다가 바깥으로 넘어감)
            const rollT = Math.max(0, (ve - ROLL0) / (1 - ROLL0));
            if (rollT > 0) {
              const A = rollT * Math.PI * 1.1 * rollJ;
              const fwd = rollR * Math.sin(A), outw = rollR * (1 - Math.cos(A));
              X += fwd * (-sl * cp) + outw * (cl * cp);
              Y += fwd * cl + outw * sl;
              Z += fwd * (-sl * sp) + outw * (cl * sp);
            }
            if (P.natAsym > 0) { const kA = 1 + P.natAsym * 0.04 * Math.cos(2 * (phi - a0)) * (1 - P.natRound * (1 - t)); X *= kA; Z *= kA; }   // 살짝 타원 (바깥 벽은 natRound만큼 둥글게)
            // 색: 바깥 벽은 바탕색, 안쪽 벽일수록 깊은 색 쪽
            c.copy(cOuter).lerp(cDeep, 0.4 * t);
            //   끝 쪽으로 갈수록 밝게 → 다음 벽의 말린 끝 아래(이 벽의 중간)는 어두움 = 고리 사이 선
            c.multiplyScalar((0.55 + 0.45 * smooth(0.35, 0.72, ve)) * shadeJ);
            //   말린 끝은 뒷면이 보여서 밝게 (접힘 색)
            c.lerp(cFold, P.ballFold * smooth(0, 0.6, rollT) * (0.75 + 0.25 * Math.sin(u * Math.PI * 4 + ph)));
            if (P.seams > 0) c.multiplyScalar(1 - P.seams * 0.25 * smooth(0.6, 1, w2) * smooth(0.15, 0.6, ve));
            push(X, Y, Z, c);
          }
          grid(start, U, Vb);
        }
      }

      // 가장 안쪽 벽의 끝 = 속을 채울 범위 (반지름 capR, 높이 rimY)
      const rsIn = Rb * (1 - 0.06), capR = rsIn * Math.cos(latIn), rimY = yc + rsIn * Math.sin(latIn);

      // (3) 속 채움: 벽 안쪽에 어두운 공 (꼭대기는 벽 끝보다 조금 낮게 → 구겨진 꽃잎 밑에 숨음)
      const fillTop = rimY - 0.02;
      ball(0, yc, 0, Rb * 0.86, fillTop - yc, () => c.copy(cGap));

      // (2) 속: 구겨진 작은 꽃잎들. 해바라기 씨앗 배치로 돔 위에 고르게 뿌리되, 방향·기울기·크기·말림은 장마다 제멋대로
      //     → 고리 줄무늬(비늘 무늬)가 생기지 않음
      const Uq = quality === 'full' ? 6 : 3, Vq = quality === 'full' ? 5 : 3, sq = quality === 'full' ? 5 : 3;
      const Nfull = Math.max(8, Math.round(70 * P.ballFill));              // 꽃잎 크기는 상세 기준 수로 정함 → 밭(lite)에서도 꽃잎 크기가 같음
      const N = quality === 'full' ? Nfull : Math.max(8, Math.round(Nfull * 0.6));   // 밭은 장수만 줄임 (점이 적게)
      for (let i = 0; i < N; i++) {
        const r = k => rndOf(1000 + i, k);
        const rr = capR * 1.12 * Math.sqrt((i + 0.5) / N);           // 가운데에서 떨어진 거리 (안쪽 벽 끝 위까지 살짝 넘침 → 속과 테두리 경계가 자연스럽게)
        const ang = i * 2.39996 + P.seed + 0.3 * r(1);
        const ctr = rr / capR;                                        // 0 가운데(단추) … 1 벽 가까이
        const px = rr * Math.cos(ang), pz = rr * Math.sin(ang);
        const py = rimY - 0.02 + P.ballDome * 0.08 * (1 - ctr * ctr) - 0.04 * ctr * ctr;   // 돔: 가운데가 조금 높음
        // 꽃잎이 뻗는 방향: 기본은 빙 도는 소용돌이. 4등분(quarter)이면 각 무리의 가운데 선 쪽으로 접히듯 → 부채 4개
        let dir = ang + Math.PI / 2;
        if (P.quarter > 0) {
          const QUAD = 2 * Math.PI / P.quarterN, qOff = QUAD / 2 + P.seed;   // 무리 수 = quarterN
          const qc = qOff + Math.round((ang - qOff) / QUAD) * QUAD;   // 가장 가까운 무리 가운데 선
          const side = Math.sign(Math.sin(ang - qc)) || 1;
          dir = (1 - P.quarter) * dir + P.quarter * (ang - side * Math.PI / 2);
        }
        dir += (0.25 + 0.5 * P.natPetal) * r(2) * 1.4;                // 조금씩 제멋대로 (너무 흩어지면 꽃잎 부스러기처럼 보임)
        // 위로 선 정도: 사진 속 꽃잎은 넓은 꽃잎이 비스듬히 서서 '휘어진 가장자리'가 위로 보임 → 초승달 같은 곡선이 겹겹이
        const elev = 0.7 + 0.5 * (r(3) + 0.5) - 0.3 * ctr;
        const unit = 2.6 * capR / Math.sqrt(Nfull);                   // 꽃잎 수가 적을수록 크게 → 덮는 넓이는 같음
        const size = unit * (0.85 + 0.6 * (r(4) + 0.5)) * (0.55 + 0.45 * ctr) * (1 + P.natPetal * 0.3 * r(5));   // 가운데일수록 작음
        const curlQ = (r(6) * 1.8 - 0.2) * (0.5 + P.natPetal);         // 끝 말림 (어떤 건 뒤로 접혀 넘어감 = 구겨짐)
        const wdt = size * (1.5 + 0.6 * (r(7) + 0.5));                // 길이보다 넓은 꽃잎
        const cupQ = 0.6 + 0.3 * (r(8) + 0.5);                        // 숟가락처럼 오목 → 위에서 보면 초승달
        const ph = r(9) * 20, shadeJ = 1 + P.natColor * 0.15 * r(10);
        const fx = Math.cos(dir), fz = Math.sin(dir);                 // 앞 (가로 방향)
        const sx = -fz, sz = fx;                                      // 옆
        const start = positions.length / 3;
        for (let iv = 0; iv <= Vq; iv++) for (let iu = 0; iu <= Uq; iu++) {
          const u = iu / Uq, v = iv / Vq, w2 = (2 * u - 1) * (2 * u - 1);
          const ve = v * (1 - 0.2 * w2);
          // 길이 방향으로 휘며 뻗음: elev 각도로 시작해 curlQ만큼 꺾임
          let ax = 0, ay = 0, th = elev;
          for (let st = 1; st <= sq; st++) {
            const vv = ve * st / sq; th = elev + curlQ * vv * vv;
            ax += Math.cos(th) * size * ve / sq; ay += Math.sin(th) * size * ve / sq;
          }
          const nx = -Math.sin(th), ny = Math.cos(th);                // 꽃잎 면에 수직 (앞-위 평면 안)
          const across = (u - 0.5) * wdt * Math.pow(Math.sin(Math.PI * (0.15 + 0.7 * ve)), 0.4);
          const lift = cupQ * w2 * wdt * 0.35 + P.ruffle * 0.025 * Math.sin(u * Math.PI * 6 + ph) * ve * ve;   // 오목 + 물결
          let X = px + fx * (ax + nx * lift) + sx * across;
          let Y = py + ay + ny * lift;
          let Z = pz + fz * (ax + nx * lift) + sz * across;
          // 공 밖으로 튀어나오지 않게 (2026-11-24 사용자: 옆에서 봤을 때 안쪽이 너무 튀어나옴): 공 표면 근처에서 눌러 넣음
          const dc = Math.hypot(X, Y - yc, Z), lim = Rb * 0.96;
          if (dc > lim) { const kS = (lim + (dc - lim) * 0.2) / dc; X *= kS; Z *= kS; Y = yc + (Y - yc) * kS; }
          // 벽 밖으로 삐져나가지 않게: 벽 끝(capR)을 넘는 부분은 안쪽으로 접어 넣음
          const hrQ = Math.hypot(X, Z);
          const edgeR = capR * 1.15;
          if (hrQ > edgeR) {
            const k2 = (edgeR + (hrQ - edgeR) * 0.25) / hrQ;
            X *= k2; Z *= k2; Y -= (hrQ - edgeR) * 0.4;
          }
          // 색: 몸통 = 바탕(가운데일수록 깊게) · 밑동 = 틈(어둡게) · 접힌 가장자리(끝·양옆) = 밝게
          c.copy(cOuter).lerp(cDeep, 0.25 + 0.45 * (1 - ctr));
          c.lerp(cGap, 1 - smooth(0.05, 0.45, ve));
          c.multiplyScalar(shadeJ);
          const crest = 0.55 + 0.45 * Math.sin(u * Math.PI * 6 + ph);
          c.lerp(cFold, P.ballFold * Math.max(smooth(0.8, 1, v) * crest, 0.35 * smooth(0.85, 1, Math.abs(2 * u - 1)) * smooth(0.5, 1, ve)));
          push(X, Y, Z, c);
        }
        grid(start, Uq, Vq);
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
    if (P.ball > 0) {
      // 공 모양: 수술·심 없음 (속은 위 ballPetals에서 채움)
    } else if (cStamen && P.threads > 0) {
      // 수술 (2026-11-23 바꿈: 납작한 판 + 알갱이 → 실제 수술처럼)
      //   꽃 가운데에서 가는 실(수술대)이 한 가닥씩 위·바깥으로 휘어 올라오고, 끝에 꽃밥(작은 구슬)이 달림
      //
      //        o   o  o        ← 꽃밥 (수술 색, 조금 진하게)
      //         \  |  /
      //          \ | /         ← 수술대 (수술 색을 밝게)
      //      ─────●─────       ← 가운데 밑동
      const rr = 0.17 * P.core;
      // 꽃 중심 받침 (2026-11-24): 꽃잎이 붙는 높이(-0.32)에서 수술이 시작하는 높이까지 낮은 둔덕으로 채움
      //   예전에는 초록 꽃받침이 이 틈을 메웠는데, 꽃받침을 숨기면서(calyxHide) 수술이 공중에 뜬 것처럼 보여서 추가
      //   색: 둘레는 꽃잎 밑동 색(조금 어둡게) → 꼭대기로 갈수록 수술 색(어둡게) → 꽃잎에서 수술로 자연스럽게 이어짐
      const STAMEN_BASE = -0.24;                                     // 수술이 시작하는 높이 (받침 윗면)
      const cDomeEdge = cCenter.clone().multiplyScalar(0.88), cDomeTop = cCenter.clone().lerp(coreCol, 0.45).multiplyScalar(0.75);
      ball(0, -0.31, 0, 0.21, 0.07, y => c.copy(cDomeEdge).lerp(cDomeTop, smooth(0.4, 1, y)));
      ball(0, STAMEN_BASE, 0, rr * 0.45, 0.035, () => c.copy(coreCol).multiplyScalar(0.6));   // 가운데 밑동 (작게)
      const count = Math.max(4, Math.round((quality === 'full' ? 28 : 12) * P.stamenCount));   // 수술 가닥 수 (상세 / 밭) × stamenCount
      const sides = quality === 'full' ? 5 : 3, segs = quality === 'full' ? 4 : 2;   // 실 단면 꼭짓점 수 · 마디 수
      const cFil = P.colors.filament ? lin(P.colors.filament) : coreCol.clone().lerp(WHITE, 0.35);   // 수술대 색: 따로 정했으면 그 색, 아니면 수술 색을 밝게
      const cOld = P.stamenAge > 0 ? lin(P.colors.stamenOld || '#A8432E') : null;   // 꽃가루를 날린 꽃밥 색
      // 늘 같은 결과가 나오는 '가짜 무작위' (블롭을 다시 만들어도 수술 자리가 그대로)
      const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
      for (let i = 0; i < count; i++) {
        // 해바라기 씨앗 배치로 밑동 자리를 고르게 퍼뜨림 (황금각만큼 돌리고 바깥으로 sqrt만큼)
        let a = i * 2.39996 + (rand(i) - 0.5) * 0.4;
        a += P.natStamen * 0.5 * Math.sin(a * 3 + P.seed);           // 수술 몰림: 몇 방향으로 모여 뭉침
        const d0 = rr * 0.35 * Math.sqrt((i + 0.5) / count);        // 밑동: 가운데 가까이
        const inner = rand(i + 200) < P.stamenMix;                   // 이 가닥은 가운데에 남는가? (stamenMix 비율만큼)
        let reachOut = rr * (0.45 + 0.5 * rand(i + 50)) * P.stamenSpread;   // 바깥으로 뻗는 거리 (stamenSpread가 작을수록 안으로 모임)
        let rise = (0.1 + 0.08 * rand(i + 100)) * Math.sqrt(P.core) * (1 + 0.3 * (1 - P.stamenSpread)); // 위로 올라오는 높이 (모일수록 조금 더 높이)
        if (inner) { reachOut *= 0.2; rise *= 1.15; }
        if (rand(i + 400) > 1 - 0.15 * P.natStamen) reachOut *= 1.6;   // 몇 가닥은 삐침
        rise *= 1 + P.natStamen * 0.4 * (rand(i + 500) - 0.5);       // 높이도 들쭉날쭉                // 가운데 가닥: 거의 안 퍼지고 조금 더 높이 솟음
        // 꽃가루를 날린 바깥 수술 (stamenAge): 가운데 가닥이 아닌 것 중 일부 → 더 멀리·조금 낮게 퍼지고 꽃밥 색이 붉은 갈색
        const old = !inner && cOld && rand(i + 300) < P.stamenAge;
        if (old) { reachOut *= 1.8; rise *= 0.85; }
        const ca = Math.cos(a), sa = Math.sin(a);
        // 실을 따라가는 점: t 0(밑동) … 1(끝). 위로 먼저 솟고 바깥으로 휘어짐
        //   받침 윗면(STAMEN_BASE)에서 시작해 lift만큼 올라감
        //   (2026-11-24 사용자: 수술이 길어 부각돼 보임 → 전체적으로 짧게. 예전 rise + 0.18 → 0.8 × rise + 0.06)
        const lift = rise * 0.8 + 0.06;
        const at = tt => [ca * (d0 + reachOut * tt * tt), STAMEN_BASE + lift * Math.sin(tt * Math.PI / 2), sa * (d0 + reachOut * tt * tt)];
        const rad = 0.007 * Math.sqrt(P.core) * P.stamenThick;       // 실 굵기 (stamenThick 배율)
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
        const size = (0.022 + 0.006 * rand(i + 150)) * P.core * P.stamenSize * (old ? 0.9 : 1);   // 꽃밥 크기 × stamenSize (날린 꽃밥은 조금 작게)
        ball(tx, ty, tz, size, size * 0.8, () => old ? c.copy(cOld) : c.copy(coreCol).multiplyScalar(0.9), 5, 3);
      }
    } else {
      ball(0, -0.05, 0, 0.17 * P.core, 0.2, (y, ph) => c.copy(coreCol).multiplyScalar(cStamen ? 0.85 + 0.15 * Math.sin(ph * 9) : 0.9));
    }
    // 꽃받침 (줄기가 붙는 곳). calyxHide만큼 아래로 내리고 납작하게 → 활짝 핀 꽃의 가운데 틈으로 초록이 비치지 않게
    //   + 윗면(y > 0)은 꽃 가운데 색(조금 어둡게)으로 칠함 → 옆에서 틈으로 비쳐도 꽃 속처럼 보이고, 아랫면은 초록 그대로
    const cCalyxTop = cCenter.clone().multiplyScalar(0.75);
    ball(0, -0.36 - 0.12 * P.calyxHide, 0, 0.26 * (1 - 0.3 * P.calyxHide), 0.2 * (1 - 0.5 * P.calyxHide),
         y => c.copy(cGreen).lerp(cCalyxTop, P.calyxHide * smooth(-0.2, 0.3, y)));

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
