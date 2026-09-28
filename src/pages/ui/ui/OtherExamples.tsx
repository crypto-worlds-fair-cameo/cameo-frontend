import { HelpCircle, Wallet } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { SelectionRow } from '@/shared/ui/list-item';
import { TransactionList } from '@/shared/ui/transaction-list';
import { Pagination } from '@/shared/ui/pagination';
import { FloatingActionButton } from '@/shared/ui/floating-action-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { useNavigationExamples, useSelectionExamples } from '../model/useCatalogExamples';
import { Demo } from './CatalogSection';
import { StatsExample } from './DisplayExamples';

export function OtherExamples() {
  const state = useSelectionExamples();
  const { page, setPage } = useNavigationExamples();
  return (
    <>
      <h3 className="catalog-group-title">기타</h3>
      <div className="catalog-demo-grid">
        <Demo title="26 · Wallet Selector Row" spec="SelectionRow · Border #D6D6D6 · Icon 32px">
          {['Phantom', 'Solflare'].map(wallet => (
            <SelectionRow
              key={wallet}
              selected={state.wallet === wallet}
              onClick={() => state.setWallet(wallet)}
              icon={<Wallet size={28} />}
            >
              {wallet}
            </SelectionRow>
          ))}
          <p className="catalog-demo-muted" role="status">
            {state.wallet ? `${state.wallet} 선택됨 · 데모` : '지갑을 선택하세요.'}
          </p>
        </Demo>
        <Demo title="27 · Transaction List" spec="Divider #171717 · 출금 #EE2233 · Row 40px" wide>
          <TransactionList
            items={[
              {
                id: '1',
                label: 'Canvas 참여',
                date: '2026.09.29',
                amount: '−0.01 SOL',
                direction: 'outgoing',
              },
              {
                id: '2',
                label: '시즌 보상',
                date: '2026.09.28',
                amount: '+0.05 SOL',
                direction: 'incoming',
              },
            ]}
          />
        </Demo>
        <Demo title="28 · Pagination" spec="Font 20px · 현재 페이지 반전 · 이전/다음 경계" wide>
          <p aria-live="polite">
            작품 {(page - 1) * 4 + 1}–{page * 4} / 20
          </p>
          <Pagination page={page} totalPages={5} onPageChange={setPage} />
        </Demo>
        <Demo
          title="29 · FAB (Floating Action)"
          spec="46 × 46px · #171717 · 원형 · 기본 우하단 고정"
        >
          <Dialog open={state.help} onOpenChange={state.setHelp}>
            <DialogTrigger asChild>
              <FloatingActionButton className="catalog-fab-example" aria-label="도움말 열기">
                <HelpCircle />
              </FloatingActionButton>
            </DialogTrigger>
            <DialogContent className="cameo-light">
              <DialogTitle>캔버스 도움말</DialogTitle>
              <DialogDescription>
                도구를 선택하고 색상과 브러시 크기를 조절해 보세요. 이 화면은 UI 예시입니다.
              </DialogDescription>
            </DialogContent>
          </Dialog>
        </Demo>
        <Demo title="30 · Connect Wallet 버튼" spec="Primary 버튼 조합 · 실제 연결 없는 데모">
          <Button onClick={() => state.setConnected(!state.connected)}>
            <Wallet />
            {state.connected ? 'Disconnect' : 'Connect Wallet'}
          </Button>
          <p className="catalog-demo-muted" role="status">
            {state.connected ? '8xQ2…7mKP · 연결 상태 예시' : '연결 전 상태'}
          </p>
        </Demo>
        <StatsExample />
      </div>
    </>
  );
}
