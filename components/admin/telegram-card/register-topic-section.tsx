import type { ReactNode } from 'react';
import { Send } from 'lucide-react';

import { TelegramTopicMappingForm } from '@/components/admin/telegram-topic-mapping-form';
import type { TelegramConnected } from '@/lib/services/telegram/connection';

import { Section } from './section';

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

export function RegisterTopicsSection({
  index,
  batchId,
  discoveredTopics,
  paceGroups,
  mapped,
}: {
  index: number;
  batchId: string;
  discoveredTopics: TelegramConnected['discoveredTopics'];
  paceGroups: TelegramConnected['paceGroups'];
  mapped: number;
}) {
  const unmappedGroups = paceGroups
    .filter((g) => g.messageThreadId === null)
    .map(({ id, name }) => ({ id, name }));

  return (
    <Section
      index={index}
      title="Register topics"
      done={
        discoveredTopics.length === 0 &&
        mapped === paceGroups.length &&
        mapped > 0
      }
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Send className="size-4" />
        In each topic send <Code>/register_topic name</Code>, then refresh.
      </p>
      {discoveredTopics.length > 0 ? (
        <div className="space-y-3">
          {discoveredTopics.map((topic) => (
            <TelegramTopicMappingForm
              key={topic.id}
              batchId={batchId}
              discoveryId={topic.id}
              messageThreadId={topic.messageThreadId}
              topicName={topic.topicName}
              paceGroups={unmappedGroups}
            />
          ))}
        </div>
      ) : null}
    </Section>
  );
}
