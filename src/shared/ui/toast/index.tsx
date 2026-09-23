import { Toaster } from '@/shared/ui/sonner';

/**
 * 사용법
 * import { toast } from 'sonner';
 *
 * onClick 이벤트 등, 어디서든 toast를 호출하여 사용
 * toast('title of toast', {
 *     description: 'description of toast',
 *     action: {
 *         label: 'action label',
 *         onClick: () => {function to execute on action click},
 *     },
 * })
 * @returns
 */
export const GlobalToast = () => {
  return <Toaster />;
};
