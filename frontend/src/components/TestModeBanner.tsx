'use client';

import { useEffect, useState } from 'react';
import { isTestMode, toggleTestMode } from '@/lib/testMode';
import { FlaskConical, X } from 'lucide-react';

export function TestModeBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isTestMode());
  }, []);

  if (!active) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-amber-400 border-t-2 border-amber-500">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span>
            <strong>TEST MODE</strong> — Using mock data. Real backend not required.
          </span>
        </div>
        <button
          onClick={toggleTestMode}
          className="flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-full transition-colors"
        >
          <X className="w-3 h-3" />
          Disable Test Mode
        </button>
      </div>
    </div>
  );
}

/** Small floating button shown when test mode is OFF — useful in dev */
export function TestModeToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isTestMode());
  }, []);

  if (active) return null;

  // Only show in non-production builds
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <button
      onClick={toggleTestMode}
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 text-xs font-medium bg-neutral-800 text-white px-3 py-2 rounded-full shadow-lg hover:bg-neutral-700 transition-colors"
    >
      <FlaskConical className="w-3 h-3" />
      Enable Test Mode
    </button>
  );
}
