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


## 13. 2026-08-12 보안 경고 대응

- 공개 config.js에서 Firebase Web API Key와 Firebase 설정을 제거했다.
- 브라우저 Firebase SDK를 제거했다.
- 로그인·세션 검증을 Cloudflare Worker 인증 API로 이동했다.
- Firebase Web API Key는 Worker Secret FIREBASE_WEB_API_KEY로만 사용한다.
- Firebase refresh token은 Worker Secret SESSION_ENCRYPTION_KEY로 암호화해 D1 admin_sessions에 저장한다.
- 브라우저에는 HttpOnly·Secure·SameSite 쿠키만 전달하며 Firebase API Key, OAuth secret, refresh token, 암호화 키를 전달하지 않는다.
- D1 003_admin_sessions.sql과 기존 migration을 위한 수동 GitHub Actions 경로를 추가했다.
- GitHub Actions에는 D1 작업용 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID만 저장한다.
- 기존 Git 이력에 탐지된 Firebase 키는 코드에서 제거했지만, 실제 폐기·교체와 GitHub Secret Scanning 경고 종료는 사용자가 Google Cloud/GitHub에서 수행해야 한다.
- 관리자 등록은 여전히 최종 배포·검증 Gate 이후로 보류한다.

## 14. 2026-08-12 D1 완료 후 진행 기준

### 완료된 운영 Gate

- GitHub Actions `Apply D1 migrations` run #3 성공
- `001_initial.sql`, `002_admin_backups_notifications.sql`, `003_admin_sessions.sql` 순서 적용 성공
- 필수 테이블 검증 성공: `posts`, `admin_roles`, `backups`, `admin_notifications`, `admin_sessions`
- GitHub Pages main 배포 성공
- D1 Worker binding은 Cloudflare에서 완료된 것으로 확인

### 다음 우선순위

1. Worker 배포 workflow를 추가한다.
2. Worker `/health`, 인증, CORS, D1 연결을 실제 URL에서 검증한다.
3. Google OAuth Redirect URI와 Drive 연결을 실제 환경에서 검증한다.
4. Worker 검증이 끝난 뒤 D1 `admin_roles`에 관리자 UID를 비공개로 등록한다.
5. 관리자 CMS와 GitHub `Content/**` 업로드를 구현한다.
6. Google Drive `Portfolio-con/YYYY-MM-DD/게시물 slug/` 원본 백업과 미디어 프록시를 통합한다.
7. DM 관리자 답변, Guestbook 대댓글, share/reaction, 휴지통 만료 알림을 통합한다.
8. CI·HTTP·브라우저 검증을 분리 기록하고 최종 배포한다.

### Worker 배포 보안 규칙

- `CLOUDFLARE_API_TOKEN`은 D1 migration 전용, `CLOUDFLARE_WORKER_API_TOKEN`은 Worker 배포 전용으로 분리하고 둘 다 GitHub Actions Secret으로만 사용한다.
- Firebase Web API Key, Google OAuth Secret, refresh token, 암호화 키는 Worker Secret으로만 사용한다.
- Worker 설정 파일에는 공개 가능한 프로젝트 식별자와 D1 binding만 기록한다.
- workflow는 Worker 경로만 배포하며 정적 Pages 파일이나 `Content/**`를 변경하지 않는다.
- workflow 로그에 Secret 값을 출력하거나 검증용 echo를 추가하지 않는다.

### 이번 Phase Gate

- 계획 문서가 구현 커밋보다 먼저 갱신되어야 한다.
- Worker 배포 workflow에 Secret 값이 직접 포함되지 않아야 한다.
- `node --check worker/src/index.js`와 기존 정적 검증이 통과해야 한다.
- PR 검증 성공 후에만 main 병합한다.
- Worker 실제 URL의 `/health` 응답과 관리자 인증 실패 경계를 확인하기 전에는 admin role을 등록하지 않는다.

### 실패 시 Loop

- Account/API 인증 실패: GitHub Secret 이름·계정 범위·D1 Edit 권한만 재확인한다.
- Wrangler/설정 실패: workflow working directory와 비밀 없는 `wrangler.toml`만 수정한다.
- Worker 런타임 실패: 해당 API 경계만 수정하고 Pages 화면을 임의로 변경하지 않는다.
- Drive OAuth 실패: Redirect URI·OAuth secret·refresh token 저장 흐름만 수정한다.
- 각 수정 후 동일 Gate를 재실행하며 Secret 값은 로그와 문서에 남기지 않는다.

## 15. 2026-08-12 관리자 CMS·Content 업로드 Phase

### 범위

- 관리자 전용 게시물 작성·수정·soft delete API
- 게시물의 HTML/CSS/JS 파일 검증
- GitHub `Content/YYYY-MM-DD_HH-mm-ss_KST/<post-slug>/` 경로 생성
- HTML/CSS/JS와 `media-manifest.json`만 GitHub Content에 커밋
- Google Drive 백업은 원본 이미지·동영상과 원본 HTML/CSS/JS를 게시물별 폴더에 저장
- 업로드 작품 실행은 sandbox iframe과 상대 경로 파일만 허용

### 보안 경계

- GitHub 쓰기 토큰은 Worker Secret `GITHUB_CONTENT_TOKEN`으로만 저장한다.
- 토큰은 `Content/**` 경로의 Contents 쓰기만 허용하는 별도 GitHub App 또는 fine-grained token을 사용한다.
- 원본 파일명·slug·경로는 제어문자, `..`, 절대경로, 외부 URL을 거부한다.
- HTML의 `script src`, `link href`, 이미지·동영상 URL은 같은 업로드 폴더의 상대경로만 허용한다.
- `javascript:`, 외부 script, iframe, object, embed, form action, inline event handler는 거부하거나 sandbox에서 실행하지 않는다.
- 파일 크기·파일 수·MIME·UTF-8을 서버에서 검사하고 브라우저 제한은 보조 수단으로만 사용한다.
- GitHub에 대용량 이미지·동영상 원본은 커밋하지 않는다. Content에는 Worker 미디어 URL manifest만 기록한다.
- D1 write와 GitHub commit이 한 원자 트랜잭션이 아니므로 upload_jobs 상태를 `pending → committed → published`로 기록하고 실패 시 재시도 가능한 상태로 남긴다.

### Gate

- 계획 문서 선커밋
- 비밀값 없는 Worker 코드와 schema
- 비관리자 요청 401/403
- Content allowlist 외 경로 변경 불가
- 업로드 HTML 외부 실행 경로 차단
- PR CI와 보안 diff 검증 통과
- main 병합 후 Pages/Worker 배포 성공

## 16. 2026-08-12 Google Drive 원본·미디어 Phase

### 저장 규칙

`Portfolio-con/YYYY-MM-DD/<게시물 slug>/`에 다음을 저장한다.

- 원본 `index.html`
- 원본 `style.css`
- 원본 `script.js`
- 관리자 업로드 이미지·동영상 원본

GitHub `Content/**`에는 실행에 필요한 HTML/CSS/JS와 `media-manifest.json`만 커밋한다. 대용량 원본은 커밋하지 않는다.

### 처리 순서

1. 관리자 세션 확인
2. multipart 파일 수·MIME·크기 검증
3. Drive 폴더 생성 또는 재사용
4. 원본 파일과 미디어를 Drive에 업로드
5. D1 `post_media`에 Drive file ID 기록
6. HTML/CSS/JS의 허용된 상대 미디어 참조를 Worker 미디어 URL로 변환
7. GitHub `Content/**`에 실행 파일과 manifest 커밋
8. `posts`와 `upload_jobs`를 published 상태로 전환

Drive 업로드 또는 GitHub 커밋 중 하나가 실패하면 게시물을 published로 전환하지 않는다. Drive에 이미 저장된 파일은 삭제하지 않고 재시도 가능한 `upload_jobs.failed` 상태로 남긴다.

### 용량 정책

- 이미지: 파일당 최대 10MB
- 동영상: 파일당 최대 50MB
- 한 게시물 전체 미디어: 최대 80MB
- 게시물당 미디어 파일: 최대 20개
- 허용 MIME: `image/*`, `video/*`
- 브라우저 제한은 보조 수단이며 Worker가 최종 검증한다.


### 2026-08-12 업로드 용량 및 로그인 오류 정책

미디어는 이미지 최대 10개·총 100MB, 동영상 최대 5개·총 100MB, 혼합 총 120MB로 제한한다. HTML/CSS/JS 원본 바이트와 미디어 바이트를 합산한 게시물 전체 용량은 150MB를 넘을 수 없다.

### 2026-08-12 로그인 오류 표시 개선

관리자 로그인 실패 시 비밀번호나 토큰을 노출하지 않고 Worker가 반환한 안전한 오류 코드에 따라 권한 미등록과 인증 실패를 구분해 표시한다. Firebase 원문 오류와 Secret 값은 브라우저에 전달하지 않는다.

## 17. 2026-08-12 관리자 비밀번호 입력 보조

- 로그인 비밀번호는 기본적으로 `type=password`로 원문을 숨긴다.
- 눈 버튼은 현재 입력값을 유지한 채 `password`와 `text`만 전환한다.
- X 버튼은 입력값을 비우고 다시 비밀번호 숨김 상태를 유지한다.
- 두 버튼은 브라우저 내 입력 보조 기능이며 서버·D1·로그인 인증 규칙을 변경하지 않는다.
- 버튼은 키보드 접근 가능하고 `aria-label`, `aria-pressed`를 제공한다.
- 비밀번호 값은 DOM 외부 저장소, 로그, URL, localStorage에 기록하지 않는다.

### Gate

- 빈 입력·입력 중·로그인 실패·로그인 성공 후 상태 확인
- 눈 버튼 연속 전환 시 입력값 보존
- X 버튼 클릭/키보드 활성화 시 입력값 삭제
- 정적 검증과 Secret 패턴 검사 통과

## 18. 2026-08-12 로그인 Failed to fetch 수정

- Worker route의 관리자 로그인 호출은 반드시 `await`하여 route 내부 `try/catch`가 인증·입력·Secret 설정 오류를 JSON 응답으로 변환하도록 한다.
- 브라우저에는 Cloudflare 1101 원문 대신 안전한 `AUTH_FAILED`, `AUTH_NOT_CONFIGURED`, `FORBIDDEN` 코드와 사용자용 메시지만 전달한다.
- 로그인 API의 OPTIONS preflight와 POST 오류 응답 모두 GitHub Pages Origin CORS 헤더를 포함해야 한다.
- 인증정보·Firebase 원문 오류·Secret 값은 로그와 응답에 포함하지 않는다.

### Gate

- 빈 입력: 안전한 401 JSON
- 가짜 계정: 안전한 401 JSON
- CSRF 헤더 누락: 안전한 403 JSON
- 정상 관리자 계정: 세션 쿠키 발급
- OPTIONS preflight: 204와 CORS 헤더

## 19. 2026-08-12 관리자 로그인 서버 오류 진단

- Firebase 계정 존재 여부와 관리자 UID 등록 여부를 인증 흐름에서 분리한다.
- Firebase 인증 실패는 `AUTH_FAILED`로 반환한다.
- Firebase ID token 검증 실패는 `AUTH_TOKEN_VERIFY_FAILED`로 반환한다.
- 세션 암호화·D1 저장 실패는 `SESSION_STORE_FAILED`로 반환한다.
- Worker Secret 설정 오류는 `AUTH_NOT_CONFIGURED`로 반환한다.
- 모든 오류 응답에는 비밀번호, Firebase 원문 응답, API 키, 토큰, SQL 값이 포함되지 않는다.
- 브라우저는 안전한 사용자 메시지만 표시한다.

### Gate

- 빈 입력: 401 `AUTH_FAILED`
- 존재하지 않는 계정: 401 `AUTH_FAILED`
- 관리자 UID 미등록: 403 `FORBIDDEN`
- 세션 저장 실패: 503 `SESSION_STORE_FAILED`
- 성공 로그인: HttpOnly Secure 세션 쿠키와 200 응답

## 20. 2026-08-12 Firebase Google Provider 관리자 로그인

### 관리자 인증 방식

관리자 로그인 화면은 두 가지 방식을 제공한다.

1. Firebase Authentication 이메일·비밀번호
2. Firebase Authentication Google Provider

두 방식 모두 Worker에서 Firebase 인증 결과를 검증하고 D1 `admin_roles`를 확인한 뒤 동일한 HttpOnly Secure 세션을 발급한다. Google Drive 연결 OAuth는 관리자 로그인과 별도의 설정 기능이다.

### Google 로그인 처리

1. 로그인 화면에서 Google 로그인 선택
2. Worker가 일회용 state를 D1에 저장
3. Google OAuth authorization code 발급
4. Worker가 Google code를 token으로 교환
5. Worker가 Firebase `accounts:signInWithIdp`에 Google ID token 전달
6. Firebase ID token·UID·관리자 role 검증
7. 기존 관리자 세션 생성
8. GitHub Pages로 redirect

Google 로그인 state는 10분 후 만료되고 callback에서 즉시 삭제한다. Google OAuth Secret, code, access token, Firebase ID token은 브라우저 응답이나 저장소에 기록하지 않는다.

### 외부 설정 Gate

- Firebase Authentication → Sign-in providers → Google 활성화
- Google Cloud OAuth Web Client에 다음 Redirect URI 추가:
  `https://yehyun-portfolio-api.ajas03974.workers.dev/oauth/google/login-callback`
- 기존 Drive callback `/oauth/google/callback`은 유지
- Firebase Authentication authorized domain에 GitHub Pages 도메인 확인
- D1 `firebase_google_login_states` migration 적용

### 실패 Loop

- Google Provider 미활성화: Firebase Provider 설정만 수정
- Redirect URI 불일치: Google Cloud OAuth Client의 URI만 수정
- state 만료·불일치: 새 로그인 flow로 재시도
- Firebase role 미등록: 비공개 D1 `admin_roles` 확인
- 세션 저장 실패: Worker Secret과 D1 `admin_sessions`만 확인


## Secret Scanning alert remediation

The public static configuration must contain only the non-secret Worker API base URL. Firebase project settings, Firebase Web API keys, Google OAuth credentials, refresh tokens, PINs, passwords, and encryption keys are not allowed in config.js, HTML, JavaScript, CSS, Content files, or GitHub Pages artifacts.

When GitHub Secret Scanning detects a historical Firebase key:

1. Do not copy the detected value into a new commit, issue, comment, workflow log, or chat.
2. Confirm the current main branch and deployed static artifact no longer contain Firebase configuration. The verification workflow enforces this for config.js and scans the repository for common Firebase credential patterns.
3. In Google Cloud Console, revoke or rotate the detected key. Restrict any replacement key to the Firebase services and approved application origins if it must exist for another trusted integration.
4. Keep the replacement Firebase Web API key only as the encrypted Cloudflare Worker Secret FIREBASE_WEB_API_KEY. Never place it in GitHub repository files or GitHub Actions logs.
5. Review Google Cloud and Firebase audit logs for use of the exposed key.
6. After rotation or revocation, close the GitHub Secret Scanning alert with the reason revoked or resolved. Closing the alert does not restore the old key and must happen only after step 3.

The old value may remain in immutable Git history, but it is unusable after revocation. Rewriting public history is not part of the normal remediation because it can break deployed references and does not replace key revocation.


## 21. 2026-08-12 관리자 인증·활동 기록·백업 복구 Phase

### 확인된 운영 기준선

- 기준 브랜치: 최신 `main`에서 생성한 `drill`
- Pages와 Worker의 공개 health 경계는 응답하지만, 관리자 로그인 성공 여부는 Firebase 설정·토큰 검증·D1 세션 저장·관리자 권한 데이터의 조합에 의해 결정된다.
- 현재 관리자 판정은 UID 기반 `admin_roles`에 의존하므로, 지정 이메일 정책을 Worker에서 별도로 강제해야 한다.
- 기존 Google Drive OAuth는 관리자 로그인과 분리한다.
- 비밀번호, API key, OAuth secret, refresh token, 세션 원문, Authorization header, 서비스 계정 원문은 문서·로그·응답에 기록하지 않는다.

### 목표 역할 모델

- `admin`: Firebase ID Token의 검증된 이메일이 운영 Secret으로 지정된 관리자 이메일과 일치할 때만 부여한다.
- `member`: Firebase 이메일 또는 Google 계정으로 인증된 일반 방문자.
- `guest`: Firebase 익명 계정 또는 아직 인증되지 않은 방문자.
- `admin`만 관리자 게시물·백업·알림·설정 API를 호출할 수 있다.
- `member`와 `guest`는 공개 게시물, 공유, 반응, Guestbook, Contact Email, Contact DM을 사용할 수 있다.

### 계층별 구현 범위

#### 화면

- 로그인 오류를 안전한 오류 코드별 메시지로 표시한다.
- 로그인 상태를 관리자·회원·게스트로 구분해 표시한다.
- 관리자 전용 컨트롤은 서버 세션 검증이 끝난 뒤에만 노출한다.
- Guestbook·DM·반응 실패는 재시도 가능한 상태로 표시한다.

#### 처리

- 이메일·Google·익명 인증 결과를 하나의 세션 상태로 정규화한다.
- 모든 보호 API는 Worker에서 토큰, issuer, audience, 만료, 이메일 검증 상태와 역할을 재확인한다.
- 활동 이벤트는 멱등 event ID를 사용해 즉시 저장하고 실패 시 제한된 재시도를 수행한다.
- 인증 성공·실패, 게시물 조회·공유·반응, Guestbook, DM, 관리자 작업을 동일한 이벤트 계약으로 기록한다.

#### 핵심 규칙

- 관리자 이메일 비교는 trim 후 소문자화하고, 클라이언트 비교만으로 권한을 부여하지 않는다.
- 익명·일반 계정은 관리자 API와 비공개 게시물에 접근할 수 없다.
- 이벤트에는 UID/방문자 식별자, 행위, 대상 식별자, 시각, 결과 코드만 저장하며 비밀정보와 불필요한 원문은 저장하지 않는다.
- 서버 시각은 UTC로 저장하고 운영 화면의 20:00 기준은 KST(UTC+09:00)로 계산한다.

#### 저장·외부 서비스

- Firebase Authentication은 계정·Provider·익명 세션의 원천이다.
- Firebase Firestore REST는 `FIRESTORE_SERVICE_ACCOUNT_JSON` Secret이 설정된 경우 계정별 활동 이벤트의 실시간 외부 저장소로 사용한다.
- Cloudflare Worker는 인증·권한·이벤트 기록·백업 API의 단일 경계다.
- D1은 이벤트 원장, 세션, 관리자 상태, 백업 payload/checksum을 저장하는 Cloudflare 백업 저장소다.
- Firestore가 일시적으로 실패해도 D1 원장 기록은 유지하고 비밀값 없는 오류 코드만 로그에 남긴다.

#### 의존성 연결

- 화면은 API client와 session/activity service만 호출한다.
- 처리 계층은 Firebase, Firestore, Worker, D1, R2 adapter를 직접 조작하지 않는다.
- 외부 서비스 오류는 내부 오류 코드로 변환하고 UI에 원문을 전달하지 않는다.

#### 앱 시작

1. non-secret 설정 로드
2. 기존 세션 복원 또는 게스트 세션 준비
3. Worker 세션 확인
4. 역할 상태 결정
5. 활동 기록 초기화
6. 화면과 관리자 기능을 역할에 맞게 활성화

### Process Phase와 Gate

#### Phase 21-A — 계획·기준선

- 이 섹션을 코드 변경보다 먼저 `drill`에 커밋한다.
- 현재 main SHA, 배포 상태, 기존 브랜치와 변경 범위를 기록한다.

Gate: 문서 선커밋, 비밀값 없음, main 미변경.

#### Phase 21-B — 이메일·Google·익명 인증

- 이메일 로그인 오류를 Firebase 원문이 아닌 안전한 오류 코드로 변환한다.
- `/api/auth/guest`가 Firebase 익명 계정을 만들고 HttpOnly 세션을 발급한다.
- `/api/auth/member/login`과 Google callback의 비관리자 계정은 member 세션으로 정규화한다.
- Google OAuth state, callback, Firebase Provider 연결, 세션 발급을 검증한다.
- 익명·일반 인증은 방문자 역할로 정규화한다.

Gate: 관리자 성공, 일반 계정 관리자 거부, 익명 방문자 성공, 만료·위조 토큰 거부.

#### Phase 21-C — 이메일 기반 관리자 정책

- 관리자 이메일은 Worker Secret 또는 제한된 운영 변수로만 관리한다.
- Firebase UID와 이메일의 불일치를 허용하지 않는다.
- 기존 `admin_roles`는 보조적인 운영 확인값으로만 사용하고, 최종 권한은 지정 이메일과 검증된 Token에 묶는다.

Gate: 다른 UID가 같은 이메일을 주장해도 거부, 이메일 미검증 계정 거부, 클라이언트 우회 거부.

#### Phase 21-D — 활동 이벤트

- Firestore REST가 설정되면 계정별 이벤트를 즉시 기록하고, 항상 D1 `activity_events` 원장에도 저장한다.
- 이벤트 쓰기는 UID/게스트 식별자 범위를 강제하고, 민감한 원문을 제거한다.
- 클라이언트에는 이벤트 조회 API를 제공하지 않고 Worker만 기록하므로 타 계정 이벤트 노출을 차단한다.

Gate: 관리자·회원·게스트 각각의 이벤트 저장, 계정 격리, 중복 event ID 무시, 실패 재시도.

#### Phase 21-E — KST 20:00 백업

- Cloudflare Cron은 UTC 11:00에 실행해 KST 20:00을 구현한다.
- D1 `activity_events`를 최근 24시간 snapshot으로 만들고 `activity_backup_runs`에 payload와 checksum을 저장한다.
- 동일한 날짜 ID로 재실행해도 `INSERT OR REPLACE`로 멱등성을 유지한다.

Gate: 수동 실행과 Cron 실행 결과 일치, checksum 검증, 재실행 멱등성, 실패 알림, 비밀정보 미포함.

#### Phase 21-F — 통합 검증·배포

- 정적 문법·Worker 문법·계약 테스트·보안 패턴 검사 실행
- Pages와 Worker 공개 endpoint 검증
- 인증 계정별 API 권한 검증
- 데스크톱·모바일 브라우저에서 로그인·Guestbook·DM smoke test

Gate: 모든 CI 성공, 브라우저 console에 미해결 오류 없음, 실제 운영 Secret 미노출, main 병합 전 승인된 diff.

### 실패 시 재수정 Loop

- 인증 실패: Provider·redirect·token·세션 경계만 수정
- 권한 실패: 이메일 정규화·역할 판정·Worker guard만 수정
- 활동 저장 실패: 이벤트 schema·Firestore/Worker adapter만 수정
- 백업 실패: Cron·snapshot·R2/D1 manifest만 수정
- UI 실패: session/activity 상태 표시만 수정

각 Loop는 실패 로그에서 비밀값을 제거한 뒤 해당 Gate만 재실행한다. 두 개 이상의 계층을 동시에 임의로 재작성하지 않는다.

### 최종 검증 산출물

- 변경된 파일 목록과 책임 계층
- 각 Phase Gate 결과
- 테스트 명령과 결과 요약
- Pages/Worker 배포 run 링크
- 외부 콘솔에서 사용자가 확인할 Secret·Provider·authorized domain 체크리스트
- 비밀값 없는 운영 인수인계 기록



## 22. 최종 실행 결과 및 인수인계 (2026-08-12 KST)

### 완료 결과

- 계획 문서를 drill의 코드 변경보다 먼저 커밋했다.
- PR #27에서 인증·방문자 세션·활동 원장·예약 백업 기능을 main에 병합했다.
- PR #28에서 Worker 배포 전 D1 005·006 멱등 마이그레이션 단계를 추가하고 main에 병합했다.
- GitHub Actions의 drill 검증, GitHub Pages 배포, Cloudflare Worker 배포가 모두 성공했다.
- 외부 브라우저 화면 확인은 운영자가 직접 수행한다. 로컬 실행 환경에서는 브라우저 연결 및 외부 네트워크가 제한되어 자동 화면 검증을 수행하지 않았다.

### 운영 설정 체크리스트

1. Worker Secret ADMIN_EMAIL을 지정 관리자 이메일로 설정한다.
2. Firebase Authentication에서 Email/Password와 Google Provider를 활성화한다.
3. Google OAuth Web Client의 로그인 callback URI와 Firebase authorized domain을 확인한다.
4. FIREBASE_WEB_API_KEY, SESSION_ENCRYPTION_KEY, OAuth Secret, FIRESTORE_SERVICE_ACCOUNT_JSON은 Worker Secret에만 저장한다.
5. Worker 배포 workflow가 005·006을 자동 적용하는지 확인한다. 실패 시 수동 migration workflow의 확인 문자열을 사용한다.
6. Firestore를 사용하려면 서비스 계정에 Datastore 권한을 부여하고 Secret 원문을 로그에 출력하지 않는다.

### 권한·데이터 확인

- 지정 관리자 이메일만 Worker의 admin 세션을 발급받는다.
- 일반 이메일·Google 계정은 member, Firebase 익명 계정은 guest 세션으로 저장된다.
- 관리자 API는 admin_sessions와 검증된 Firebase token을 다시 확인한다.
- 이벤트는 D1 activity_events에 멱등 저장되며 Firestore Secret이 있을 때 외부 DB에도 기록된다.
- 매일 UTC 11:00(KST 20:00)에 최근 24시간 이벤트를 activity_backup_runs에 checksum과 함께 저장한다.

### 미완료 외부 작업

- 이 작업 환경의 GitHub connector에는 branch delete API가 노출되지 않아 drill과 기존 keep 브랜치 삭제를 자동 수행할 수 없었다. 저장소 관리자 권한으로 아래 작업을 1회 실행해 main만 남긴다.
  git push origin --delete drill keep
- Firebase Provider, Worker Secret, Firestore 권한은 외부 콘솔에서 운영자가 확인해야 한다.


## 23. 2026-08-12 로그인 오류 재진단 Phase

### 증상

- Google OAuth callback이 Firebase Provider 단계에서 실패할 때 동일한 일반 오류 fragment로 축약될 수 있다.
- 이메일 로그인에서 Worker 내부의 토큰 검증·세션 암호화·D1 저장 오류가 화면의 일반 서버 오류로 축약될 수 있다.

### 수정 목표

- 비밀번호·토큰·Secret 원문을 노출하지 않고 인증 단계별 안전한 오류 코드를 유지한다.
- Google OAuth 교환, Firebase Provider, Firebase 토큰 검증, 세션 저장 단계를 화면 메시지와 구분한다.
- 구성 누락·인증서 조회 실패·세션 암호화 실패가 `INTERNAL_ERROR`로 뭉개지지 않도록 Worker 공통 오류 매핑을 둔다.

### Gate

- Worker 문법·정적 Secret 검사가 성공한다.
- 잘못된 이메일 요청은 `AUTH_FAILED`를 반환한다.
- 설정 누락은 `AUTH_NOT_CONFIGURED` 또는 Google 전용 설정 코드로 반환한다.
- Google Provider 실패와 기존 계정 연결 필요 상태가 서로 다른 안전한 fragment로 반환된다.
- 정상 관리자 인증 성공 여부는 운영자가 실제 화면에서 확인한다.

### 외부 확인

- Firebase Authentication의 Email/Password 및 Google Provider 활성화
- Google OAuth Web Client callback URI와 Firebase authorized domain
- Worker Secret 이름과 길이·형식만 확인하고 값은 문서화하지 않는다.


## 24. 로그인 오류 재진단 구현 결과

- Worker 공통 오류 응답이 알 수 없는 예외도 `INTERNAL_ERROR` 코드와 안전한 사용자 메시지로 일관되게 반환하도록 보강했다.
- Firebase JWT header/payload 파싱 실패를 일반 서버 오류가 아닌 `INVALID_TOKEN` 계열로 변환했다.
- Google OAuth의 Firebase `requestUri`를 Pages origin으로 정규화해 authorized domain 검증 실패 가능성을 줄였다.
- Google Provider 비활성화와 기존 Firebase 계정 연결 필요 상태를 서로 다른 callback fragment로 구분했다.
- 비밀값·토큰·Firebase 원문 응답은 로그와 화면에 노출하지 않는다.

### 검증

- drill 최신 정적 검증 성공: Worker 문법, app.js 문법, migration 파일, Secret 패턴 검사
- 운영 브라우저 화면 확인은 사용자가 직접 수행한다.
- 실제 관리자 성공 로그인 여부는 Firebase 계정·Provider·Secret의 운영 상태에 종속되므로 화면 확인 결과에 따라 다음 재수정 Loop를 시작한다.


## 25. Firebase Auth lookup 검증 전환

- Cloudflare Worker에서 Firebase JWKS를 직접 import·verify하던 경로를 제거하고, Firebase Auth `accounts:lookup` API로 ID Token을 서버 측 검증한다.
- Firebase가 검증한 `localId`, `email`, `emailVerified`, `disabled`만 역할 판정에 사용한다.
- API 응답 원문·토큰·Secret은 Worker 로그와 브라우저에 전달하지 않는다.
- 인증서 fetch/import 런타임 예외로 이메일·익명·Google 경로가 함께 500이 되는 공통 실패를 제거한다.

### Gate

- Worker/app 정적 검증 성공
- 이메일·익명·Google 인증 경로가 동일한 Auth lookup 검증기를 사용
- invalid/expired/disabled token은 안전한 401 계열 코드로 반환
- 관리자 이메일 비교는 lookup 결과의 검증된 email만 사용


## 26. 2026-08-12 인증 Secret·Firebase Provider 업그레이드

### 원인

- `SESSION_ENCRYPTION_KEY`가 Base64 32바이트 형식만 허용되어, 운영자가 설정한 유효한 32바이트 hex 또는 32문자 Secret도 `SECRET_CONFIG_INVALID`로 거부될 수 있었다.
- Firebase 오류 응답을 모두 같은 코드로 처리해 API key 설정 오류와 잘못된 계정 정보를 구분하기 어려웠다.

### 수정

- 세션 암호화 키는 Base64, Base64URL, 64자리 hex, 정확히 32바이트 UTF-8 문자열만 허용한다.
- 허용 길이 밖의 값은 계속 안전하게 거부하며 키 원문은 로그·응답에 남기지 않는다.
- Firebase Email/Password·Anonymous·Google 응답의 API key 오류, Provider 비활성화, 계정 오류를 내부 코드로 분류한다.

### Gate

- drill `Verify static portfolio` 성공
- 세션 키 파서가 약한 임의 문자열을 허용하지 않음
- Firebase API key·Provider 오류가 서버 500 대신 안전한 503/401 계열 코드로 반환됨
- Pages와 Worker 배포 후 운영 화면에서 이메일·Google 로그인을 직접 확인


## 27. 2026-08-12 인증 무한 대기·Provider 오류 개선 Phase

### 확정 관찰

- 로그인 화면의 `로그인 중…` 상태는 API fetch에 timeout이 없어 Worker 또는 Firebase upstream 지연 시 무기한 유지될 수 있다.
- Google callback은 Provider·API key·Redirect URI·계정 연결·세션 저장 오류를 세분화하지 못하면 동일한 provider 오류로 표시될 수 있다.
- `/api/auth/session`의 401은 세션이 없는 초기 상태에서 정상이다.
- CSP `frame-ancestors` meta 경고와 jsDelivr source map 차단은 인증 API의 직접 원인이 아니다.

### 구현 범위

- 화면 API client에 15초 timeout과 `REQUEST_TIMEOUT` 메시지를 추가한다.
- 이메일 로그인 중복 제출을 막고 timeout·실패·성공 모든 경로에서 버튼 상태를 복구한다.
- Worker 외부 Firebase/Google 요청에 10초 timeout을 추가하고 안전한 `AUTH_UPSTREAM_TIMEOUT`으로 변환한다.
- Firestore 활동 기록은 D1 세션 발급 응답을 막지 않도록 `waitUntil`로 분리한다.
- Google callback은 Provider 비활성화, API key 설정, upstream timeout, 토큰 검증, 세션 저장 fragment를 구분한다.

### Gate

- 계획 문서 선커밋
- app.js와 Worker 정적 문법·Secret 패턴 검증 성공
- timeout 발생 시 화면이 무한 대기하지 않음
- 인증 성공 시 Firestore 지연이 세션 발급을 막지 않음
- Google 오류가 안전한 단계별 메시지로 표시됨
- 실제 계정 로그인은 운영자가 배포 후 화면에서 확인


## 28. 2026-08-12 인증 안정화 구현 결과 및 검증 게이트

### 적용 범위

- 화면 계층: `app.js`의 인증 API 요청에 15초 AbortController 타임아웃을 적용하고, 타임아웃·인증 서비스 오류·Provider 비활성화 오류를 사용자 메시지로 구분한다.
- 처리 계층: 관리자 이메일 로그인 제출 중복 실행을 잠그고 `finally`에서 버튼과 상태를 복구한다. 실패·지연 뒤에도 로그인 화면이 영구적으로 “로그인 중…”에 머물지 않는다.
- 핵심 규칙 계층: Worker의 이메일·Google 인증 외부 호출에 10초 상한을 적용하고, Google OAuth 교환·Firebase `signInWithIdp` 타임아웃을 전용 hash 결과로 반환한다.
- 저장·외부 서비스 계층: 인증 성공 응답에 대한 Firebase 활동 기록은 D1 저장을 유지하되 Firestore 기록은 `ctx.waitUntil`로 비동기 처리하여 로그인 응답을 지연시키지 않는다.
- 의존성·앱 시작 계층: 기존 Firebase Provider/환경변수 검증과 세션 확인 흐름을 유지하며, 신규 공개 비밀값은 추가하지 않는다.

### Phase별 Gate

- Phase A(구현): `app.js`에 `API_TIMEOUT_MS`, `REQUEST_TIMEOUT`, 로그인 잠금·복구가 존재하고 Worker에 `fetchWithTimeout` 및 Google 오류 매핑이 존재해야 한다.
- Phase B(정적 검증): GitHub Actions의 정적 검사 및 Worker 배포 전 검사가 성공해야 한다.
- Phase C(운영 검증): Actions의 Worker·Pages 배포가 성공해야 한다. 실제 Firebase 계정 인증은 운영자가 배포 URL에서 이메일/Google 각각 직접 확인한다.

### 실패 시 재수정 Loop

정적 검사 실패 시 해당 커밋을 수정하여 drill Actions를 재실행한다. 인증 제공자 설정·OAuth Redirect URI·Firebase 계정 연결처럼 저장소 외부에서만 확인 가능한 오류가 재현되면 hash 오류 단계와 브라우저 콘솔을 기준으로 운영 설정을 보정한 뒤 동일 검증을 반복한다.

### 보안 및 비밀값

문서와 코드에는 API 키·Client Secret·세션 암호화 키·Firebase 서비스 계정 값을 기록하지 않는다. 해당 값은 GitHub/Cloudflare/Firebase의 비밀 저장소와 운영 설정에서만 관리한다.


## 29. 2026-08-12 운영 재현 후 추가 수정

운영 Worker에 잘못된 비밀번호를 보내면 Firebase가 정상적으로 401을 반환했지만, 성공 인증 뒤 실행되는 Firebase `accounts:lookup` 토큰 검증 호출에는 타임아웃이 빠져 있었다. 이 호출이 지연되면 프런트가 성공 세션을 받지 못해 로그인 중 상태가 지속될 수 있으므로 `fetchWithTimeout`(10초)을 적용했다. drill Actions 정적 검증은 성공했으며, 운영자 브라우저에서 올바른 계정으로 최종 확인한다.


## 30. 2026-08-13 CSP·세션 확인 콘솔 정리 계획

### 문제별 수정 계획

1. `frame-ancestors`는 HTML meta CSP에서 무시되므로 meta 정책에서 제거한다. 실제 framing 차단이 필요하면 배포 응답 헤더에서 별도로 관리한다.
2. Bootstrap source map 요청이 CSP `connect-src`에 막히는 개발 도구 경고를 제거하기 위해 jsDelivr를 connect-src에 명시적으로 허용한다. 이는 CSS 본체 로딩과 인증 요청에는 영향을 주지 않는다.
3. 초기 관리자 세션 확인의 401은 비로그인 상태의 정상 응답이므로 인증 실패로 오인하지 않도록 코드 주석과 문서의 의미를 명확히 한다. 보안상 비로그인 세션을 2xx로 바꾸지 않는다.

### Process Phase / Gate

- Phase A: index.html CSP를 수정하고 정적 정책 문자열에 금지 directive가 없는지 확인한다.
- Phase B: drill Actions의 정적 검증이 성공해야 한다.
- Phase C: Pages 배포 후 CSP와 세션 요청을 운영 주소에서 확인한다. 401은 비로그인 초기 확인의 정상 결과이며 실제 로그인 POST/Google callback과 구분한다.

### 실패 시 재수정 Loop 및 검증 절차

정적 검증 실패 시 CSP 문자열과 HTML 문법을 수정하여 drill Actions를 재실행한다. 배포 후 source map 경고가 남으면 브라우저가 새 HTML을 수신했는지 확인하고, 인증 요청 실패가 별도로 재현되면 해당 POST/callback 응답만 다음 원인 분석 대상으로 삼는다. API 키·Client Secret 등 민감정보는 문서와 코드에 기록하지 않는다.


## 31. 2026-08-13 세션 확인 응답 정정

초기 페이지에서 관리자 쿠키가 전혀 없는 경우에는 인증 실패가 아니라 “로그인하지 않음” 상태다. 이 경우에 한해 `GET /api/auth/session`이 `{ user: null }`을 200으로 반환하도록 조정하고, 프런트는 user가 있을 때만 관리자 UI를 활성화한다. 쿠키가 있으나 만료·위조된 경우에는 기존 401을 유지하여 세션 검증 실패를 숨기지 않는다.

Gate: no-cookie 초기 요청 200/null, 유효 관리자 세션 200/user, 잘못된 세션 401, 관리자 보호 API 비관리자 접근 401/403을 각각 정적 코드 검사와 배포 후 운영 요청으로 확인한다.


## 32. 2026-08-13 Firebase 역할·Member 기능·방명록 재설계 승인 계획

### 확정 정책

- Guest는 공개 게시물·방명록을 열람하고 Contact 이메일 링크만 사용할 수 있다.
- 공유, 반응, Contact DM, 방명록 작성은 Google 로그인 Member 전용이다. Guest가 누르면 동작 대신 로그인 유도 모달을 표시한다.
- Member는 Firebase UID로 신규 방명록을 작성하며 자신의 UID 글만 수정·삭제할 수 있다.
- Admin은 Firebase 이메일/비밀번호 또는 지정 Google 계정으로 로그인한다. 관리자 판정은 공개 이메일 설정이 아니라 private D1 `admin_roles`의 Firebase UID allowlist만 사용한다.
- 비밀번호형 방명록의 UI, API, hash/salt, 검증 로직, 데이터 열은 제거한다. 기존 글의 본문·작성일은 보존하되 작성자 UID가 없으므로 방문자 편집 대상에서 제외하며 Admin만 관리한다.
- 지정 관리자 계정의 이메일·Firebase UID·비밀값은 저장소와 문서에 기록하지 않는다.

### 계층별 범위

- 화면: Member 전용 기능의 로그인 유도 모달, 로그인 뒤 원래 동작 재개, 역할별 UI 제어.
- 처리: Firebase Google 또는 이메일/비밀번호 인증, Worker 토큰 검증, member/admin HttpOnly 세션 발급.
- 핵심 규칙: D1 UID allowlist, Guest/Member/Admin 접근 제어, 방명록 UID 소유권.
- 저장·외부 서비스: Firebase Auth는 신원 확인, Cloudflare Worker/D1은 역할·세션·소유권, Pages는 정적 화면을 담당한다.
- 의존성·시작: 브라우저에는 API base만 유지하고 Secret은 Worker에서만 관리한다. 시작 시 세션을 확인한 뒤 역할별 UI를 적용한다.

### Process Phase와 Gate

1. 기준선 및 문서: `drill`을 main 기준으로 맞추고 본 계획을 먼저 커밋한다. Gate: 열린 PR·기존 작업 손실 없음.
2. 운영 진단: Worker Secret 존재·형식, Firebase Provider, OAuth redirect, D1 migration을 비밀값 없이 점검한다. Gate: 이메일 503과 Google 실패 원인을 코드로 분류한다.
3. Worker·D1: UID 기반 역할과 세션, 비밀번호형 방명록 제거 migration, UID 소유권을 구현한다. Gate: Guest 401, 타 Member 403, Admin 허용.
4. 화면: Member 전용 모달과 로그인 뒤 재개 흐름을 연결한다. Gate: 공개 기능 회귀 없음, 권한 UI와 API가 일치한다.
5. 검증·배포: 정적 검사, Actions, HTTP, Guest/Member/Admin 실제 흐름을 점검한다. Gate: 모두 통과한 경우만 main 병합·Pages/Worker 배포 및 불필요 브랜치 정리를 한다.

### 실패 재수정 Loop 및 검증

실패한 Gate의 오류 코드·재현 조건만 기록하고 Firebase/OAuth/Worker Secret/D1/코드 중 원인을 좁혀 최소 변경으로 수정한 뒤 해당 Gate부터 재검증한다. 코드·문서·로그에는 API key, OAuth secret, Firebase UID, 관리자 이메일을 쓰지 않는다.


## 33. 2026-08-13 기존 Firebase 관리자 Google Provider 연결 구현 계획

### 문제와 원인

기존 Firebase 이메일/비밀번호 관리자와 Google 로그인은 같은 이메일이라도 별도 Provider 신원이다. Google Provider를 기존 Firebase UID에 연결하지 않은 상태에서 일반 Google 로그인부터 시도하면 Firebase가 계정 연결을 요구하거나 별도 UID를 만들 수 있다. 후자는 private D1 UID allowlist와 일치하지 않아 관리자 접근이 거절된다.

### 계층별 구현 범위

- 화면: 관리자 설정에 **Google 계정 연결** 버튼과 성공·만료·이미 사용 중 오류 상태를 추가한다.
- 처리: 현재 관리자 HttpOnly 세션을 확인한 뒤 Google OAuth state를 생성하고, 기존 로그인 callback에서 link state를 식별해 Firebase provider-link API로 전환한다.
- 핵심 규칙: state는 현재 관리자 UID와 세션 hash에 묶고 10분 뒤 만료한다. 연결 결과 UID가 달라지거나 관리자가 아니면 거절한다.
- 저장·외부 서비스: private D1에 일회성 link state만 저장한다. Firebase Auth가 Google credential을 기존 UID에 연결하며 Worker가 OAuth code·refresh token을 서버에서만 처리한다.
- 의존성·시작: 새 browser SDK·공개 Secret은 추가하지 않는다. Worker 배포 때 additive schema/008을 먼저 적용한다.

### Process Phase와 Gate

1. State schema와 Worker link route를 추가한다. Gate: state가 세션 hash·UID·만료시각을 포함하고 재사용 뒤 삭제된다.
2. Firebase accounts:update provider-link를 기존 callback에 연결한다. Gate: 성공 payload UID가 기존 UID와 같고 refresh token이 암호화되어 session에 갱신된다.
3. 관리자 설정 화면과 hash 결과 메시지를 연결한다. Gate: link 요청은 관리자 세션에서만 시작되고 실패해도 Secret·UID가 화면에 드러나지 않는다.
4. 정적 검사와 Actions를 통과한 뒤 main에 병합하고 Worker/Pages 배포를 확인한다. Gate: Worker schema apply 및 deploy 성공, Pages deploy 성공, 운영자가 이메일 로그인 -> 설정 -> Google 연결 -> Google 재로그인을 직접 확인한다.

### 실패 재수정 Loop 및 검증 절차

OAuth 교환 오류면 redirect URI와 OAuth client의 운영 설정을 확인한다. Firebase가 이미 연결됨을 반환하면 해당 Google identity가 다른 Firebase UID에 연결된 상태이므로 그 계정을 삭제·재생성하지 않고 Firebase Console에서 provider 소유 관계를 먼저 정리한다. state 만료면 기존 이메일/비밀번호로 다시 로그인해 새 연결을 시작한다. code, UID, 이메일, API key, client secret, refresh token은 로그·문서·소스에 남기지 않는다.


## 34. 2026-08-13 무료 환경용 인증 세션 재구성 승인 계획

### 결정

GitHub Pages와 workers.dev의 교차 사이트 HttpOnly 쿠키는 브라우저의 third-party cookie 정책에 의해 로그인 직후 세션 확인이 실패할 수 있다. 따라서 인증 쿠키에 의존하지 않는다. Firebase 웹 SDK와 공개 설정도 추가하지 않고, Worker가 Firebase 인증을 수행한 뒤 짧은 수명의 불투명 세션 토큰을 JSON 또는 일회성 callback ticket으로 전달한다. 브라우저는 token을 sessionStorage에만 보관하고 Authorization header로 Worker에 보낸다.

기존 정책을 유지한다. 이메일/비밀번호는 관리자 전용이고, UID가 private D1 admin_roles에 없으면 세션을 발급하지 않는다. Google 로그인은 allowlist UID면 Admin, 그 외 정상 Firebase 사용자는 Member가 된다. 비로그인은 Guest다.

### 문제별 수정 계획

1. 쿠키 기반 admin_sessions / visitor_sessions 분기를 단일 auth_sessions 테이블과 Bearer token 검증으로 교체한다.
2. 이메일 로그인 성공 뒤 Firebase UID와 D1 allowlist를 같은 요청 안에서 확인하고 Admin 세션만 반환한다.
3. Google callback은 URL fragment의 단기 일회성 ticket을 사용해 브라우저가 session token을 안전하게 교환하도록 한다. fragment/ticket은 즉시 제거한다.
4. Google Provider 연결도 현재 관리자 Bearer 세션에 묶어 동일 Firebase UID에 연결한다.
5. 화면은 로그인, UID 권한 판정, 세션 교환의 실패를 각기 표시하며 실패 뒤 버튼 상태를 항상 복구한다.
6. 기존 cookie session과 Google link state를 폐기하는 additive D1 migration을 새 배포에서 한 번만 적용한다.

### 계층별 범위

- 화면: sessionStorage의 메모리형 세션 보관, callback ticket 교환, 단계별 상태 문구, 로그아웃 시 제거.
- 처리: Worker의 Firebase sign-in / token verification / D1 role lookup / opaque session creation.
- 핵심 규칙: Guest, Member, Admin 역할은 UID allowlist만으로 결정한다. 이메일 주소 비교는 사용하지 않는다.
- 저장·외부 서비스: D1은 암호화된 Firebase refresh token과 hash된 opaque session ID만 저장한다. Firebase는 신원 확인만 담당한다.
- 의존성·시작: 외부 browser SDK와 Secret 노출은 없다. 초기 시작은 sessionStorage token이 있을 때만 session endpoint를 호출한다.

### Process Phase와 Gate

1. 문서와 schema: 계획을 먼저 commit하고 auth_sessions / callback ticket schema를 추가한다. Gate: session raw token은 D1에 평문으로 저장하지 않는다.
2. Worker: 단일 requireUser / requireAdmin을 Bearer token 기반으로 교체한다. Gate: no-token 401, Member의 admin API 403, Admin 성공.
3. 화면: token 저장·제거와 Google callback ticket 교환을 연결한다. Gate: 실패 시 로그인 중 상태가 남지 않고 안내 문구가 보인다.
4. Google link: current session state와 UID를 검증한다. Gate: link 후 UID가 동일하고 재로그인으로 Admin을 확인한다.
5. 검증·배포: drill static checks, main Worker schema/deploy, Pages deploy를 통과한다. Gate: 이메일 Admin, Google Member, Google Admin, Guest 경계를 운영 화면에서 확인한다.

### 실패 재수정 Loop

각 실패는 login, role lookup, session exchange, provider link 중 한 단계 코드로만 분류한다. 그 단계의 안전한 오류 code와 Network 상태를 확인한 뒤 최소 수정 후 같은 Gate부터 반복한다. email, UID, password, API key, OAuth code, token, client secret은 코드·문서·로그에 기록하지 않는다.


## 35. 2026-08-13 Bearer Authorization CORS 차단 수정

### 관찰과 원인

배포된 browser app은 opaque bearer session을 Authorization header로 전송한다. Worker CORS preflight의 Access-Control-Allow-Headers에는 Authorization이 없어 GitHub Pages origin의 GET /api/auth/session 요청이 브라우저에서 차단된다. Firebase, D1 UID allowlist, 세션 검증 함수는 이 요청에 도달하지 않는다. autocomplete 경고는 관련이 없다.

### Process Phase와 Gate

1. Worker CORS allow-list에 Authorization만 추가한다. Gate: 기존 허용 origin·methods·CSRF header 정책은 변경하지 않는다.
2. 정적 검증에 Authorization allow-list 문자열을 추가한다. Gate: Worker와 app의 Bearer header 계약이 함께 존재해야 한다.
3. drill CI, PR, main Worker/Pages 배포를 확인한다. Gate: preflight가 Authorization을 허용하고 /api/auth/session이 CORS 차단 없이 응답한다.

### 실패 재수정 Loop

CORS 오류가 남으면 Network의 OPTIONS 응답에서 allow-origin, allow-headers, allow-methods를 확인하고 정확히 누락된 항목만 추가한다. 허용 origin을 wildcard로 완화하거나 credentials·Secret·UID를 노출하지 않는다.


## 36. 2026-08-13 이메일 로그인 직후 세션 확인 실패 수정

### 원인

이메일 로그인 요청은 Firebase sign-in, Firebase ID token lookup, D1 admin_roles UID allowlist, auth_sessions 저장까지 완료한 뒤 응답한다. 그러나 다음 GET /api/auth/session에서 requireUser가 다시 Firebase refresh token 교환과 accounts:lookup을 수행한다. 이 중복 외부 의존 호출이 실패하면 optionalUser가 user:null을 반환해 화면이 “로그인 세션을 확인하지 못했습니다”로 끝난다. 이 단계는 이미 인증이 끝난 로그인 직후에는 권한 판정에 불필요하다.

### 수정 범위와 규칙

- auth_sessions의 hash된 opaque token, UID, role, 만료 시각을 단일 서버 세션 근거로 사용한다.
- requireUser는 Bearer token hash와 D1 세션 만료만 확인해 UID와 role을 반환한다.
- requireAdmin은 매 요청 private D1 admin_roles allowlist를 다시 조회한다. 관리자 권한 철회는 즉시 반영된다.
- Firebase 인증·UID 확인은 로그인 및 Google provider-link 같은 Firebase 작업이 필요한 경계에서만 수행한다.
- 세션은 12시간 만료와 logout 삭제를 유지한다. raw token, password, UID, refresh token은 노출하지 않는다.

### Gate 및 실패 재수정 Loop

1. Worker: 이메일 로그인 이후 session endpoint가 Firebase 외부 호출 없이 D1 session으로 user를 반환한다. Gate: sessionStorage Bearer -> GET session -> admin user.
2. 권한: Member admin endpoint는 403, allowlist 삭제 후 Admin endpoint는 403, 만료·logout은 401이다.
3. 검증·배포: drill static check, main Worker/Pages deploy 성공 뒤 이메일 로그인 화면을 재검증한다.
4. 실패 시 Network에서 login 응답과 session 응답을 분리해 확인하고 실패 단계만 최소 수정한다. CORS·origin·Secret·Firebase 구성을 완화하거나 공개하지 않는다.


## 37. 2026-08-13 Google provider 연결 callback 및 Drive 준비 상태 정정

### 확인 결과

- Cloudflare Worker의 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET은 Firebase project ID `yehyun-portfolio`에 속한 첫 번째 Google Cloud 프로젝트와 일치한다는 운영자 확인을 받았다. 프로젝트 ID `yehyun-portfolio-505304`는 Worker Secret·공개 설정에서 참조되지 않는다.
- Google provider 연결은 시작 시 Bearer 세션 hash를 state에 저장하지만, callback에서 이미 제거한 legacy cookie를 읽어 동일성을 비교한다. OAuth redirect에는 browser Authorization header가 없으므로 callback은 항상 만료처럼 처리된다.
- Drive OAuth 연결은 token 저장만 성공해도 “연결됨”을 표시한다. 현재 폴더 생성은 첫 백업에서만 일어나므로 연결 직후 Drive에 폴더가 없는 것은 코드 동작상 정상이나 화면 의미가 불명확하다.

### 수정 계획

1. Google provider callback은 one-time OAuth state에 이미 묶인 D1 session hash를 직접 사용한다. state 삭제, 만료, session 존재, UID 일치, D1 allowlist를 검증한다. legacy cookie 참조는 제거한다.
2. Drive OAuth callback은 token 저장 뒤 앱 소유 `Portfolio-con/Backups` 폴더를 즉시 준비한다. 폴더 준비 실패는 연결 성공으로 표시하지 않고 기존 Drive connection을 되돌린다.
3. 화면은 Drive 상태를 “연결됨·백업 폴더 준비됨”으로 표시하고, 수동 백업은 날짜별 파일 생성 단계로 안내한다.
4. OAuth 오류는 access denied, redirect mismatch, Drive API/권한, 만료, provider in-use를 안전한 한국어 상태로 구분한다.
5. 외부 console 정리: 실제 OAuth project가 첫 번째임은 확인됐지만 삭제는 Google Cloud Console에서 운영자가 최종 수행한다. 두 번째 프로젝트에 다른 서비스가 없는지 마지막 확인 후에만 삭제한다.

### Gate와 재수정 Loop

- Provider link: 이메일 Admin 로그인 -> Google 계정 연결 -> callback success -> 로그아웃 -> Google Admin 로그인.
- Drive: Drive 연결 -> `Portfolio-con/Backups` 생성 확인 -> 수동 백업 -> 날짜 폴더와 JSON 파일 생성 확인.
- 실패 시 callback fragment 또는 Drive status의 안전한 code만 확인하고 해당 단계부터 반복한다. raw OAuth state, UID, token, credential, secret은 기록하지 않는다.


## 38. 2026-08-13 Google Admin 연결·Drive 원본 저장소 재검증

### 사실 확인

게시물 업로드 경로에는 이미 Drive 원본 저장, YYYY-MM-DD 폴더, title slug 폴더, HTML/CSS/JS 원본, media Drive ID 기록, Worker media stream이 구현돼 있다. 현재 기능 장애는 저장 모델 부재가 아니라 Google provider link와 Drive OAuth의 실제 실패 원인을 일반 오류로 숨기는 연결 상태 설계다.

### 구현

- OAuth callback error 및 Firebase accounts:update/Drive API 응답을 안전한 단계별 code로 분류한다.
- Drive connection 상태는 Drive root folder ID와 verified timestamp가 있을 때만 ready다.
- Drive OAuth callback은 root folder 생성 실패를 connection rollback과 exact safe code로 처리한다.
- post asset folder 이름은 YYYY-MM-DD/title-slug 구조로 통일하고 Drive ID를 D1에 저장한다.
- media display는 Worker Drive proxy만 사용하며 token/Drive direct URL은 노출하지 않는다.

### Gate

1. Email admin -> Google provider link -> logout -> Google admin sign-in.
2. Drive OAuth -> Portfolio-con exists -> connection ready.
3. New post -> date/slug folder includes index.html/style.css/script.js/media -> post uses Worker media URL.
4. Error path surfaces provider-in-use, OAuth denial, Drive permissions, folder creation, upload errors without secrets.

### Free plan boundary

Personal Google storage is shared and limited; uploads remain constrained to the Cloudflare Free request body limit. Files larger than the configured upload limit are rejected before storage. The system is not an unlimited video archive.


## 39. 2026-08-13 관리자 Google·Drive 통합 연동 재구성

### 문제별 수정 계획

1. 현재 Google Provider 연결은 암호화된 Firebase refresh token 재발급에 의존한다. 이 외부 재발급 실패가 일반 오류로 축소되어 실제 실패 단계를 확인할 수 없다.
2. Drive 연결은 OAuth·토큰·폴더 생성·D1 저장 중 어느 단계의 실패인지 화면에 남기지 않는다. 연결 해제 시 root 메타데이터도 함께 정리하지 않아 다음 시도에 이전 상태가 섞일 수 있다.
3. 관리자 알림 조회 실패는 설정 화면과 독립적으로 처리해야 한다. 알림 조회 예외가 설정 초기화를 중단해서는 안 된다.

### 목표와 계층별 구조

- 화면: 설정에서 하나의 Google 및 Drive 연동 흐름을 제공한다. 현재 이메일/비밀번호 관리자만 시작할 수 있으며 비밀번호를 한 번 재확인한다. 비밀번호는 저장하지 않는다.
- 처리: Worker는 재확인 비밀번호로 Firebase의 새 ID token을 발급하고, 10분짜리 일회성 D1 state에 암호화해 보관한다. Google callback에서 이 token으로 Firebase Provider를 같은 UID에 연결하고 Drive refresh token을 암호화한다.
- 핵심 규칙: 시작·callback 모두 private D1 admin_roles allowlist를 확인한다. Google identity가 다른 Firebase UID에 연결된 경우에는 연결·Drive 저장을 모두 중단하고 안전한 안내를 반환한다.
- 저장·외부 서비스: 성공이 확인된 뒤에만 Google Drive에 Portfolio-con 및 Backups를 준비하고 D1 root ID를 기록한다. 연결 해제는 connection과 root metadata를 함께 삭제한다.
- 의존성·시작: 브라우저 Firebase SDK, 공개 Secret, Drive direct URL을 추가하지 않는다. 브라우저는 OAuth code·access token·refresh token을 보관하지 않는다.

### Process Phase와 Gate

1. 문서·기준선: 이 계획을 구현 전 커밋한다. Gate: 비밀값·이메일·UID·토큰이 문서에 없다.
2. Worker 상태 설계: 기존 provider link/Drive state를 단일 연동 state로 교체하고 실패 단계를 code로 분리한다. Gate: state는 관리자 UID·세션·만료와 묶이며 callback 후 재사용할 수 없다.
3. 화면 연결: 비밀번호 재확인 UI와 한 번의 Google consent 시작을 연결한다. Gate: 비밀번호는 DOM 제출 뒤 저장되지 않고 실패·취소 뒤 버튼 상태가 복구된다.
4. Drive 준비: root 생성 성공 뒤에만 ready로 표시하고 실패면 connection/root를 rollback한다. Gate: Portfolio-con 없이는 연결됨을 표시하지 않는다.
5. 회귀 방지: notifications 실패는 독립적으로 처리한다. Gate: 알림 API 실패에도 Drive 상태·설정 모달은 계속 표시된다.
6. 검증·배포: 정적 검사, PR checks, Worker schema/deploy, Pages deploy, 운영자 browser flow를 분리해 확인한다. Gate: 각 증거를 혼동하지 않는다.

### 실패 시 재수정 Loop 및 검증 절차

- Firebase 재인증 실패: 이메일/비밀번호 로그인 설정과 해당 요청만 확인한다.
- Provider 충돌: Firebase Console에서 이미 연결된 별도 Google provider 사용자 여부만 확인하고, 확인 전 사용자를 삭제하지 않는다.
- OAuth 실패: redirect URI·테스트 사용자·동의 화면을 확인한다.
- Drive 실패: token 교환, Drive API, 폴더 생성 중 해당 code만 수정한다.
- Worker 오류: request ID/안전한 error code를 로그에 남기고 해당 handler만 수정한다.

정적 검증은 Worker 문법, UI hash-message 계약, secret/UID 비노출, 상태 정리 쿼리를 검사한다. 배포 후 운영자는 이메일 관리자 로그인 → 통합 연동 → Drive의 Portfolio-con 확인 → 로그아웃 → Google 관리자 로그인을 확인한다. API key, client secret, OAuth code, access/refresh token, 비밀번호, UID는 코드·문서·Actions 로그에 기록하지 않는다.


## 40. 2026-08-13 Google OAuth callback 복호화 누락 수정

### 확인된 원인

Google OAuth 승인 뒤 Worker callback은 암호화된 Firebase ID token과 Drive refresh token을 복호화한다. 이 경로가 사용하는 decodeBytes helper가 Worker에 정의되어 있지 않아 ReferenceError가 발생했다. 예외는 일반 연결 실패 fragment로 변환되었고, Drive connection/root는 rollback되어 Portfolio-con 폴더가 만들어지지 않았다.

### 수정 범위·Gate

- URL-safe Base64와 표준 Base64 양쪽을 처리하는 decodeBytes helper를 Worker에 추가한다.
- Google ID token payload는 URL-safe Base64 decoder로 읽고, payload가 잘못되면 안전한 OAuth error로 반환한다.
- 통합 Google setup과 독립 Drive callback이 같은 decoder를 사용하도록 한다.
- Gate: decryptSecret, Google subject 추출, Drive access-token 재발급에서 undefined decoder 참조가 없고 Worker 문법·static 검증을 통과한다.

### 실패 Loop·검증

정적 검증 뒤 배포한다. 운영자는 이메일 관리자 로그인 → Google 및 Drive 연결 → 권한 허용 → Portfolio-con 확인 → 로그아웃 → Google 관리자 로그인을 확인한다. 실패 시 안전한 fragment와 Worker 로그의 error code만 확인하며 token, password, UID, OAuth code, secret은 기록·공유하지 않는다.


## 41. 2026-08-13 Google 계정 연결·Drive 연결 분리 재구성

### 결정과 원인

하나의 OAuth callback에서 Firebase Google Provider 연결, Drive refresh token 저장, Drive root 생성까지 처리하면 어느 한 단계의 실패가 전체 일반 오류로 합쳐진다. Provider가 성공한 뒤 Drive만 실패한 경우에도 결과를 되돌리려 해 상태가 불명확해진다. 따라서 두 기능을 독립 OAuth transaction으로 분리한다.

### 계층별 범위

- 화면: 설정을 Google 계정 연결과 Google Drive 연결 두 섹션으로 분리한다. Google 계정 연결만 이메일/비밀번호 재확인을 요구한다.
- 처리: Provider link state는 기존 암호화된 일회성 state table을 재사용한다. Drive는 기존 google_oauth_states callback만 사용한다.
- 핵심 규칙: Provider link 성공은 Drive 상태와 무관하며, Drive 실패는 Firebase Provider를 unlink하거나 세션을 변경하지 않는다.
- 저장·외부 서비스: Drive callback이 Portfolio-con 및 Backups root를 모두 검증한 경우에만 connection/root metadata를 기록한다. 연결 해제는 Drive metadata만 삭제한다.
- 의존성·시작: 브라우저 SDK와 공개 Secret을 추가하지 않는다. OAuth state, Firebase ID token, Drive refresh token은 Worker·D1 암호화 경계 밖으로 나가지 않는다.

### Process Phase와 Gate

1. 문서 선커밋. Gate: 이 계획이 구현보다 먼저 존재하고 민감값이 없다.
2. Worker 재구성. Gate: admin Google link는 openid/email/profile만 요청하고, Drive callback은 Firebase account link를 호출하지 않는다.
3. 화면 재구성. Gate: 계정 연결과 Drive 연결의 버튼·상태·실패 문구가 독립적이다.
4. 정적·배포 검증. Gate: Worker 문법, OAuth route 계약, secret/UID 비노출 검사와 Actions가 통과한다.
5. 운영 검증. Gate: 이메일 Admin → Google 계정 연결 → Google Admin 로그인 → Drive 연결 → Portfolio-con 확인을 순서대로 독립 확인한다.

### 실패 시 재수정 Loop

Google 계정 연결 실패는 Firebase provider-link 단계만, Drive 연결 실패는 token 교환·Drive root 단계만 수정한다. 어느 단계에서도 다른 연결 데이터를 삭제하지 않는다. 비밀번호, OAuth code, access/refresh token, Client Secret, UID는 문서·코드·로그에 기록하지 않는다.


## 42. 2026-08-13 Worker module duplicate declaration hotfix

Cloudflare Worker deploy에서 기존 googleLinkErrorFragment와 동일 이름의 helper가 추가되어 ES-module build가 거부됐다. 기존 helper를 재사용하고 중복 선언을 제거한다. Gate: Wrangler build와 Worker deploy가 성공해야 하며, Pages 화면과 Worker route 계약이 다시 일치해야 한다. 실패 시 이 단일 build error만 수정·재배포한다.
