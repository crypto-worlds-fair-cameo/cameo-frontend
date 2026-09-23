# Frontend Convention

설계·구현·검토 기준은 [react-page-first-architecture](../../.agents/skills/react-page-first-architecture/SKILL.md)입니다. 이 문서는 해당 기준으로 정리한 현재 boilerplate의 구현과 시작 방법을 설명합니다.

## 구조와 소유권

```text
src/
├── main.tsx                     # React 루트 생성
├── app/
│   ├── App.tsx                  # Provider·라우트·전역 UI 조립
│   ├── providers/               # 테마·QueryClient 설정
│   ├── router/                  # lazy 페이지 등록·메뉴/SEO 메타
│   ├── config/site.ts           # 브랜딩·레이아웃 프리셋
│   ├── layout/                  # 헤더·푸터·공통 셸
│   ├── menu/                    # 라우트에서 파생하는 내비게이션
│   └── styles/app.css           # 전역 토큰·기본 스타일
├── pages/
│   ├── home/
│   │   ├── HomePage.tsx         # 상태별 렌더링·섹션 조합
│   │   ├── ui/                 # 홈 전용 섹션
│   │   ├── model/              # 홈 콘텐츠 조회 모델
│   │   └── api/                # Promise 요청·타입·query key·조회 훅
│   └── not-found/NotFoundPage.tsx
└── shared/
    ├── api/http-client.ts       # Axios 기본 설정
    ├── lib/                    # cn·범용 훅
    └── ui/                     # 기존 primitive·범용 조합 UI
```

`vite-env.d.ts`와 `types/global.d.ts`는 빌드용 타입 선언입니다. 실제 공유 도메인·행동이 없으므로 `entities`·`features`는 만들지 않았습니다. 두 화면이 같은 도메인 개념 또는 행동을 공유할 때 스킬 기준으로 승격합니다.

## 의존 방향

- `app → pages → shared`, `app → shared` 방향을 유지합니다.
- 페이지는 다른 페이지 내부나 `app`을 import하지 않습니다. 홈의 브랜드 설명·프리셋 표시는 라우트가 props로 전달합니다.
- `shared`는 페이지·앱·제품 정책을 알지 않습니다. 모달과 로딩의 범용 UI 상태는 각각 `shared/ui/modal/model`, `shared/ui/loading/model`에 있습니다. 앱은 해당 전역 UI를 마운트합니다.
- 같은 페이지 안에서는 실제 구현 파일을 직접 참조합니다. 필요 없는 barrel·빈 역할 폴더·중간 wrapper는 만들지 않습니다.
- 경로 별칭은 Vite·TypeScript 모두 `@/` 하나를 사용합니다.

## 페이지와 데이터

페이지 진입점은 `pages/<page>/<Name>Page.tsx`입니다. 별도 UI는 `ui`, 상태·화면 동작은 `model`, 요청·전송 타입·query/mutation·캐시 정책은 `api`, 순수 계산은 `lib`에 둡니다. 사용하는 역할만 만듭니다.

홈은 `HomePage → useHomeContent → useHomePageQuery → getHomePageContent` 흐름입니다. 현재 요청 함수는 로컬 샘플 콘텐츠를 반환하며 백엔드 요청을 하지 않습니다. 실제 API를 붙일 때 페이지 소유 `api` 함수에서 `shared/api/http-client`를 사용합니다. 서버 결과를 로컬 store에 복사하지 않습니다. 오류는 로딩/데이터 유무보다 먼저 구분합니다.

## 라우팅·레이아웃

`app/router/route-config.tsx`가 URL·lazy 페이지·메뉴 표시·SEO 메타의 기준입니다. `navigationItems → app/menu/Menu.data.ts → Layout/Header/Menu`로 연결하고 메뉴 배열을 중복 정의하지 않습니다. 기존 SEO 필드는 메타데이터이며 별도 DOM 동기화 구현을 의미하지 않습니다.

`app/config/site.ts`에서 `web`, `mobile`, `landing` 프리셋을 선택합니다. 공통 셸은 `app/layout/Layout.tsx`에서 한 번 조립하며 lazy 페이지를 Suspense로 감쌉니다. 페이지가 셸을 복제하지 않습니다. 레이아웃 CSS는 `app/layout/layout.css`, 전역 토큰은 `app/styles/app.css`에 둡니다.

## 새 프로젝트와 공통 UI 설계

1. 루트 `PROJECT.md`에 목적·화면·행동을 정리합니다.
2. [공통 UI 설계 양식](../../docs/design.md)에 사용할 토큰·컴포넌트·상태·검토 결정을 기록합니다.
3. [시각 검토 양식](../../docs/pre-design.html)을 브라우저에서 열어 예시값을 프로젝트에 맞게 조정합니다.
4. 검토된 항목만 실제 `shared/ui`에 구현하고, 특정 페이지에만 필요한 구성은 그 페이지 `ui`에 둡니다.

설계 HTML은 공통 UI를 결정하기 위한 미리보기 양식입니다. 실제 구현은 `shared/ui`에 두며, shadcn 생성 경로는 `components.json`에서 관리합니다.

## 페이지 생성과 검증

저장소 루트에서 `./scripts/create-page orders-list`를 실행하면 `pages/orders-list/OrdersListPage.tsx`가 생성됩니다. 출력된 lazy import와 route object를 `app/router/route-config.tsx`에 추가하세요. 기존 페이지 디렉토리는 덮어쓰지 않습니다.

React 19·Vite·TypeScript·Tailwind v4·React Query·Zustand·Radix를 사용합니다. API 기본 URL은 `VITE_API_URL || /api`입니다. Provider 순서는 ThemeProvider → QueryClientProvider이며 StrictMode는 기본으로 활성화하지 않습니다.

앱 소유 코드는 4-space와 세미콜론을 기본으로 합니다. 기존 shadcn 파일은 생성 스타일을 유지합니다. 변경 후 `npm run lint`, `npm run build`를 실행하고 홈·404·내비게이션 및 변경한 상태 흐름을 브라우저에서 확인합니다. Vitest·Testing Library·jsdom 테스트를 `npm test`로 실행합니다.

## 공통 오류·로딩·탐색 수명주기

- `app/errors/ErrorBoundary.tsx`는 렌더링 및 lazy 모듈 로드 실패를 복구 UI로 격리합니다. App의 경계는 Provider 바깥에 있으며, Layout의 페이지 경계는 헤더·메뉴를 유지합니다. 오류 상세는 콘솔에 기록하고 화면에는 일반 안내만 표시합니다.
- 페이지 경계는 `location.key` 변경 시 실패 상태를 초기화합니다. 정상 페이지는 query 변경만으로 강제로 remount하지 않습니다. 청크 로드 실패는 새로고침으로 새 앱 파일을 요청합니다. 이벤트 핸들러·일반 비동기/API 실패는 해당 모델/API 흐름에서 처리합니다.
- 페이지·버튼은 자기 로딩 상태를 사용합니다. 전체 화면 대기가 필요한 경우에만 `useLoadingStore`를 사용합니다. `show()`가 반환한 작업 ID를 `hide(id)`에 전달하며, 미등록 또는 중복 해제는 다른 작업에 영향을 주지 않습니다.

```ts
const { show, hide } = useLoadingStore.getState();
const taskId = show();
try {
    await work();
} finally {
    hide(taskId);
}
```

- `hide()`에는 `show()`가 반환한 작업 ID를 전달합니다. 작업 취소·실패에도 ID를 해제해야 합니다. 모든 HTTP 요청을 이 전역 로딩에 자동 연결하지 않습니다.
- `app/layout/model/useMobileNavigation.ts`는 모바일 메뉴 상태를 소유합니다. 같은 URL을 포함한 메뉴·로고 선택, 외부 경로 변경, Escape 닫기를 처리합니다. 페이지에서 메뉴 store를 조작하지 않습니다.
- `app/layout/model/useRouteScroll.ts`는 web의 window와 mobile 프리셋의 main ref를 실제 스크롤 소유자로 사용합니다. PUSH/REPLACE는 맨 위, POP은 history entry별 저장 위치로 복원합니다. 최근 100개 위치를 앱 레이아웃 수명 동안 보관하며 첫 진입은 현재 위치를 유지합니다. 새로고침을 넘는 영구 저장은 하지 않습니다.
- 지연 콘텐츠가 짧으면 ResizeObserver/MutationObserver로 복원을 재시도합니다. 성공·사용자 입력·다음 이동·unmount 시 관찰을 정리합니다. 브라우저 자동 복원과 중복되지 않도록 마운트 동안 manual 모드로 전환하고 종료 시 원래 설정을 복구합니다.
- `npm test`는 Vitest·Testing Library·jsdom으로 오류 격리/복구, 페이지 상태 유지, 동시 로딩, 메뉴 닫기, 스크롤 history·지연·취소·정리를 검사합니다. jsdom은 실제 레이아웃이 없으므로 스크롤 변경은 브라우저에서도 확인합니다.

## i18n

초기화와 namespace 조립은 `app/i18n`, 범용 번역은 `shared/i18n/locales`, 페이지 번역은 `pages/<page>/config/locales`가 소유합니다. UI는 `react-i18next`의 `useTranslation(namespace)`을 사용하고 페이지에서 app 인스턴스를 import하지 않습니다. [다국어 구성 가이드](../../docs/i18n.md)를 참고하세요.
