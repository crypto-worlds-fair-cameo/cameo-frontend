export type SeasonStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export type SeasonListStatus = Exclude<SeasonStatus, 'cancelled'>;

export interface Season {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  width: number;
  height: number;
  strokeLimitPerUser: number | null;
  capacity: number;
  participantCount: number;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  forceEndedAt: string | null;
  createdAt: string;
  status: SeasonStatus;
  isParticipant: boolean;
  isCreator: boolean;
  canCancel: boolean;
  canEnd: boolean;
}

export interface SeasonPage {
  items: Season[];
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface ListSeasonsInput {
  status?: SeasonListStatus;
  page: number;
  limit: number;
}

export interface CreateSeasonInput {
  title: string;
  description?: string;
  width: number;
  height: number;
  strokeLimitPerUser: number | null;
  capacity: number;
  startsAt?: string;
  endsAt: string;
}

export type SeasonRequestErrorKind = 'aborted' | 'business' | 'transport' | 'invalid-response';

export class SeasonRequestError extends Error {
  readonly kind: SeasonRequestErrorKind;
  readonly statusCode?: number;
  readonly code?: string;
  readonly traceId?: string;

  constructor(
    message: string,
    kind: SeasonRequestErrorKind,
    statusCode?: number,
    code?: string,
    traceId?: string
  ) {
    super(message);
    this.name = 'SeasonRequestError';
    this.kind = kind;
    this.statusCode = statusCode;
    this.code = code;
    this.traceId = traceId;
  }
}
