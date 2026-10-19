import {
  createTelegramTopicsAction,
  disconnectTelegramAction,
  generateTelegramLinkCodeAction,
  matchTelegramTopicsAction,
  renameTelegramTopicsAction,
  sendTelegramTestMessageAction,
  syncTelegramChatAction,
} from '@/actions/telegram';
import { TelegramActionButton } from '@/components/admin/telegram-action-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TelegramConnectionView } from '@/lib/services/telegram/connection';
import type { PaceTopicStatus } from '@/lib/services/telegram/topic-evaluation';

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
  missing: { label: 'Topic missing', variant: 'outline' },
};

export function TelegramConnectionCard({
  batchId,
  botUsername,
  connection,
  activeCode,
}: {
  batchId: string;
  botUsername: string | null;
  connection: TelegramConnectionView;
  activeCode: { code: string; minutesLeft: number } | null;
}) {
  const botName = botUsername ? `@${botUsername}` : 'the bot';

  if (!connection.connected) {
    return (
      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            Connect the Telegram group
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
            <li>
              Create the batch group in Telegram and turn on{' '}
              <strong>Topics</strong> in the group settings.
            </li>
            <li>
              Add {botName} as an admin with <strong>Manage topics</strong>,{' '}
              <strong>Delete messages</strong> and <strong>Pin messages</strong>
              .
            </li>
            <li>
              Generate a code below and send it in the group as /link CODE.
            </li>
          </ol>

          {activeCode ? (
            <div className="space-y-2 rounded-lg border border-border bg-surface-container p-4">
              <p className="text-sm text-muted-foreground">
                Send this in the group (valid for about {activeCode.minutesLeft}{' '}
                min):
              </p>
              <p className="font-mono text-xl font-semibold tracking-widest">
                /link {activeCode.code}
              </p>
            </div>
          ) : null}

          <TelegramActionButton
            action={generateTelegramLinkCodeAction}
            batchId={batchId}
            label={activeCode ? 'Generate a new code' : 'Generate link code'}
            pendingLabel="Generating..."
            variant={activeCode ? 'outline' : 'default'}
          />
        </CardContent>
      </Card>
    );
  }

  const { chat, paceGroups, announcementThreadId } = connection;
  const missing = paceGroups.filter((g) => g.status === 'missing').length;
  const needsRename = paceGroups.filter(
    (g) => g.status === 'name_mismatch' || g.status === 'wrong_pace',
  ).length;
  const matchable = paceGroups.filter(
    (g) => g.status === 'ready_to_match',
  ).length;
  const ready =
    chat.status === 'active' && chat.isForum && chat.canManageTopics;

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
              action={syncTelegramChatAction}
              batchId={batchId}
              label="Re-check"
              pendingLabel="Checking..."
              variant="outline"
            />
            <TelegramActionButton
              action={sendTelegramTestMessageAction}
              batchId={batchId}
              label="Send test message"
              pendingLabel="Sending..."
              variant="outline"
              disabled={chat.status !== 'active'}
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
            Each pace group needs a topic in the Telegram group named exactly as
            shown below (the group name and its pages per day). Create the
            topics in Telegram, then press <strong>Match topics</strong>.
          </p>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {paceGroups.map((group) => {
              const badge = STATUS_BADGE[group.status];
              return (
                <li key={group.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{group.name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Topic name: {group.expectedName}
                    {group.messageThreadId !== null
                      ? ` · topic #${group.messageThreadId}`
                      : ''}
                  </p>
                  {group.hint ? (
                    <p className="text-xs text-destructive">{group.hint}</p>
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
              ? 'not mapped (send /topic announcement inside it)'
              : `topic #${announcementThreadId}`}
            . Other topics (book talk, open chat) can be named anything.
          </p>

          <div className="flex flex-wrap items-start gap-4">
            <TelegramActionButton
              action={matchTelegramTopicsAction}
              batchId={batchId}
              label={
                matchable > 0
                  ? `Match ${matchable} topic${matchable === 1 ? '' : 's'}`
                  : 'Match topics'
              }
              pendingLabel="Matching..."
            />
            <TelegramActionButton
              action={createTelegramTopicsAction}
              batchId={batchId}
              label={
                missing > 0
                  ? `Create ${missing} missing topic${missing === 1 ? '' : 's'}`
                  : 'No missing topics'
              }
              pendingLabel="Creating topics..."
              variant="outline"
              disabled={!ready || missing === 0}
            />
            <TelegramActionButton
              action={renameTelegramTopicsAction}
              batchId={batchId}
              label={
                needsRename > 0
                  ? `Fix ${needsRename} topic name${needsRename === 1 ? '' : 's'}`
                  : 'Fix topic names'
              }
              pendingLabel="Renaming..."
              variant="outline"
              disabled={!ready || needsRename === 0}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
