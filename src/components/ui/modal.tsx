import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-2xl',
}) => {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/75 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl shadow-2xl',
              maxWidthClass
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-0.5 text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface TooltipHintProps {
  label: string;
  children: React.ReactNode;
}

export const TooltipHint: React.FC<TooltipHintProps> = ({ label, children }) => {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="pointer-events-none hidden sm:block absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-700 bg-neutral-900/95 px-2.5 py-1 text-[11px] font-medium text-neutral-100 opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:-translate-y-0.5 group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
};
