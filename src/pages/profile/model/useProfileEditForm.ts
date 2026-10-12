import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import type { ProfileChanges } from '../api/profile.queries';
import {
  NICKNAME_MAX_LENGTH,
  nicknameLength,
  validateAvatarFile,
  type AvatarFileError,
} from '../lib/profileValidation';

export type ProfileSaveErrorKey =
  | 'invalid'
  | 'imageInvalid'
  | 'imageUnavailable'
  | 'sessionExpired'
  | 'rateLimited'
  | 'network'
  | 'failed';

/** 프로필 저장 실패를 화면 문구 key로 바꾼다. 서버 오류 원문은 표시하지 않는다. */
export function getProfileSaveErrorKey(error: unknown): ProfileSaveErrorKey {
  if (isAxiosError(error)) {
    if (!error.response) return 'network';
    if (error.response.status === 401) return 'sessionExpired';
    if (error.response.status === 429) return 'rateLimited';
    // 화면 검사를 통과했어도 서버가 형식·크기를 다시 보고 거절할 수 있다.
    if (error.response.status === 413) return 'imageInvalid';
    const code = error.response.data?.code;
    if (code === 'USER_DISPLAY_NAME_INVALID') return 'invalid';
    if (code === 'USER_PROFILE_IMAGE_INVALID') return 'imageInvalid';
    if (code === 'USER_PROFILE_IMAGE_UNAVAILABLE') return 'imageUnavailable';
  }
  return 'failed';
}

/**
 * 수정 모달이 열릴 때마다 현재 닉네임으로 시작한다. 사진은 형식·크기를 먼저 검사해 미리보기를 보여 주고,
 * 저장 버튼은 닉네임이 바뀌었거나 쓸 수 있는 새 사진을 골랐을 때 활성화한다.
 */
export function useProfileEditForm(currentNickname: string | null) {
  const initialNickname = (currentNickname ?? '').trim();
  const [nickname, setNickname] = useState(currentNickname ?? '');
  const [avatar, setAvatar] = useState<{
    file: File | null;
    previewUrl: string | null;
    error: AvatarFileError | null;
  }>({ file: null, previewUrl: null, error: null });
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
    setAvatar({ file: error ? null : file, previewUrl: previewUrl.current, error });
  }

  const length = nicknameLength(nickname);
  const tooLong = length > NICKNAME_MAX_LENGTH;
  const nicknameChanged = nickname.trim() !== initialNickname;

  /** 바뀐 항목만 저장 요청에 담는다. 닉네임은 서버와 같이 앞뒤 공백을 제거해 보낸다. */
  function changes(): ProfileChanges {
    return {
      ...(nicknameChanged ? { displayName: nickname.trim() } : {}),
      ...(avatar.file ? { image: avatar.file } : {}),
    };
  }

  return {
    nickname,
    setNickname,
    length,
    tooLong,
    canSave: length >= 1 && !tooLong && (nicknameChanged || avatar.file !== null),
    avatar,
    selectAvatar,
    changes,
  };
}
