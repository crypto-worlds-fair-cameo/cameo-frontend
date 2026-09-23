import HeroSection from '@/pages/home/ui/HeroSection';
import HighlightsSection from '@/pages/home/ui/HighlightsSection';
import StartStepsSection from '@/pages/home/ui/StartStepsSection';
import LayoutPresetsSection from '@/pages/home/ui/LayoutPresetsSection';
import SurfaceCard from '@/shared/ui/card/SurfaceCard';
import { RouteLoading } from '@/shared/ui/loading/index';
import { useHomeContent } from './model/useHomeContent';
import type { LayoutPresetsSectionProps } from './ui/LayoutPresetsSection';

interface HomePageProps extends LayoutPresetsSectionProps {
  repositoryLabel: string;
  description: string;
}

const HomePage = ({ repositoryLabel, description, ...presets }: HomePageProps) => {
  const { data, isLoading, isError } = useHomeContent();

  if (isError) {
    return (
      <SurfaceCard className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          홈 페이지 데이터를 불러오지 못했습니다.
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          API 또는 query 설정을 확인한 뒤 다시 시도하세요.
        </p>
      </SurfaceCard>
    );
  }

  if (isLoading || !data) return <RouteLoading />;

  return (
    <div className="space-y-8">
      <HeroSection
        content={data.hero}
        repositoryLabel={repositoryLabel}
        description={description}
      />
      <HighlightsSection highlights={data.highlights} />
      <StartStepsSection steps={data.startSteps} />
      <LayoutPresetsSection {...presets} />
    </div>
  );
};

export default HomePage;
