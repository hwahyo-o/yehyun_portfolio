# YeHyun Portfolio

표준 HTML, CSS, JavaScript로 구성한 GitHub Pages 포트폴리오 사이트입니다.

## 실행

별도 빌드 도구 없이 정적 서버에서 실행할 수 있습니다.

```bash
python -m http.server
```

또는 VS Code Live Server로 index.html을 엽니다.

## 구조

- index.html: 로딩 화면, GNB, GalleryHero, 작업물 rail, About/이력서, 카테고리 상세의 정적 화면 마크업, Bootstrap 5.3.8 CSS와 Bootstrap Icons 연결
- styles.css: 웹폰트, 레퍼런스 기반 색상·레이아웃·카드·반응형·모션, Bootstrap 기본값을 보완하는 고유 표현
- app.js: 3초 로딩, 300ms 폰트 셔플, About Me 입력 제한, 해시 페이지 이동, 버튼 작동
- public/: 파비콘과 YeHyun 로고 원본 자산
- .github/workflows/deploy.yml: 정적 파일 GitHub Pages 배포
- .github/workflows/verify.yml: 정적 진입점과 JavaScript 구문 검증
- docs/implementation-plan.md: 화면·처리·핵심 규칙·외부 서비스·앱 시작 계층, Process Phase, Gate, 실패 Loop, 검증 절차

## 미디어 자산

실제 이미지·영상은 아직 제공되지 않았습니다. 현재 작업물 영역은 추후 자산을 연결할 수 있는 명시적 슬롯으로 표시됩니다. 자산을 추가할 때에는 제목, 제작 기간, 설명, publishedAt, media 경로를 함께 연결하고 최신순 규칙을 유지합니다.

비밀정보나 API 키는 코드와 문서에 기록하지 않습니다.

## Bootstrap 연결 정책

- Bootstrap 5.3.8 CSS와 Bootstrap Icons 1.13.1을 고정 버전 HTTPS CDN으로 연결합니다.
- Bootstrap CSS는 기존 styles.css보다 먼저 로드하고, 기존 포트폴리오의 고유 레이아웃과 모션은 styles.css가 유지합니다.
- GNB·View More·TOP·이전/다음의 기능성 화살표는 Bootstrap Icons를 사용합니다.
- 로고·파비콘·Gallery 손/휴대폰·타원 장식은 기존 정적 자산과 CSS 표현을 유지합니다.
- Bootstrap JavaScript, Popper, npm, React, Vite는 사용하지 않습니다.
- Bootstrap CSS link에는 공식 SRI를 사용하며, Bootstrap Icons는 공식 CDN 고정 URL을 사용합니다.


## Shared backend preparation

The static site remains deployable on GitHub Pages. The optional shared backend is under `worker/`:

- `worker/src/index.js`: Cloudflare Worker API, Firebase token verification, Google Drive media proxy, and OAuth callback.
- `worker/schema/001_initial.sql`: D1 schema.
- `worker/wrangler.toml.example`: non-secret configuration template.
- `worker/README.md`: setup order and secret-handling rules.

The frontend stays usable without an API URL and shows an offline state until the Worker is configured. Never commit OAuth client secrets, refresh tokens, Firebase Admin credentials, Cloudflare API tokens, or GitHub tokens.
