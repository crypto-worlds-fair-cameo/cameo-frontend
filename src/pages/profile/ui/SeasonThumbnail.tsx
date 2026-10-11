import { useState } from 'react';

/** 확정 스냅샷이 있으면 썸네일로 사용하고, 없거나 로드에 실패하면 장식 배경을 표시한다. */
export function SeasonThumbnail({
  colors,
  imageUrl,
}: {
  colors: [string, string];
  imageUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // 이전 이미지 실패는 이후 새 스냅샷의 표시를 막지 않는다.
  if (imageUrl && imageUrl !== failedUrl) {
    return (
      <img
        className="profile-thumbnail"
        src={imageUrl}
        alt=""
        loading="lazy"
        style={{ objectFit: 'contain' }}
        onError={() => setFailedUrl(imageUrl)}
      />
    );
  }
  return (
    <span
      className="profile-thumbnail"
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      aria-hidden="true"
    />
  );
}
