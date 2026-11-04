import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface BentoCardProps extends HTMLMotionProps<'div'> {
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-all duration-200',
        glass
          ? 'bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl border-white/60 dark:border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.12)]'
          : 'bg-white/90 dark:bg-slate-900/75 backdrop-blur-xl border-neutral-200/80 dark:border-white/10 shadow-bento',
        interactive &&
          'hover:-translate-y-0.5 hover:bg-white/90 dark:hover:bg-slate-900/75 hover:border-indigo-400/40 dark:hover:border-indigo-400/35 hover:shadow-[0_14px_38px_rgba(79,70,229,0.18),inset_0_1px_0_0_rgba(255,255,255,0.2)] cursor-pointer',
        !noPadding && 'p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};
