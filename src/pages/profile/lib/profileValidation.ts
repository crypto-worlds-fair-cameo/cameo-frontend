export const NICKNAME_MAX_LENGTH = 20;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const avatarTypes = ['image/jpeg', 'image/png'];

export type AvatarFileError = 'type' | 'size';

/** 서버와 같이 앞뒤 공백을 제거한 Unicode code point 수로 닉네임 길이를 계산한다. */
export function nicknameLength(value: string) {
  return Array.from(value.trim()).length;
}

/** 디자인 기준(JPG·PNG, 최대 2MB)을 벗어난 사진의 사유를 반환한다. */
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>): AvatarFileError | null {
  if (!avatarTypes.includes(file.type)) return 'type';
  if (file.size > AVATAR_MAX_BYTES) return 'size';
  return null;
}
