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
- GNB, 이전/다음, 최상단 버튼의 이벤트 위임
- 브라우저가 JS를 실행하지 못해도 정적 HTML이 빈 화면이 되지 않도록 초기 화면을 HTML에 직접 포함

### 핵심 규칙

- 프로젝트는 publishedAt 내림차순으로 관리한다.
- 카테고리 첫 진입은 가장 최신 프로젝트를 기준으로 한다.
- 로딩 타이머는 외부 폰트 로딩 여부와 무관하게 최초 표시 기준 3000ms로 고정한다.
- 300ms 폰트 셔플은 로딩 화면 내부 텍스트에만 적용한다.
- About Me 셔플은 매 1px 이동마다 실행하지 않고 32px 이상 이동 및 400ms 쿨다운을 모두 만족할 때만 실행한다.
- prefers-reduced-motion에서는 애니메이션을 최소화한다.
- 버튼에는 의미 있는 라벨과 키보드 포커스를 유지한다.
- 프로젝트 이미지·영상이 없을 때는 빈 화면 대신 명시적인 슬롯 안내를 표시한다.
- 실제 자산이 연결되면 슬롯 내부의 이미지·영상만 교체하며 레이아웃과 동작 규칙은 유지한다.

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

### 화면 순서

1. 분홍색 GNB: 실제 YeHyun 로고와 UX/UI, Graphic, Video 이동 버튼
2. 크림색 GalleryHero: 중앙 회색 프레임과 장식 코너, 추후 대표 이미지가 들어갈 슬롯
3. UX/UI 레일: 큰 대표 슬롯과 우측 보조 슬롯, View More 이동 버튼
4. Film/Video 레일: 회색 밴드 안의 가로 카드 목록과 View More 버튼
5. About: 왼쪽 스킬/도구 목록, 오른쪽 Yang Ye Hyun 이력서 카드, Project File 슬롯
6. 하단 장식 밴드와 최상단 이동 버튼
7. 카테고리 상세: 상단 GNB, 중앙 제목·기간, 좌우 이전/다음 슬롯, 본문 미디어/설명, 하단 이동 버튼

### 구현 경계

- 화면의 제목, 버튼, 안내 문구, 섹션 구조는 HTML에 직접 작성한다.
- 색상, 프레임, 레일, 카드, 반응형 배치, hover/focus, 로딩 모션은 CSS로 관리한다.
- JS는 data-route, data-action 버튼 동작, hashchange, 로딩 타이머, 폰트 셔플만 관리한다.
- 이미지·영상이 없는 상태에서 임의의 작품 이미지를 만들지 않는다. CSS 슬롯은 미디어가 들어갈 위치와 비어 있는 상태를 보여주는 용도다.
- 같은 표현을 여러 곳에 복사하지 않고 공유 클래스와 토큰으로 관리한다.

## Process Phase와 Gate

### Phase A — 기준선과 백업

- 최신 main 커밋을 keep 브랜치에 그대로 보존한다.
- drill의 현재 정적 구조, 배포 workflow, favicon/logo, 모션 수치를 확인한다.

Gate A:
- keep가 리뉴얼 전 main SHA를 가리킨다.
- 현재 배포 경로와 필수 파일이 확인된다.
- 비밀정보가 새로 생기지 않는다.

### Phase B — 계획 문서와 HTML 화면 구조

- 이 문서를 먼저 갱신한다.
- 홈과 카테고리 상세 화면의 레퍼런스 기반 섹션을 정적 HTML로 배치한다.
- 작업물 미디어 슬롯과 추후 교체 가능한 data-media-slot 표식을 둔다.
- GNB와 기존 라우팅용 data-route 계약은 유지한다.

Gate B:
- JS가 실행되지 않아도 주요 홈 화면의 HTML이 존재한다.
- UX/UI, Graphic, Video/Film, About, Project File이 DOM에 존재한다.
- category page도 동일한 HTML/CSS 시스템을 사용한다.
- 화면 생성용 innerHTML과 런타임 템플릿 의존성이 없다.

### Phase C — CSS 리뉴얼

- 레퍼런스 색상과 구간별 배경 밴드를 토큰으로 정의한다.
- 중앙 갤러리 프레임, 가로 rail, card, about resume panel, footer rhythm을 구현한다.
- desktop과 mobile에서 rail overflow, 텍스트 줄바꿈, 버튼 포커스를 점검한다.
- 기존 로딩 화면의 하이라이트·페이드·reduced-motion 규칙은 보존한다.

Gate C:
- 시각 계층과 섹션 순서가 첨부 레퍼런스와 일치한다.
- 반복 스타일은 공유 토큰과 클래스만 사용한다.
- 불필요한 이전 레이아웃 규칙과 zombie CSS를 남기지 않는다.
- 모바일에서 가로 작업물 레일은 의도된 스크롤만 허용한다.

### Phase D — 동작 검증

- app.js는 로딩·폰트 셔플·해시 이동·최상단 버튼만 처리한다.
- static HTML을 JS가 다시 렌더링하지 않는지 검사한다.
- GNB, category hash, home logo, top 버튼, About 포인터 셔플을 확인한다.

Gate D:
- node --check app.js 통과
- 로딩 3000ms, 셔플 300ms, About 32px/400ms 수치 확인
- 주요 버튼이 콘솔 오류 없이 동작
- JS 실패 시에도 빈 화면이 아닌 정적 화면이 표시됨

### Phase E — 배포와 실서비스 검증

- drill에 직접 커밋한다.
- verify workflow를 통과시킨다.
- drill에서 main으로 PR을 생성·병합한다.
- GitHub Pages 배포 workflow와 실제 URL의 HTML/CSS/JS/자산 응답을 검증한다.
- drill과 keep은 사용자가 유지 요청한 브랜치이므로 보존하며, 그 외 불필요 브랜치만 확인 후 정리한다.

Gate E:
- verify 성공
- PR 병합 성공
- Pages build/deploy 성공
- 실제 URL에서 진입 HTML, CSS, JS, favicon, logo가 200 응답
- 브라우저 도구가 가능하면 스크린샷·콘솔·주요 상호작용까지 확인
- 브라우저 도구가 불가능하면 그 사실을 명시하고 HTTP/Actions 검증과 분리 보고

## 실패 시 재수정 Loop

Gate가 실패하면 실패한 계층만 원인 방향으로 수정한다.

1. HTML이 비어 있거나 경로가 틀리면 index.html 구조와 상대 경로만 수정한다.
2. CSS가 깨지면 해당 토큰·레이아웃·반응형 규칙만 수정한다.
3. JS 오류면 선택자·이벤트·hash 상태만 수정하고 화면 마크업을 JS로 이동하지 않는다.
4. verify 실패면 로그의 첫 원인만 고친 뒤 workflow를 재실행한다.
5. Pages 실패면 artifact 복사 경로와 Pages 설정을 확인한다.
6. 브라우저 런타임이 불가능하면 정적 HTTP와 Actions 검증을 먼저 완료하고, 브라우저 미검증을 성공으로 표현하지 않는다.
7. 구조 변경으로 회귀가 생기면 Phase B부터 Gate를 다시 통과시킨다.

## 검증 절차

- 파일 목록에서 React/Vite 파일과 패키지 의존성 부재 확인
- node --check app.js
- 정적 HTML에 GNB, GalleryHero, UX/UI, Film/Video, About, category 상세 존재 확인
- app.js에 innerHTML, ES module import가 없는지 확인
- 로딩 최초 표시 기준 3000ms와 300ms 셔플 확인
- hash 홈/category 이동과 버튼 동작 확인
- About Me 포인터 32px 이동·400ms 쿨다운 확인
- desktop/mobile에서 overflow, clipping, focus, reduced-motion 확인
- Actions verify와 Pages deploy 결과 확인
- 실제 배포 URL의 HTML, CSS, JS, favicon, logo HTTP 200 확인
- 브라우저 도구가 가능하면 레퍼런스와 최신 스크린샷을 비교하고, 불가능하면 해당 검증을 미실행으로 기록
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
