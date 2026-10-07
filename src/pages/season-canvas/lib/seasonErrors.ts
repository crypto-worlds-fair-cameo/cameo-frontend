import { SeasonRequestError } from '../api/seasons.types';

export type SeasonErrorKey =
  | 'inputInvalid'
  | 'sessionInvalid'
  | 'originNotAllowed'
  | 'userUnavailable'
  | 'activeLimit'
  | 'capacityReached'
  | 'ownerRequired'
  | 'stateConflict'
  | 'notFound'
  | 'unavailable'
  | 'unknown';

/** 서버 message가 아닌 안정된 code와 전송 유형으로 사용자 안내를 고른다. */
export function getSeasonErrorKey(error: unknown): SeasonErrorKey {
  if (!(error instanceof SeasonRequestError)) return 'unknown';
  if (error.kind === 'transport' || error.kind === 'invalid-response') return 'unavailable';
  switch (error.code) {
    case 'SEASON_INPUT_INVALID':
    case 'BadRequestException':
      return 'inputInvalid';
    case 'AUTH_SESSION_INVALID':
      return 'sessionInvalid';
    case 'AUTH_ORIGIN_NOT_ALLOWED':
      return 'originNotAllowed';
    case 'AUTH_USER_UNAVAILABLE':
      return 'userUnavailable';
    case 'SEASON_ACTIVE_LIMIT_REACHED':
      return 'activeLimit';
    case 'SEASON_CAPACITY_REACHED':
      return 'capacityReached';
    case 'SEASON_OWNER_REQUIRED':
      return 'ownerRequired';
    case 'SEASON_STATE_CONFLICT':
      return 'stateConflict';
    case 'SEASON_NOT_FOUND':
      return 'notFound';
    default:
      return 'unknown';
  }
}

/** 전송 실패와 5xx·잘못된 응답은 생성 결과가 불명확하므로 재전송을 막는다. */
export function isAmbiguousWriteError(error: unknown): boolean {
  return (
    error instanceof SeasonRequestError &&
    (error.kind === 'transport' ||
      error.kind === 'invalid-response' ||
      (error.statusCode !== undefined && error.statusCode >= 500))
  );
}
