'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  mapDiscoveredTopicAction,
  type TelegramActionState,
} from '@/actions/telegram';
import { PaceGroupFormDialog } from '@/components/admin/pace-groups/pace-group-form-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const initialState: TelegramActionState = null;

export function TelegramTopicMappingForm({
  batchId,
  discoveryId,
  messageThreadId,
  topicName,
  paceGroups,
}: {
  batchId: string;
  discoveryId: string;
  messageThreadId: number;
  topicName: string | null;
  paceGroups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [createPaceGroupOpen, setCreatePaceGroupOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    mapDiscoveredTopicAction,
    initialState,
  );

  return (
    <>
      <form
        action={formAction}
        className="space-y-4 rounded-lg border border-border p-4"
      >
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="discoveryId" value={discoveryId} />
        <div>
          <p className="font-medium">
            {topicName ?? `Telegram topic #${messageThreadId}`}
          </p>
          {topicName ? (
            <p className="text-sm text-muted-foreground">
              Telegram topic #{messageThreadId}
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={() => setCreatePaceGroupOpen(true)}>
          Create pace group for this topic
        </Button>
        {paceGroups.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor={`pace-group-${discoveryId}`}>EMFS pace group</Label>
            <Select name="paceGroupId" defaultValue={paceGroups[0]?.id}>
              <SelectTrigger
                id={`pace-group-${discoveryId}`}
                className="w-full"
              >
                <SelectValue placeholder="Choose a pace group" />
              </SelectTrigger>
              <SelectContent>
                {paceGroups.map((paceGroup) => (
                  <SelectItem key={paceGroup.id} value={paceGroup.id}>
                    {paceGroup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Mapping...' : 'Map topic'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No unmapped pace groups are available. You can still create a new
            group for this topic.
          </p>
        )}
        {state?.ok && state.message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {state.message}
          </p>
        ) : null}
        {state && !state.ok && state.errors?.formErrors[0] ? (
          <p role="alert" className="text-sm text-destructive">
            {state.errors.formErrors[0]}
          </p>
        ) : null}
      </form>
      <PaceGroupFormDialog
        open={createPaceGroupOpen}
        onOpenChange={setCreatePaceGroupOpen}
        batchId={batchId}
        initial={null}
        discovery={{ id: discoveryId, topicName, messageThreadId }}
        onSuccess={() => {
          setCreatePaceGroupOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
