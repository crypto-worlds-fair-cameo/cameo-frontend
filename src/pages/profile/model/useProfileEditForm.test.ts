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
    expect(getProfileSaveErrorKey(httpError(429))).toBe('rateLimited');
    expect(getProfileSaveErrorKey(new AxiosError('offline'))).toBe('network');
    expect(getProfileSaveErrorKey(new Error('unknown'))).toBe('failed');
  });
});
