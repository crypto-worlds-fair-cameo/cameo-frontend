import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { getProfileSaveErrorKey } from './useProfileEditForm';

function httpError(status: number, data?: unknown) {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

describe('profile save errors', () => {
  it('maps server responses to page messages without exposing raw errors', () => {
    expect(getProfileSaveErrorKey(httpError(400, { code: 'USER_DISPLAY_NAME_INVALID' }))).toBe(
      'invalid'
    );
    expect(getProfileSaveErrorKey(httpError(401))).toBe('sessionExpired');
    // 닉네임 중복은 허용하며, 계약에 없는 409는 일반 저장 실패로 처리한다.
    expect(getProfileSaveErrorKey(httpError(409))).toBe('failed');
    expect(getProfileSaveErrorKey(httpError(429))).toBe('rateLimited');
    expect(getProfileSaveErrorKey(new AxiosError('offline'))).toBe('network');
    expect(getProfileSaveErrorKey(new Error('unknown'))).toBe('failed');
  });
});
