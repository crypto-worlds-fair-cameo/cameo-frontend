/** 팝업을 닫은 뒤 연 버튼으로 초점을 돌려주고, 버튼이 사라졌으면 대체 요소로 보낸다. */
export function restoreDialogFocus(target: HTMLElement | null, fallback: HTMLElement | null) {
  queueMicrotask(() => {
    // 참가 안내처럼 다음 팝업이 이어서 열렸으면 그 팝업의 초점을 빼앗지 않는다.
    if (document.querySelector('[data-slot="dialog-content"][data-state="open"]')) return;
    const available = (element: HTMLElement | null) =>
      element?.isConnected && !element.matches(':disabled, [aria-disabled="true"]');
    if (available(target)) target!.focus();
    else if (available(fallback)) fallback!.focus();
  });
}
