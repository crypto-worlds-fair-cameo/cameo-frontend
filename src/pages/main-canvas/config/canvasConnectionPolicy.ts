// 최초 접속은 제외한다. 자동 재연결과 서버 정책에 따른 재시도가 이 한도를 함께 쓴다.
export const MAX_CANVAS_RETRIES = 3;
// 접속 시도와 자동 복구 진행을 기다리는 최대 시간이다. connect 수신만으로 기한을 늘리지 않는다.
export const CANVAS_ATTEMPT_TIMEOUT_MS = 10_000;
// Socket.IO connect 이후 서버의 connection:ready 응답을 기다리는 시간이다.
export const CANVAS_READY_TIMEOUT_MS = 5000;
// connection:reset 이후 실제 disconnect를 기다린 뒤 로컬에서 연결을 정리하는 시간이다.
export const CANVAS_RESET_TIMEOUT_MS = 5000;
