import type { TelegramTopicSyncMode } from '@/db/schema/telegram-topic-sync-mode';
import type { TelegramConnectionView } from '@/lib/services/telegram/connection';

import { ConnectedView } from './telegram-card/connected-view';
import { NotConnectedView } from './telegram-card/not-connected-view';

type TelegramConnectionCardProps = {
  batchId: string;
  batchName: string;
  topicSyncMode: TelegramTopicSyncMode;
  connection: TelegramConnectionView;
};

export function TelegramConnectionCard({
  batchId,
  batchName,
  topicSyncMode,
  connection,
}: TelegramConnectionCardProps) {
  const managed = topicSyncMode === 'managed';

  if (!connection.connected) {
    return (
      <NotConnectedView
        batchId={batchId}
        batchName={batchName}
        managed={managed}
        view={connection}
      />
    );
  }

  return (
    <ConnectedView
      batchId={batchId}
      batchName={batchName}
      managed={managed}
      view={connection}
    />
  );
}
