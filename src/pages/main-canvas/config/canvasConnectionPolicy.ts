// Socket.IO transport 연결 시도의 제한 시간이다. 자동 재연결은 컨트롤러가 따로 예약한다.
export const CANVAS_ATTEMPT_TIMEOUT_MS = 10_000;
// transport 연결 이후 캔버스 권한과 초기 데이터를 기다리는 제한 시간이다.
export const CANVAS_READY_TIMEOUT_MS = 5000;
// 복구 대기는 1초부터 두 배씩 늘리고, 기본 지연은 최대 8초로 제한한다.
export const CANVAS_RETRY_BASE_DELAY_MS = 1000;
export const CANVAS_RETRY_MAX_DELAY_MS = 8000;
// ready 없이 반복되는 서버 강제 종료만 세 번 뒤 영구 실패로 본다.
export const MAX_UNEXPLAINED_SERVER_DISCONNECTS = 3;
