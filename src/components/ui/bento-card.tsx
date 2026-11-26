import React from 'react';
import { cn } from '../../lib/utils';

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  glass?: boolean;
  noPadding?: boolean;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  className,
  interactive = false,
  glass = true,
  noPadding = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-colors duration-150',
        glass
          ? 'bg-white/95 dark:bg-slate-900/90 border-white/60 dark:border-white/[0.12] shadow-lg'
          : 'bg-white/95 dark:bg-slate-900/90 border-neutral-200/80 dark:border-white/10 shadow-md',
        interactive &&
          'hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-400/45 dark:hover:border-indigo-400/40 cursor-pointer',
        !noPadding && 'p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
