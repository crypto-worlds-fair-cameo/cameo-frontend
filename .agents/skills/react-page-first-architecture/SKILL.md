---
name: react-page-first-architecture
description: Use when designing, creating, reviewing, or refactoring React and TypeScript frontend architecture with page-first ownership. Organizes page internals into ui, model, api, lib, and config directories; covers page composition, shared features and entities, import boundaries, state, and cache ownership.
metadata:
    version: '2.1.0'
    convention: 'page-first-vertical-slice'
---

# React Page-first Architecture

React 프론트엔드를 page-first 방식으로 설계한다. 코드의 소유권과 변경 범위를 기준으로 파일을 배치하고, 실제 재사용이 필요한 경우에만 공용 계층으로 분리한다.

## 설계 원칙

- 한 기능을 이해하기 위해 여러 최상위 폴더를 오가지 않도록 관련 코드를 가까이 둔다.
- 새로운 화면 기능은 사용하는 페이지에서 시작한다. 다른 페이지에서 사용할 필요가 생기기 전까지는 해당 페이지 안에 둔다.
- 페이지 루트에는 페이지 진입점을 두고, 내부 구현 파일은 역할에 따라 `ui`, `model`, `api`, `lib`, `config` 하위에 배치한다.
- 페이지는 화면의 주요 블록과 사용자 흐름을 보여준다. 파일 길이보다 책임의 명확성을 우선한다.
- 여러 페이지에서 같은 기능과 규칙을 사용하는 코드는 공용화한다. 모양만 비슷하고 동작이나 변경 이유가 다르면 별도로 유지한다.
- 필요한 파일·계층만 만든다. 빈 폴더, 책임 구분 없이 전달 단계만 늘리는 wrapper, 형식적인 index는 만들지 않는다.

## 1. 요청을 구조로 바꾸는 순서

1. **화면과 행동**: URL별 화면, 주요 사용자 행동, 정상·실패 흐름을 정한다.
2. **데이터와 수명주기**: 서버 데이터, URL 조건, 입력 draft, 일시 UI 상태, 세션을 구분한다.
3. **소유자**: 각 UI·상태·API·타입을 아래 소유권 기준에 따라 배치한다.
4. **공유 경계**: 복수 소비자가 같은 의미로 사용하는 부분만 승격한다. 새 설계에서도 요구사항에 명시된 두 화면의 사용은 재사용 근거다.
5. **의존성**: 공개할 항목과 허용 import를 정하고 역방향·순환 의존이 없는지 확인한다.
6. **흐름 점검**: 사용자 행동 → 상태/API 변경 → cache → 화면 반영이 추적되는지 확인한다.
7. **검증**: 변경된 경계에 맞는 정적 검사와 실행 동작을 선택한다.

기존 프로젝트에서는 먼저 실제 route, 관련 코드, 소비자, 실행 가능한 검사 명령을 조사한다. 새 프로젝트에서는 알려진 요구로 시작하고, 제품 결과를 바꾸는 미정 사항만 질문한다. 폴더명 같은 일상적인 선택은 아래 기본값으로 결정한다.

## 2. 기본 구조와 소유권

작게 시작한다.

```text
src/
├── app/       # 실행과 전역 조립
├── pages/     # URL 단위 화면
└── shared/    # 제품 비종속 기반 코드
```

필요가 입증되면 `features`, `entities`를 추가한다. 반드시 다섯 계층을 갖출 필요는 없다.

- **컴포넌트의 하위 UI**는 사용하는 컴포넌트를 소유한 모듈의 `ui/` 안에 둔다. 페이지의 하위 UI는 페이지에, feature의 하위 UI는 해당 feature에 둔다.
- **페이지 진입점인 `*Page.tsx`**는 `pages/<page>` 루트에 두고, 화면의 주요 컴포넌트를 조합한다.
- **페이지 내부 구현 파일**은 같은 페이지 폴더 안에서 역할별로 나눈다. UI는 `ui/`, 상태와 훅은 `model/`, 요청은 `api/`, 보조 함수는 `lib/`, 설정은 `config/`에 둔다.
- **여러 페이지에서 사용하는 동일한 사용자 행동**은 `features/<verb-noun>`으로 묶는다. 취소·초대·내보내기처럼 하나의 행동에 필요한 UI·상태·mutation을 함께 관리한다.
- **여러 화면에서 공유하는 도메인 개념**은 `entities/<noun>`에 둔다. 해당 개념의 타입·표시 컴포넌트·조회·규칙·query key를 관리한다.
- **제품 기능에 종속되지 않는 범용 코드**는 `shared`에 둔다. Button·Dialog 같은 UI, HTTP 통신 기반 코드, 날짜 포맷 함수, 범용 hook이 여기에 해당한다.
- **애플리케이션의 실행과 전역 조립 코드**는 `app`에 둔다. router, provider 연결, 공통 레이아웃, 전역 스타일, 초기화 흐름을 관리한다.

### 승격 판단

- **feature**: 복수 화면이 동일한 행동을 사용하고, 그 행동의 UI·상태·API를 하나의 변경 경계로 묶을 가치가 있을 때 만든다.
- **entity**: 복수 소비자가 공유하는 안정된 도메인 개념이 있을 때 만든다. 모든 API resource에 entity를 만들지는 않는다.
- **shared**: 다른 제품에서도 이름과 의미가 자연스러운 코드만 둔다. 주문 권한·로그인 정책은 범용 기반 코드가 아니다.
- 두 코드가 서로 다른 이유로 변한다면 중복이 조금 있어도 분리한다. 사용 횟수만으로 공용화하지 않는다.

## 3. Page 내부 설계

페이지 루트에는 `<Name>Page.tsx`와 필요한 공개 진입점(`index.ts`)을 둔다. 별도 파일로 만든 내부 구현은 역할별 하위 폴더에 배치한다. UI 파일이 하나뿐이어도 페이지 진입점 옆이 아니라 `ui/`에 둔다.

```text
pages/orders-list/
├── OrdersListPage.tsx
├── ui/
│   ├── OrdersHeader.tsx
│   └── OrdersTable.tsx
├── model/
│   ├── useOrdersFilters.ts
│   └── useOrdersList.ts
├── api/
│   ├── ordersList.api.ts
│   ├── orders.queries.ts     # React Query 사용 시
│   └── orders.mutations.ts   # React Query 사용 시
└── lib/
    └── parseOrdersFilters.ts
```

역할별 하위 폴더 배치는 기본 규칙이다. 파일명과 폴더 구성은 필요한 책임에 맞춰 선택하며, 해당 역할의 파일이 없으면 폴더도 만들지 않는다. 예를 들어 UI만 있는 페이지는 진입점과 `ui/`만 있으면 된다.

- `ui`: 화면 블록을 구성하고, 훅이나 props로 받은 데이터·상태·이벤트 핸들러를 JSX에 연결한다.
- `model`: 폼·선택·모달 상태, 검증, 여러 행동의 조합을 담당한다. URL 읽기·변경과 필터 상태 연결은 모델 훅에서 처리한다.
- `api`: Promise 요청, DTO, query·mutation 전용 훅, query key, mapper, 캐시 정책을 관리한다.
- `lib`: 소유 모듈의 순수 계산·파싱·변환을 담당한다. URL 값의 파싱·변환도 여기에 둔다.
- `config`: 소유 모듈의 정적 설정을 관리한다.

### 컴포넌트 가까이에 두는 범위

하위 UI·UI 테스트·스타일은 `ui/` 안에서 해당 컴포넌트 가까이에 둔다. 관련 파일이 모이면 아래처럼 묶는다.

```text
pages/orders-list/ui/OrdersTable/
├── OrdersTable.tsx
├── OrderRow.tsx
├── OrdersTable.test.tsx
└── OrdersTable.module.css
```

별도 파일로 분리한 모델 훅과 폼 검증 스키마는 소유 모듈의 `model/`, HTTP 요청 함수와 query·mutation 전용 훅은 `api/`, 순수 계산·파싱 함수는 `lib/`에 둔다. 특정 컴포넌트에서만 사용하는 파일도 같은 기준으로 배치한다. 관련 모델 파일이 여러 개라면 `model/orders-table/`처럼 역할 폴더 안에서 묶을 수 있다.

props 타입과 화면 표시를 위한 간단한 계산은 해당 컴포넌트 파일 안에 둘 수 있다.

### 페이지 진입점과 모델 훅

페이지와 UI 컴포넌트는 필요한 모델 훅 호출과 JSX 구성에 집중한다. `*Page.tsx`는 훅이 제공하는 데이터·상태·이벤트 핸들러를 UI 컴포넌트에 연결하고, 필터·테이블·페이지 이동 영역 같은 주요 화면 블록을 조립한다. 복잡한 행 렌더링이나 독립적인 모달은 `ui/`의 컴포넌트로 분리한다.

데이터 조회와 상태·동작은 `model/`에서 책임별 훅으로 관리한다. **함께 동작하고 같은 이유로 변경되는 상태와 처리 로직을 하나의 훅으로 묶는다.** 예를 들어 URL 필터와 필터 변경은 `useOrdersFilters`, 필터에 따른 목록 조회는 `useOrdersList`가 담당한다. 상태 변수마다 훅을 만들거나, 페이지의 모든 책임을 하나의 훅에 모으지 않는다.

페이지는 여러 모델 훅을 직접 호출하고 필요한 값을 인자로 연결할 수 있다. 여러 훅 사이의 상태 전환이나 실행 순서 조정이 복잡할 때만 `model/use<Name>Page.ts`를 추가해 조합한다. 단순히 여러 훅의 반환값을 모으기 위한 중간 훅은 만들지 않는다. 화면의 데이터 접근을 맡는 책임별 모델 훅은 조회만 필요한 경우에도 둘 수 있다.

모델 훅은 `api/`의 query·mutation 전용 훅을 사용해 화면 동작을 연결한다. 서버 상태는 React Query 같은 조회·캐시 계층이 관리하며, 화면에 표시하기 위해 모델 훅의 로컬 상태로 복사하지 않는다.

특정 UI 내부에서 끝나는 상태와 동작은 `model/useOrdersTable.ts`처럼 해당 UI의 모델 훅에서 관리하고, 해당 컴포넌트가 호출해 사용한다. 다른 UI와 함께 사용하는 상태는 페이지에서 모델 훅을 호출하고 props로 전달한다. 동일한 상태를 공유해야 하는 컴포넌트가 각각 훅을 호출해 별도 상태를 만들지 않는다. 데이터 조회나 상태·동작이 없는 페이지와 컴포넌트에는 형식적인 훅을 만들지 않는다.

## 4. 의존 방향과 공개 API

```text
app      → pages, features, entities, shared
pages    → features, entities, shared
features → entities, shared
entities → shared
shared   → 외부 패키지, shared 내부
```

- 다른 page의 private UI/model/api를 가져오지 않는다.
- 서로 다른 feature끼리, 서로 다른 entity끼리의 의존도 기본적으로 피한다. 관계없는 책임을 하나로 묶거나 shared로 내려서 금지를 우회하지 않는다.
- entity 간 데이터를 결합해야 하면 page/feature에서 조합하거나 필요한 최소 타입·값을 인자로 전달한다.
- 같은 slice 안에서는 실제 파일을 직접 import한다. 자기 index를 거치며 순환 참조를 만들지 않는다.
- 경계 밖에서 사용할 feature/entity 항목은 `index.ts`에 명시적으로 export한다. private 구현은 숨기고 `export *`는 사용하지 않는다.
- shared는 UI·API·lib 등 각 모듈에서 필요한 항목을 참조한다. 전체 shared를 재수출하는 거대한 barrel을 만들지 않는다.

### 라우팅 처리

- 라우터는 페이지 진입점인 `*Page.tsx`를 직접 import할 수 있다. 페이지 내부 구현 파일을 외부에서 가져오는 것과 구분한다.
- 파일 기반 라우팅에서는 프레임워크가 요구하는 진입 파일을 사용한다. URL이 중첩되어 있어도 서로 다른 페이지의 내부 구현을 직접 공유하지 않는다.

### 세션과 인증

- 여러 페이지가 사용하는 사용자 정보와 세션 상태는 `entities/session` 같은 공유 도메인 모듈에서 관리한다.
- `app/`은 세션 Provider와 초기화 흐름을 연결한다. 페이지는 공유 세션 모듈을 사용하고, `app/` 내부 구현을 직접 참조하지 않는다.
- 공통 HTTP 클라이언트에 인증 처리가 필요해도 `app/` 내부 구현을 직접 가져오지 않는다. 필요한 인증 기능은 외부에서 전달받는다.

## 5. API와 타입 배치

### 요청과 캐시의 소유권

- HTTP 요청 함수는 React와 무관한 Promise 함수로 작성한다. React Query를 사용하면 해당 함수를 호출하는 query·mutation 전용 훅도 `api/`에 정의하고, `model/`의 훅에서 사용한다. React Query를 사용하지 않으면 모델 훅에서 요청 함수를 사용한다.
- 페이지 전용 요청은 `pages/<page>/api/`, 공유 도메인 조회는 `entities/<entity>/api/`, 공유 사용자 행동의 요청은 `features/<feature>/api/`에 둔다. 범용 HTTP 클라이언트는 `shared/api/`에 둔다.
- query·mutation 전용 훅은 해당 요청을 소유한 모듈의 `api/`에 둔다. 조회·변경과 캐시 처리를 담당하며, 폼·선택·모달·화면 이동 같은 UI 상태와 동작은 포함하지 않는다.
- 한 페이지 안에서만 사용하는 query key는 페이지의 `api/`에 둔다. 다른 페이지나 feature가 관련 캐시를 조회·갱신해야 하면 key 정의를 공유 도메인 모듈의 `api/`에서 관리하고 공개한다. key를 공유하기 위해 페이지 전용 요청 함수까지 옮기지는 않는다.
- 관련 캐시를 조회·갱신하는 코드는 query key 정의를 공유한다. 목록과 상세, 서로 다른 필터·대상처럼 결과가 다른 조회는 구분되는 key를 사용한다.
- mutation의 캐시 갱신은 `api/`에 둔다. 성공 후 모달 닫기·선택 해제·화면 이동 같은 동작은 `model/`의 훅에서 처리한다.

### 타입과 데이터 변환

- 요청·응답 타입은 해당 요청의 `api/`에 둔다.
- 폼·상태 타입은 해당 로직의 `model/`에 둔다.
- 컴포넌트 props 타입은 해당 UI 파일에 둔다.
- 여러 모듈이 공유하는 도메인 타입은 `entities/<entity>/` 안에서 역할에 맞는 위치에 둔다. 의미와 구조가 같은 타입은 불필요하게 복제하지 않는다. 전송 계약과 도메인 모델의 의미나 변경 이유가 다르면 별도로 정의한다.
- 서버 응답과 화면에서 필요한 데이터 형태가 다를 때만 mapper를 둔다. 전송 형식을 도메인 데이터로 바꾸는 변환은 `api/`, 화면 표시를 위한 순수 계산·변환은 `lib/`에 둔다.

## 6. 설계 예시

요구: 주문 목록과 상세, URL 목록 필터, 두 화면에서 같은 주문 취소, 공통 세션. React Query를 사용하는 예시다.

```text
src/
├── app/
│   ├── router/
│   └── providers/
├── pages/
│   ├── orders-list/
│   │   ├── OrdersListPage.tsx
│   │   ├── ui/
│   │   │   ├── OrdersFilters.tsx
│   │   │   └── OrdersTable.tsx
│   │   ├── model/
│   │   │   ├── useOrdersFilters.ts
│   │   │   └── useOrdersList.ts
│   │   ├── api/
│   │   │   ├── orders.api.ts
│   │   │   └── orders.queries.ts
│   │   └── lib/
│   │       └── parseOrdersFilters.ts
│   └── order-detail/
│       ├── OrderDetailPage.tsx
│       ├── ui/
│       │   └── OrderDetails.tsx
│       ├── model/
│       │   └── useOrderDetail.ts
│       └── api/
│           ├── orderDetail.api.ts
│           └── orderDetail.queries.ts
├── features/
│   └── cancel-order/
│       ├── index.ts
│       ├── ui/
│       │   └── CancelOrderDialog.tsx
│       ├── model/
│       │   └── useCancelOrder.ts
│       └── api/
│           ├── cancelOrder.api.ts
│           └── cancelOrder.mutations.ts
├── entities/
│   ├── order/
│   │   ├── index.ts
│   │   ├── model/
│   │   │   └── order.types.ts
│   │   └── api/
│   │       └── order.keys.ts
│   └── session/
│       ├── index.ts
│       └── model/
│           ├── SessionProvider.tsx
│           └── useSession.ts
└── shared/
    ├── api/
    │   └── httpClient.ts
    └── ui/
        └── Button.tsx
```

- `useOrdersFilters`는 URL 필터와 변경 처리를 맡는다. `useOrdersList`는 필터를 받아 `api/orders.queries.ts`의 query 전용 훅을 사용하고, 화면에 필요한 데이터와 조회 상태를 제공한다. `OrdersListPage.tsx`는 두 훅을 호출하고 반환된 값과 핸들러를 UI에 연결한다.
- 상세 페이지는 `useOrderDetail`에서 `api/orderDetail.queries.ts`의 query 전용 훅을 사용한다. 목록·상세 전용 요청과 query는 각각의 페이지 `api/`에 남는다.
- 두 페이지는 `cancel-order`의 공개 항목인 `useCancelOrder`와 `CancelOrderDialog`를 사용한다. 각 페이지에서 훅을 한 번 호출해 취소 대상·확인창 상태·이벤트 핸들러를 연결한다. `useCancelOrder`는 `api/cancelOrder.mutations.ts`의 mutation 전용 훅을 사용해 확인창 동작을 연결한다. mutation 전용 훅은 `order`가 공개한 query key 정의로 목록·상세 캐시를 갱신한다. feature는 페이지를 import하지 않는다.
- `order`에는 실제로 공유하는 도메인 타입과 query key를 둔다. 한 페이지에서만 쓰는 요청까지 entity로 옮기지 않는다.
- `app/`은 `SessionProvider`를 연결하고, 세션이 필요한 모델 훅은 `session`이 공개한 `useSession`을 사용한다.
- 주문 취소가 상세 한 곳에서만 필요하다면 해당 UI·모델 훅·요청·mutation은 상세 페이지 안에 둔다.

이 예시는 필터·조회·취소를 각각의 책임으로 나눈다. 페이지 전체를 감싸는 훅은 필수가 아니며, 이 책임들 사이의 조정이 복잡해질 때 추가한다.

## 7. 검증

실제 프로젝트에 있는 검사 도구를 확인하고 다음 중 변경에 해당하는 검증을 수행한다. 특정 package manager나 test script를 가정하지 않는다.

- **신규 구조 설계**: 페이지 진입점과 역할별 폴더 배치, 코드의 소유권, 책임별 훅 분리, import 방향과 공개 항목을 확인한다. 상태가 생성·공유·초기화되는 범위와 주요 성공·실패 흐름이 요구사항에 맞는지 검토한다.
- **파일 이동·라우팅·타입 변경**: 변경에 필요한 타입 검사·lint·빌드를 수행한다. 변경한 라우트의 진입 동작과 공개 export·import 경계를 확인한다.
- **폼·query·mutation 변경**: 관련 테스트나 실행으로 변경한 흐름을 확인한다. 정상·오류·빈 결과·처리 중 상태와 URL 복원·캐시 영향 중 변경에 해당하는 항목을 점검한다.
- **세션·외부 시스템 동기화 변경**: 초기화·실패·재시도·구독 및 자원 정리 중 변경한 경로를 확인한다.
- **문서·스킬만 변경**: 설명과 예시의 일관성, 요구사항에 적용할 수 있는지, 문서 형식을 확인한다.

lint 통과와 계층 경계 준수, build 성공과 런타임 동작 확인은 서로 다른 증거다. 테스트가 없으면 대체 확인과 미검증 범위를 밝힌다. 수행하지 않은 검사를 통과로 보고하지 않는다. 완료된 검증을 새 근거 없이 반복하지 않는다.

## 8. 기존 구조 변경과 예외

이 섹션은 기존 구조가 이 스킬과 다른 프로젝트에 적용한다. 새 프로젝트는 앞선 설계 규칙을 바로 적용한다.

- **새 코드에는 스킬의 구조를 적용한다.** 새 페이지·컴포넌트·훅·요청 파일은 소유권과 역할에 맞게 배치한다. 기존 코드가 페이지 루트에 섞여 있다는 이유로 같은 배치를 확장하지 않는다.
- **변경하는 책임을 중심으로 구조를 정리한다.** 기존 기능을 추가·수정할 때는 해당 UI·상태·요청 중 변경하는 책임에 이 스킬을 우선 적용한다. 필요하면 관련 로직을 역할별 파일과 훅으로 분리하되, 같은 파일이나 페이지에 있다는 이유만으로 나머지 구현까지 모두 재구성하지 않는다.
- **구조 정리의 범위는 요청과 직접 연결한다.** 단순 문구·스타일 수정은 폴더 이동이나 훅 분리의 계기로 삼지 않는다. 다른 페이지·공용 모듈까지 대규모 변경이 필요하면 이번 작업에 필요한 연결만 처리하고, 나머지는 별도 구조 정리 대상으로 남긴다.
- **이동한 코드의 연결과 동작을 유지한다.** 파일을 이동하거나 진입점을 정리하면 관련 import·공개 export·라우터·lazy loading 연결을 함께 수정하고 검증한다. 기존 진입점 이름만 다르다는 이유로 일괄 변경하지 않는다.
- **기존 구조를 유지하는 예외는 해당 범위에 한정한다.** 이번 변경에서 스킬의 구조를 적용하기 어려운 부분은 이유와 남겨둔 범위를 설명한다. 이 예외를 다른 새 코드의 배치 기준으로 사용하지 않는다.
