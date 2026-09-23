import SurfaceCard from '@/shared/ui/card/SurfaceCard';
import Grid from '@/shared/ui/grid/index';
export interface LayoutPresetsSectionProps {
    activePresetKey: string;
    layoutPresets: Record<
        string,
        {
            label: string;
            description: string;
            mode: string;
            frame: string;
            contentWidth: string;
        }
    >;
}

const LayoutPresetsSection = ({ activePresetKey, layoutPresets }: LayoutPresetsSectionProps) => {
    return (
        <SurfaceCard className="space-y-4">
            <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">레이아웃 프리셋</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                    현재 기본 프리셋은 <strong>{layoutPresets[activePresetKey]?.label}</strong>
                    입니다. 새 프로젝트에서는 `siteConfig.layoutPreset` 값만 바꿔도 전체 쉘 구성이
                    같이 바뀝니다.
                </p>
            </div>
            <Grid minItemWidth={220} gap={16}>
                {Object.entries(layoutPresets).map(([key, preset]) => (
                    <SurfaceCard
                        key={key}
                        className={
                            key === activePresetKey
                                ? 'border-primary/40 bg-primary/5'
                                : 'bg-background/85'
                        }
                    >
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-base font-semibold">{preset.label}</h3>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                                    {key}
                                </span>
                            </div>
                            <p className="text-sm leading-6 text-muted-foreground">
                                {preset.description}
                            </p>
                            <p className="text-xs leading-6 text-muted-foreground">
                                mode: {preset.mode} / frame: {preset.frame} / width:{' '}
                                {preset.contentWidth}
                            </p>
                        </div>
                    </SurfaceCard>
                ))}
            </Grid>
        </SurfaceCard>
    );
};

export default LayoutPresetsSection;
