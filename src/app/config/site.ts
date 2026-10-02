import type { LayoutProps } from '@/app/layout/Layout';

type LayoutPreset = Required<
  Pick<LayoutProps, 'mode' | 'frame' | 'contentWidth' | 'showHeader' | 'showSidebar' | 'showFooter'>
> & {
  label: string;
  description: string;
};

export const layoutPresets = {
  web: {
    label: '웹 기본 레이아웃',
    description: '좌측 사이드바와 헤더를 함께 사용하는 일반적인 웹 앱 구조입니다.',
    mode: 'web',
    frame: 'full',
    contentWidth: 'wide',
    showHeader: true,
    showSidebar: true,
    showFooter: true,
  },
  mobile: {
    label: '모바일 최적화 레이아웃',
    description: '좁은 프레임과 사이드바 없는 구성을 기본값으로 두는 모바일 중심 구조입니다.',
    mode: 'mobile',
    frame: 'mobile',
    contentWidth: 'full',
    showHeader: true,
    showSidebar: false,
    showFooter: false,
  },
  landing: {
    label: '사이드바 없는 랜딩 레이아웃',
    description: '마케팅 페이지나 단일 진입 화면에 맞는 넓은 본문 중심 구조입니다.',
    mode: 'web',
    frame: 'full',
    contentWidth: 'content',
    showHeader: true,
    showSidebar: false,
    showFooter: true,
  },
} as const satisfies Record<string, LayoutPreset>;

export type LayoutPresetKey = keyof typeof layoutPresets;

export const siteConfig = {
  name: 'Cameo',
  shortName: 'C',
  description: '제한된 획 수 규칙으로 모두가 함께 완성하는 실시간 협업 캔버스',
  repositoryLabel: 'Solana 협업 캔버스',
  layoutPreset: 'web' as LayoutPresetKey,
} as const;

export const activeLayoutPreset = layoutPresets[siteConfig.layoutPreset];
