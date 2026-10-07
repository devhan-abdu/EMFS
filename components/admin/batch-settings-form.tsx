'use client';

import { useActionState } from 'react';
import { ShieldCheck } from 'lucide-react';

import {
  updateBatchCadenceAction,
  type BatchCadenceActionState,
} from '@/actions/batch-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BATCH_WEEKDAYS } from '@/lib/validations/batch-settings';

const WEEKDAY_LABELS: Record<(typeof BATCH_WEEKDAYS)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const defaultReadingDays = (count: number) => {
  const total = Math.min(7, Math.max(1, count));
  return BATCH_WEEKDAYS.slice(0, total);
};

const initialState: BatchCadenceActionState = null;

export function BatchSettingsForm({
  batchId,
  batchName,
  readingDaysPerWeek,
}: {
  batchId: string;
  batchName: string;
  readingDaysPerWeek: number;
}) {
  const [state, formAction, isPending] = useActionState(
    updateBatchCadenceAction,
    initialState,
  );
  const fieldErrors = state?.errors?.fieldErrors ?? {};
  const readingDefaults = defaultReadingDays(readingDaysPerWeek);

  return (
    <Card className="card-soft">
      <CardHeader>
        <CardTitle className="font-display text-xl">
          Reading cadence & schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="batchId" value={batchId} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label>Reading days</Label>
              <div className="grid grid-cols-2 gap-2">
                {BATCH_WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface-container px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="readingDays"
                      value={day}
                      defaultChecked={readingDefaults.includes(day)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>{WEEKDAY_LABELS[day]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Attendance days</Label>
              <div className="grid grid-cols-2 gap-2">
                {BATCH_WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface-container px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="attendanceDays"
                      value={day}
                      defaultChecked={day === 'mon' || day === 'thu'}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>{WEEKDAY_LABELS[day]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="readingDaysPerWeek">Reading days per week</Label>
            <Input
              id="readingDaysPerWeek"
              name="readingDaysPerWeek"
              type="number"
              min={1}
              max={7}
              defaultValue={readingDaysPerWeek}
            />
            {fieldErrors.readingDaysPerWeek ? (
              <p className="text-sm text-destructive">
                {fieldErrors.readingDaysPerWeek[0]}
              </p>
            ) : null}
          </div>

          {state?.ok ? (
            <p className="text-sm text-emerald-600">
              Updated {batchName} with{' '}
              {state.data?.readingDaysPerWeek ?? readingDaysPerWeek} reading
              days per week.
            </p>
          ) : null}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" />
            Batch-level settings are limited to assigned batch admins.
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save schedule'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
