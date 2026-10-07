import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  NICKNAME_MAX_LENGTH,
  nicknameLength,
  validateAvatarFile,
  type AvatarFileError,
} from '../lib/profileValidation';

export type ProfileSaveErrorKey =
  'invalid' | 'sessionExpired' | 'rateLimited' | 'network' | 'failed';

/** 닉네임 저장 실패를 화면 문구 key로 바꾼다. 서버 오류 원문은 표시하지 않는다. */
export function getProfileSaveErrorKey(error: unknown): ProfileSaveErrorKey {
  if (isAxiosError(error)) {
    if (!error.response) return 'network';
    if (error.response.status === 401) return 'sessionExpired';
    if (error.response.status === 429) return 'rateLimited';
    if (error.response.data?.code === 'USER_DISPLAY_NAME_INVALID') return 'invalid';
  }
  return 'failed';
}

/**
 * 수정 모달이 열릴 때마다 현재 닉네임으로 시작한다. 사진 업로드 API가 없으므로 사진은
 * 형식·크기 검사와 미리보기만 관리하고, 저장 버튼은 닉네임이 바뀌었을 때만 활성화한다.
 */
export function useProfileEditForm(currentNickname: string | null) {
  const initialNickname = (currentNickname ?? '').trim();
  const [nickname, setNickname] = useState(currentNickname ?? '');
  const [avatar, setAvatar] = useState<{
    previewUrl: string | null;
    error: AvatarFileError | null;
  }>({ previewUrl: null, error: null });
  // 새 사진을 고르거나 모달이 닫히면 이전 미리보기의 메모리를 해제한다.
  const previewUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    []
  );

  function selectAvatar(file: File | undefined) {
    if (!file) return;
    const error = validateAvatarFile(file);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = error ? null : URL.createObjectURL(file);
    setAvatar({ previewUrl: previewUrl.current, error });
  }

  const length = nicknameLength(nickname);
  const tooLong = length > NICKNAME_MAX_LENGTH;

  return {
    nickname,
    setNickname,
    length,
    tooLong,
    canSave: length >= 1 && !tooLong && nickname.trim() !== initialNickname,
    avatar,
    selectAvatar,
  };
}
