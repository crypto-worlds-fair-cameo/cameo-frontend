import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';

/**
 * 사용방법
 * const { openModal } = useModalStore();
 * const handleClick = () => {
 *     openModal({ title: '모달 제목', content: <div>모달 내용</div> });
 * };
 */
export const GlobalModal = () => {
  const { isModalOpen, title, titleClassName, content, returnFocusElement, closeModal } =
    useModalStore();

  return (
    <Dialog open={isModalOpen} onOpenChange={closeModal}>
      <DialogContent
        onCloseAutoFocus={event => {
          if (returnFocusElement?.isConnected) {
            event.preventDefault();
            returnFocusElement.focus();
          }
        }}
      >
        <DialogTitle className={titleClassName}>{title}</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
};
