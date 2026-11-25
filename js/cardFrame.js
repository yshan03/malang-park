// 큰 화면 카드 틀 (2026-11-25)
// ------------------------------------------------------------
// 이 사이트는 휴대폰 세로 화면에 맞춰 만들었다. 컴퓨터처럼 큰 화면(창 폭 600px 이상)에서는
// 지도(index.html)처럼 회색 바탕 가운데에 "폰 카드"를 띄워서 보여 준다.
//
// 장미광장(interaction.html)·나홀로나무(lonetree.html)는 겉모양만 줄이면 안 된다.
// 유리병 벽, 위쪽 버튼, 상세에서 꽃이 서는 높이, TMI 공책 높이 등이 "브라우저 창 크기"를 기준으로
// 자리를 잡기 때문이다. 그래서 카드 안에 같은 페이지를 폰 크기 창(iframe)으로 한 번 더 띄운다.
// 안쪽 페이지에게는 "창 = 카드"라서, 폰에서 볼 때와 똑같이 계산되고 작동한다.
//
//   큰 화면에서 페이지를 열면
//     ├ [바깥] 이 스크립트가 페이지를 멈추고 → 회색 바탕 + 카드 틀(iframe)로 바꿈
//     └ [안쪽] iframe 안에서 같은 페이지가 다시 열림 → 이 스크립트는 "나는 카드 안"이라 그대로 둠
//
// 이 파일은 각 페이지 <head> 맨 앞에서 불러야 한다(다른 그림·코드가 시작되기 전에 멈춰야 하므로).
// 주소에 ?nocard 를 붙이면 큰 화면에서도 카드 없이 본다(테스트용).

(function () {
  // 폰 카드 크기 = 아이폰 17 Pro Max에서 사파리 주소창이 있을 때 "브라우저 안에 보이는 칸" (지도와 같은 값)
  const CARD_WIDTH = 440;
  const CARD_HEIGHT = 830;

  const insideCard = window.self !== window.top;     // iframe 안에서 열렸으면 true
  const wideScreen = window.matchMedia('(min-width: 600px)').matches;
  const noCard = new URLSearchParams(location.search).has('nocard');

  if (insideCard) {
    keepOuterAddressInSync();
    sendLinksToOuterWindow();
    return;
  }
  if (!wideScreen || noCard) return;                  // 휴대폰(또는 ?nocard): 아무것도 안 함

  buildCard();

  // ---------- [바깥] 회색 바탕 + 가운데 카드 틀 만들기 ----------
  function buildCard() {
    // 1) 페이지 읽기를 여기서 멈춘다 → 아래쪽의 3D 밭·나무 코드가 바깥 창에서는 시작되지 않는다
    window.stop();

    // 2) 문서 내용을 카드 틀로 바꾼다. 안쪽 iframe에는 지금과 같은 주소를 연다
    const title = document.title;
    document.documentElement.innerHTML = `
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title></title>
        <style>
          html, body { margin: 0; height: 100%; }
          /* 바탕색·카드 모서리·그림자는 지도(index.html)의 카드 모양과 같은 값 */
          body { background: #ece9e0; overflow: hidden; }
          .card-frame {
            position: absolute; left: 50%; top: 50%;
            width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px; border: 0;
            border-radius: 14px; background: #fff;
            box-shadow: 0 0 0 1px #66725e40, 0 8px 20px #26312020;
            transform-origin: center;
          }
        </style>
      </head>
      <body>
        <!-- allow: 나홀로나무가 카드 안에서도 마이크(바람 불기)를 쓸 수 있게 허락 -->
        <iframe class="card-frame" allow="microphone; autoplay; fullscreen"></iframe>
      </body>`;
    document.title = title;

    const frame = document.querySelector('.card-frame');
    frame.src = location.href;

    // 3) 창 크기에 맞춰 카드를 비율대로 줄인다 (가장자리 8px씩 여유. 카드보다 크게는 안 키움)
    function fitCard() {
      const scale = Math.min(1, (innerWidth - 16) / CARD_WIDTH, (innerHeight - 16) / CARD_HEIGHT);
      frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
    fitCard();
    window.addEventListener('resize', fitCard);

    // 4) 창을 폰만큼 좁히면 카드 없이 보는 게 맞다 → 같은 주소를 새로 열어서 휴대폰 화면으로
    window.matchMedia('(min-width: 600px)').addEventListener('change', event => {
      if (!event.matches) location.replace(frame.contentWindow.location.href);
    });
  }

  // ---------- [안쪽] 주소창 맞추기 ----------
  // 장미 상세로 들어가면 안쪽 페이지 주소가 바뀐다(…&item=장미이름).
  // 바깥 주소창에도 같은 주소가 보이게 해야, 복사해서 공유했을 때 그 장미가 열린다.
  // (뒤로 가기 기록은 안쪽 iframe에 쌓이고, 브라우저 뒤로 가기 버튼도 그 기록을 그대로 쓴다)
  function keepOuterAddressInSync() {
    function copyAddressOut() {
      try {
        window.top.history.replaceState(null, '', location.href);
        window.top.document.title = document.title;
      } catch (error) {
        // 다른 사이트에 끼워진 경우 등 바깥에 손댈 수 없으면 그냥 둔다
      }
    }
    for (const name of ['pushState', 'replaceState']) {
      const original = history[name].bind(history);
      history[name] = function (...args) {
        original(...args);
        copyAddressOut();
      };
    }
    window.addEventListener('popstate', copyAddressOut);
    // 이 스크립트는 <title>보다 먼저 읽혀서, 페이지 제목은 문서를 다 읽은 뒤에 한 번 더 옮긴다
    document.addEventListener('DOMContentLoaded', copyAddressOut);
    copyAddressOut();
  }

  // ---------- [안쪽] 다른 페이지로 가는 링크는 바깥 창에서 열기 ----------
  // 예: "지도로 돌아가기"를 카드 안에서 열면 카드 속에 또 지도가 들어가 버린다.
  // 바깥 창 전체가 지도로 바뀌어야 지도 자신의 카드 모양으로 제대로 보인다.
  function sendLinksToOuterWindow() {
    document.addEventListener('click', event => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (link && !link.target) link.target = '_top';
    }, true);
  }
})();
