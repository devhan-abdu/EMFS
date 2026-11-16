import {
  disconnectTelegramAction,
  refreshTelegramAction,
} from '@/actions/telegram';
import { TelegramActionButton } from '@/components/admin/telegram-action-button';
import type { TelegramConnected } from '@/lib/services/telegram/connection';

import { CheckRow } from './check-row';
import { Section } from './section';

export function GroupStatusSection({
  batchId,
  batchName,
  chat,
}: {
  batchId: string;
  batchName: string;
  chat: TelegramConnected['chat'];
}) {
  const titleMatches = chat.title?.trim() === batchName.trim();
  // A removed bot never reaches the connected view, so only these can fail.
  const healthy = chat.isForum && chat.canManageTopics && titleMatches;

  return (
    <Section index={1} title={chat.title ?? 'Telegram group'} done={healthy}>
      <ul className="grid gap-2 sm:grid-cols-3">
        <CheckRow ok={chat.isForum} label="Topics on" hint="Turn on Topics" />
        <CheckRow
          ok={chat.canManageTopics}
          label="Can manage topics"
          hint="Give the bot Manage topics"
        />
        <CheckRow
          ok={titleMatches}
          label={
            <>
              Name matches <strong>{batchName}</strong>
            </>
          }
          hint="Rename the group or batch"
        />
      </ul>
      <div className="flex flex-wrap gap-3 pt-2">
        <TelegramActionButton
          action={refreshTelegramAction}
          batchId={batchId}
          label="Re-check"
          pendingLabel="Checking..."
          variant="outline"
        />
        <TelegramActionButton
          action={disconnectTelegramAction}
          batchId={batchId}
          label="Disconnect"
          pendingLabel="Disconnecting..."
          variant="destructive"
          confirmMessage="Disconnect this Telegram group? The bot will leave the group. Topic mappings are kept, so reconnecting the same group will not create the topics again."
        />
      </div>
    </Section>
  );
}
