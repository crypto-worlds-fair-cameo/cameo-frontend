import { create } from 'zustand';

export type LoadingTaskId = symbol;

interface LoadingState {
    isLoading: boolean;
    tasks: ReadonlySet<LoadingTaskId>;
    show: () => LoadingTaskId;
    hide: (taskId: LoadingTaskId) => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
    isLoading: false,
    tasks: new Set(),
    show: () => {
        const taskId = Symbol('loading-task');
        set((state) => ({ tasks: new Set([...state.tasks, taskId]), isLoading: true }));
        return taskId;
    },
    hide: (taskId) =>
        set((state) => {
            if (!state.tasks.has(taskId)) return state;
            const tasks = new Set(state.tasks);
            tasks.delete(taskId);
            return { tasks, isLoading: tasks.size > 0 };
        }),
}));
