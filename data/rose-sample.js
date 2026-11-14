// 장미정보 API 문서 페이지에 나온 샘플 5건을 API 응답 필드 이름 그대로 옮긴 것.
// 인증키가 없거나 API가 실패할 때 이 데이터를 대신 보여준다 (시연 안전용).
//
// 왜 .json이 아니라 .js인가?
//  - HTML 파일을 더블클릭해서 열면(file://) 브라우저가 fetch로 JSON 읽는 것을 막는다.
//  - <script>로 불러오는 .js는 막히지 않아서, 서버 없이도 바로 열어볼 수 있다.
window.ROSE_SAMPLE = [
  {
    title: '에버골드',
    alternativeTitle: '에버골드(Ever Gold)',
    subjectCategory: 'CL',
    description: '1966년 독일 코르테스 사에서 육종되었으며 화려한 노란색 물결을 보는 듯한 모습을 하고 있다. 꽃이 약간 큰 편이며 약하지만 향기도 가지고 있다. 꽃기둥에 적합하다.',
    subDescription: '꽃색:연노랑색||육성국:독일',
    referenceIdentifier: 'http://www.ksponco.or.kr/jsp/upload_files/RosePlzLook/atch_image/9_90.jpg',
    url: ''
  },
  {
    title: '폴리카르드',
    alternativeTitle: '폴 리카르드(Paul Ricard)',
    subjectCategory: 'HT',
    description: '1993년 메이앙 사에서 육성한 다른 꽃에서는 찾아볼 수 없는 독특한 베이지색을 가진 장미이며, 향기도 특이하게 맛있는 과일향이 난다. 1990년 로마 국제 장미 콩쿠르 금상 수상',
    subDescription: '꽃색:옅은 베이지||육성국:프랑스',
    referenceIdentifier: 'http://www.ksponco.or.kr/jsp/upload_files/RosePlzLook/atch_image/7_76.jpg',
    url: ''
  },
  {
    title: '린',
    alternativeTitle: '린(Rin)',
    subjectCategory: 'FL',
    description: '야무진 꽃모양과 분홍색 중심에 흰색의 흐림이 있는 꽃색이 어우러진 아름다운 품종이다. 잎은 광택이 있고 신장력이 왕성하다. 2005년 JRC 금상 수상',
    subDescription: '꽃색:복숭아색||육성국:일본',
    referenceIdentifier: 'http://www.ksponco.or.kr/jsp/upload_files/RosePlzLook/atch_image/9_94.jpg',
    url: ''
  },
  {
    title: '데저트 피스',
    alternativeTitle: '데저트 피스(Desert Peace)',
    subjectCategory: 'HT',
    description: '명화 Peace의 혈통을 이어 받은 우량아로 수세가 특히 강건하며 선명한 황색과 홍색의 조화가 뛰어나다.',
    subDescription: '꽃색:황색, 홍색||육성국:프랑스',
    referenceIdentifier: 'http://www.ksponco.or.kr/jsp/upload_files/RosePlzLook/atch_image/9_96.jpg',
    url: ''
  },
  {
    title: '엘르',
    alternativeTitle: '엘르(Elle)',
    subjectCategory: 'HT',
    description: '반짝이는 잎과 건강한 수형을 가진다. 프랑스 여성지 Elle에서 이름을 지은 장미로 풍부한 색채가 미묘하게 섞여 따뜻한 분위기가 있는 꽃이다. 향기 또한 뛰어나다. 1999년 바가텔 국제 콩쿠르 방향상. 제네바 국제 콩쿠르 은상 수상',
    subDescription: '꽃색:살구색, 중심은 짙은 핑크||육성국:프랑스',
    referenceIdentifier: 'http://www.ksponco.or.kr/jsp/upload_files/RosePlzLook/atch_image/7_72.jpg',
    url: ''
  }
];
