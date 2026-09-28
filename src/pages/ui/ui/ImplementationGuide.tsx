import { CatalogSection, SpecTable } from './CatalogSection';

export function ImplementationGuide() {
  return (
    <>
      <CatalogSection id="implementation" title="10. 구현 가이드">
        <h3 className="catalog-group-title">PAGE-FIRST · 공통 UI와 페이지 조합</h3>
        <pre className="catalog-code">
          <code>{`src/
├── app/styles/app.css         # Primitive + semantic tokens
├── shared/ui/                # 제품 비종속 컴포넌트
│   ├── button.tsx            # primary / web3 / secondary / ghost / glass
│   ├── input.tsx             # Field와 조합
│   ├── card.tsx              # MediaCard / ProfileCard / InfoCard / StatsCard
│   ├── list-item.tsx         # MediaListItem / DataRow / SelectionRow
│   ├── dialog.tsx            # 접근 가능한 Radix 모달
│   └── ui.css                # 토큰 기반 컴포넌트 스타일
└── pages/ui/
    ├── UiPage.tsx            # 쇼케이스 조립
    ├── ui/                   # 실제 컴포넌트 예시와 카탈로그 스타일
    ├── model/                # 데모 상태와 동작
    └── config/               # 레퍼런스 토큰 목록`}</code>
        </pre>
        <h3 className="catalog-group-title">사용 예시</h3>
        <pre className="catalog-code">
          <code>{`import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

<Field label="시즌 이름" hint="최대 30자" required>
  {props => <Input {...props} maxLength={30} />}
</Field>

<Button variant="web3" loading={isPending} onClick={sign}>
  Sign & Mint
</Button>
<Button variant="secondary" disabled={isPending} onClick={cancel}>
  Cancel
</Button>`}</code>
        </pre>
        <aside className="catalog-note">
          시즌·지갑 데이터와 동작은 사용하는 페이지에서 관리합니다. shared/ui는 페이지나 app을
          import하지 않습니다.
        </aside>
      </CatalogSection>
      <CatalogSection id="decisions" title="11. 핵심 통일 결정">
        <ol className="catalog-decisions">
          <li>
            검정은 <code>#171717</code>, 빨강은 <code>#EE2233</code>으로 통일합니다.
          </li>
          <li>
            SOL 결제·서명 버튼은 <code>web3</code> variant를 사용합니다.
          </li>
          <li>
            취소·닫기는 <code>secondary</code>, 단독 닫기는 <code>primary</code>를 허용합니다.
          </li>
          <li>버튼 radius는 12px, 모달은 24px입니다.</li>
          <li>
            Web3 로딩 배경 <code>#9B7EC8</code>는 유지하고, 작은 글자는 검정으로 표시합니다.
          </li>
          <li>공통 UI 폰트는 Noto Sans KR와 Space Grotesk 두 종류입니다.</li>
          <li>Ended 배지는 회색 Filled pill을 사용합니다.</li>
          <li>Glass Panel은 흰색 80%, Overlay는 검정 50%입니다.</li>
          <li>버튼 크기와 상태는 공통 컴포넌트에서 관리합니다.</li>
          <li>레퍼런스에 없는 페이지네이션 선택 상태는 검정 배경·흰색 숫자로 보완했습니다.</li>
        </ol>
      </CatalogSection>
      <CatalogSection id="accessibility" title="12. 접근성 및 동작">
        <SpecTable
          headings={['항목', '적용 내용']}
          rows={[
            ['로딩 버튼', 'Spinner + aria-busy + 중복 클릭 차단'],
            ['Web3 로딩 텍스트', '#9B7EC8 위 #171717로 가독성 보완'],
            ['키보드 포커스', '2px outline + 3px offset'],
            ['탭', '방향키, Home, End / tabpanel 연결'],
            ['모달', '포커스 유지, Escape 닫기, 트리거 복귀'],
            ['입력 오류', 'label + aria-invalid + 오류 설명 연결'],
            ['사용자 동작', '검색, 선택, 슬라이더, 확대, 페이지 이동 예시'],
            ['모션', 'prefers-reduced-motion에서 애니메이션 축소'],
          ]}
        />
        <p className="catalog-description">
          이 카탈로그는 실제 공용 컴포넌트를 렌더링합니다. 지갑 연결·결제·저장은 로컬 데모이며 외부
          요청을 보내지 않습니다.
        </p>
      </CatalogSection>
    </>
  );
}
