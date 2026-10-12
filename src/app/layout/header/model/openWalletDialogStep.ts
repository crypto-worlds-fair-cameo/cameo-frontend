import type { ReactNode } from 'react';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { walletDialogTitleClassName } from '../config/walletDialogStyles';

interface WalletDialogStep {
  title: ReactNode;
  content: ReactNode;
  /** 큰 완료 문구가 제목을 대신하는 단계는 제목을 화면에서 숨기고 보조 기술에만 남긴다. */
  hideTitle?: boolean;
  returnFocusElement?: HTMLElement | null;
}

/** 지갑 연결·닉네임·완료 단계를 같은 창 모양으로 이어서 연다. 닫기는 각 단계의 버튼이 맡는다. */
export function openWalletDialogStep({
  title,
  content,
  hideTitle = false,
  returnFocusElement = useModalStore.getState().returnFocusElement,
}: WalletDialogStep) {
  useModalStore.getState().openModal({
    title,
    titleClassName: hideTitle ? 'sr-only' : walletDialogTitleClassName,
    content,
    returnFocusElement,
  });
}
