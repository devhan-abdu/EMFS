import type { TelegramTopicSyncMode } from '@/db/schema/telegram-topic-sync-mode';
import type { TelegramConnectionView } from '@/lib/services/telegram/connection';

import { AutoRefresh } from './telegram-card/auto-refresh';
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

  return (
    <>
      <AutoRefresh />
      {connection.connected ? (
        <ConnectedView
          batchId={batchId}
          batchName={batchName}
          managed={managed}
          view={connection}
        />
      ) : (
        <NotConnectedView
          batchId={batchId}
          batchName={batchName}
          managed={managed}
          view={connection}
        />
      )}
    </>
  );
}
