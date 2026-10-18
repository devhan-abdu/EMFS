import {
  createTelegramTopicsAction,
  disconnectTelegramAction,
  generateTelegramLinkCodeAction,
  sendTelegramTestMessageAction,
  syncTelegramChatAction,
} from '@/actions/telegram';
import { TelegramActionButton } from '@/components/admin/telegram-action-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TelegramConnectionView } from '@/lib/services/telegram/connection';

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
  const missing = paceGroups.filter((g) => g.messageThreadId === null).length;
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
          <ul className="divide-y divide-border rounded-lg border border-border">
            {paceGroups.map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
              >
                <span className="font-medium">{group.name}</span>
                {group.messageThreadId === null ? (
                  <Badge variant="outline">Not mapped</Badge>
                ) : (
                  <Badge variant="secondary">
                    Topic #{group.messageThreadId}
                  </Badge>
                )}
              </li>
            ))}
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
            . Already have topics? Send /topic pace &lt;pace group name&gt;
            inside each one.
          </p>

          <TelegramActionButton
            action={createTelegramTopicsAction}
            batchId={batchId}
            label={
              missing > 0
                ? `Create ${missing} missing topic${missing === 1 ? '' : 's'}`
                : 'All topics created'
            }
            pendingLabel="Creating topics..."
            disabled={!ready || missing === 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
