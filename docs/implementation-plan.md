# Interactive Portfolio 구현 계획

- 기준일: 2026-08-12 (KST)
- 저장소: hwahyo-o/yehyun_portfolio
- 작업 브랜치: drill
- 정적 호스팅: GitHub Pages 유지
- 서버 API: 별도 Cloudflare Worker
- 인증: Firebase Authentication 이메일·비밀번호 관리자 로그인
- 데이터베이스: Cloudflare D1
- 원본 백업: 관리자 Google Drive의 Portfolio-con
- 공개 금지: PIN, 비밀번호 원문, OAuth client secret, refresh token, Firebase Admin 비밀키, GitHub/Cloudflare 토큰은 저장소와 정적 배포 파일에 기록하지 않는다.

## 1. 목표와 현재 기준선

현재 앱은 index.html, styles.css, app.js, public/ 자산으로 구성된 정적 포트폴리오다. 기존 Gallery, 로딩 화면, About, UX/UI, Film/Video, 카테고리 상세, 800ms Gallery loop, reduced-motion, Bootstrap CSS/Icons 연결은 유지한다.

이번 작업은 현재 레이아웃의 콘텐츠 순서를 유지하면서 다음 기능을 추가한다.

- 분석서의 라벤더 중심 Light/Dark 디자인 토큰
- 기존 콘텐츠 뒤의 Community와 Contact
- 관리자 Firebase 이메일·비밀번호 인증
- 게시물·업데이트·Guestbook·DM·휴지통을 위한 D1 API
- 이미지·동영상의 Google Drive 백업 및 Worker 미디어 프록시 표시
- HTML/CSS/JS 원본의 GitHub Content 정적 배포와 Google Drive 백업
- 관리자 게시물 작성·수정·삭제 및 업로드 상태 관리

## 2. 계층 설계

### 화면

- 기존 GNB, GalleryHero, UX/UI, Film/Video, About, CategoryPage
- Community: Update Log, Guestbook, 답글, 페이지네이션
- Contact: Email, Direct Message
- 관리자 로그인, 관리자 작성/수정 모달, 휴지통, Drive 연결 상태
- 게시물 상세와 sandbox 작품 미리보기
- 이미지·동영상은 /api/media/{postId}/{mediaId} URL로 표시

### 처리

- app.js: 화면 상태, hash route, theme, API 요청, polling, 모달, 미디어 manifest
- Worker: CORS, Firebase ID token 검증, D1 query, Google OAuth/Drive API, GitHub Content 커밋, 미디어 프록시
- 업로드 job: 검증 → GitHub Content 커밋 → Drive 백업 → D1 published 처리
- DM polling: 기본 5~10초, 숨김 탭에서는 중지
- 작품 미리보기: 로컬 상대 파일과 연결된 JavaScript만 sandbox에서 실행

### 핵심 규칙

- Firebase 로그인은 관리자만 사용한다. 방문자는 Google 로그인 없이 공개 콘텐츠를 이용한다.
- PIN은 사용하지 않는다. 기존 문서에 있던 PIN 값도 코드·문서에 재기록하지 않는다.
- 공개·비공개 필터는 UI가 아니라 Worker/D1에서 강제한다.
- Guestbook 비밀번호는 원문 저장 없이 salted hash로 저장한다.
- 게시물 삭제는 soft delete 후 7일 뒤 purge 대상으로 만든다.
- 업로드 경로는 Content/**만 허용한다.
- 파일명과 경로는 path traversal, 제어문자, 외부 URL을 차단한다.
- 외부 script, iframe, object, embed와 외부 네트워크를 작품 미리보기에서 차단한다.
- GitHub Content에는 HTML/CSS/JS와 media-manifest.json만 저장하고 대용량 이미지·동영상 원본은 저장하지 않는다.
- 같은 날짜의 Google Drive 게시물 충돌을 막기 위해 날짜 폴더 아래 게시물 slug 폴더를 만든다.
- 모든 KST 업로드 시간은 서버에서 결정한다. 브라우저 시간을 신뢰하지 않는다.

## 3. 저장 및 외부 서비스

### GitHub Content

게시물 하나는 다음 위치에 배포한다.

```
Content/YYYY-MM-DD_HH-mm-ss_KST/
  index.html
  style.css
  script.js
  media-manifest.json
```

HTML/CSS/JS는 GitHub Pages에서 정적으로 제공한다. 이미지·동영상은 manifest의 media API URL을 통해 Worker가 Google Drive에서 읽어 반환한다. Worker의 GitHub 쓰기 권한은 Content/** 경로와 필요한 최소 contents 권한으로 제한한다.

### Google Drive

관리자가 Firebase 로그인 후 Google OAuth로 Drive를 연결한다.

```
Portfolio-con/
  YYYY-MM-DD/
    게시물 slug/
      원본 이미지
      원본 동영상
      index.html
      style.css
      script.js
```

Google Drive는 백업용이다. 브라우저에 Drive file ID, access token, refresh token을 노출하지 않는다. 초기 권한은 가능한 경우 drive.file로 제한한다. refresh token은 Worker 전용 암호화 저장소에 둔다.

### Cloudflare D1

핵심 테이블:

- users / admin_roles
- posts
- post_media
- updates
- guestbook_comments
- guestbook_replies
- guestbook_reactions
- conversations
- messages
- trash
- upload_jobs
- audit_logs

D1에는 파일 원본을 넣지 않고 GitHub 경로, Drive folder/file ID, MIME 타입, 크기, hash, 상태만 저장한다.

## 4. API 경계

공개 API:

- GET /api/posts
- GET /api/posts/:id
- GET /api/updates
- GET /api/guestbook
- POST /api/guestbook
- GET /api/media/:postId/:mediaId
- GET /api/conversations/:id/messages
- POST /api/conversations/:id/messages

관리자 API:

- POST/PATCH/DELETE /api/admin/posts
- POST/PATCH/DELETE /api/admin/updates
- DELETE/restore /api/admin/trash
- POST /api/admin/guestbook/:id/reply
- POST /api/admin/drive/connect
- POST /api/admin/upload-jobs
- GET /api/admin/audit-logs

모든 관리자 API는 Authorization Bearer Firebase ID token을 검증하고 관리자 권한을 확인한다. CORS는 GitHub Pages origin과 개발 origin만 허용한다.

## 5. 미디어 표시와 보안

Worker 미디어 프록시는 다음을 수행한다.

1. D1에서 게시물 공개 상태와 media ID를 확인한다.
2. 비공개이면 관리자 토큰을 요구한다.
3. 서버에 보관한 Drive OAuth 토큰으로 Drive 파일을 읽는다.
4. MIME, ETag, Cache-Control을 설정한다.
5. 이미지와 동영상의 Range 요청을 검증한다.
6. 동일 파일 반복 요청은 안전한 범위에서 캐시한다.

Drive 원본을 public 링크로 변경하지 않는다. Worker가 인증·공개 상태·파일 연결을 확인하는 단일 진입점으로 동작한다.

작품 미리보기는 sandbox iframe과 CSP로 격리한다. 단, 공개 GitHub Pages 경로의 원본 파일은 직접 URL로 열릴 수 있으므로 업로드 작품은 관리자 콘텐츠로 취급하고, 포트폴리오 내부 실행은 sandbox 경로를 우선 사용한다.

## 6. Process Phase와 Gate

### Phase A — 기준선·문서

- 최신 main과 drill 확인
- 이 문서 갱신 후 선커밋
- 변경 파일 범위 기록

Gate: 계획 문서가 구현보다 먼저 drill에 존재하고 비밀값이 없다.

### Phase B — 디자인 시스템·화면

- 최대 너비 1200px, 좌우 여백 20px
- 라벤더 CSS 변수와 Light/Dark
- 기존 화면 순서 유지
- Community·Contact 추가
- Bootstrap CSS/Icons와 고유 CSS 책임 분리
- 모바일 메뉴와 반응형

Gate: 기존 Gallery·로딩·About·카테고리 동작이 유지되고 새 섹션이 모바일에서 overflow를 만들지 않는다.

### Phase C — D1·Worker 골격

- migration
- 공개 조회 API
- 관리자 토큰 검증 경계
- CORS와 error envelope
- pagination

Gate: 브라우저가 D1에 직접 접근하지 않고 Worker만 사용한다.

### Phase D — Firebase 관리자 인증

- 이메일·비밀번호 로그인
- Firebase ID token 검증
- admin role 확인
- PIN 관련 코드 부재 검사

Gate: 비로그인 사용자의 관리자 API 요청이 UI 우회 여부와 무관하게 거부된다.

### Phase E — 게시물·Content 배포

- 업로드 파일 검증
- 한국시간 Content 폴더 생성
- HTML/CSS/JS/manifest 커밋
- D1 upload job 기록
- Pages 배포

Gate: Worker가 Content/** 이외의 파일을 생성·수정하지 않는다.

### Phase F — Google Drive 백업·미디어 프록시

- Portfolio-con 생성
- 날짜/게시물 폴더 생성
- 원본 파일 resumable upload
- D1 Drive ID 기록
- media proxy와 공개 상태 검사
- 캐시·Range 검증

Gate: 이미지·동영상이 GitHub 대용량 파일 없이 화면에 표시되고 비공개 파일은 인증 없이 조회되지 않는다.

### Phase G — Community·Contact

- Guestbook hash/pagination/reply
- DM polling
- 업데이트 로그
- Email mailto
- 좋아요·조회수·휴지통

Gate: 여러 브라우저에서 D1 상태가 공유되고 rate limit과 비밀번호 원문 미저장이 확인된다.

### Phase H — 통합·배포

- node --check
- HTML/static checks
- secret scan
- API tests
- Actions
- Pages HTTP
- Worker HTTP
- 실제 브라우저 DOM/console/interaction

Gate: CI, HTTP, 브라우저 결과를 각각 분리 기록하고 모두 필요한 조건을 통과한다.

## 7. 실패 시 재수정 Loop

- 디자인 실패: CSS와 markup 계층만 수정
- API 실패: Worker/D1만 수정
- 인증 실패: token/role 검증만 수정
- Drive 실패: OAuth/upload job만 수정
- GitHub 실패: Content 경로와 commit 작업만 수정
- 미디어 실패: manifest/proxy/cache/Range만 수정
- 배포 실패: workflow와 secret binding만 수정

각 실패는 첫 원인만 수정한 뒤 동일 Gate를 재실행한다. 비밀값을 코드에 삽입하거나, UI만 숨겨 권한 문제를 해결하지 않는다.

## 8. 검증 절차

정적:

- index.html, styles.css, app.js, public 자산 검사
- Bootstrap link 순서와 SRI 확인
- node --check app.js
- React/Vite/npm 의존성 부재 확인
- PIN·password·private_key·client_secret·Cloudflare token 패턴 검사
- Content 경로 allowlist 검사

서버:

- D1 migration
- 공개/비공개 API
- Firebase token 만료·audience·issuer
- 관리자/비관리자 권한
- CORS
- Guestbook hash
- DM polling
- Drive file ID 연결
- media cache와 Range

브라우저:

- Light/Dark
- 모바일 메뉴
- 기존 Gallery 800ms와 reduced-motion
- Community·Contact
- 이미지·동영상 표시와 재생
- 작품 sandbox
- 콘솔 오류와 네트워크 실패

## 9. 현재 상태와 제한

이번 구현은 drill에서 단계적으로 진행한다. Firebase 관리자 계정, Google OAuth client secret, Cloudflare Worker/D1 식별자와 secret은 사용자가 채팅으로 보내지 않아도 된다. 배포 연결에 필요한 값은 각 서비스의 Secret 설정에 직접 입력해야 한다.

비밀값이 설정되지 않은 상태에서는 정적 화면·D1/Worker 코드·OAuth 연결 코드·검증 workflow까지 구현할 수 있지만, 실제 Google Drive 백업과 Worker 운영 배포는 설정 Gate를 통과할 때까지 완료로 표시하지 않는다.

## 10. 최종 정리 조건

- drill 구현 및 검증
- main 대상 PR 생성
- CI와 Pages 배포 확인
- main 병합
- 실제 URL/Worker 확인
- 불필요한 브랜치 정리
- 최종 md 문서에 비밀값 없이 재현 가능한 운영 절차 기록


## 11. 2026-08-12 진행 기록

### 완료된 drill 변경

- 계획 문서를 현재 요구사항 기준으로 갱신했다.
- 기존 레이아웃을 유지한 Community와 Contact 화면을 추가했다.
- Light/Dark theme 토글과 localStorage 저장을 추가했다.
- API가 없는 상태에서도 화면이 깨지지 않는 offline fallback을 추가했다.
- D1 초기 스키마를 추가했다.
- Cloudflare Worker 공개 API, CORS, Firebase ID token/JWKS 검증, Guestbook hash, DM polling API 경계를 추가했다.
- Google Drive OAuth state, callback, refresh token 암호화 저장 흐름을 추가했다.
- Google Drive 미디어 프록시는 공개 게시물 권한과 Range 응답 헤더를 확인하도록 구성했다.
- GitHub Pages workflow가 Content 디렉터리를 artifact에 포함하도록 갱신했다.
- verify workflow가 Worker 문법과 비밀값 패턴을 함께 검사하도록 갱신했다.

### 현재 확인되지 않은 외부 상태

- Cloudflare Worker와 D1이 실제로 생성되었는지
- D1 migration이 실제 계정에 적용되었는지
- Google OAuth consent screen/client가 생성되었는지
- Worker secret이 등록되었는지
- Firebase Email/Password 관리자 계정과 admin_roles가 설정되었는지
- 실제 Worker URL로 API와 media proxy가 동작하는지
- GitHub Actions 결과가 연결된 현재 connector에서 반환되는지

### 다음 구현 전 운영 설정

사용자가 직접 외부 콘솔에서 다음을 완료해야 한다.

1. Cloudflare D1 database를 생성한다.
2. Cloudflare Worker를 생성하거나 GitHub 연동 배포를 준비한다.
3. Worker URL이 정해지면 `GOOGLE_REDIRECT_URI=https://<worker>/oauth/google/callback`을 설정한다.
4. Google Cloud Console에서 Drive API와 OAuth Web client를 설정한다.
5. Cloudflare Worker Secret에 OAuth client secret과 `GOOGLE_TOKEN_ENCRYPTION_KEY`를 등록한다.
6. Firebase Console에서 Email/Password를 활성화하고 관리자 계정을 만든다.
7. D1에 관리자 UID를 `admin_roles`로 등록한다.
8. Worker URL을 정적 앱의 non-secret API base 설정으로 연결한다.

비밀값은 채팅으로 전달하지 않고 각 콘솔의 Secret 입력란에 직접 입력한다.


## 12. 2026-08-12 관리자 운영 기능 추가

- 로그인 전에는 Admin 버튼만 표시하고, Worker에서 Firebase UID 권한 확인이 끝난 뒤 알림·설정·로그아웃을 표시한다.
- Firebase Auth local persistence를 사용해 명시적 로그아웃 전까지 세션을 유지한다.
- 설정 모달에서 Google Drive 연결 상태, 연결/연결 해제, 수동 백업, 백업 목록, 다운로드, 복원을 제공한다.
- 자동 백업은 관리자 페이지가 visible이고 인증된 동안 KST 00:00, 08:00, 16:00의 첫 2분 안에만 요청한다.
- Drive 백업은 `Portfolio-con/Backups/YYYY-MM-DD/`에 저장한다.
- 알림은 DM, Guestbook, share/reaction event, 백업/복원 이벤트를 D1에 기록한다.
- Guestbook 비밀번호는 Worker에서 PBKDF2 salted hash로 저장하고 수정·삭제 요청에서만 HTTPS body로 검증한다.
- D1 002 migration에 backups와 admin_notifications를 추가했다.
- admin_roles 등록은 최종 main 병합 직전 운영 migration Gate 이후로 보류한다.
