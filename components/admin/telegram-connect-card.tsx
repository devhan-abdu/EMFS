import { Check, Circle } from 'lucide-react';
import { ConnectTelegramButton } from './connect-telegram-button';
import { getTelegramReadiness } from '@/lib/telegram/readiness';

export async function TelegramConnectCard({ batchId }: { batchId: string }) {
  const r = await getTelegramReadiness(batchId);
  if (!r) return null;

  const Row = ({
    ok,
    label,
    hint,
  }: {
    ok: boolean;
    label: string;
    hint?: string;
  }) => (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <Check className="mt-0.5 size-4 text-teal" />
      ) : (
        <Circle className="mt-0.5 size-4 text-muted-foreground/50" />
      )}
      <span>
        {label}
        {!ok && hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
    </li>
  );

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {r.system.map((i) => (
          <Row {...i} />
        ))}
      </ul>
      <ul className="space-y-2 border-t border-border pt-4">
        {r.telegram.map((i) => (
          <Row {...i} />
        ))}
      </ul>
      <ConnectTelegramButton batchId={batchId} disabled={!r.canConnect} />
    </div>
  );
}
