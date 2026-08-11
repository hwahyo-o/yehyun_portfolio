# YeHyun Portfolio 구현 계획

- 기준일: 2026-08-11 (KST)
- 저장소: hwahyo-o/yehyun_portfolio
- 초기 작업 브랜치: drill
- 구현 범위: 로딩 화면, 홈/이력서, 카테고리별 작업물 화면, 반응형 및 모션
- 제외 범위: 실제 이미지·영상 자산은 추후 제공 시 연결

## 확정 요구사항

1. 최초 화면 표시 시점부터 로딩 화면을 정확히 3초간 노출한다.
2. Portfolio와 2026 텍스트가 나타난 후 Portfolio 하이라이트가 왼쪽에서 오른쪽으로 채워진다.
3. 하이라이트 이후 Portfolio와 2026의 폰트를 300ms 주기로 셔플한다.
4. 로딩 종료 시 메인 화면으로 자연스럽게 페이드 전환한다.
5. 홈에는 YeHyun GNB, About Me, UX/UI·Graphic·Video 최신순 캐러셀, 최상단 이동을 둔다.
6. 카테고리 화면은 최신 작업물을 먼저 보여주고, 이전/다음 썸네일과 상세 내용을 제공한다.
7. 외부 폰트 로딩 지연은 2초를 연장하지 않으며, 실패 시 대체 폰트를 사용한다.
8. 실제 작업물 자산은 추후 연결하며 없는 자산을 임의로 생성하지 않는다.

## 계층 설계

### 화면
- LoadingScreen
- PortfolioShell
- HomePage
- CategoryPage
- ProjectDetail
- ProjectCarousel
- ScrollToTop

### 처리
- loading timeline controller
- font shuffle controller
- carousel drag/keyboard controller
- route transition controller
- media lazy-loading

### 핵심 규칙
- 프로젝트는 publishedAt 내림차순 정렬
- 카테고리별 최신 프로젝트가 첫 항목
- 로딩 타이머는 최초 표시 기준 3000ms 고정
- reduced motion에서는 효과를 즉시 또는 짧은 전환으로 축소
- 키보드 포커스와 버튼 의미를 유지

### 저장·외부 서비스
- 프로젝트 메타데이터는 정적 데이터 파일
- 작업물 미디어는 추후 제공되는 저장소 자산 경로
- 폰트는 외부 CDN과 시스템 폴백
- API 키와 비공개 식별자는 사용하지 않음

### 의존성·앱 시작
- 기존 저장소가 비어 있으므로 최소한의 정적 웹앱 구조로 시작
- 모션은 CSS와 작은 상태 컨트롤러를 우선 사용
- 앱 시작 후 로딩 화면을 먼저 마운트하고 3000ms 뒤 홈으로 전환

## 실행 단계와 Gate

1. 초기 구조: 실행 가능한 앱, 문서, 안전한 기본 스타일
2. 로딩: 텍스트·하이라이트·300ms 폰트 셔플·3000ms 전환
3. 홈: GNB, About Me, 캐러셀, 최상단 이동
4. 카테고리: 최신순 목록, 상세, 이전/다음 이동
5. 반응형·접근성: 모바일, 키보드, reduced motion
6. 검증: 빌드, 린트/테스트, 보안 점검, 브라우저 시각 검증
7. 배포: drill 커밋 확인 후 main 병합, 배포, 실서비스 확인, 불필요 브랜치 정리

## 실패 Loop

각 Gate 실패 시 실패한 표면의 원인을 기록하고 최소 범위만 수정한다. 같은 Gate를 다시 실행하며, 수정 범위가 넓어지면 회귀 검증을 처음부터 반복한다.

## 검증 절차

- 정적 검사와 프로덕션 빌드
- 로딩 화면의 최초 표시부터 3000ms 전환 확인
- 폰트 셔플 주기와 폴백 확인
- GNB와 카테고리 이동 확인
- 캐러셀 클릭·드래그·키보드 이동 확인
- 데스크톱 및 모바일 렌더링 확인
- 콘솔 오류, 빈 화면, 오버플로, 포커스 상태 확인
- 배포 후 실제 URL에서 동일 흐름 재확인

## 자산 연결 규칙

실제 이미지·영상 제공 전에는 프로젝트 데이터의 media 필드를 비워 둔다. 자산이 추가되면 제목, 제작 기간, 설명, 역할, 기여 내용과 함께 프로젝트 데이터에 연결한다. 비밀정보는 문서와 코드에 기록하지 않는다.

## 변경 이력

### 2026-08-11 모션 조정

- 로딩 화면의 최초 표시 기준 전환 시간을 3000ms로 조정했다.
- 로딩 폰트 셔플 주기를 300ms로 조정했다.
- About Me 폰트 셔플은 포인터 이동 거리 32px 이상과 400ms 쿨다운을 모두 만족할 때만 실행한다.


### 2026-08-11 파비콘·GNB 로고 자산 교체

- 기존 공개 저장소 `hwahyo-o/yehyun-s_Portfolio`의 원본 `img/favicon-96x96.png`를 `public/portfolio-favicon.png`으로 재사용했다.
- 기존 공개 저장소의 원본 `img/이름.png`를 `public/yehyun_logo.png`을 현재 GNB 원본 자산으로 사용한다.
- 기존 SVG 파비콘은 참조가 없어져 제거했으며, API 키·비공개 식별자는 추가하지 않았다.


## 2026-08-11 정적 웹앱 전환 계획

### 문제별 수정 계획

1. React JSX 런타임과 React 의존성을 제거하고 표준 HTML 문서, CSS 스타일시트, ES 모듈 JavaScript로 전환한다.
2. 화면 계층은 `index.html`의 시맨틱 마크업과 JS 템플릿 렌더링으로 분리한다.
3. 표현 계층은 `styles.css` 하나로 통합하고, 기존 로딩·하이라이트·반응형 규칙을 보존한다.
4. 처리 계층은 `app.js`의 작은 상태 컨트롤러로 통합한다. 해시 라우팅, 로딩 타이밍, 폰트 셔플, 캐러셀, 키보드·포인터 입력을 유지한다.
5. 정적 데이터는 `projects.js`로 유지하고, 실제 작업물 자산은 추후 연결한다.
6. 현재 저장소의 실제 로고 파일 `public/yehyun_logo.png`를 사용하며, 존재하지 않는 `yehyun-logo.png` 참조를 제거한다.
7. Vite와 React 패키지를 제거하고 GitHub Pages workflow는 정적 파일을 `dist`로 복사해 배포하도록 단순화한다.

### 계층별 목표

- 화면: `index.html`의 GNB, 로딩 화면, 홈, About Me, 작업 목록, 카테고리 상세 영역
- 처리: `app.js`의 상태 렌더링, 해시 라우팅, 3초 로딩, 300ms 셔플, 32px/400ms About Me 입력 제한
- 핵심 규칙: 카테고리별 최신순, 첫 진입 최신 작업물, 미디어 미제공 상태 보존, 접근성 속성 유지
- 저장·외부 서비스: `projects.js` 정적 메타데이터, `public/` 이미지 자산, 외부 웹폰트 CDN
- 의존성 연결·앱 시작: 브라우저가 `index.html`에서 `styles.css`와 `app.js`를 직접 로드하며 npm 런타임 의존성은 사용하지 않음

### Process Phase와 Gate

1. Phase A — 기준선 정렬: 최신 `main`을 `drill`에 반영하고 계획 문서를 먼저 갱신한다.
   - Gate A: 현재 이미지 자산, 라우팅, 모션 수치, Pages workflow를 확인한다.
2. Phase B — 정적 구조 전환: HTML/CSS/JS 파일을 만들고 React/Vite 파일과 의존성을 제거한다.
   - Gate B: `index.html` 직접 로드, JS 모듈 로드, 모든 주요 화면 템플릿 존재
3. Phase C — 기능 동등성: 로딩, 해시 라우팅, GNB, About Me, 캐러셀, 상세 이동을 연결한다.
   - Gate C: 기존 사용자 흐름과 키보드·포인터 입력이 동작하고 콘솔 오류가 없다.
4. Phase D — 반응형·접근성: 모바일 레이아웃, 포커스, reduced motion, 대체 폰트를 확인한다.
   - Gate D: 데스크톱·모바일에서 클리핑·빈 화면·오버플로가 없다.
5. Phase E — 배포 검증: 정적 workflow, PR, Pages artifact, 실제 URL을 검증한다.
   - Gate E: build/verify 성공, Pages 배포 성공, HTML·JS·CSS·favicon·logo 응답 200

### 실패 시 재수정 Loop

Gate 실패 시 실패한 계층만 원인 방향으로 수정한다. HTML 로딩 실패는 경로·마크업을, JS 실패는 모듈·상태 전이를, CSS 문제는 해당 반응형 규칙을, 배포 실패는 artifact 경로를 먼저 수정한 후 같은 Gate를 재실행한다. 구조 전환으로 인한 회귀가 확인되면 Phase B부터 다시 검증한다.

### 검증 절차

- 파일 목록에서 `.jsx`, React import, Vite plugin과 패키지 의존성 제거 확인
- 정적 workflow의 파일 복사와 Pages artifact 생성 확인
- 로딩 최초 표시부터 3000ms 전환, 300ms 폰트 셔플 확인
- 해시 홈·카테고리 라우팅, GNB 클릭, 이전·다음, 최상단 이동 확인
- About Me 포인터 32px 거리와 400ms 쿨다운 확인
- 실제 로고 `/yehyun_portfolio/yehyun_logo.png`와 favicon 응답 확인
- Browser 도구가 가능하면 DOM·콘솔·스크린샷·상호작용을 확인하고, 불가능하면 정적 HTTP와 workflow 증거를 분리 기록한다.
