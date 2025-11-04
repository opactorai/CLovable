# 배포 가이드

## 기본 흐름
- GitHub `main` 브랜치에 변경 사항을 push 하면 Vercel 프로젝트 `clink-front`가 자동으로 빌드 및 프로덕션 배포를 수행합니다.
- 배포가 완료되면 `https://clink.ai`와 `https://www.clink.ai` 커스텀 도메인이 최신 프런트엔드 번들을 제공하며, Vercel 대시보드에서 배포 상태를 확인할 수 있습니다.
- 프리뷰 브랜치는 동일한 환경 변수 집합으로 프리뷰 URL을 생성하므로, 머지 전 QA 시에도 동일한 설정이 유지됩니다.

## 프리뷰 환경
- Vercel Preview 배포는 기본적으로 브랜치별 URL을 생성하므로, `preview` 브랜치를 프리뷰 검증용으로 고정하려면 해당 브랜치를 보호하고 필요한 경우 수동으로 머지하세요.
- Preview 환경의 `NEXT_PUBLIC_API_URL`은 백엔드 프리뷰 도메인(`https://api-preview.clink.ai`)으로 지정해야 하며, CLI에서는 `printf 'https://api-preview.clink.ai' | vercel env add NEXT_PUBLIC_API_URL preview --force`로 업데이트할 수 있습니다.
- `NEXT_PUBLIC_APP_URL`을 프리뷰용 커스텀 도메인(`https://preview.clink.ai`)으로 맞춰 두어야 OAuth 리디렉션이 올바르게 동작합니다.
- 추가로 필요한 비공개 값이 있다면 Production과 동일한 키로 Preview 슬롯에 복제하여 브랜치별 빌드에서 일관된 설정을 유지하세요.
- GitHub OAuth는 프리뷰 전용 클라이언트 ID(`Ov23li3oB85HoA1YAUbN`)를 사용하므로 Preview 환경 변수에서 `NEXT_PUBLIC_GITHUB_CLIENT_ID`를 해당 값으로 유지하세요.

### GitHub OAuth 키 현황
| 환경 | Client ID | 비고 |
| --- | --- | --- |
| Production (`main`) | `Ov23li3ClIhBYOlaid9m` | Vercel Production `NEXT_PUBLIC_GITHUB_CLIENT_ID`, Cloud Run `clink-api` |
| Preview (`preview`) | `Ov23li3oB85HoA1YAUbN` | Vercel Preview `NEXT_PUBLIC_GITHUB_CLIENT_ID`, Cloud Run `clink-api-preview` |

### Slack 알림
- GitHub Actions 워크플로(`.github/workflows/vercel-notify.yml`)가 main/preview 푸시에 실행되어 각 브랜치에 맞는 채널로 Vercel 빌드 시작·성공·실패를 통지합니다.
  * Preview 브랜치 → `SLACK_WEBHOOK_URL_FRONT`
  * Main 브랜치 → `SLACK_WEBHOOK_URL_FRONT_PROD`
- Vercel REST API를 사용하므로 GitHub Secret에 `VERCEL_TOKEN`(읽기 토큰)과 위 두 Slack Webhook을 설정해야 합니다.

- 커스텀 도메인 `preview.clink.ai`는 Vercel 프로젝트의 Preview 도메인으로 연결하며, DNS CNAME 레코드를 Vercel이 안내하는 대상에 매핑해야 합니다.
- Google/GitHub OAuth 설정에도 프리뷰 프런트 URL(`https://preview.clink.ai`)을 리디렉션 URL로 추가해 두어야 합니다.

## 환경 변수 관리
Vercel Dashboard 또는 CLI를 통해 다음 값을 관리합니다 (Production/Preview 모두 동일 키 사용).

| Key | Environment | 예시 값 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Production / Preview | `https://api.clink.ai` |
| `NEXT_PUBLIC_APP_URL` | Production | `https://clink.ai` |
| `NEXT_PUBLIC_PREVIEW_URL` | Preview | `https://clink-front-git-{branch}.vercel.app` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Production / Preview | Google OAuth 클라이언트 ID |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Production | GitHub OAuth 클라이언트 ID |
| *(서버 전용)* `GITHUB_TOKEN` | Backend | GitHub GraphQL 조회용 토큰 (클라이언트에 노출 금지) |
| *(서버 전용)* `VERCEL_TOKEN` | Backend | Vercel API 토큰 |
| *(서버 전용)* `VERCEL_TEAM_ID` | Backend | `team_xJUTPlOZeM13wcYNcoLMLvcm` |

CLI 예시:
```bash
# 프로덕션 API URL 갱신
printf 'https://api.clink.ai' | vercel env add NEXT_PUBLIC_API_URL production --force
# 프리뷰 환경 같은 값으로 동기화
printf 'https://api.clink.ai' | vercel env add NEXT_PUBLIC_API_URL preview --force
```

> 로컬 개발은 `.env.development`를 사용하며, 프로덕션 번들에는 포함되지 않습니다.

## 배포 모니터링
1. GitHub Actions / Vercel Activity에서 배포 파이프라인이 성공했는지 확인합니다.
2. 배포 완료 후 `https://clink.ai/api/env`에서 `apiUrl`, `appUrl` 값이 기대한 도메인인지 확인합니다.
3. 시크릿 모드에서 `/login` → Google 로그인 플로우를 테스트하고, 네트워크 요청이 `https://api.clink.ai`로 향하는지 확인합니다.
4. `/`, `/projects`, 다운로드 처리 등 주요 기능을 수동 점검합니다.

## 수동 배포 (필요 시)
CI/CD를 사용하기 어려운 상황에서만 CLI로 배포할 수 있습니다.
```bash
npm install -g vercel
vercel login
vercel switch opactor
vercel deploy --prod --yes
vercel alias set <배포URL> clink.ai
vercel alias set <배포URL> www.clink.ai
```

## 참고 사항
- 캐시·Service Worker 영향으로 이전 번들이 남을 수 있으므로 배포 검증은 강력 새로고침 또는 시크릿 모드에서 진행합니다.
- 백엔드 Cloud Run `API_PUBLIC_URL`, `FRONTEND_URL` 값이 프론트 환경 변수와 일치해야 OAuth 리디렉션이 정상 동작합니다.
- `src/app/api/env/route.ts`는 런타임 환경을 확인하기 위한 엔드포인트입니다. 운영 모드에서 노출이 부담된다면 배포 직후 비활성화할 수 있습니다.
