import { useEffect } from 'react';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';

export function useProfileUpdatedAutoClose() {
  useEffect(() => {
    const content = useModalStore.getState().content;
    const timer = window.setTimeout(() => {
      const modal = useModalStore.getState();
      if (modal.isModalOpen && modal.content === content) modal.closeModal();
    }, 1000);

    return () => window.clearTimeout(timer);
  }, []);
}
