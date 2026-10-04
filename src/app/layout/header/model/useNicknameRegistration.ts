import { useState } from 'react';

export function useNicknameRegistration() {
  const [nickname, setNickname] = useState('');
  const length = Array.from(nickname.trim()).length;

  return {
    nickname,
    setNickname,
    length,
    tooLong: length > 20,
    canSubmit: length >= 1 && length <= 20,
  };
}
