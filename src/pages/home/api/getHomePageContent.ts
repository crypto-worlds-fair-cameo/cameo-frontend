export interface HomeHeroContent {
  title: string;
  intro: string;
  checklist: string[];
}

export interface HomeHighlightContent {
  icon: 'rocket' | 'layers3' | 'shield-check';
  title: string;
  description: string;
}

export interface HomePageContent {
  hero: HomeHeroContent;
  highlights: HomeHighlightContent[];
  startSteps: string[];
}

const homePageContent: HomePageContent = {
  hero: {
    title: '다음 프로젝트를 바로 시작할 수 있는\n더 정돈된 기본값입니다.',
    intro:
      '이 스타터는 레이아웃, 라우팅, 전역 UI, 백엔드 부팅 구조를 미리 정리해둔 상태이므로 새 프로젝트에서는 도메인과 화면 설계에 바로 집중할 수 있습니다.',
    checklist: [
      '`siteConfig`와 백엔드 앱 설정에서 프로젝트 이름과 버전을 먼저 바꿉니다.',
      '`VITE_API_URL`과 백엔드 환경변수를 실제 로컬/개발 환경에 맞게 설정합니다.',
      '`siteConfig.layoutPreset`에서 시작 레이아웃을 web, mobile, landing 중 하나로 선택합니다.',
      '샘플 모듈을 실제 첫 도메인으로 바꿀지, 중립적인 sample 모듈로 둘지 결정합니다.',
      '이 페이지를 유지할지, 실제 서비스의 첫 화면으로 교체할지 정합니다.',
    ],
  },
  highlights: [
    {
      icon: 'rocket',
      title: '프론트와 백 분리 배포 전제',
      description: '프론트와 백엔드는 각각 독립적으로 배포하는 구조를 기본값으로 둡니다.',
    },
    {
      icon: 'layers3',
      title: '구조가 먼저 보이는 스타터',
      description:
        '라우트 설정, 레이아웃, 공용 UI, 백엔드 bootstrap이 재사용 가능한 기준으로 정리되어 있습니다.',
    },
    {
      icon: 'shield-check',
      title: '품질 기준 내장',
      description:
        '다음 프로젝트를 시작하기 전에 build, lint, backend test 기준선을 유지하도록 구성했습니다.',
    },
  ],
  startSteps: [
    '프로젝트 이름, 메타 정보, 환경변수 값을 실제 서비스 기준으로 변경합니다.',
    '백엔드 샘플 모듈을 실제 첫 도메인으로 교체하거나 중립적인 sample 모듈로 둡니다.',
    '이 메인 페이지를 서비스 랜딩 또는 내부 대시보드 시작 화면으로 교체합니다.',
    '프론트 API 계층과 백엔드 모듈을 첫 기능 기준으로 확장합니다.',
  ],
};

export const getHomePageContent = async (): Promise<HomePageContent> => {
  return homePageContent;
};
