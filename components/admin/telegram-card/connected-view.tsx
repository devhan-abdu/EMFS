import type { TelegramConnected } from '@/lib/services/telegram/connection';

import { GroupStatusSection } from './group-status-section';
import { PaceGroupTopicsSection } from './pace-group-topics-section';
import { RegisterTopicsSection } from './register-topic-section';

export function ConnectedView({
  batchId,
  batchName,
  managed,
  view,
}: {
  batchId: string;
  batchName: string;
  managed: boolean;
  view: TelegramConnected;
}) {
  const { chat, paceGroups, announcementThreadId, discoveredTopics } = view;
  const mapped = paceGroups.filter((g) => g.messageThreadId !== null).length;

  return (
    <div className="space-y-4">
      <GroupStatusSection batchId={batchId} batchName={batchName} chat={chat} />

      {!managed ? (
        <RegisterTopicsSection
          index={2}
          batchId={batchId}
          discoveredTopics={discoveredTopics}
          paceGroups={paceGroups}
          mapped={mapped}
        />
      ) : null}

      <PaceGroupTopicsSection
        index={managed ? 2 : 3}
        managed={managed}
        paceGroups={paceGroups}
        announcementThreadId={announcementThreadId}
        mapped={mapped}
      />
    </div>
  );
}
