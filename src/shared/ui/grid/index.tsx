import React from 'react';
import clsx from 'clsx';

interface GridProps {
    className?: string;
    children: React.ReactNode;
    /**
     * 각 아이템의 최소 너비 (px)
     * - 화면이 좁아져도 이 너비 이하로 줄어들지 않음
     * - 공간이 부족하면 아래로 줄바꿈
     * @default 250
     */
    minItemWidth?: number;

    /**
     * 한 줄에 표시할 최대 열 개수
     * - 설정하면 이 개수 이상으로 늘어나지 않음
     * - 미설정 시 화면 너비에 맞춰 무제한 배치
     * @example maxCols={3} → 최대 3열, 4번째 아이템은 다음 줄로
     */
    maxCols?: number;

    /**
     * 아이템 간 간격 (px)
     * @default 16
     */
    gap?: number; // px

    /**
     * 아이템들의 세로 정렬
     * - start: 위쪽 정렬
     * - center: 가운데 정렬
     * - end: 아래쪽 정렬
     * - stretch: 높이를 동일하게 늘림
     * @default 'stretch'
     */
    alignItems?: 'start' | 'center' | 'end' | 'stretch';

    /**
     * Grid 컨테이너를 페이지 가운데 배치
     * - maxCols가 있을 때만 효과가 있음
     * @default true
     */
    center?: boolean;
}
const Grid = ({
    className,
    children,
    minItemWidth = 250,
    maxCols,
    gap = 16,
    alignItems = 'stretch',
    center = true,
}: GridProps) => {
    const alignClass = {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
        stretch: 'items-stretch',
    }[alignItems];

    /**
     * maxWidth 계산 공식:
     * (아이템 최소 너비 × 최대 열 수) + (간격 × (열 수 - 1))
     *
     * 예: maxCols=3, minItemWidth=250, gap=16
     * → (250 × 3) + (16 × 2) = 750 + 32 = 782px
     * → Grid 컨테이너가 782px를 넘지 않음
     */
    const maxWidth = maxCols
        ? `calc(${maxCols} * ${minItemWidth}px + ${(maxCols - 1) * gap}px)`
        : undefined;

    return (
        <div
            className={clsx('grid', alignClass, center && maxCols && 'mx-auto', className)}
            style={{
                // auto-fit: 화면 너비에 맞춰 자동으로 열 개수 조정
                // minmax: 최소 minItemWidth, 최대 1fr(균등 분배)
                gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`,
                gap,
                maxWidth, // maxCols가 있을 때만 적용
                width: '100%',
            }}
        >
            {children}
        </div>
    );
};

export default Grid;
