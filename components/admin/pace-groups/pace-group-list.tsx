'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { PaceGroupCard } from './pace-group-card';
import { PaceGroupFormDialog } from './pace-group-form-dialog';
import { PaceAdminAssignDialog } from './pace-admin-assign-dialog';
import { archivePaceGroupAction } from '@/actions/pace-group';
import type { PaceGroupWithAdmins } from './types';

export function PaceGroupList({
  batchId,
  initialGroups,
}: {
  batchId: string;
  initialGroups: PaceGroupWithAdmins[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<
    { mode: 'create' } | { mode: 'edit'; group: PaceGroupWithAdmins } | null
  >(null);
  const [assignGroup, setAssignGroup] = useState<PaceGroupWithAdmins | null>(
    null,
  );
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const activeGroups = initialGroups.filter((g) => !g.archived);
  const archivedGroups = initialGroups.filter((g) => g.archived);

  function handleArchive(group: PaceGroupWithAdmins) {
    setArchivingId(group.id);
    startTransition(async () => {
      const result = await archivePaceGroupAction({ paceGroupId: group.id });
      setArchivingId(null);
      if (result.ok) {
        toast.success(`${group.name} archived`);
        router.refresh();
      } else {
        toast.error(
          result.errors.formErrors[0] ?? 'Could not archive pace group',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {activeGroups.length} active pace group
          {activeGroups.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setFormState({ mode: 'create' })}>
          <Plus className="size-4" />
          Create pace group
        </Button>
      </div>

      {activeGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            No pace groups yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Registration can stay open without pace groups. Create one when
            you&apos;re ready to place members.
          </p>
          <Button
            className="mt-4"
            onClick={() => setFormState({ mode: 'create' })}
          >
            <Plus className="size-4" />
            Create pace group
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {activeGroups.map((group) => (
            <PaceGroupCard
              key={group.id}
              group={group}
              isArchiving={isPending && archivingId === group.id}
              onEdit={() => setFormState({ mode: 'edit', group })}
              onAssignAdmin={() => setAssignGroup(group)}
              onArchive={() => handleArchive(group)}
            />
          ))}
        </div>
      )}

      {archivedGroups.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Archived
          </p>
          <div className="grid gap-4 opacity-70 lg:grid-cols-2">
            {archivedGroups.map((group) => (
              <PaceGroupCard key={group.id} group={group} readOnly />
            ))}
          </div>
        </div>
      )}

      <PaceGroupFormDialog
        open={formState !== null}
        onOpenChange={(open) => !open && setFormState(null)}
        batchId={batchId}
        initial={formState?.mode === 'edit' ? formState.group : null}
        onSuccess={() => {
          setFormState(null);
          router.refresh();
        }}
      />

      <PaceAdminAssignDialog
        open={assignGroup !== null}
        onOpenChange={(open) => !open && setAssignGroup(null)}
        group={assignGroup}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
