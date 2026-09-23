import { create } from 'zustand';

let timer: number | null = null;
interface ModalState {
    isModalOpen: boolean;
    title?: string;
    titleClassName?: string;
    content: React.ReactNode | null;
    openModal: ({
        title,
        titleClassName,
        content,
    }: {
        title?: string;
        titleClassName?: string;
        content: React.ReactNode;
    }) => void;
    closeModal: () => void;
}
export const useModalStore = create<ModalState>((set, get) => ({
    isModalOpen: false,
    title: '',
    titleClassName: '',
    content: null,
    openModal: ({
        title,
        titleClassName,
        content,
    }: {
        title?: string;
        titleClassName?: string;
        content: React.ReactNode;
    }) => {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
        set({ isModalOpen: true, title, titleClassName, content });
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
