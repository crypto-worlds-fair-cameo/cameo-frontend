import { useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Slider } from '@/shared/ui/slider';
import { ToggleGroup } from '@/shared/ui/toggle-group';
import { paletteColors } from './config/paletteColors';
import { HexColorInput } from './ui/HexColorInput';
import { BrushPreview } from './ui/BrushPreview';
import type { BrushSettings } from './model/brushSettings';
import './color-palette.css';

interface ColorPaletteProps {
  value: BrushSettings;
  onValueChange: (value: BrushSettings) => void;
  defaultOpen?: boolean;
}

/**
 * 페이지가 소유한 브러시 설정을 편집하고 샘플 선에 반영한다.
 * color는 #RRGGBB, brushSize는 1~100px로 전달한다.
 * 설정값을 저장하거나 캔버스·서버에 그림을 보내는 책임은 사용 페이지에 있다.
 */
export function ColorPalette({ value, onValueChange, defaultOpen = true }: ColorPaletteProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(defaultOpen);
  const [customOpen, setCustomOpen] = useState(true);
  const [presetSelection, setPresetSelection] = useState(0);
  const channels = [1, 3, 5].map(start => parseInt(value.color.slice(start, start + 2), 16));

  /** 변경한 필드만 합쳐 페이지에 전달하고 나머지 브러시 설정은 유지한다. */
  function update(patch: Partial<BrushSettings>) {
    onValueChange({ ...value, ...patch });
  }

  /** 슬라이더로 변경한 RGB 채널을 HEX로 변환해 모든 색상 UI와 미리보기를 갱신한다. */
  function updateChannel(index: number, next: number) {
    const updated = [...channels];
    updated[index] = next;
    update({
      color:
        `#${updated.map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase(),
    });
  }

  return (
    <Collapsible className="color-palette" open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="color-palette-title" type="button">
        {t('colorPalette.title')}
        <ChevronDown aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="color-palette-content">
          <div
            className="color-palette-swatches"
            role="group"
            aria-label={t('colorPalette.presets')}
          >
            {paletteColors.map(color => (
              <button
                key={color}
                type="button"
                className="color-palette-swatch"
                style={{ backgroundColor: color }}
                aria-label={t('colorPalette.color', { color })}
                aria-pressed={value.color.toUpperCase() === color}
                title={color}
                onClick={() => {
                  update({ color });
                  // 같은 색상 프리셋을 다시 선택해도 잘못된 HEX 입력과 오류를 초기화한다.
                  setPresetSelection(previous => previous + 1);
                }}
              />
            ))}
          </div>

          <Collapsible
            className="color-palette-custom"
            open={customOpen}
            onOpenChange={setCustomOpen}
          >
            <CollapsibleTrigger type="button" className="color-palette-custom-trigger">
              <span
                className="color-palette-current"
                style={{ backgroundColor: value.color }}
                aria-hidden="true"
              />
              {t('colorPalette.custom')}
              <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="color-palette-custom-controls">
                <HexColorInput
                  key={presetSelection}
                  value={value.color}
                  onValueChange={color => update({ color })}
                />
                <div className="color-palette-channels">
                  {['R', 'G', 'B'].map((channel, index) => (
                    <div
                      key={channel}
                      className="color-palette-channel"
                      style={
                        {
                          '--channel-color': ['#FF1735', '#00C800', '#3D68FF'][index],
                          '--channel-end': ['#FF0000', '#00FF00', '#0000FF'][index],
                        } as CSSProperties
                      }
                    >
                      <Slider
                        label={channel}
                        aria-label={channel}
                        value={channels[index]}
                        min={0}
                        max={255}
                        step={1}
                        onValueChange={next => updateChannel(index, next)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="color-palette-brush-controls">
            <ToggleGroup
              label={t('colorPalette.brushType')}
              value={value.brushType}
              onValueChange={brushType =>
                update({ brushType: brushType as BrushSettings['brushType'] })
              }
              items={[
                { value: 'round', label: t('colorPalette.round') },
                { value: 'flat', label: t('colorPalette.flat') },
                { value: 'airbrush', label: t('colorPalette.airbrush') },
              ]}
            />
            <Slider
              label={t('colorPalette.brushSize')}
              aria-label={t('colorPalette.brushSize')}
              value={value.brushSize}
              min={1}
              max={100}
              step={1}
              unit="px"
              onValueChange={brushSize => update({ brushSize })}
            />
            <div className="color-palette-preview">
              <p>{t('colorPalette.preview')}</p>
              <BrushPreview value={value} />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
