export interface CanvasHistoryItem {
  id: string;
  imageUrl: string;
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
