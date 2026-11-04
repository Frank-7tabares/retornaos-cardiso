import React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'commercial'
  | 'quality'
  | 'neutral'
  | 'indigo';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
  success:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  warning:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  danger:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  commercial:
    'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25',
  quality:
    'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/25',
  neutral:
    'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20',
  indigo:
    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/25',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-neutral-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500 animate-pulse',
  danger: 'bg-rose-500',
  commercial: 'bg-amber-400',
  quality: 'bg-sky-400',
  neutral: 'bg-neutral-400',
  indigo: 'bg-indigo-400',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  dot = false,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors duration-200',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
