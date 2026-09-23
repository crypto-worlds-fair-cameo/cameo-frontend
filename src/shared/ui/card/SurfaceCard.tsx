import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface SurfaceCardProps {
    children: ReactNode;
    className?: string;
}

const SurfaceCard = ({ children, className }: SurfaceCardProps) => {
    return (
        <section
            className={cn(
                'rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur',
                className,
            )}
        >
            {children}
        </section>
    );
};

export default SurfaceCard;
