/** 시즌 썸네일 API 전까지 목록 항목을 구분하는 장식용 그라데이션. */
export function SeasonThumbnail({ colors }: { colors: [string, string] }) {
  return (
    <span
      className="profile-thumbnail"
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      aria-hidden="true"
    />
  );
}
