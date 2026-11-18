import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface WalletOptionRowProps {
  label: ReactNode;
  /** 지갑 이름. 지갑이 아이콘을 알려 주지 않을 때 기본 모양을 고르는 데 쓴다. */
  walletName?: string;
  /** 설치된 지갑이 직접 알려 주는 아이콘. */
  icon?: string;
  status?: string;
  /** 오른쪽에 옅게 붙이는 보조 문구(예: 설치 안 됨). 연결 단계(status)가 있으면 그것을 보여 준다. */
  note?: string;
  invalid?: boolean;
  /** 목록에서 고르는 칸이면 고른 상태와 동작을 넘긴다. 없으면 표시만 하는 칸이다. */
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
}

/** 지갑 아이콘. 설치된 지갑은 그 지갑의 아이콘을, 아니면 Phantom 유령 모양이나 이름 첫 글자를 그린다. */
function WalletMark({ walletName, icon }: { walletName?: string; icon?: string }) {
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        width={20}
        height={20}
        className="size-5 shrink-0 rounded-[4px] object-contain"
      />
    );
  }
  if (walletName === 'Phantom') {
    // Phantom 앱 아이콘처럼 보라색 칸 안에 흰 유령 모양을 둔다.
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-[#ab9ff2]"
      >
        <img
          src="/images/phantom.svg"
          alt=""
          width={14}
          height={14}
          className="size-3.5 object-contain brightness-0 invert"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-gray-200 text-[11px] font-medium text-gray-700"
    >
      {walletName ? walletName.slice(0, 1) : <Wallet className="size-3.5" />}
    </span>
  );
}

/** 지갑 하나와 현재 연결 단계를 한 줄로 보여 준다. 목록에서는 눌러서 고르고, 연결은 아래 버튼이 맡는다. */
export function WalletOptionRow({
  label,
  walletName,
  icon,
  status,
  note,
  invalid = false,
  selected = false,
  onSelect,
  disabled = false,
  className,
}: WalletOptionRowProps) {
  const content = (
    <>
      <WalletMark walletName={walletName} icon={icon} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {status ? (
        <span
          role="status"
          className={cn('shrink-0 text-xs text-muted-foreground', invalid && 'text-destructive')}
        >
          {status}
        </span>
      ) : (
        note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>
      )}
    </>
  );
  const rowClassName = cn(
    'flex h-10 w-full min-w-0 items-center gap-2 rounded-[4px] border border-[var(--border-input)] bg-[var(--background)] px-3 text-[13px]',
    selected && 'border-foreground',
    invalid && 'border-destructive',
    className
  );
  if (!onSelect) return <div className={rowClassName}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        rowClassName,
        'cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:hover:bg-[var(--background)]'
      )}
    >
      {content}
    </button>
  );
}
