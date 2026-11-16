import type { ReactNode } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';

import { connectTelegramAction } from '@/actions/telegram';
import { TelegramActionButton } from '@/components/admin/telegram-action-button';
import type { TelegramNotConnected } from '@/lib/services/telegram/connection';

import { Checklist } from './checklist';
import { Section } from './section';

function setupSteps(managed: boolean): ReactNode[] {
  return managed
    ? [
        <>Create a new Telegram group</>,
        <>
          Turn on <strong>Topics</strong> in the group settings
        </>,
      ]
    : [
        <>Open your existing group</>,
        <>
          Check <strong>Topics</strong> is on
        </>,
      ];
}

function connectLabel(opts: {
  botRemoved: boolean;
  waiting: boolean;
  managed: boolean;
}) {
  if (opts.botRemoved) return 'Reconnect Telegram group';
  if (opts.waiting) return 'Open Telegram again';
  return opts.managed ? 'Connect Telegram group' : 'Connect existing group';
}

export function NotConnectedView({
  batchId,
  batchName,
  managed,
  view,
}: {
  batchId: string;
  batchName: string;
  managed: boolean;
  view: TelegramNotConnected;
}) {
  const { botRemoved, previousTitle, activeCode } = view;
  const waiting = activeCode !== null;

  return (
    <div className="space-y-4">
      {botRemoved ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            The bot is no longer in{' '}
            <strong>{previousTitle ?? 'the group'}</strong>. Reconnect to link
            it again. If it is the same group, its topic mappings are kept.
          </p>
        </div>
      ) : null}

      <Section
        index={1}
        title={managed ? 'Prepare a new group' : 'Prepare your group'}
      >
        <p className="text-sm text-muted-foreground">
          Group name: <strong className="text-foreground">{batchName}</strong>
        </p>
        <Checklist steps={setupSteps(managed)} />
      </Section>

      <Section index={2} title={botRemoved ? 'Reconnect' : 'Connect'}>
        <p className="text-sm text-muted-foreground">
          {managed
            ? 'Topics are created for you automatically.'
            : 'Your existing topics and messages stay as they are.'}{' '}
          After you pick the group in Telegram, make the bot an admin with{' '}
          <strong>Manage topics</strong>.
        </p>

        {activeCode ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Loader2 className="size-4 animate-spin" />
              Waiting for your group...
            </p>
            <p className="text-muted-foreground">
              This page updates by itself. The link stays valid for{' '}
              {activeCode.minutesLeft} min.
            </p>
          </div>
        ) : null}

        <TelegramActionButton
          action={connectTelegramAction}
          batchId={batchId}
          label={connectLabel({ botRemoved, waiting, managed })}
          pendingLabel="Opening Telegram..."
        />
      </Section>
    </div>
  );
}
