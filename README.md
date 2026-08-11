# YeHyun Portfolio

표준 HTML, CSS, JavaScript로 구성한 GitHub Pages 포트폴리오 사이트입니다.

## 실행

별도 빌드 도구 없이 정적 서버에서 실행할 수 있습니다.

```bash
python -m http.server
```

또는 VS Code Live Server로 `index.html`을 엽니다.

## 구조

- `index.html`: 시맨틱 화면 진입점과 외부 자산 연결
- `styles.css`: 웹폰트, 레이아웃, 모션, 반응형 스타일
- `app.js`: 로딩 타이밍, 폰트 셔플, 해시 라우팅, 캐러셀, 접근성 입력 처리
- `app.js`: 최신순 작업물 데이터와 화면 처리
- `public/`: 파비콘과 YeHyun 로고 원본 자산
- `.github/workflows/deploy.yml`: 정적 파일 GitHub Pages 배포
- `docs/implementation-plan.md`: 계층 설계, Gate, 실패 Loop, 검증 절차

실제 이미지·영상은 추후 `projects.js`의 프로젝트 데이터에 연결합니다.
