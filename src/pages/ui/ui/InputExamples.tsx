import { Input } from '@/shared/ui/input';
import { Field } from '@/shared/ui/field';
import { SearchInput } from '@/shared/ui/search-input';
import { Checkbox } from '@/shared/ui/checkbox';
import { DateTimePicker } from '@/shared/ui/date-time-picker';
import { Slider } from '@/shared/ui/slider';
import { ColorPicker } from '@/shared/ui/color-picker';
import { useInputExamples } from '../model/useCatalogExamples';
import { Demo } from './CatalogSection';

export function InputExamples() {
  const state = useInputExamples();
  return (
    <>
      <h3 className="catalog-group-title">INPUT</h3>
      <div className="catalog-demo-grid">
        <Demo title="01 · Text Input" spec="높이 48px · Radius 10px · Focus #171717">
          <Field label="시즌 이름" hint="최대 30자" required>
            {props => <Input {...props} placeholder="새로운 시즌의 이름" maxLength={30} />}
          </Field>
          <Field label="오류 상태" error="시즌 이름을 입력해 주세요.">
            {props => <Input {...props} placeholder="이름을 입력하세요" />}
          </Field>
          <Input aria-label="비활성 입력" placeholder="비활성 상태" disabled />
        </Demo>
        <Demo title="02 · Search Input" spec="높이 26px · Radius 8px · 왼쪽 Search 아이콘">
          <Field label="시즌 검색">
            {props => (
              <SearchInput
                {...props}
                placeholder="Search season"
                value={state.search}
                onChange={event => state.setSearch(event.target.value)}
              />
            )}
          </Field>
          <div role="status" className="catalog-search-results">
            {['First Light', 'Color Garden', 'Night Canvas']
              .filter(name => name.toLowerCase().includes(state.search.toLowerCase()))
              .map(name => (
                <p key={name}>{name}</p>
              ))}
            {!['First Light', 'Color Garden', 'Night Canvas'].some(name =>
              name.toLowerCase().includes(state.search.toLowerCase())
            ) && <p>검색 결과가 없습니다.</p>}
          </div>
        </Demo>
        <Demo title="03 · Checkbox" spec="20 × 20px · Radius 4px · Selected #171717">
          <Checkbox
            label="선택 상태"
            checked={state.checked}
            onChange={event => state.setChecked(event.target.checked)}
          />
          <Checkbox label="기본 상태" />
          <Checkbox label="비활성 상태" disabled />
        </Demo>
        <Demo title="04 · Date / Time Picker" spec="높이 48px · Radius 8px · 네이티브 날짜 선택">
          <Field label="시작 일시">
            {props => <DateTimePicker {...props} defaultValue="2026-09-29T10:00" />}
          </Field>
          <Field label="종료 날짜">
            {props => <DateTimePicker {...props} type="date" defaultValue="2026-10-06" />}
          </Field>
        </Demo>
      </div>
      <h3 className="catalog-group-title">SLIDER & PICKER</h3>
      <div className="catalog-demo-grid">
        <Demo title="05 · Slider" spec="Track #D6D6D6 · Fill #EE2233 · Thumb 20px">
          <Slider label="진행률" value={state.slider} onValueChange={state.setSlider} unit="%" />
        </Demo>
        <Demo title="06 · Color Picker" spec="Preview 38px · HEX 입력 · RGB 슬라이더">
          <ColorPicker value={state.color} onValueChange={state.setColor} />
        </Demo>
        <Demo title="07 · Opacity / Brush Slider" spec="Thumb 14px · Label 14px">
          <Slider
            label="불투명도"
            value={state.opacity}
            onValueChange={state.setOpacity}
            unit="%"
            compact
          />
          <Slider
            label="브러시 크기"
            value={state.brush}
            onValueChange={state.setBrush}
            min={1}
            max={40}
            unit="px"
            compact
          />
          <div
            className="catalog-brush-preview"
            aria-label={`브러시 미리보기 ${state.brush}px, 불투명도 ${state.opacity}%`}
          >
            <i
              style={{
                width: state.brush,
                height: state.brush,
                opacity: state.opacity / 100,
                background: state.color,
              }}
            />
          </div>
        </Demo>
      </div>
    </>
  );
}
