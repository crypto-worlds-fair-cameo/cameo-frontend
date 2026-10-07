# 시즌 캔버스 2단계 구현 계획

**Goal:** 시즌 참가와 시즌별 실시간 관람·그리기·종료·복구를 구현한다.

**Spec:** [백엔드 연동 지침](../../../../backend/docs/frontend/season-canvas-phase-two.md).

**Architecture:** 기존 캔버스의 API·동기화·렌더링을 `features/canvas-workspace`로 옮겨 메인과 시즌이 공개 API로 사용한다. 목록과 작업 화면은 `pages/season-canvas`가 소유하며 기존 세션별 HTTP 캐시를 공유한다. 시즌별 연결은 페이지 수명과 세션 세대에 묶는다.

**Execution:** 현재 세션에서 직접 구현한다. 사용자가 연동 검토 후 구현 시작을 요청했으므로 해당 흐름과 라우트를 구현한다. 기존 작업을 유지하며 커밋과 배포는 수행하지 않는다.

## 제약

- 의존성 추가 없음. 메인 protocolVersion 1 wire shape 유지.
- HTTP 쿠키 포함, 소켓은 HTTP prefix 없는 origin의 `/canvas`, path `/realtime` 사용.
- 시즌 UUID v4와 수신 canvasKey를 검증한다. ready에는 epoch/head가 없다.
- 새 입력은 active·canDraw·sync 완료를 모두 요구한다. 브라우저 시각은 승인 근거가 아니다.
- 참가 수와 연결 수를 구분하고 남은 획 수를 확정값처럼 표시하지 않는다.
- 모든 이벤트·타이머·비동기 결과는 대상 캔버스와 세션 소유권을 확인한다.

## 작업

- [x] 공통 캔버스 추출: API·모델·렌더러·viewport와 관련 테스트를 함께 이동하고 공개 진입점을 만든다. 메인 화면과 테스트의 동작을 유지한다.
- [x] 시즌 계약: canvasKey·크기 기반 preview/sync 검증, 시즌 ready/state/reset 계약과 handshake auth를 추가한다. 다른 캔버스 응답과 경계 좌표를 거절하는 테스트를 작성한다.
- [x] 동기화 확장: 시즌 획 정책, fixed-head 복구 버퍼, rate 제한, 종료 head 복구, epoch 교체와 세션 입력 폐기를 구현한다. 숫자 제한·무제한·중복 ACK·늦은 종료 preview·서버 재시작을 테스트한다.
- [x] 참가 API: `joinSeason(id): Promise<Season>`와 scoped mutation을 추가한다. 중복 클릭 방지, 타임아웃 재시도, 정원·상태 오류 갱신, 이전 세션 응답 차단을 테스트한다.
- [x] 시즌 화면: `/season-canvas/:seasonId`, 관람 링크, 참가·상태·연결 수·그리기 제한 UI와 한국어/영어를 추가한다. ready 갱신·active 전환·종료·404·세션 변경을 연결한다.
- [x] 검증: 전체 format/lint/test/build, 메인 회귀, 로컬 테스트 응답을 사용하는 모바일·데스크톱 브라우저 검증과 [보고서](../reviews/2026-10-07-season-canvas-phase-two.md)를 작성한다.

## 검토 초점

- 참가 HTTP 성공과 소켓 ready 사이에는 입력을 열지 않는다.
- 같은 사용자 재로그인도 이전 ACK 대기를 새 세션에 넘기지 않는다.
- 종료 이벤트가 기존 sync 도중 도착해도 최종 head를 끝까지 복구한다.
- epoch 교체는 데이터 삭제로 안내하지 않는다. 저장된 부분 획도 렌더링한다.
- flag=false에서는 관람이 유지되며, canDraw=false만으로 원인을 flag라고 추측하지 않는다.
- 자동 재시도는 일시 오류에만 적용하고 terminal reset·영구 업무 오류는 멈춘다.

## 실환경 검증 경계

사용자는 앞선 작업에서 로컬 테스트 응답 검증을 선택했다. 실제 서버의 CORS·쿠키·배포·DB·쓰기 flag와 실제 지갑 인증은 해당 서버가 준비됐을 때 별도 확인한다. 테스트 응답은 제품 코드에 넣지 않는다.
