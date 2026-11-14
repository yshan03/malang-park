// 장미 API 한 건 → 공통 아이템 형태로 바꾸는 변환기(adapter).
// "장미"에 관한 지식은 전부 이 파일 안에만 둔다. 인터랙션 코드는 장미를 모른다.
//
//   API 원본 { title, alternativeTitle, subDescription:"꽃색:…||육성국:…", ... }
//        │  roseAdapter()
//        ▼
//   공통 형태 { id, name, nameEn, color, colorHex, colorHex2, imageUrls, description, detailUrl, zone, tags }
//   (colorHex는 이름 옆 색 동그라미에만 쓴다. 3D 도형 색에는 쓰지 않는다.)

(function () {
  // 한글 색 이름 → HEX. 긴 이름부터 찾아야 "연노랑"이 "노랑"보다 먼저 잡힌다.
  const COLOR_WORDS = {
    '연노랑': '#F6E27F', '노랑': '#F5C842', '노란': '#F5C842', '황색': '#F2B705',
    '옅은 베이지': '#E8D7BC', '베이지': '#DCC6A0', '크림': '#F3E7C9',
    '복숭아': '#F7B49A', '살구': '#F5A97F', '주황': '#F08A3C', '오렌지': '#F08A3C',
    '연분홍': '#F7C6D3', '짙은 핑크': '#D9447A', '진분홍': '#D9447A', '분홍': '#F28AB2', '핑크': '#F28AB2',
    '홍색': '#D93A4E', '진홍': '#B5172F', '적색': '#C8203A', '빨강': '#D62839', '빨간': '#D62839',
    '자주': '#9B3A7A', '보라': '#9C7BC4', '라벤더': '#B9A3DA',
    '흰': '#F7F4EE', '백색': '#F7F4EE', '흰색': '#F7F4EE'
  };
  const WORDS_LONGEST_FIRST = Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length);
  // 꽃색 정보가 없거나 표에 없는 색 이름이면 색을 지어내지 않고 비워 둔다(null).

  function colorWordToHex(text) {
    const word = WORDS_LONGEST_FIRST.find(w => text.includes(w));
    return word ? COLOR_WORDS[word] : null;
  }

  // "꽃색:황색, 홍색||육성국:프랑스" → { 꽃색: '황색, 홍색', 육성국: '프랑스' }
  //
  // ⚠️ 주의사항 (지금은 고치지 않음 — subDescription에 실제 값이 들어오면 다시 확인할 것)
  //  1. 형식 가정: API 문서 샘플의 "꽃색:…||육성국:…" 모양을 가정했다.
  //     2026-11-14 기준 실제 API 182건은 subDescription이 전부 비어 있어서, 실제 형식으로 시험해 본 적이 없다.
  //     구분자("||", ":")가 다르게 들어오면 이 함수를 손봐야 한다.
  //  2. 읽는 항목: 아래 roseAdapter는 '꽃색'과 '육성국' 두 항목만 쓴다.
  //     "개화기:5월"처럼 새 항목이 생기면 여기서 쪼개지긴 하지만 화면에는 쓰이지 않고 무시된다.
  function parseSubDescription(s) {
    const out = {};
    String(s || '').split('||').forEach(part => {
      const i = part.indexOf(':');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
    return out;
  }

  // "에버골드(Ever Gold)" → "Ever Gold"
  function englishName(alt) {
    const m = String(alt || '').match(/\(([^)]+)\)/);
    return m ? m[1] : '';
  }

  const LINEAGE = { HT: '하이브리드 티', FL: '플로리분다', CL: '덩굴장미', MIN: '미니어처', S: '관목장미' };

  window.roseAdapter = function (apiItem, index) {
    const sub = parseSubDescription(apiItem.subDescription);
    const colorText = sub['꽃색'] || '';
    // 색이 여러 개면("황색, 홍색") 앞 색 → 위쪽, 뒤 색 → 아래쪽 그라데이션
    const hexes = colorText ? colorText.split(',').map(colorWordToHex).filter(Boolean) : [];
    const lineage = apiItem.subjectCategory;

    return {
      id: 'rose-' + index,
      name: apiItem.title,
      nameEn: englishName(apiItem.alternativeTitle),
      color: colorText,
      colorHex: hexes[0] || null,
      colorHex2: hexes[1] || null,
      // 실제 API는 referenceIdentifier가 비어 있고, url 필드가 장미 사진 주소다.
      // 사진 후보를 순서대로: 앞 주소가 깨지면 화면이 다음 주소를 시도한다.
      imageUrls: [apiItem.referenceIdentifier, apiItem.url].filter(Boolean),
      description: apiItem.description || '',
      detailUrl: '',
      zone: 'rose',
      // 카드에 보여줄 부가 정보(이름표 형태). 인터랙션 코드는 내용을 몰라도 그냥 나열만 한다.
      tags: [
        lineage ? (LINEAGE[lineage] || lineage) : null,
        sub['육성국'] ? sub['육성국'] + ' 육성' : null,
        colorText || null
      ].filter(Boolean)
    };
  };
})();
