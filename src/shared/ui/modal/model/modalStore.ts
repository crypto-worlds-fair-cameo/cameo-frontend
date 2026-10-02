import { create } from 'zustand';

let timer: number | null = null;
interface ModalState {
  isModalOpen: boolean;
  title?: React.ReactNode;
  titleClassName?: string;
  content: React.ReactNode | null;
  returnFocusElement: HTMLElement | null;
  openModal: ({
    title,
    titleClassName,
    content,
    returnFocusElement,
  }: {
    title?: React.ReactNode;
    titleClassName?: string;
    content: React.ReactNode;
    returnFocusElement?: HTMLElement | null;
  }) => void;
  closeModal: () => void;
}
export const useModalStore = create<ModalState>((set, get) => ({
  isModalOpen: false,
  title: '',
  titleClassName: '',
  content: null,
  returnFocusElement: null,
  openModal: ({
    title,
    titleClassName,
    content,
    returnFocusElement = null,
  }: {
    title?: React.ReactNode;
    titleClassName?: string;
    content: React.ReactNode;
    returnFocusElement?: HTMLElement | null;
  }) => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    set({ isModalOpen: true, title, titleClassName, content, returnFocusElement });
  },
  closeModal: () => {
    set({ isModalOpen: false });
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }

    timer = window.setTimeout(() => {
      if (get().isModalOpen === true) return;
      set({ title: '', titleClassName: '', content: null });
      timer = null;
    }, 200);
  },
}));
