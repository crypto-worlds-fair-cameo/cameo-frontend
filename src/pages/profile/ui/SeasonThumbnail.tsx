import { useState } from 'react';
import type { ProfileThumbnail } from '../api/profile.api';

/**
 * 확정 스냅샷이나 시즌 이미지가 있으면 썸네일로 사용하고,
 * 없거나 로드에 실패하면 장식용 그라데이션을 표시한다.
 */
export function SeasonThumbnail({
  thumbnail,
  imageUrl,
}: {
  thumbnail: ProfileThumbnail;
  imageUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = imageUrl ?? (typeof thumbnail === 'string' ? thumbnail : null);
  // 이전 이미지 실패는 이후 새 스냅샷의 표시를 막지 않는다.
  if (src && src !== failedUrl) {
    return (
      <img
        className="profile-thumbnail"
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        // 확정 캔버스 스냅샷은 잘리지 않게 전체를 보여 준다.
        style={src === imageUrl ? { objectFit: 'contain' } : undefined}
        onError={() => setFailedUrl(src)}
      />
    );
  }
  const colors = typeof thumbnail === 'string' ? fallbackColors : thumbnail;
  return (
    <span
      className="profile-thumbnail"
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      aria-hidden="true"
    />
  );
}

const fallbackColors: [string, string] = ['#d6d6d6', '#f2f2f2'];
