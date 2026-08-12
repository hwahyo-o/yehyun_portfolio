# YeHyun Portfolio 구현 계획

- 기준일: 2026-08-11 (KST)
- 저장소: hwahyo-o/yehyun_portfolio
- 작업 브랜치: drill
- 백업 브랜치: keep
- 구현 범위: 로딩 화면, 홈/이력서, 카테고리별 작업물 화면, 반응형, 모션, 레퍼런스 기반 시각 리뉴얼
- 제외 범위: 실제 이미지·영상 자산은 추후 제공 시 연결
- 공개 금지 정보: API 키, 토큰, 비공개 식별자, 개인 인증 정보는 코드와 문서에 기록하지 않음

## 확정 요구사항

1. 최초 화면 표시 시점부터 로딩 화면을 정확히 3초간 노출한다.
2. Portfolio와 2026 텍스트가 나타난 후 Portfolio 하이라이트가 왼쪽에서 오른쪽으로 채워진다.
3. 하이라이트 이후 Portfolio와 2026의 폰트를 300ms 주기로 셔플한다.
4. 로딩 종료 시 메인 화면으로 자연스럽게 페이드 전환한다.
5. 홈에는 YeHyun GNB, About Me, UX/UI·Graphic·Video 최신순 캐러셀, 최상단 이동을 둔다.
6. 카테고리 화면은 최신 작업물을 먼저 보여주고, 이전/다음 썸네일과 상세 내용을 제공한다.
7. 외부 폰트 로딩 지연은 3초를 연장하지 않으며, 실패 시 대체 폰트를 사용한다.
8. 실제 작업물 자산은 추후 연결하며 없는 자산을 임의로 생성하지 않는다.
9. 로딩 이후 페이지의 시각 방향은 첨부 레퍼런스의 분홍 GNB, 크림색 갤러리 히어로, 회색 프레임, 가로 작업물 레일, 회색 Film 밴드, About 카드, 하단 장식 리듬을 기준으로 한다.
10. HTML은 화면 마크업, CSS는 시각 표현, JS는 버튼 작동·해시 페이지 이동·로딩/셔플 동작만 담당한다.
11. 최초 접속과 재접속 모두 문서 스크롤 위치는 최상단에서 시작한다.
12. 홈 Gallery 영역은 800ms 간격의 자동 슬라이드 배너로 오른쪽에서 왼쪽 방향으로 반복 이동한다.
13. UX/UI, Graphic, Video 상세 페이지는 GNB 아래에 작은 이전/다음 썸네일과 중앙 제목·제작 기간을 배치하고, 아래에 상세 본문과 하단 이동 버튼을 둔다.
14. 카테고리 상세 첫 진입은 최신 작업물을 기준으로 한다.

## 계층 설계

### 화면

- index.html의 LoadingScreen
- index.html의 PortfolioShell
- GNB와 홈 이동 로고
- GalleryHero
- AboutResume
- CategoryWorkRail: UX/UI, Graphic, Film/Video
- CategoryPage
- ProjectDetail placeholder
- ScrollToTop
- 실제 미디어가 제공되기 전까지의 project media slot

### 처리

- 최초 표시 기준 3000ms loading timeline controller
- 300ms loading font shuffle controller
- 400ms About Me shuffle cooldown과 32px 포인터 이동 임계값
- 해시 기반 home/category route controller
- 문서 시작 시 scrollTo(0, 0)와 hash route 변경 시 scrollTo(0, 0)
- Gallery slide controller: 800ms 간격, 오른쪽에서 왼쪽으로 1칸 이동, 마지막에서 첫 항목으로 순환
- GNB, 이전/다음, 최상단 버튼의 이벤트 위임
- 브라우저가 JS를 실행하지 못해도 정적 HTML이 빈 화면이 되지 않도록 초기 화면을 HTML에 직접 포함

### 핵심 규칙

- 프로젝트는 publishedAt 내림차순으로 관리한다.
- 카테고리 첫 진입은 가장 최신 프로젝트를 기준으로 한다.
- 로딩 타이머는 외부 폰트 로딩 여부와 무관하게 최초 표시 기준 3000ms로 고정한다.
- 300ms 폰트 셔플은 로딩 화면 내부 텍스트에만 적용한다.
- About Me 셔플은 매 1px 이동마다 실행하지 않고 32px 이상 이동 및 400ms 쿨다운을 모두 만족할 때만 실행한다.
- 최초 로드, 새로고침, category hash 이동 모두 scrollTop 0에서 시작한다.
- Gallery 자동 이동은 800ms를 기준으로 하며 reduced motion에서는 자동 이동을 멈추고 첫 슬라이드를 표시한다.
- 프로젝트 이미지·영상이 없을 때는 빈 화면 대신 명시적인 슬롯 안내를 표시한다.
- 실제 자산이 연결되면 슬롯 내부의 이미지·영상만 교체하며 레이아웃과 동작 규칙은 유지한다.
- 자산이 없는 현재 상태에서는 상세 페이지의 최신 프로젝트 슬롯을 기준으로 이전/다음 썸네일을 비활성 상태로 표시한다.

### 저장·외부 서비스

- 프로젝트 메타데이터와 미디어 경로는 추후 정적 데이터로 연결한다.
- 현재 공개 자산은 public/portfolio-favicon.png, public/yehyun_logo.png만 사용한다.
- 폰트는 외부 CDN과 시스템 폴백을 사용한다.
- 백엔드, API 키, 인증 토큰, 비공개 저장소 연동은 사용하지 않는다.

### 의존성·앱 시작

- npm, React, Vite 없이 표준 정적 웹앱으로 실행한다.
- 브라우저는 index.html에서 styles.css와 app.js를 직접 로드한다.
- app.js는 DOM에 이미 존재하는 마크업을 제어하고 새 화면 HTML을 생성하지 않는다.
- GitHub Pages workflow는 index.html, styles.css, app.js, public/을 artifact로 복사한다.

## 레퍼런스 기반 시각 설계

### 디자인 토큰

- GNB 핑크: #f09aa7
- 히어로 크림: #fbf8ea
- Film 밴드 회색: #e9eef1
- 메인 텍스트: #131313
- 카드 파스텔: 하늘색, 코발트, 라일락, 라이트 피치
- 버튼 블루: #6395ff
- 기본 모서리: 큰 프레임 32px, 카드 20px, 버튼 pill
- 기본 여백: 24px 단위, 넓은 섹션은 96~160px
- 폰트: Wanted Sans를 기본으로 사용하고 기존 폰트 셔플 목록을 유지
- Gallery 자동 슬라이드: 800ms interval, transform 기반 translateX, prefers-reduced-motion 대응

### 화면 순서

1. 분홍색 GNB: 실제 YeHyun 로고와 UX/UI, Graphic, Video 이동 버튼
2. 크림색 GalleryHero: 중앙 회색 프레임과 장식 코너, 800ms 자동 이동 슬라이드
3. UX/UI 레일: 큰 대표 슬롯과 우측 보조 슬롯, View More 이동 버튼
4. Film/Video 레일: 회색 밴드 안의 가로 카드 목록과 View More 버튼
5. About: 왼쪽 스킬/도구 목록, 오른쪽 Yang Ye Hyun 이력서 카드, Project File 슬롯
6. 하단 장식 밴드와 최상단 이동 버튼
7. 카테고리 상세: 상단 GNB, 중앙 제목·제작 기간, 좌우 작은 이전/다음 썸네일, 상세 본문, 하단 이동 버튼

### 구현 경계

- 화면의 제목, 버튼, 안내 문구, 섹션 구조는 HTML에 직접 작성한다.
- 색상, 프레임, 레일, 카드, 반응형 배치, hover/focus, 로딩 모션은 CSS로 관리한다.
- JS는 data-route, data-action 버튼 동작, hashchange, scroll reset, Gallery 자동 슬라이드, 로딩 타이머, 폰트 셔플만 관리한다.
- 이미지·영상이 없는 상태에서 임의의 작품 이미지를 만들지 않는다. CSS 슬롯은 미디어가 들어갈 위치와 비어 있는 상태를 보여주는 용도다.
- 같은 표현을 여러 곳에 복사하지 않고 공유 클래스와 토큰으로 관리한다.

## Process Phase와 Gate

### Phase A — 기준선 확인과 계획 갱신

- 최신 main과 drill 상태, keep 백업, static entry point를 확인한다.
- 이번 scroll reset, Gallery interval, category detail 변경을 이 문서에 먼저 기록한다.

Gate A:
- keep가 리뉴얼 전 main SHA를 보존한다.
- drill이 main 기준에서 작업 가능한 상태다.
- 변경 파일 범위가 index.html, styles.css, app.js, 문서로 제한된다.

### Phase B — 정적 HTML 구조

- Gallery에 3개 이상의 슬라이드 슬롯과 현재 슬라이드 표시 구조를 둔다.
- category 상세 상단에 이전/다음 썸네일 버튼, 중앙 제목·기간을 둔다.
- 상세 본문과 하단 이전/다음 버튼을 HTML에 직접 배치한다.
- 최신 작업물 슬롯을 첫 항목으로 고정한다.

Gate B:
- JS 없이도 첫 Gallery 슬라이드와 category 최신 상세 구조가 DOM에 존재한다.
- 화면 생성용 innerHTML과 런타임 템플릿 의존성이 없다.
- 썸네일은 본문을 가리지 않을 정도의 고정 크기다.

### Phase C — CSS 표현

- Gallery rail은 overflow hidden과 transform transition으로 오른쪽에서 왼쪽으로 이동한다.
- category 상단은 중앙 정렬 제목과 양옆 소형 썸네일 구조로 만든다.
- 상세 본문과 하단 navigation은 기존 색상 체계를 유지한다.
- 모바일에서 제목·썸네일·본문이 겹치거나 가로 overflow가 생기지 않도록 한다.

Gate C:
- 800ms interval에 맞는 이동 전환이 시각적으로 자연스럽다.
- 카테고리 상세의 제목/기간/썸네일/본문/하단 버튼이 모두 보인다.
- 반복 스타일은 공유 토큰과 클래스만 사용한다.
- 이전 레이아웃의 zombie CSS를 남기지 않는다.

### Phase D — 동작 검증

- 앱 시작 직후와 hash route 변경 시 scrollTop 0을 적용한다.
- Gallery controller를 800ms interval로 시작하고 마지막에서 첫 항목으로 순환한다.
- reduced motion에서는 Gallery 자동 interval을 생략한다.
- 카테고리 route는 UX/UI, Graphic, Video를 유지하고 최신 슬롯을 첫 화면에 표시한다.

Gate D:
- node --check app.js 통과
- 800ms 설정과 right-to-left 순환 코드 확인
- 새로고침·홈 이동·category 이동 모두 최상단 시작
- 주요 버튼과 route에 콘솔 오류가 없음

### Phase E — 배포와 실서비스 검증

- drill에 직접 커밋한다.
- verify workflow를 통과시킨다.
- drill에서 main으로 PR을 생성·병합한다.
- Pages build/deploy와 실제 URL 응답을 확인한다.

Gate E:
- verify 성공
- PR 병합 성공
- Pages build/deploy 성공
- 실제 URL에서 새 HTML/CSS/JS가 200 응답
- 브라우저 도구가 가능하면 scroll reset, Gallery 자동 이동, 상세 레이아웃을 확인
- 브라우저 도구가 불가능하면 HTTP/Actions 검증과 브라우저 미검증을 분리 보고

## 실패 시 재수정 Loop

Gate가 실패하면 실패한 계층만 원인 방향으로 수정한다.

1. HTML이 비어 있거나 선택자가 없으면 index.html의 정적 구조만 수정한다.
2. Gallery가 움직이지 않으면 slide track 선택자와 transform transition만 수정한다.
3. 카테고리 레이아웃이 깨지면 category CSS와 반응형 규칙만 수정한다.
4. scroll reset 오류는 route 상태와 scrollTo 호출 시점만 수정한다.
5. JS 오류면 화면 마크업을 JS로 옮기지 않고 이벤트·상태 코드만 수정한다.
6. verify 실패면 로그의 첫 원인만 고친 뒤 같은 workflow를 재실행한다.
7. Pages 실패면 artifact 복사 경로와 Pages 설정을 확인한다.
8. 브라우저 런타임이 불가능하면 정적 HTTP와 Actions 검증을 먼저 완료하고, 브라우저 미검증을 성공으로 표현하지 않는다.

## 검증 절차

- 파일 목록에서 React/Vite 파일과 패키지 의존성 부재 확인
- node --check app.js
- 정적 HTML에 GNB, GalleryHero slide track, UX/UI, Film/Video, About, category 상세 존재 확인
- app.js에 innerHTML, ES module import가 없는지 확인
- scrollTo(0, 0), 800ms Gallery interval, right-to-left transform 조건 확인
- 로딩 최초 표시 기준 3000ms와 300ms 셔플 확인
- hash 홈/category 이동과 버튼 동작 확인
- category 최신 프로젝트가 첫 상세 상태인지 확인
- About Me 포인터 32px 이동·400ms 쿨다운 확인
- desktop/mobile에서 overflow, clipping, focus, reduced-motion 확인
- Actions verify와 Pages deploy 결과 확인
- 실제 배포 URL의 HTML, CSS, JS, favicon, logo HTTP 200 확인
- API 키, 토큰, 비공개 식별자 노출 여부 확인

## 자산 연결 규칙

실제 이미지·영상 제공 전에는 미디어 슬롯을 유지하고 임의 작품 이미지를 생성하지 않는다. 자산이 추가되면 제목, 제작 기간, 설명, 역할, 기여 내용, publishedAt, media 경로를 함께 연결하며 최신순 규칙을 유지한다.

## 변경 이력

### 2026-08-11 모션·정적 웹앱 전환

- 로딩 최초 표시 기준을 3000ms, 로딩 폰트 셔플을 300ms로 유지했다.
- About Me 폰트 셔플은 32px 포인터 이동과 400ms 쿨다운을 사용한다.
- 화면 마크업을 index.html, 표현을 styles.css, 동작을 app.js로 분리했다.
- 실제 이미지·영상은 추후 제공으로 유보했다.

### 2026-08-11 레퍼런스 기반 시각 리뉴얼

- keep 백업 브랜치를 현재 main 커밋에서 생성한다.
- 로딩 이후 화면을 분홍 GNB, 크림색 GalleryHero, 가로 작업물 rail, Film/Video 회색 밴드, About resume 카드, 하단 장식 밴드로 재구성한다.
- 미디어가 없는 상태를 명시적 슬롯으로 표현하고, 추후 자산 삽입 시 HTML/CSS 구조를 재사용한다.
- JS의 역할은 버튼 작동, 해시 페이지 이동, 로딩/폰트 셔플, 최상단 이동으로 제한한다.

### 2026-08-11 scroll·Gallery·category detail 조정

- 최초 접속, 재접속, 홈 이동, category 이동 시 스크롤을 최상단으로 재설정한다.
- Gallery hero를 800ms 간격의 우→좌 자동 순환 슬라이드로 확장한다.
- 카테고리 상세를 중앙 제목·제작 기간, 좌우 소형 썸네일, 본문 상세, 하단 이전/다음 버튼 형식으로 정리한다.
- 실제 작업물 데이터가 없으므로 최신 작업물 슬롯을 첫 상태로 유지하고 이전/다음 썸네일은 비활성 슬롯으로 표시한다.


### 2026-08-11 Gallery banner visual refinement

#### 문제별 수정 계획

1. 중앙 배너의 전체 외곽선을 제거하고 네 모서리의 꺾인 라인 오브젝트만 유지한다.
2. 배너 내부의 회색 미디어 영역은 레퍼런스와 같은 비율과 여백을 유지한다.
3. GALLERY 제목은 배너를 설명하는 주제목이 아니라 장식 요소이므로 현재 크기에서 축소하고 하단 중앙에 배치한다.
4. 검은 타원, 작은 점 배열, 휴대폰을 든 손 형태를 Gallery의 고정 페이지네이션 오브젝트로 배치한다.
5. 슬라이드가 바뀌어도 페이지네이션 오브젝트는 항상 배너 하단 중앙에 남도록 HTML/CSS에서 슬라이드 트랙과 분리한다.
6. 실제 작업물 이미지는 아직 없으므로 페이지네이션 오브젝트는 CSS 기반 장식으로 구성하고, 추후 미디어가 추가되어도 배너 구조를 변경하지 않는다.

#### 계층별 범위

- 화면: index.html의 gallery frame, gallery track, pagination ornament, GALLERY decoration
- 처리: 기존 app.js의 800ms Gallery track 이동만 유지하고 pagination ornament에는 상태 의존성을 추가하지 않음
- 핵심 규칙: 전체 테두리 금지, 모서리 라인만 표시, GALLERY는 축소, pagination은 고정
- 저장·외부 서비스: 새 외부 자산과 비밀정보를 추가하지 않음
- 의존성·앱 시작: 기존 정적 HTML/CSS/JS와 GitHub Pages artifact 경로 유지

#### Process Phase와 Gate

- Phase A — 기준선: 현재 Gallery HTML/CSS/800ms JS를 확인한다.
- Phase B — HTML: 슬라이드 트랙과 페이지네이션 오브젝트의 책임을 분리한다.
- Phase C — CSS: 프레임 코너 라인, 회색 배너, 하단 타원·점·손/휴대폰 장식을 레퍼런스 비율로 조정한다.
- Phase D — 동작: 슬라이드 이동 중 페이지네이션이 고정되고 800ms 간격이 유지되는지 확인한다.
- Phase E — 배포: drill 검증, PR 병합, Pages build/deploy, 실제 HTTP 응답을 확인한다.

Gate 조건:

- 배너 중앙 영역에 사방을 두르는 border가 없다.
- 네 모서리 라인만 보인다.
- GALLERY가 배너보다 작고 하단 장식 역할을 한다.
- 검은 타원·점·손/휴대폰 오브젝트가 모든 슬라이드에서 같은 위치에 있다.
- 800ms 슬라이드 동작과 reduced-motion 대응이 깨지지 않는다.
- 정적 HTML/CSS/JS 구조와 로고·파비콘 경로가 유지된다.

#### 실패 시 재수정 Loop

1. 전체 테두리가 보이면 hero-media-slot의 border/overflow와 frame pseudo-element를 확인한다.
2. 코너가 잘리면 슬라이드 track의 overflow와 frame 장식의 overflow 책임을 분리한다.
3. GALLERY가 크면 font-size와 margin만 조정한다.
4. pagination이 움직이면 track 내부에 들어간 장식을 frame 바깥 고정 요소로 이동한다.
5. JS 실패는 app.js의 기존 Gallery 이동 로직만 점검하고 화면 마크업을 JS로 옮기지 않는다.
6. 검증 실패 시 원인 계층만 수정한 뒤 같은 Gate를 재실행한다.

#### 검증 절차

- index.html에 gallery-track과 독립 pagination ornament가 존재하는지 확인
- styles.css에 배너 전체 border가 없고 코너 pseudo-element만 있는지 확인
- GALLERY 장식 크기와 하단 위치 규칙 확인
- black oval, pagination dots, hand-phone ornament의 고정 위치 확인
- app.js의 800ms interval, transform 이동, reduced-motion 조건 확인
- node --check app.js 및 verify workflow 확인
- Pages URL의 HTML/CSS/JS 200 응답 및 정적 문자열 확인

### 2026-08-12 Bootstrap 정적 연결 및 아이콘 표준화

#### 문제별 수정 계획

1. 현재 정적 HTML/CSS/JavaScript 구조를 유지하면서 Bootstrap 5.3.8 CSS를 CDN으로 연결한다.
2. Bootstrap Icons 1.13.1을 CDN으로 연결하고 기능성 화살표·이동 아이콘을 아이콘 폰트로 통일한다.
3. Bootstrap CSS는 기존 styles.css보다 먼저 로드하고, 기존 고유 시각 규칙은 styles.css에서 재정의한다.
4. 기존 GNB, Gallery 장식, 카드, 이력서, 로딩 화면의 시각 방향과 동작을 Bootstrap 기본값 때문에 변경하지 않는다.
5. Bootstrap JavaScript, npm, React, Vite, 빌드 도구는 추가하지 않는다. 현재 페이지에는 Bootstrap JS 컴포넌트가 필요하지 않다.
6. Bootstrap으로 대체할 수 없는 로고·파비콘·Gallery 손/휴대폰·타원 장식은 기존 정적 자산과 CSS를 유지한다.
7. Bootstrap CSS에는 버전과 공식 SRI 무결성 값을 고정하고, Bootstrap Icons는 공식 고정 버전 HTTPS CDN URL을 사용한다. API 키·토큰·비공개 식별자는 추가하지 않는다.
8. 사용하지 않는 Bootstrap 클래스나 중복 아이콘 표현을 남기지 않는다.

#### 계층별 범위

- 화면: index.html의 Bootstrap CSS·Icons link, 버튼 아이콘, 필요한 Bootstrap 유틸리티 클래스
- 처리: app.js의 route·loading·Gallery·scroll·font 동작은 변경하지 않음
- 핵심 규칙: 기능성 아이콘은 Bootstrap Icons 사용, 고유 장식은 CSS 유지, 기존 route와 타이밍 보존
- 저장·외부 서비스: jsDelivr의 고정 버전 Bootstrap CSS와 Bootstrap Icons만 추가
- 의존성·앱 시작: Bootstrap CSS → Bootstrap Icons → 기존 styles.css → defer app.js 순서 유지

#### Process Phase와 Gate

- Phase A — 기준선 및 브랜치: 최신 main을 기준으로 drill을 재구성하고 기존 변경 이력을 보존 확인한다.
- Phase B — 계획 선커밋: 이 Bootstrap 범위와 검증 기준을 implementation-plan.md에 먼저 기록한다.
- Phase C — 의존성 연결: Bootstrap CSS와 Icons CDN link를 index.html head에 추가하고 SRI를 고정한다.
- Phase D — 아이콘·유틸리티 적용: GNB, View More, TOP, 이전/다음의 기능성 화살표를 Bootstrap Icons로 교체한다. 기존 고유 레이아웃 클래스는 유지한다.
- Phase E — 정적 검증: HTML 참조, JavaScript 문법, Bootstrap link 순서, 기존 동작 문자열, 비밀정보 노출 여부를 확인한다.
- Phase F — CI·Pages 검증: drill workflow, PR workflow, main 병합, Pages 배포와 실제 HTTP 응답을 확인한다.

Gate A:
- drill이 현재 main commit에서 시작한다.
- 열린 이전 PR이 없고 작업 대상 파일 범위가 확인된다.
- main과 keep를 작업 중간에 변경하지 않는다.

Gate B:
- 문서가 구현보다 먼저 drill에 커밋된다.
- 문서에 외부 의존성, 아이콘 범위, 보안 정책, 실패 Loop, 검증 절차가 기록된다.

Gate C:
- Bootstrap 5.3.8 CSS link가 styles.css보다 앞선다.
- Bootstrap Icons 1.13.1 link가 존재한다.
- Bootstrap CSS는 HTTPS와 공식 SRI를 사용하고, Bootstrap Icons는 공식 고정 버전 HTTPS URL을 사용한다. Icons 공식 CDN 사용 예에는 SRI 값이 제공되지 않으므로 임의의 hash를 추가하지 않는다.
- Bootstrap JS, Popper, npm, React, Vite를 추가하지 않는다.

Gate D:
- GNB, View More, TOP, 이전/다음 기능성 화살표가 Bootstrap Icons로 표시된다.
- Gallery 장식과 실제 로고·파비콘은 기존 표현을 유지한다.
- 로딩 3000ms, 로딩 셔플 300ms, About 32px/400ms, Gallery 800ms, reduced-motion, hash route, scroll reset이 유지된다.
- Bootstrap 기본값으로 모바일 overflow, focus, disabled 상태, 카드 간격이 깨지지 않는다.

Gate E:
- node --check app.js 통과
- verify workflow 통과
- Bootstrap link 순서·SRI·금지 의존성 검사 통과
- API 키·토큰·비공개 식별자 없음
- 정적 HTML/CSS/JS와 PNG asset 응답 확인

Gate F:
- drill 기준 검증 성공
- main 대상 PR 생성 및 병합 성공
- Pages build/deploy 성공
- 실제 Pages URL의 index.html, styles.css, app.js, Bootstrap CDN link, logo, favicon HTTP 응답 확인
- 브라우저 검증 가능 시 홈·카테고리·아이콘·반응형·reduced-motion을 확인하고, 불가능하면 브라우저 검증 unavailable로 분리 보고

#### 실패 시 재수정 Loop

1. 문서가 먼저 커밋되지 않았으면 구현 커밋을 중단하고 문서 커밋부터 만든다.
2. Bootstrap CDN 또는 SRI가 잘못되면 공식 Bootstrap 문서의 동일 버전 link와 무결성 값을 다시 대조한다.
3. Bootstrap 기본값이 기존 디자인을 덮으면 link 순서를 유지한 채 styles.css의 원인 선택자만 수정한다.
4. 아이콘이 보이지 않으면 Bootstrap Icons link, icon class, aria-hidden과 대체 텍스트만 점검한다.
5. 레이아웃이 깨지면 Bootstrap 유틸리티를 제거하거나 기존 고유 클래스와 충돌하는 최소 규칙만 수정한다.
6. 기존 동작이 깨지면 app.js를 Bootstrap JS로 옮기지 않고 기존 상태·이벤트 계층만 복구한다.
7. verify 실패 시 로그의 첫 원인에 해당하는 파일만 수정하고 같은 Gate를 재실행한다.
8. Pages 실패 시 artifact 복사 대상과 link 경로를 확인한다.
9. 브라우저 확인이 불가능하면 HTTP·Actions 성공과 브라우저 미검증을 분리 기록한다.

#### Bootstrap 연결 및 정적 유지 규칙

- Bootstrap CSS는 CDN으로만 연결하며 저장소에 npm lockfile이나 빌드 결과물을 추가하지 않는다.
- Bootstrap Icons는 기능성 이동 아이콘에만 사용한다.
- 기존 텍스트 라벨은 아이콘만으로 의미가 사라지지 않도록 유지하거나 접근성용 텍스트를 함께 둔다.
- 장식용 CSS 도형을 Bootstrap 아이콘으로 억지로 치환하지 않는다.
- styles.css는 Bootstrap의 보조 계층이며, 포트폴리오 고유 토큰·레이아웃·모션의 source of truth로 유지한다.
- CDN 장애 시에도 정적 HTML과 기존 CSS만으로 핵심 화면이 표시되도록 Bootstrap에 핵심 레이아웃을 의존시키지 않는다.

#### 검증 절차

- 문서 선커밋 SHA 확인
- index.html의 Bootstrap CSS → Bootstrap Icons → styles.css 순서 확인
- Bootstrap CSS 버전·SRI 문자열과 Bootstrap Icons 고정 버전 URL 확인
- node --check app.js
- Bootstrap JS, Popper, npm, React, Vite 참조 부재 확인
- 기능성 화살표의 Bootstrap Icons class 확인
- 기존 route, timer, Gallery, reduced-motion, scroll reset 관련 문자열 보존 확인
- workflow의 정적 entry point 검사 통과
- GitHub Actions 결과와 PR 상태 확인
- Pages URL의 HTML/CSS/JS/asset HTTP 응답 확인
- 브라우저에서 아이콘 표시, 버튼 동작, 포커스, 모바일 overflow 확인
