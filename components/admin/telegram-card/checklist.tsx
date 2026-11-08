'use client';

import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Steps the user can tick off themselves. */
export function Checklist({ steps }: { steps: ReactNode[] }) {
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const count = done.filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(count / steps.length) * 100}%` }}
        />
      </div>
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() =>
                setDone((d) => d.map((v, j) => (j === i ? !v : v)))
              }
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50',
                done[i] && 'bg-muted/40 text-muted-foreground line-through',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                  done[i]
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border',
                )}
              >
                {done[i] ? <Check className="size-3" /> : null}
              </span>
              {step}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {count} of {steps.length} done
      </p>
    </div>
  );
}
