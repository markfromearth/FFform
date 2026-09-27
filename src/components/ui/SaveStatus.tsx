import React, { useState, useEffect } from 'react';
import { Cloud, Check, Loader2 } from 'lucide-react';

interface SaveStatusProps {
  lastSaved: Date | null;
  isSaving: boolean;
}

export const SaveStatus: React.FC<SaveStatusProps> = ({ lastSaved, isSaving }) => {
  const [timeAgo, setTimeAgo] = useState<string>('just now');

  useEffect(() => {
    if (!lastSaved) return;

    const updateAgo = () => {
      const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (seconds < 10) {
        setTimeAgo('just now');
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else {
        const mins = Math.floor(seconds / 60);
        setTimeAgo(`${mins}m ago`);
      }
    };

    updateAgo();
    const interval = setInterval(updateAgo, 15000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  if (isSaving) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
        <span>Saving changes...</span>
      </div>
    );
  }

  if (!lastSaved) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={`Last auto-saved: ${lastSaved.toLocaleTimeString()}`}>
      <Check className="w-3.5 h-3.5 text-emerald-600" />
      <span>Saved {timeAgo}</span>
    </div>
  );
};
