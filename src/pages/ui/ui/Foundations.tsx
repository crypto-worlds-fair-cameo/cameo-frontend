import { palettes, semanticGroups, radiusTokens } from '../config/catalog';
import { CatalogSection, SpecTable } from './CatalogSection';

export function ColorTokens() {
  return (
    <CatalogSection id="colors" title="1. 컬러 토큰">
      {palettes.map(group => (
        <div className="catalog-group" key={group.label}>
          <h3>{group.label}</h3>
          <div className="catalog-swatches">
            {group.colors.map(([name, token, value]) => (
              <div className="catalog-swatch" key={token}>
                <div style={{ background: `var(${token})` }} />
                <strong>{name}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </CatalogSection>
  );
}
export function SemanticTokens() {
  return (
    <CatalogSection id="semantic" title="2. Semantic 토큰 매핑">
      <p className="catalog-description">
        밝은 컴포넌트 표면 기준. 기존 Tailwind semantic 토큰도 이 값에 연결됩니다.
      </p>
      {semanticGroups.map(group => (
        <div className="catalog-group" key={group.label}>
          <h3>{group.label}</h3>
          <SpecTable
            rows={group.tokens.map(([token, value]) => [<code key={token}>{token}</code>, value])}
          />
        </div>
      ))}
    </CatalogSection>
  );
}
export function Typography() {
  return (
    <CatalogSection id="typography" title="3. 타이포그래피">
      <SpecTable
        headings={['용도', '폰트', 'Weight', 'Size', '사용처']}
        rows={[
          ['UI 기본', 'Noto Sans KR', 'Regular 400', '14–16px', '버튼, 입력, 라벨, 본문'],
          ['UI 강조', 'Noto Sans KR', 'Medium 500', '13–14px', '보조 텍스트'],
          ['섹션 제목', 'Noto Sans KR', 'SemiBold 600', '12–14px', '카드 제목, 소제목'],
          ['페이지 제목', 'Noto Sans KR', 'Bold 700', '16–18px', '모달 제목, 헤딩'],
          ['영문 데이터', 'Space Grotesk', 'Regular / Bold', '11–17px', '날짜, 숫자, 지갑주소'],
          ['탭 내비', 'Space Grotesk', 'Bold 700', '14px', '탭과 내비게이션'],
        ]}
      />
      <div className="catalog-type-samples cameo-light">
        <p>함께 그리는 하나의 캔버스</p>
        <p>Create together. Own a moment.</p>
        <p className="font-data">2026.09.29 · 0.01 SOL · 8xQ2…7mKP</p>
      </div>
      <aside className="catalog-note">
        UI는 Noto Sans KR, 영문 데이터와 숫자는 Space Grotesk를 사용합니다. 캔버스 장식용 폰트는
        공통 UI에서 제외합니다.
      </aside>
    </CatalogSection>
  );
}
export function RadiusAndSpacing() {
  return (
    <CatalogSection id="radius" title="7. Border Radius & Spacing">
      <div className="catalog-radius-grid">
        {radiusTokens.map(([name, token, value]) => (
          <div key={name}>
            <div style={{ borderRadius: `var(${token})` }} />
            <strong>{name}</strong>
            <span>{value}</span>
          </div>
        ))}
      </div>
      <div className="catalog-spacing">
        {[1, 2, 3, 4, 5, 6, 8].map(n => (
          <div key={n}>
            <span>{n * 4}px</span>
            <i style={{ width: `var(--space-${n})` }} />
          </div>
        ))}
      </div>
    </CatalogSection>
  );
}
