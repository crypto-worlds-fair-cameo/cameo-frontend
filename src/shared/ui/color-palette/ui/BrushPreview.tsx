import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { PreviewBox } from '@/shared/ui/preview-box';
import type { BrushSettings } from '../model/brushSettings';

/** 선택한 색상·종류·크기·불투명도를 실제 드로잉과 독립된 샘플 선으로 표시한다. */
export function BrushPreview({ value }: { value: BrushSettings }) {
  const { t } = useTranslation('common');
  const filterId = useId();
  // 미리보기 안에 최대 크기의 선도 담도록 절반 크기로 표시하며, 평붓만 네모난 끝을 쓴다.
  const linecap = value.brushType === 'flat' ? 'square' : 'round';
  // 에어브러시는 흐린 윤곽으로, 나머지 브러시는 선명한 선으로 표시한다.
  const filter = value.brushType === 'airbrush' ? `url(#${filterId})` : undefined;

  return (
    <PreviewBox className="color-palette-preview-box">
      <svg
        viewBox="0 0 280 120"
        role="img"
        aria-label={t('colorPalette.previewLabel', {
          brush: t(`colorPalette.${value.brushType}`),
          color: value.color,
          size: value.brushSize,
          opacity: value.opacity,
        })}
      >
        <defs>
          <filter id={filterId} x="-50%" y="-100%" width="200%" height="300%">
            <feGaussianBlur stdDeviation={Math.max(1, value.brushSize / 12)} />
          </filter>
        </defs>
        <path
          d="M 32 74 Q 140 12 248 74"
          fill="none"
          stroke={value.color}
          strokeWidth={value.brushSize / 2}
          strokeLinecap={linecap}
          opacity={value.opacity / 100}
          filter={filter}
        />
      </svg>
    </PreviewBox>
  );
}
