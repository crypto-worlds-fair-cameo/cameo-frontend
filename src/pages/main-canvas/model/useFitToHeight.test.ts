import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFitToHeight } from './useFitToHeight';

/** jsdom은 레이아웃이 없으므로 영역의 높이와 내용의 원래 높이를 직접 정해 준다. */
function setup(containerHeight: number, contentHeight: number, enabled = true) {
  const container = document.createElement('aside');
  const content = document.createElement('div');
  Object.defineProperty(container, 'clientHeight', { value: containerHeight });
  Object.defineProperty(content, 'offsetHeight', { value: contentHeight });
  container.style.paddingTop = '100px';
  container.style.paddingBottom = '20px';
  container.append(content);
  document.body.append(container);
  renderHook(() => useFitToHeight({ current: container }, { current: content }, enabled));
  return content;
}

describe('fit to height', () => {
  it('shrinks content that is taller than the space left after padding', () => {
    // 사용 가능한 높이 = 920 - 100 - 20 = 800, 내용 1000 → 0.8배
    const content = setup(920, 1000);
    expect(content.style.getPropertyValue('--fit-scale')).toBe('0.8');
    // 줄어든 만큼 아래 여백을 음수로 두어 레이아웃 높이도 줄인다.
    expect(content.style.getPropertyValue('--fit-trim')).toBe('-200px');
  });

  it('leaves content alone when it already fits', () => {
    const content = setup(1200, 900);
    expect(content.style.getPropertyValue('--fit-scale')).toBe('1');
    expect(content.style.getPropertyValue('--fit-trim')).toBe('0px');
  });

  it('never shrinks below the minimum scale', () => {
    // 사용 가능한 높이 220, 내용 2000 → 0.11배가 되지만 0.55배에서 멈춘다.
    const content = setup(340, 2000);
    expect(content.style.getPropertyValue('--fit-scale')).toBe('0.55');
  });

  it('does nothing when disabled', () => {
    const content = setup(920, 1000, false);
    expect(content.style.getPropertyValue('--fit-scale')).toBe('');
  });

  it('shrinks only the content and leaves the reserved block at full size', () => {
    const container = document.createElement('aside');
    const content = document.createElement('div');
    const reserved = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 920 });
    Object.defineProperty(content, 'offsetHeight', { value: 800 });
    Object.defineProperty(reserved, 'offsetHeight', { value: 180 });
    container.style.paddingTop = '100px';
    container.style.paddingBottom = '20px';
    container.append(content, reserved);
    document.body.append(container);
    renderHook(() =>
      useFitToHeight({ current: container }, { current: content }, true, { current: reserved })
    );
    // 사용 가능한 높이 = 920 - 100 - 20 - 180 = 620, 내용 800 → 0.775배
    expect(content.style.getPropertyValue('--fit-scale')).toBe('0.775');
    expect(content.style.getPropertyValue('--fit-trim')).toBe('-180px');
  });
});
