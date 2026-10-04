# Frontend 시작 가이드

React · TypeScript · Vite 기반의 **page-first** 프론트엔드입니다. 아래 순서로 새 프로젝트의 설정과 첫 화면을 준비하세요. 서버와 독립적으로 실행·배포하며, 기본 홈은 로컬 샘플 데이터로 동작합니다.

## 1. 실행 환경 설치

프론트엔드 폴더에서 실행합니다. nvm이 설치되어 있어야 합니다. 상위 작업 공간에서 시작한다면 먼저 `cd frontend`를 실행하세요.

```bash
nvm install
nvm use
npm ci
cp .env.example .env
```

Node 버전은 `.nvmrc`의 **24.21.0**을 기준으로 합니다. `cp`는 `.env`가 없는 최초 설정 때만 실행하세요. 이후 명령은 별도 안내가 없으면 `frontend/` 기준입니다.

## 2. API 주소와 앱 기본값 설정

| 설정                        | 수정 위치                         | 처음 정할 값                              |
| --------------------------- | --------------------------------- | ----------------------------------------- |
| API 주소                    | `.env`의 `VITE_API_URL`           | 로컬 기본값 `http://localhost:5000/api`   |
| 프로젝트 이름·설명·레이아웃 | `src/app/config/site.ts`          | `web`, `mobile`, `landing` 중 시작 프리셋 |
| 페이지·메뉴·메타데이터      | `src/app/router/route-config.tsx` | 첫 화면과 메뉴 구성                       |
| 브라우저 제목               | `index.html`                      | 프로젝트 제목                             |
| 전역 디자인 토큰            | `src/app/styles/app.css`          | 사전 설계한 색상·타이포그래피             |
| 지원 언어·기본 언어         | `src/app/i18n/config.ts`          | `ko`, `en` 지원·영어 기본값               |

`VITE_API_URL`에는 실제 서버 주소와 API 경로 접두사가 있다면 해당 경로까지 포함합니다. 환경변수 변경 후 개발 서버를 다시 시작하세요. `VITE_` 값은 브라우저 번들에 노출되므로 비밀키를 넣지 않습니다.

API 주소가 없으면 `/api`를 사용하지만, 현재 Vite에는 API 프록시가 없습니다. 예제의 `http://localhost:5000/api`는 연결할 서버에 맞게 변경하세요. 현재 인접한 `backend/`의 기본 포트는 3000이며, 공통 `/api` 접두사와 CORS 설정은 없습니다. 이 백엔드를 연결하려면 주소를 맞추고 서버 CORS 또는 개발 프록시를 별도로 구성해야 합니다. 상대 경로는 배포 환경에서 `/api`를 서버로 전달하도록 구성했을 때 사용합니다.

## 3. 실행하고 기본 화면 확인

```bash
npm run dev
```

터미널에 표시된 주소(기본 `http://localhost:5173`)에서 홈·없는 경로의 404·모바일 메뉴를 확인합니다. 포트가 달라지면 서버 CORS 주소도 변경합니다.

초기 표시 언어는 저장된 설정과 관계없이 영어로 지정합니다. `ko`, `en` 번역과 `LanguageSelect` 컴포넌트는 유지하지만 화면에는 언어 전환 버튼을 표시하지 않습니다. 언어 선택 UI를 연결할 때 `i18nOptions.lng`의 고정값을 제거하면 저장된 `app.language` 선택을 사용할 수 있습니다. 번역은 지갑 연결 다이얼로그·언어 선택기·404·공통 로딩·다이얼로그 닫기 라벨에 적용되어 있으며 홈 전체 콘텐츠 번역은 포함하지 않습니다. 번역 JSON을 추가한 뒤 [i18n 설정](src/app/i18n/config.ts)의 `resources`와 namespace 목록에 등록하세요.

지갑 로그인은 헤더의 **Connect Wallet → Connect with Phantom**으로 시작합니다. `@wallet-standard/app`으로 등록된 지갑을 탐지하고, 서버에서 받은 `signInInput`을 선택한 지갑의 `solana:signIn`에 그대로 전달합니다. 표준 응답의 `account.address`를 주소 문자열로 사용하고, 원본 메시지·서명을 표준 Base64로 인코딩해 `/auth/login`에 제출합니다. 로그인 후 헤더에 지갑 주소가 표시되며, 새로고침 시 `/auth/me`로 세션을 복원합니다. 주소 버튼의 **Disconnect Wallet**은 `/auth/logout`으로 세션을 해제하고, 지갑이 지원하면 `standard:disconnect`로 연결을 정리합니다. 인증은 서버 쿠키를 사용하고 브라우저 저장소에 인증 토큰을 저장하지 않습니다.

현재 다이얼로그에는 Phantom 버튼만 표시합니다. 인증 함수와 mutation은 지갑 이름을 받아 처리하므로, 다른 지갑을 추가할 때 같은 흐름을 사용할 수 있습니다. 연결할 지갑은 Solana 체인과 `solana:signIn` 기능을 지원해야 합니다. 지갑 연동 코드는 `app/layout/header/lib/wallet-standard.ts`가 소유하며, Phantom의 직접 provider API는 호출하지 않습니다.

로컬 인증 연결은 `VITE_API_URL=http://localhost:5000`과 `http://localhost:5173`을 사용합니다. 백엔드가 이 프론트 Origin을 허용해야 하며, 인증 요청은 `withCredentials: true`로 연결 쿠키·세션 쿠키를 주고받습니다. 데스크톱에서는 Phantom 확장 프로그램, 모바일에서는 Wallet Standard의 `solana:signIn`을 등록하는 지갑 내부 브라우저가 필요합니다. 일반 모바일 브라우저의 딥링크 연결은 포함하지 않습니다.

## 4. 첫 페이지와 API 연결

`src/pages/orders-list/OrdersListPage.tsx`처럼 페이지 진입점을 만들고, `src/app/router/route-config.tsx`에 lazy import와 route를 등록합니다. 현재 저장소에는 페이지 생성 스크립트가 없습니다.

| 위치                              | 책임                                   |
| --------------------------------- | -------------------------------------- |
| `src/app`                         | Provider·라우터·레이아웃·전역 설정     |
| `src/pages/<page>/ui`             | 페이지 전용 UI                         |
| `src/pages/<page>/model`          | 화면 상태와 동작                       |
| `src/pages/<page>/api`            | 요청 함수·타입·React Query 훅          |
| `src/pages/<page>/config/locales` | 페이지 전용 번역                       |
| `src/shared`                      | 범용 UI·HTTP 클라이언트·유틸·공통 번역 |

API 요청에는 `src/shared/api/http-client.ts`의 `axiosInstance`를 사용합니다. 인접한 백엔드의 라우트와 응답은 [backend/src/modules](../backend/src/modules)에서 확인하세요. 현재 홈의 `getHomePageContent`는 실제 HTTP 요청을 하지 않는 샘플입니다.

공유 도메인·행동이 생겼을 때만 `entities`·`features`를 추가합니다. 기본 구현 예시는 홈 페이지를 참고하고, 서비스의 첫 화면이 준비되면 샘플 소개 문구와 브랜드·푸터를 교체합니다.

## 5. 변경 검증과 배포 준비

```bash
npm run format:check
npm run lint
npm run build
npm run preview
```

`build`는 TypeScript 검사와 프로덕션 번들 생성을 수행합니다. `preview`는 빌드 결과의 로컬 확인용이며 운영 서버가 아닙니다. 배포 대상은 `dist/`이고, BrowserRouter를 사용하므로 직접 URL 접근 시 `index.html`로 연결하는 SPA fallback을 호스팅에 설정합니다.

의존성은 `package-lock.json`과 함께 관리하고 재설치는 `npm ci`를 사용합니다. 린트는 Oxlint입니다. 프론트의 `.test.*` 파일은 삭제했으며 기존 Vitest 설정은 유지합니다. 구현 규칙과 공통 오류·로딩·스크롤 사용법은 [convention.md](docs/convention.md), 설계 기준은 [page-first 스킬](.agents/skills/react-page-first-architecture/SKILL.md)을 참고하세요.

코드 포맷은 `.prettierrc`의 2칸 들여쓰기·작은따옴표·세미콜론·LF 기준을 사용합니다. `npm run format`으로 적용하고 `npm run format:check`로 검사합니다. 스킬·에이전트 설정, 생성물, lockfile은 `.prettierignore`에서 제외합니다. `package-lock.json`은 npm이 관리하며 반드시 함께 커밋합니다.
