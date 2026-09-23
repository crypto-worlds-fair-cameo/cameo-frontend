import { CheckCircle2 } from 'lucide-react';
import type { HomeHeroContent } from '@/pages/home/api/getHomePageContent';
import SurfaceCard from '@/shared/ui/card/SurfaceCard';

interface HeroSectionProps {
  content: HomeHeroContent;
  repositoryLabel: string;
  description: string;
}

const HeroSection = ({ content, repositoryLabel, description }: HeroSectionProps) => {
  return (
    <SurfaceCard className="overflow-hidden bg-[linear-gradient(135deg,rgba(17,24,39,0.96),rgba(15,23,42,0.9))] text-white">
      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs tracking-[0.18em] text-white/70">
            {repositoryLabel}
          </span>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {content.title.split('\n').map(line => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{description}</p>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-300">{content.intro}</p>
        </div>

        <SurfaceCard className="border-white/10 bg-white/5 p-5 text-white shadow-none">
          <h2 className="text-sm font-semibold tracking-[0.12em] text-slate-300">
            시작 체크리스트
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {content.checklist.map(item => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 text-cyan-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>
    </SurfaceCard>
  );
};

export default HeroSection;
