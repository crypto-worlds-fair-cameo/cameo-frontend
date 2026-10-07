import { axiosInstance } from '@/shared/api/http-client';

interface ApiResponse<T> {
  statusCode: number;
  success: true;
  data: T;
}

export type ProfileSeasonStatus = 'active' | 'ended';

export interface ProfileTransaction {
  id: string;
  label: string;
  occurredAt: string;
  amountSol: number;
}

interface ProfileCanvasBase {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: ProfileSeasonStatus;
  minted: boolean;
  // 썸네일 API 전까지 목록에서 시즌을 구분하는 장식용 색 두 개.
  thumbnail: [string, string];
}

export interface ProfileSeason extends ProfileCanvasBase {
  participantCount: number;
}

export interface JoinedCanvas extends ProfileCanvasBase {
  strokeCount: number;
}

export interface ProfileActivity {
  joinedAt: string;
  balanceSol: number;
  transactions: ProfileTransaction[];
  mySeasons: ProfileSeason[];
  joinedCanvases: JoinedCanvas[];
}

// 가입일·잔액·거래 내역·시즌 목록 API가 아직 없어 디자인 시안(P · 프로필)의 값을 그대로 쓴다.
// 실제 API를 연결할 때 getProfileActivity만 http-client 요청으로 교체한다.
const sampleActivity: ProfileActivity = {
  joinedAt: '2026-09-10T12:00:00Z',
  balanceSol: 1222.33,
  transactions: [
    { id: 'tx-1', label: 'Brush stroke', occurredAt: '2026-09-28T12:00:00Z', amountSol: -0.01 },
    { id: 'tx-2', label: 'Ink purchase', occurredAt: '2026-09-28T12:00:00Z', amountSol: -0.01 },
    { id: 'tx-3', label: 'Season entry', occurredAt: '2026-09-28T12:00:00Z', amountSol: -0.01 },
  ],
  mySeasons: [
    {
      id: 'season-design-the-ui',
      title: 'Design the UI',
      startsAt: '2026-10-12T12:00:00Z',
      endsAt: '2026-11-01T12:00:00Z',
      participantCount: 7,
      status: 'ended',
      minted: false,
      thumbnail: ['#4fb3ff', '#5ec44f'],
    },
    {
      id: 'season-pixel-battle',
      title: 'Pixel Battle',
      startsAt: '2026-09-25T12:00:00Z',
      endsAt: '2026-10-30T12:00:00Z',
      participantCount: 128,
      status: 'active',
      minted: false,
      thumbnail: ['#ff6fb5', '#5d4ee2'],
    },
    {
      id: 'season-night-sky',
      title: 'Night Sky',
      startsAt: '2026-08-01T12:00:00Z',
      endsAt: '2026-08-20T12:00:00Z',
      participantCount: 64,
      status: 'ended',
      minted: true,
      thumbnail: ['#1b2a6b', '#f5c542'],
    },
  ],
  joinedCanvases: [
    {
      id: 'joined-night-sky',
      title: 'Night Sky',
      startsAt: '2026-03-01T12:00:00Z',
      endsAt: '2026-03-20T12:00:00Z',
      strokeCount: 12,
      status: 'ended',
      minted: true,
      thumbnail: ['#1b2a6b', '#f5c542'],
    },
  ],
};

/** 프로필 활동 샘플을 반환한다. 백엔드 요청은 하지 않는다. */
export async function getProfileActivity(): Promise<ProfileActivity> {
  return sampleActivity;
}

/** 기존 닉네임 변경 API를 사용한다. 서버는 앞뒤 공백을 제거한 1~20자만 허용한다. */
export async function updateDisplayName(displayName: string) {
  const response = await axiosInstance.patch<ApiResponse<{ id: string; displayName: string }>>(
    '/users/me/display-name',
    { displayName },
    { withCredentials: true }
  );
  if (response.status !== 200) throw new Error('Unexpected nickname update response');
  return response.data.data;
}
