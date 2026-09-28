import { Link } from 'react-router';
import { sections } from './config/catalog';
import { CatalogSection } from './ui/CatalogSection';
import { ColorTokens, SemanticTokens, Typography, RadiusAndSpacing } from './ui/Foundations';
import { ButtonVariants, ButtonSizes, StateMatrix, ButtonPatterns } from './ui/ButtonExamples';
import { InputExamples } from './ui/InputExamples';
import { NavigationExamples } from './ui/NavigationExamples';
import { CardExamples, StatusExamples } from './ui/DisplayExamples';
import { OverlayExamples } from './ui/OverlayExamples';
import { CanvasExamples } from './ui/CanvasExamples';
import { OtherExamples } from './ui/OtherExamples';
import { ImplementationGuide } from './ui/ImplementationGuide';
import './ui/catalog.css';

export default function UiPage() {
  return (
    <div className="ui-catalog cameo-light">
      <title>Cameo — 공통 UI 스펙</title>
      <meta name="robots" content="noindex" />
      <a className="catalog-skip" href="#components">
        공통 컴포넌트로 이동
      </a>
      <div className="catalog-container">
        <header className="catalog-header">
          <div className="catalog-eyebrow">
            CAMEO / DESIGN SYSTEM <Link to="/">프로젝트 홈 ↗</Link>
          </div>
          <h1>Cameo — 공통 UI 스펙</h1>
          <p>버튼 · 컬러 · 타이포 · 컴포넌트 · 구현 코드 — 프로젝트 공통 기준</p>
          <div className="catalog-tags">
            <span>React 19 + Vite</span>
            <span>Tailwind v4</span>
            <span>Radix UI</span>
            <span>31 components</span>
          </div>
        </header>
        <nav className="catalog-toc" aria-label="UI 스펙 목차">
          <h2>목차</h2>
          <ol>
            {sections.map(([id, label], index) => (
              <li key={id}>
                <a href={`#${id}`}>
                  {index + 1}. {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <ColorTokens />
        <SemanticTokens />
        <Typography />
        <ButtonVariants />
        <ButtonSizes />
        <StateMatrix />
        <RadiusAndSpacing />
        <ButtonPatterns />
        <CatalogSection id="components" title="9. 공통 UI 컴포넌트 (31종)">
          <p className="catalog-description">
            규격과 실제 UI를 함께 확인하세요. 밝은 영역은 서비스 컴포넌트, 어두운 영역은 카탈로그
            설명입니다.
          </p>
          <InputExamples />
          <NavigationExamples />
          <CardExamples />
          <OverlayExamples />
          <StatusExamples />
          <CanvasExamples />
          <OtherExamples />
        </CatalogSection>
        <ImplementationGuide />
        <footer className="catalog-footer">
          <strong>Cameo</strong>
          <span>공통 디자인 토큰 · Page-first architecture</span>
          <a href="#">맨 위로 ↑</a>
        </footer>
      </div>
    </div>
  );
}
