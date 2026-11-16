import type { ReactNode } from 'react';
import { Check, CircleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export function CheckRow({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: ReactNode;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
          ok
            ? 'bg-primary text-primary-foreground'
            : 'bg-destructive/15 text-destructive',
        )}
      >
        {ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
      </span>
      <span>
        {label}
        {!ok && hint ? (
          <span className="block text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </li>
  );
}
