import { Hash, Megaphone, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { TelegramConnected } from '@/lib/services/telegram/connection';

import { Section } from './section';

function ThreadBadge({ threadId }: { threadId: number | null }) {
  return threadId === null ? (
    <Badge variant="destructive">Not mapped</Badge>
  ) : (
    <Badge variant="secondary">#{threadId}</Badge>
  );
}

export function PaceGroupTopicsSection({
  index,
  managed,
  paceGroups,
  announcementThreadId,
  mapped,
}: {
  index: number;
  managed: boolean;
  paceGroups: TelegramConnected['paceGroups'];
  announcementThreadId: number | null;
  mapped: number;
}) {
  return (
    <Section
      index={index}
      title="Pace group topics"
      done={paceGroups.length > 0 && mapped === paceGroups.length}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {managed ? 'Synced automatically' : 'Mapped manually'}
        </span>
        <Badge variant="secondary">
          {mapped}/{paceGroups.length} mapped
        </Badge>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {paceGroups.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-2 font-medium">
              <Hash className="size-4 text-muted-foreground" />
              {g.name}
            </span>
            <ThreadBadge threadId={g.messageThreadId} />
          </li>
        ))}
        {paceGroups.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted-foreground">
            {managed
              ? 'No pace groups yet. Create one and its topic is created in Telegram automatically.'
              : 'No pace groups yet. Create pace groups, then map each one to a topic above.'}
          </li>
        ) : null}
        <li className="flex items-center justify-between gap-4 bg-muted/30 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Megaphone className="size-4 text-muted-foreground" />
            Announcements
          </span>
          <ThreadBadge threadId={announcementThreadId} />
        </li>
      </ul>

      {managed ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" />
          Changes to pace groups update Telegram automatically.
        </p>
      ) : null}
    </Section>
  );
}
