import type { LayoutProps } from '@/app/layout/Layout';

type LayoutPreset = Required<
  Pick<LayoutProps, 'mode' | 'frame' | 'contentWidth' | 'showHeader' | 'showSidebar' | 'showFooter'>
> & {
  label: string;
  description: string;
};

export const layoutPresets = {
  web: {
    label: 'Default web layout',
    description: 'A standard web app with a left sidebar and header.',
    mode: 'web',
    frame: 'full',
    contentWidth: 'wide',
    showHeader: true,
    showSidebar: true,
    showFooter: true,
  },
  mobile: {
    label: 'Mobile layout',
    description: 'A narrow frame without a sidebar.',
    mode: 'mobile',
    frame: 'mobile',
    contentWidth: 'full',
    showHeader: true,
    showSidebar: false,
    showFooter: false,
  },
  landing: {
    label: 'Landing layout',
    description: 'A wide content layout for a single entry screen.',
    mode: 'web',
    frame: 'full',
    contentWidth: 'content',
    showHeader: true,
    showSidebar: false,
    // 시안에 꼬리말이 없어 사용 중인 레이아웃에서는 표시하지 않는다.
    showFooter: false,
  },
} as const satisfies Record<string, LayoutPreset>;

export type LayoutPresetKey = keyof typeof layoutPresets;

export const siteConfig = {
  name: 'React Nest Boilerplate',
  shortName: 'RNB',
  description: 'A starter with a visible structure and separate frontend and backend deploys.',
  repositoryLabel: 'Project starter',
  layoutPreset: 'landing' as LayoutPresetKey,
} as const;

export const activeLayoutPreset = layoutPresets[siteConfig.layoutPreset];
