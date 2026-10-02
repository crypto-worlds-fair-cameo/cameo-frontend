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
    title: '한 획으로\n함께 그리는 도화지',
    intro:
      '메인 도화지는 10000×10000 한 장이고, 계정당 평생 한 획만 그릴 수 있습니다. 시즌 도화지는 기간 안에 신청한 사람이 함께 그리고, 끝나면 결과물이 확정됩니다.',
    checklist: [
      '메인 도화지에서 회원은 평생 1획만 그립니다.',
      '기존 획 위에 덮어 그릴 수 있고, 1시간 단위 스냅샷으로 히스토리를 봅니다.',
      '시즌 도화지는 기간 안 신청자 전원이 참여합니다.',
      '주최자가 사용자당 1~1000획을 정하고, 종료되면 그리기가 멈춥니다.',
      '종료 후 대표 캔버스 cNFT와 참여 증명 cNFT를 나눕니다.',
    ],
  },
  highlights: [
    {
      icon: 'layers3',
      title: '메인 도화지',
      description:
        '고정된 한 장의 캔버스에 계정당 평생 1획을 남기고, 시간 단위 스냅샷으로 과정을 봅니다.',
    },
    {
      icon: 'rocket',
      title: '시즌 도화지',
      description:
        '시작과 종료가 있는 이벤트 캔버스입니다. 신청한 사람이 정해진 획 수만큼 함께 그립니다.',
    },
    {
      icon: 'shield-check',
      title: '참여 증명',
      description:
        '시즌이 끝나면 완성 캔버스를 대표하는 cNFT와 참가자 증명 cNFT를 지갑으로 받습니다.',
    },
  ],
  startSteps: [
    '가입하고 Solana 지갑을 연결합니다.',
    '메인 도화지에 평생 1획을 그립니다.',
    '시즌 도화지에 신청하고, 주최자가 정한 획 수만큼 참여합니다.',
    '시즌이 끝나면 그리기가 멈추고 결과물이 확정됩니다.',
    '대표 캔버스와 참여 증명 cNFT를 지갑에서 확인합니다.',
  ],
};

export const getHomePageContent = async (): Promise<HomePageContent> => {
  return homePageContent;
};
