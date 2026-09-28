import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { buttonSpecs } from '../config/catalog';
import { useActionExamples } from '../model/useCatalogExamples';
import { CatalogSection, SpecTable } from './CatalogSection';

export function ButtonVariants() {
  return (
    <CatalogSection id="buttons" title="4. 버튼 Variant (5종)">
      <p className="catalog-description">
        Hover·Pressed는 비교용 고정 상태입니다. Default 버튼에서 실제 hover·focus·pressed를 확인할
        수 있습니다.
      </p>
      <div className="catalog-button-grid">
        {buttonSpecs.map(spec => (
          <article className="catalog-button-card" key={spec.variant}>
            <header>
              <h3>{spec.title}</h3>
              <span>{spec.purpose}</span>
            </header>
            <div
              className={`catalog-button-stage cameo-light${spec.variant === 'glass' ? ' catalog-demo-stage--canvas' : ''}`}
            >
              <Button variant={spec.variant} size="sm">
                Default
              </Button>
              <Button variant={spec.variant} size="sm" data-preview-state="hover">
                Hover
              </Button>
              {['primary', 'web3', 'secondary'].includes(spec.variant) && (
                <Button variant={spec.variant} size="sm" data-preview-state="pressed">
                  Pressed
                </Button>
              )}
              {['primary', 'web3'].includes(spec.variant) && (
                <Button variant={spec.variant} size="sm" loading>
                  Loading
                </Button>
              )}
              <Button variant={spec.variant} size="sm" disabled>
                Disabled
              </Button>
            </div>
            <SpecTable
              rows={spec.rows.map(([label, token]) => [label, <code key={token}>{token}</code>])}
            />
          </article>
        ))}
      </div>
    </CatalogSection>
  );
}
export function ButtonSizes() {
  return (
    <CatalogSection id="sizes" title="5. 버튼 Size (4종)">
      <div className="catalog-size-stage cameo-light">
        <div>
          <span>lg · 56px</span>
          <Button size="lg">Create Season</Button>
        </div>
        <div>
          <span>md · 48px</span>
          <Button>Join Canvas</Button>
        </div>
        <div>
          <span>sm · 36px</span>
          <Button size="sm">Edit</Button>
        </div>
        <div>
          <span>icon · 40px</span>
          <Button size="icon" aria-label="추가">
            <Plus />
          </Button>
        </div>
      </div>
      <SpecTable
        headings={['Size', 'Height', 'Padding', 'Font', '용도']}
        rows={[
          ['lg', '56px', '0 24px', '18px', '모달 CTA, 폼 제출'],
          ['md', '48px', '0 20px', '16px', '일반 버튼 · 기본값'],
          ['sm', '36px', '0 16px', '14px', '카드 내부, 보조'],
          ['icon', '40 × 40px', '8px', '—', '아이콘 전용'],
        ]}
      />
    </CatalogSection>
  );
}
export function StateMatrix() {
  return (
    <CatalogSection id="states" title="6. State 매트릭스">
      <SpecTable
        headings={['Variant', 'Default', 'Hover', 'Pressed', 'Disabled', 'Loading', 'Focus']}
        rows={[
          ['Primary', '✓', '✓', '✓', '✓', '✓', '✓'],
          ['Web3', '✓', '✓', '✓', '✓', '✓', '✓'],
          ['Secondary', '✓', '✓', '✓', '✓', '—', '✓'],
          ['Ghost', '✓', '✓', '—', '✓', '—', '✓'],
          ['Glass', '✓', '✓', '—', '✓', '—', '✓'],
        ]}
      />
      <aside className="catalog-note">
        모든 버튼은 키보드 포커스를 표시합니다. 로딩 중에는 중복 실행을 막고 버튼 이름을 유지합니다.
      </aside>
    </CatalogSection>
  );
}
export function ButtonPatterns() {
  const { message, setMessage, loading, runDemo } = useActionExamples();
  return (
    <CatalogSection id="patterns" title="8. 버튼 조합 패턴">
      <div className="catalog-patterns cameo-light">
        <div>
          <span>결제 + 보조</span>
          <Button variant="web3" size="sm" onClick={() => setMessage('0.01 SOL 결제 데모입니다.')}>
            0.01 SOL Pay
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMessage('취소했습니다.')}>
            Cancel
          </Button>
        </div>
        <div>
          <span>블록체인 액션</span>
          <Button variant="web3" size="sm" loading={loading} onClick={runDemo}>
            Sign & Mint
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => setMessage('취소했습니다.')}
          >
            Cancel
          </Button>
        </div>
        <div>
          <span>성공 후 다음</span>
          <Button size="sm" onClick={() => setMessage('캔버스 입장 데모입니다.')}>
            Enter Canvas
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMessage('완료했습니다.')}>
            Done
          </Button>
        </div>
        <div>
          <span>단독 닫기</span>
          <Button size="sm" onClick={() => setMessage('닫기 동작을 확인했습니다.')}>
            Close
          </Button>
        </div>
        <p role="status">{message}</p>
      </div>
      <aside className="catalog-note">
        SOL 결제·서명은 Web3(보라). Cancel / Close는 Secondary. 유일한 닫기 버튼에는 Primary를
        허용합니다.
      </aside>
    </CatalogSection>
  );
}
