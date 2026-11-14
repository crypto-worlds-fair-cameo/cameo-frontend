export interface CanvasHistoryItem {
  id: string;
  /** 원본 크기 PNG. 다운로드에 쓴다. */
  imageUrl: string;
  /** 크게 보기용 중간 크기 그림. 서버가 아직 만들지 않았으면 null이다. */
  previewUrl: string | null;
  /** 목록 카드용 작은 그림. 서버가 아직 만들지 않았으면 null이다. */
  thumbnailUrl: string | null;
  width: number;
  height: number;
  capturedAt: string;
  isFinal: boolean;
}

export interface CanvasHistoryPage {
  items: CanvasHistoryItem[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface ListCanvasHistoryInput {
  limit: number;
  cursor?: string;
}

export type HistoryRequestErrorKind = 'aborted' | 'business' | 'transport' | 'invalid-response';

export class HistoryRequestError extends Error {
  readonly kind: HistoryRequestErrorKind;
  readonly statusCode?: number;
  readonly code?: string;

  constructor(message: string, kind: HistoryRequestErrorKind, statusCode?: number, code?: string) {
    super(message);
    this.name = 'HistoryRequestError';
    this.kind = kind;
    this.statusCode = statusCode;
    this.code = code;
  }
}
