# 시즌 캔버스 최종 교차 검증

검증일: 2026-10-07. 제품 코드와 기존 테스트 파일을 변경하지 않고 현재 구현을 검증했다.

## 최종 판정

핵심 흐름과 전체 자동 검사는 통과했다. 서브에이전트 두 명과 루트의 교차 검증 결과 High/Medium 문제는 없고, 종료 이후 append 소유권 처리에서 Low/P3 문제 한 건을 확인했다. 해당 문제는 미수정이며 아래 재현 근거와 보완 방향을 기록한다.

## 범위와 검증 분담

- 루트: 전체 format/lint/test/build, 브라우저 입력·렌더링·레이아웃·다이얼로그, 실제 서버의 익명 관람과 presence.
- `season_session_ui_audit`: phase one/two 기준 목록·생성·상세·관리·참가·workspace, 세션 캐시와 늦은 응답, page-first 의존 경계.
- `season_contract_audit`: 백엔드 원본과 phase two 기준 wire 계약, 종료 head·epoch·ACK·속도 제한·재시도·획 정책.

## 자동 검사

Node v24.21.0에서 아래 검사를 새로 실행했다.

| 명령                   | 결과                             |
| ---------------------- | -------------------------------- |
| `npm run format:check` | 통과                             |
| `npm run lint`         | 통과                             |
| `npm test`             | 31개 파일, 205개 테스트 통과     |
| `npm run build`        | TypeScript 검사와 Vite 빌드 통과 |
| `git diff --check`     | 통과                             |

UI·세션 담당 에이전트는 시즌 및 공유 캔버스 관련 26개 파일, 175개 테스트와 해당 경로 Oxlint를 독립 실행해 통과했다. 추가 High/Medium 문제는 발견하지 못했다.

## 발견한 문제: 종료 이후 폐기된 append의 소유권이 남는다 — Low/P3

위치: [append의 비동기 전송과 응답 처리](../../../src/features/canvas-workspace/model/canvasSync.ts), 특히 527–531, 575–626행. 종료 처리의 672–683행은 pending을 비우지만 진행 중 append의 generation은 바꾸지 않는다. ready의 417–449행과 recover 완료의 368–371행도 같은 사용자 pending을 ended 연결에서 재전송할 수 있다.

세 가지 경로를 제품 코드 변경 없이 재현했다.

1. append ACK 대기 중 ended 이벤트가 도착한다. 이후 `SEASON_NOT_ACTIVE` ACK가 오면 최종 head 복구가 끝난 뒤에도 `error.code: SEASON_NOT_ACTIVE`, `submissionStatus: failed`가 남는다.
2. active 연결에서 미확정 append를 가진 채 끊겼다가 같은 epoch의 ended ready로 재접속하면 append 호출 수가 1에서 2로 늘며 이미 종료된 요청을 다시 보낸다.
3. 초당 30개 전송 뒤 31번째가 로컬 속도 제한 대기 중일 때 ended 이벤트로 pending을 폐기한다. 1001ms 후 폐기된 요청이 전송돼 호출 수가 30에서 31로 늘어난다.

계약 담당 에이전트가 `/private/tmp/season-terminal-race.test.ts`에 재현을 작성했고, 루트도 아래 명령으로 독립 실행해 세 경로를 확인했다. 이 테스트는 결함 상태가 발생함을 확인하는 재현이며 정상 동작을 검증하는 회귀 테스트가 아니다.

```sh
./node_modules/.bin/vitest run --root /private/tmp --config /private/tmp/vitest.config.ts
```

UI·세션 에이전트도 늦은 거절이 정상 종료 화면에 읽기 전용 alert를 중복 표시하는 것을 코드에서 확인했다. 양쪽 에이전트와 루트는 최종 head 복구가 계속되고, 서버가 종료된 append를 거절하며, 확정 그림의 유실·권한 우회·관람 중단 근거가 없다는 점에서 Low/P3로 평가했다.

보완 방향은 전송 대기 후·ACK 후·오류 처리 전 현재 pending 소유권을 다시 확인하는 것이다. ended/cancelled ready에서는 과거 pending을 재전송하지 않고 승인된 최종 head를 sync한다. 이후 회귀 테스트는 종료 뒤 `error: null`, `submissionStatus: idle` 유지와 추가 append 0회를 검증해야 한다.

## 실제 로컬 서버 확인

백엔드 `http://localhost:5000`, 프론트 `http://localhost:5173`에서 익명으로 읽기만 수행했다. 서버 인증이나 DB 쓰기는 수행하지 않았다.

- 공개 목록에서 종료 시즌을 조회하고 관람 링크로 작업 화면에 진입했다.
- guest ready에 `canDraw:false`, `status:ended`, 1000×1000 크기가 전달됐다.
- 최초 sync의 `reset:true` 뒤 head 128을 고정해 50·50·28개 좌표 묶음으로 복구했다. 부분 획도 렌더링됐다.
- 두 번째 탭을 열면 관람 연결 수가 1에서 2로 늘고, 탭 종료 후 1로 복원됐다. 참가 수는 1/20을 유지했다.
- 360×640, 390×844, 1440×900에서 문서 scrollWidth와 clientWidth가 같았다. 모바일 상태·도구 패널은 내부 스크롤을 유지하고 캔버스 높이가 양수였다.

현재 백엔드는 `http://localhost:5173` Origin을 허용한다. `5174`에서는 `/auth/me`가 CORS에 막혀 프론트가 세션 확인 오류를 표시했다. 실제 연동 확인 주소는 `http://localhost:5173/season-canvas`다. 다른 포트를 사용할 때는 해당 Origin을 백엔드 허용 목록에 맞춰야 한다.

## 로컬 테스트 응답 확인

실제 서버의 데이터를 바꾸지 않도록 별도 Playwright 브라우저 `season-mock-final`에 HTTP·Socket.IO 테스트 응답을 설치했다. 테스트 fixture는 `/private/tmp`에만 있으며 제품 코드에 포함하지 않는다.

- active 시즌 참가 POST 본문은 없었다. 참가 수 1/4에서 2/4로 바뀌고 참가 후 새 handshake와 sync가 실행됐다.
- 제한 2 시즌에서 두 획을 final ACK까지 저장한 뒤, 세 번째 시도는 서버 한도 오류를 표시했다.
- 연습 모드 입력은 append를 보내지 않았다.
- scheduled 기존 참가자는 active 이벤트 뒤 한 번 재연결했다. 개인 권한은 새 ready에서 확인했다.
- 무제한 시즌에서 두 획을 완료했다. 세 번째 진행 중 획의 종료 이벤트 뒤 새 입력은 append를 보내지 않았다. 이벤트의 head 5까지 `throughSequence:'5'`로 sync했다.
- epoch 변경 후 재연결·sync로 저장된 부분 획이 다시 표시됐다.
- 생성 폼의 빈 제목 거절, Tab 포커스의 다이얼로그 내부 유지, Escape 닫기와 생성 버튼 포커스 복원, 상세의 관람 링크를 확인했다.

## 확인하지 않은 범위

실제 지갑 로그인, 로그인된 사용자의 참가·append, 서버의 자연/조기 종료 transaction, 프로세스 재시작과 DB 내구성은 이번 실제 서버 검증 범위에 포함하지 않았다. 해당 프론트 경로는 테스트 응답과 자동 테스트로 검증했다.

기존 React script 태그 경고와 favicon 404는 콘솔에 남아 있다. 익명 `/auth/me`의 401은 예상된 응답이다. 제품·테스트 파일의 수정, 커밋, 배포는 수행하지 않았다.
