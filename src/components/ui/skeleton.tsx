import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80',
        className
      )}
      {...props}
    />
  );
};

export const TableSkeletonLoader: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-4 pb-2">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="grid grid-cols-12 items-center gap-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-3.5"
        >
          <Skeleton className="col-span-2 h-4 w-full" />
          <Skeleton className="col-span-3 h-4 w-full" />
          <Skeleton className="col-span-2 h-4 w-4/5" />
          <Skeleton className="col-span-3 h-5 w-full" />
          <Skeleton className="col-span-2 h-6 w-20 justify-self-end rounded-full" />
        </div>
      ))}
    </div>
  );
};

export const BentoGridSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/90">
        <TableSkeletonLoader rows={5} />
      </div>
    </div>
  );
};
