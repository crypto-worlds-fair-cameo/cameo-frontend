export const sections = [
  ['colors', '컬러 토큰'],
  ['semantic', 'Semantic 토큰'],
  ['typography', '타이포그래피'],
  ['buttons', '버튼 Variant (5종)'],
  ['sizes', '버튼 Size (4종)'],
  ['states', 'State 매트릭스'],
  ['radius', 'Border Radius'],
  ['patterns', '버튼 조합 패턴'],
  ['components', '공통 UI 컴포넌트 (31종)'],
  ['implementation', '구현 가이드'],
  ['decisions', '핵심 통일 결정'],
  ['accessibility', '접근성 및 동작'],
] as const;

export const palettes = [
  {
    label: 'CORE',
    colors: [
      ['Black', '--color-black', '#171717'],
      ['Web3', '--color-web3', '#641ACB'],
      ['Red', '--color-accent-red', '#EE2233'],
      ['Active', '--color-status-active', '#5D4EE2'],
      ['Blue', '--color-accent-blue', '#2A43D0'],
    ],
  },
  {
    label: 'GRAY SCALE',
    colors: [
      ['50', '--color-gray-50', '#F5F5F5'],
      ['100', '--color-gray-100', '#EBEBEB'],
      ['200', '--color-gray-200', '#D6D6D6'],
      ['300', '--color-gray-300', '#B8B8B8'],
      ['400', '--color-gray-400', '#8E8E8E'],
      ['500', '--color-gray-500', '#6B6B6B'],
      ['600', '--color-gray-600', '#4F4F4F'],
      ['700', '--color-gray-700', '#3D3D3D'],
      ['800', '--color-gray-800', '#2C2C2C'],
    ],
  },
  {
    label: 'WEB3 STATES',
    colors: [
      ['Default', '--color-web3', '#641ACB'],
      ['Hover', '--color-web3-hover', '#5215A8'],
      ['Pressed', '--color-web3-pressed', '#420F8A'],
      ['Loading', '--color-web3-loading', '#9B7EC8'],
    ],
  },
  { label: 'SOLANA BRAND', colors: [['Solana', '--solana-gradient', '#9945FF → #14F195']] },
];

export const semanticGroups = [
  {
    label: 'TEXT',
    tokens: [
      ['--text-primary', '#171717 · 본문'],
      ['--text-secondary', '#4F4F4F · 보조 텍스트'],
      ['--text-tertiary', '#8E8E8E · 부가 정보'],
      ['--text-placeholder', '#8E8E8E'],
      ['--text-disabled', '#B8B8B8'],
    ],
  },
  {
    label: 'BUTTON',
    tokens: [
      ['--btn-primary-bg', '#171717'],
      ['--btn-primary-hover', '#2C2C2C'],
      ['--btn-primary-active', '#3D3D3D'],
      ['--btn-web3-bg', '#641ACB'],
      ['--btn-web3-hover', '#5215A8'],
      ['--btn-web3-active', '#420F8A'],
      ['--btn-web3-loading', '#9B7EC8'],
      ['--btn-disabled-bg', '#EBEBEB'],
      ['--btn-disabled-text', '#8E8E8E'],
    ],
  },
  {
    label: 'BORDER',
    tokens: [
      ['--border-default', '#B8B8B8'],
      ['--border-strong', '#171717'],
      ['--border-input', '#B8B8B8'],
      ['--border-card', '#B8B8B8'],
    ],
  },
  {
    label: 'SURFACE',
    tokens: [
      ['--surface-modal', '#FFFFFF'],
      ['--surface-card', '#F5F5F5'],
      ['--surface-glass', 'rgba(255,255,255,0.80)'],
      ['--surface-glass-panel', 'rgba(255,255,255,0.80)'],
      ['--surface-overlay', 'rgba(0,0,0,0.50)'],
    ],
  },
  {
    label: 'STATUS',
    tokens: [
      ['--color-status-active', '#5D4EE2'],
      ['--color-accent-red', '#EE2233'],
      ['--color-accent-blue', '#2A43D0'],
    ],
  },
];

export const buttonSpecs = [
  {
    variant: 'primary',
    title: 'Primary',
    purpose: '주요 CTA',
    rows: [
      ['Background', '--btn-primary-bg'],
      ['Hover', '--btn-primary-hover'],
      ['Pressed', '--btn-primary-active'],
    ],
  },
  {
    variant: 'web3',
    title: 'Web3',
    purpose: '블록체인 액션',
    rows: [
      ['Background', '--btn-web3-bg'],
      ['Hover', '--btn-web3-hover'],
      ['Pressed', '--btn-web3-active'],
      ['Loading', '--btn-web3-loading'],
    ],
  },
  {
    variant: 'secondary',
    title: 'Secondary',
    purpose: '보조 / Cancel',
    rows: [
      ['Background', 'transparent'],
      ['Border', '1px solid · --border-strong'],
      ['Hover', '--surface-card'],
      ['Pressed', '--secondary'],
    ],
  },
  {
    variant: 'ghost',
    title: 'Ghost',
    purpose: '텍스트 전용',
    rows: [
      ['Background', 'transparent'],
      ['Text', '--text-secondary'],
      ['Hover text', '--text-primary'],
    ],
  },
  {
    variant: 'glass',
    title: 'Glass',
    purpose: '캔버스 오버레이',
    rows: [
      ['Background', 'rgba(255,255,255,0.86)'],
      ['Hover', 'rgba(255,255,255,0.95)'],
      ['Blur', '2px'],
      ['Shadow', 'inset 0 -2px 4px rgba(0,0,0,0.25)'],
    ],
  },
] as const;

export const radiusTokens = [
  ['Button', '--radius-button', '12px'],
  ['Input', '--radius-input', '10px'],
  ['Modal', '--radius-modal', '24px'],
  ['Card', '--radius-card', '14px'],
  ['Checkbox', '--radius-checkbox', '4px'],
  ['Picker', '--radius-picker', '8px'],
];
