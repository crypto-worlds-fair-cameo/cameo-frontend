import SurfaceCard from '@/shared/ui/card/SurfaceCard';

interface StartStepsSectionProps {
  steps: string[];
}

const StartStepsSection = ({ steps }: StartStepsSectionProps) => {
  return (
    <SurfaceCard className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">데모 여정</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          가입부터 지갑 수령까지 끊기지 않아야 하는 흐름입니다. 그리기, 지갑 연결, 시즌 화면은 아직
          이 프론트에 연결되어 있지 않습니다.
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
