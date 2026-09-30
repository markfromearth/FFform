import React from 'react';
import { Button } from './Button';
import { Edit3 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ReviewSectionCardProps {
  title: string;
  icon: React.ReactNode;
  onEdit?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  editLabel?: string;
  className?: string;
}

export const ReviewSectionCard: React.FC<ReviewSectionCardProps> = ({
  title,
  icon,
  onEdit,
  actions,
  children,
  editLabel = 'Edit',
  className,
}) => {
  return (
    <div className={twMerge('bg-white/10 rounded-2xl border border-white/10 shadow-soft overflow-hidden', className)}>
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 border-b border-white/10">
        <div className="flex items-center gap-2.5 font-bold text-white text-sm">
          {icon}
          <span>{title}</span>
        </div>
        {actions ? (
          actions
        ) : onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            aria-label={`Edit ${title}`}
          >
            {editLabel}
          </Button>
        ) : null}
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
};
