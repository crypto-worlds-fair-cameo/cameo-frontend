export interface BrushSettings {
  color: string;
  brushType: 'round' | 'flat' | 'airbrush';
  brushSize: number;
}

// 크기는 도화지 좌표의 px다. 페이지마다 설정값을 별도로 소유한다.
export const defaultBrushSettings: BrushSettings = {
  color: '#ED4242',
  brushType: 'round',
  brushSize: 12,
};
