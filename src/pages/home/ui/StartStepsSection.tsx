import SurfaceCard from '@/shared/ui/card/SurfaceCard';

interface StartStepsSectionProps {
    steps: string[];
}

const StartStepsSection = ({ steps }: StartStepsSectionProps) => {
    return (
        <SurfaceCard className="space-y-4">
            <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">권장 시작 순서</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                    이 페이지 하나만 샘플로 남겨두었습니다. 실제 프로젝트에 들어갈 때는 아래 순서로
                    정리하면 가장 빠르게 전환됩니다.
                </p>
            </div>
            <ol className="space-y-3 text-sm leading-7 text-muted-foreground">
                {steps.map((step, index) => (
                    <li key={step}>
                        {index + 1}. {step}
                    </li>
                ))}
            </ol>
        </SurfaceCard>
    );
};

export default StartStepsSection;
