'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Section({
  index,
  title,
  done,
  defaultOpen = true,
  children,
}: {
  index: number;
  title: string;
  done?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="card-soft overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
            done
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground',
          )}
        >
          {done ? <Check className="size-4" /> : index}
        </span>
        <h2 className="font-display flex-1 text-lg">{title}</h2>
        <ChevronDown
          className={cn(
            'size-5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border px-5 py-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
