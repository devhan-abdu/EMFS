'use client';

import { useActionState, useId, useState } from 'react';
import { CalendarOff, Lock, Plus, Trash2 } from 'lucide-react';

import {
  createBatchBreakAction,
  deleteBatchBreakAction,
} from '@/actions/batch-settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BatchBreakWithScope } from '@/lib/services/batches/breaks';

interface BreaksCardProps {
  batchId: string;
  activeScopeId: string; // 'all' or paceGroupId
  scopeLabel: string;
  paceGroups: { id: string; name: string }[];
  breaks: BatchBreakWithScope[];
  role: 'super_admin' | 'batch_admin' | 'pace_admin';
  onBreakCreated?: () => void;
  onBreakDeleted?: () => void;
}

export function BreaksCard({
  batchId,
  activeScopeId,
  scopeLabel,
  paceGroups,
  breaks,
  role,
  onBreakCreated,
  onBreakDeleted,
}: BreaksCardProps) {
  const formId = useId();

  // Add break form local state
  const isPaceAdmin = role === 'pace_admin';
  const initialScope = activeScopeId === 'all' ? '' : activeScopeId;

  const [breakScope, setBreakScope] = useState<string>(initialScope);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // Form actions
  const [createState, createAction, isCreating] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      const res = await createBatchBreakAction(null, formData);
      if (res?.ok) {
        setTitle('');
        setStartDate('');
        setEndDate('');
        setIsAddFormOpen(false);
        onBreakCreated?.();
      }
      return res;
    },
    null,
  );

  const [deleteState, deleteAction, isDeleting] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      const res = await deleteBatchBreakAction(null, formData);
      if (res?.ok) {
        onBreakDeleted?.();
      }
      return res;
    },
    null,
  );

  // Calculate duration in days
  const calculateDuration = (start: string, end: string): number | null => {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s)
      return null;
    const diffTime = e.getTime() - s.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const duration = calculateDuration(startDate, endDate);

  // Filter breaks relevant to the active scope:
  // - In 'all' scope: show all breaks
  // - In specific group scope: show this group's breaks + "Whole batch" breaks
  const filteredBreaks = breaks.filter((b) => {
    if (activeScopeId === 'all') return true;
    return b.paceGroupId === null || b.paceGroupId === activeScopeId;
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg font-medium text-card-foreground">
            Scheduled breaks
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {activeScopeId === 'all'
              ? 'Pauses across the whole batch and specific pace groups.'
              : `Pauses applying to ${scopeLabel} (including whole-batch pauses).`}
          </p>
        </div>

        <Button
          type="button"
          variant={isAddFormOpen ? 'outline' : 'default'}
          size="sm"
          onClick={() => setIsAddFormOpen((prev) => !prev)}
          className="gap-2"
        >
          <Plus className="size-4" />
          {isAddFormOpen ? 'Cancel' : 'Schedule break'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Collapsible Add Break Form */}
        {isAddFormOpen ? (
          <form
            action={createAction}
            className="space-y-4 rounded-xl border border-border bg-surface-container p-4"
          >
            <input type="hidden" name="batchId" value={batchId} />

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {/* Title / Reason */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${formId}-title`}>Break name / reason</Label>
                <Input
                  id={`${formId}-title`}
                  name="title"
                  placeholder="e.g. Eid al-Fitr, Spring break, Catch-up pause"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Scope */}
              <div className="space-y-2">
                <Label htmlFor={`${formId}-scope`}>Scope</Label>
                {isPaceAdmin ? (
                  <>
                    <input
                      type="hidden"
                      name="paceGroupId"
                      value={activeScopeId}
                    />
                    <Input
                      id={`${formId}-scope`}
                      value={scopeLabel}
                      disabled
                      className="bg-muted text-muted-foreground"
                    />
                  </>
                ) : (
                  <select
                    id={`${formId}-scope`}
                    name="paceGroupId"
                    value={breakScope}
                    onChange={(e) => setBreakScope(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Whole batch</option>
                    {paceGroups.map((pg) => (
                      <option key={pg.id} value={pg.id}>
                        {pg.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Duration preview */}
              <div className="flex flex-col justify-end space-y-2">
                <Label className="text-muted-foreground">Duration</Label>
                <div className="flex h-9 items-center px-3 text-sm font-medium text-foreground">
                  {duration !== null
                    ? `${duration} ${duration === 1 ? 'day' : 'days'}`
                    : '—'}
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor={`${formId}-startDate`}>Start date</Label>
                <Input
                  id={`${formId}-startDate`}
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor={`${formId}-endDate`}>
                  End date (inclusive)
                </Label>
                <Input
                  id={`${formId}-endDate`}
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  required
                />
              </div>
            </div>

            {/* Error message */}
            {createState?.errors?.formErrors?.length ? (
              <p className="text-sm text-destructive">
                {createState.errors.formErrors[0]}
              </p>
            ) : null}

            {createState?.errors?.fieldErrors?.endDate?.length ? (
              <p className="text-sm text-destructive">
                {createState.errors.fieldErrors.endDate[0]}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isCreating}>
                {isCreating ? 'Saving…' : 'Add break'}
              </Button>
            </div>
          </form>
        ) : null}

        {/* Action feedback */}
        {createState?.ok ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-emerald-600">
            {createState.message}
          </p>
        ) : null}

        {deleteState?.ok ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-emerald-600">
            {deleteState.message}
          </p>
        ) : null}

        {deleteState?.errors?.formErrors?.length ? (
          <p className="rounded-lg border border-border bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {deleteState.errors.formErrors[0]}
          </p>
        ) : null}

        {/* Breaks List */}
        {filteredBreaks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <CalendarOff className="size-10 text-muted-foreground/50" />
            <h4 className="mt-3 text-sm font-medium text-foreground">
              No breaks scheduled
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Reading will progress uninterrupted on standard scheduled days.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBreaks.map((b) => {
              const isWholeBatch = b.paceGroupId === null;
              const daysDuration = calculateDuration(b.startDate, b.endDate);

              // Permissions logic:
              // - In "All pace groups" view: Batch Admin can delete any break
              // - In a specific group view: "Whole batch" breaks are strictly read-only
              // - In Pace Admin view: "Whole batch" breaks are strictly read-only
              const isReadOnly =
                (activeScopeId !== 'all' || isPaceAdmin) && isWholeBatch;

              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface-container p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {b.title}
                      </span>
                      {isWholeBatch ? (
                        <Badge variant="outline">Whole batch</Badge>
                      ) : (
                        <Badge variant="secondary">{b.paceGroupName}</Badge>
                      )}
                      {isReadOnly ? (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 text-muted-foreground"
                        >
                          <Lock className="size-3" />
                          Read-only
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.startDate} to {b.endDate}
                      {daysDuration !== null ? ` · ${daysDuration} days` : ''}
                    </p>
                  </div>

                  {/* Delete Action (only if not read-only) */}
                  {!isReadOnly ? (
                    <form
                      action={deleteAction}
                      className="self-end sm:self-center"
                    >
                      <input type="hidden" name="breakId" value={b.id} />
                      <input type="hidden" name="batchId" value={batchId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                        aria-label={`Delete ${b.title}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only sm:not-sr-only sm:text-xs">
                          Delete
                        </span>
                      </Button>
                    </form>
                  ) : (
                    <div className="text-xs text-muted-foreground italic sm:self-center">
                      Inherited from batch
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
