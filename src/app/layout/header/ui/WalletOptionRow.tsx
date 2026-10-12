import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface WalletOptionRowProps {
  label: ReactNode;
  status?: string;
  invalid?: boolean;
  className?: string;
}

/** 연결할 지갑과 현재 연결 단계를 한 줄로 보여 준다. 동작은 아래 버튼이 맡는다. */
export function WalletOptionRow({
  label,
  status,
  invalid = false,
  className,
}: WalletOptionRowProps) {
  return (
    <div
      className={cn(
        'flex h-10 min-w-0 items-center gap-2 rounded-[4px] border border-[var(--border-input)] bg-[var(--background)] px-3 text-[13px]',
        invalid && 'border-destructive',
        className
      )}
    >
      {/* Phantom 앱 아이콘처럼 보라색 칸 안에 흰 유령 모양을 둔다. */}
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
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {status && (
        <span
          role="status"
          className={cn('shrink-0 text-xs text-muted-foreground', invalid && 'text-destructive')}
        >
          {status}
        </span>
      )}
    </div>
  );
}
