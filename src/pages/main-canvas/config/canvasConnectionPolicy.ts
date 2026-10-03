// 최초 접속은 제외한다. 자동 재연결과 서버 정책에 따른 재시도가 이 한도를 함께 쓴다.
export const MAX_CANVAS_RETRIES = 3;
export const CANVAS_ATTEMPT_TIMEOUT_MS = 10_000;
export const CANVAS_READY_TIMEOUT_MS = 5000;
export const CANVAS_RESET_TIMEOUT_MS = 5000;
