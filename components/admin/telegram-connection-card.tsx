import {
  connectTelegramAction,
  disconnectTelegramAction,
  refreshTelegramAction,
  resolveTopicAction,
  syncTopicsAction,
} from '@/actions/telegram';
import { TelegramActionButton } from '@/components/admin/telegram-action-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TelegramConnectionView } from '@/lib/services/telegram/connection';
import {
  needsAttention,
  type PaceTopicStatus,
} from '@/lib/services/telegram/topic-evaluation';

const STATUS_BADGE: Record<
  PaceTopicStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  mapped: { label: 'Connected', variant: 'secondary' },
  ready_to_match: { label: 'Ready to match', variant: 'default' },
  name_mismatch: { label: 'Name changed', variant: 'destructive' },
  wrong_pace: { label: 'Wrong pace', variant: 'destructive' },
  ambiguous: { label: 'Duplicate topics', variant: 'destructive' },
  duplicate_name: { label: 'Duplicate group name', variant: 'destructive' },
  missing: { label: 'Topic will be created', variant: 'outline' },
};

export function TelegramConnectionCard({
  batchId,
  batchName,
  connection,
  readiness,
}: {
  batchId: string;
  batchName: string;
  connection: TelegramConnectionView;
  readiness: { key: string; label: string; ok: boolean; hint?: string }[];
}) {
  if (!connection.connected) {
    const ready = readiness.every((r) => r.ok);
    return (
      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            Connect the Telegram group
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-1 text-sm">
            {readiness.map((r) => (
              <li
                key={r.key}
                className={r.ok ? 'text-muted-foreground' : 'text-destructive'}
              >
                {r.ok ? '✔' : '○'} {r.label}
                {!r.ok && r.hint ? ` — ${r.hint}` : ''}
              </li>
            ))}
          </ul>
          <ol className="list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
            <li>
              Create a Telegram group named exactly <strong>{batchName}</strong>{' '}
              and turn on <strong>Topics</strong>.
            </li>
            <li>
              If the group already has topics, post one message in each so the
              bot can read its name.
            </li>
            <li>
              Press the button, pick the group and confirm the admin rights.
            </li>
          </ol>
          <TelegramActionButton
            action={connectTelegramAction}
            batchId={batchId}
            label="Add bot to Telegram group"
            pendingLabel="Opening Telegram..."
            disabled={!ready}
          />
        </CardContent>
      </Card>
    );
  }

  const { chat, paceGroups, announcementThreadId } = connection;
  const ready =
    chat.status === 'active' && chat.isForum && chat.canManageTopics;
  const missing = paceGroups.filter((g) => g.status === 'missing').length;
  const attention = paceGroups.filter(
    (g) => needsAttention(g.status) && g.status !== 'missing',
  ).length;

  return (
    <div className="space-y-6">
      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {chat.title ?? 'Telegram group'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={chat.status === 'active' ? 'default' : 'destructive'}
            >
              {chat.status === 'active' ? 'Bot in group' : 'Bot removed'}
            </Badge>
            <Badge variant={chat.isForum ? 'secondary' : 'destructive'}>
              {chat.isForum ? 'Topics on' : 'Topics off'}
            </Badge>
            <Badge variant={chat.canManageTopics ? 'secondary' : 'destructive'}>
              {chat.canManageTopics
                ? 'Can manage topics'
                : 'Needs Manage topics right'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-start gap-4">
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
              confirmMessage="Disconnect this Telegram group? Topic mappings are removed."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            Pace group topics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Topics are named “group name · pages”. From now on, renaming in
            Telegram updates the system and renaming here updates Telegram.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {paceGroups.map((g) => {
              const badge = STATUS_BADGE[g.status];
              return (
                <li key={g.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{g.name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Topic name: {g.expectedName}
                    {g.messageThreadId !== null
                      ? ` · topic #${g.messageThreadId}`
                      : ''}
                  </p>
                  {g.hint && g.status !== 'missing' ? (
                    <p className="text-xs text-destructive">{g.hint}</p>
                  ) : null}
                  {g.status === 'wrong_pace' ? (
                    <div className="flex flex-wrap gap-2">
                      <TelegramActionButton
                        action={resolveTopicAction}
                        batchId={batchId}
                        extra={{ paceGroupId: g.id, keep: 'system' }}
                        label="Rename the topic to match the system"
                        pendingLabel="Renaming..."
                        variant="outline"
                        disabled={!ready}
                      />
                      <TelegramActionButton
                        action={resolveTopicAction}
                        batchId={batchId}
                        extra={{ paceGroupId: g.id, keep: 'telegram' }}
                        label="Use the topic's pace in the system"
                        pendingLabel="Updating..."
                        variant="outline"
                        confirmMessage="This changes the pages per day of this pace group."
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
            {paceGroups.length === 0 ? (
              <li className="px-4 py-2 text-sm text-muted-foreground">
                This batch has no pace groups yet.
              </li>
            ) : null}
          </ul>
          <p className="text-sm text-muted-foreground">
            Announcements topic:{' '}
            {announcementThreadId === null
              ? 'will be created on sync'
              : `topic #${announcementThreadId}`}
            .
          </p>
          <TelegramActionButton
            action={syncTopicsAction}
            batchId={batchId}
            label={
              missing > 0
                ? `Sync topics (${missing} will be created)`
                : attention > 0
                  ? 'Sync topics'
                  : 'Sync topics (nothing to change)'
            }
            pendingLabel="Syncing..."
            disabled={!ready}
            confirmMessage={
              missing > 0
                ? `${missing} topic(s) will be created. If a topic for a pace group already exists in Telegram, post one message in it first so I can match it instead of creating a duplicate. Continue?`
                : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
