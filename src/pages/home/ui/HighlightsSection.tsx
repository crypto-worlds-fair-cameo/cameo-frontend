import { Layers3, Rocket, ShieldCheck } from 'lucide-react';
import type { HomeHighlightContent } from '@/pages/home/api/getHomePageContent';
import SurfaceCard from '@/shared/ui/card/SurfaceCard';
import Grid from '@/shared/ui/grid/index';

interface HighlightsSectionProps {
    highlights: HomeHighlightContent[];
}

const highlightIcons = {
    rocket: Rocket,
    layers3: Layers3,
    'shield-check': ShieldCheck,
} as const;

const HighlightsSection = ({ highlights }: HighlightsSectionProps) => {
    return (
        <Grid minItemWidth={260} gap={20}>
            {highlights.map((item) => (
                <SurfaceCard key={item.title} className="space-y-4 bg-background/85">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {(() => {
                            const Icon = highlightIcons[item.icon];
                            return <Icon className="size-5" />;
                        })()}
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold tracking-tight">{item.title}</h2>
                        <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                </SurfaceCard>
            ))}
        </Grid>
    );
};

export default HighlightsSection;
