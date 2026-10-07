import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES, nicknameLength, validateAvatarFile } from './profileValidation';

describe('profile validation', () => {
  it('counts trimmed Unicode code points like the server', () => {
    expect(nicknameLength('  jisun  ')).toBe(5);
    expect(nicknameLength('😀😀')).toBe(2);
  });

  it('accepts JPG and PNG images up to 2MB', () => {
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES + 1 })).toBe('size');
    expect(validateAvatarFile({ type: 'image/gif', size: 10 })).toBe('type');
  });
});
