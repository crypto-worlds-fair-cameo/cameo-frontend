import { useLayoutEffect, type RefObject } from 'react';

/** 너무 작아져 읽기 어려워지지 않게 하는 하한. 그보다 낮은 화면에서는 영역 안에서 스크롤한다. */
const MIN_FIT_SCALE = 0.55;

/**
 * 영역의 내용이 영역 높이보다 크면 --fit-scale을 줄여 스크롤 없이 전부 보이게 한다.
 * 크기는 transform으로 줄이고, 줄어든 만큼 아래 여백(--fit-trim)을 음수로 두어 레이아웃 높이도 맞춘다.
 * 내용의 원래 높이(offsetHeight)는 transform·여백의 영향을 받지 않으므로 줄인 값이 다시 측정에 영향을 주지 않는다.
 * reserved는 줄이지 않고 그대로 둘 높이(미니맵)다. 그 높이만큼 내용이 쓸 수 있는 공간에서 뺀다.
 * 영역이나 내용의 크기가 바뀔 때(창 크기, 팔레트 접기·펼치기)마다 다시 계산한다.
 */
export function useFitToHeight(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  reservedRef?: RefObject<HTMLElement | null>
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const reserved = reservedRef?.current ?? null;
    if (!container || !content) return;
    if (!enabled) {
      content.style.removeProperty('--fit-scale');
      content.style.removeProperty('--fit-trim');
      return;
    }

    function update() {
      if (!container || !content) return;
      const style = getComputedStyle(container);
      const available =
        container.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom) -
        (reserved?.offsetHeight ?? 0);
      const natural = content.offsetHeight;
      // 측정할 수 없는 환경(테스트 등)이나 아직 배치 전이면 줄이지 않는다.
      if (!(available > 0) || !(natural > 0)) {
        content.style.removeProperty('--fit-scale');
        content.style.removeProperty('--fit-trim');
        return;
      }
      // 소수점 반올림 오차로 1px 넘쳐 스크롤바가 생기지 않도록 내림한다.
      const scale =
        Math.floor(Math.min(1, Math.max(MIN_FIT_SCALE, available / natural)) * 1000) / 1000;
      content.style.setProperty('--fit-scale', String(scale));
      content.style.setProperty('--fit-trim', `${-Math.ceil(natural * (1 - scale))}px`);
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(content);
    if (reserved) observer.observe(reserved);
    update();
    return () => {
      observer.disconnect();
      content.style.removeProperty('--fit-scale');
      content.style.removeProperty('--fit-trim');
    };
  }, [containerRef, contentRef, enabled, reservedRef]);
}
