'use client';

import { useActionState, useId, useState } from 'react';
import {
  Calendar,
  Clock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import {
  saveScheduleSettingsAction,
  resetPaceGroupScheduleAction,
} from '@/actions/batch-settings';
import { Badge } from '@/components/ui/badge';
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

interface ScheduleSettingsCardProps {
  batchId: string;
  paceGroupId: string | null;
  scopeLabel: string;
  defaultReadingDaysPerWeek: number;
  initialReadingDays?: string[];
  initialAttendanceDay?: string | null;
  initialAttendanceTime?: string | null;
  hasCustomOverride: boolean;
  role: 'super_admin' | 'batch_admin' | 'pace_admin';
  onDirtyChange?: (isDirty: boolean) => void;
  onOverrideReset?: () => void;
  onSettingsSaved?: () => void;
}

export function ScheduleSettingsCard({
  batchId,
  paceGroupId,
  scopeLabel,
  defaultReadingDaysPerWeek,
  initialReadingDays,
  initialAttendanceDay,
  initialAttendanceTime,
  hasCustomOverride,
  role,
  onDirtyChange,
  onOverrideReset,
  onSettingsSaved,
}: ScheduleSettingsCardProps) {
  const timeInputId = useId();

  const fallbackReadingDays =
    initialReadingDays && initialReadingDays.length > 0
      ? initialReadingDays
      : defaultReadingDays(defaultReadingDaysPerWeek);

  const [selectedReadingDays, setSelectedReadingDays] =
    useState<string[]>(fallbackReadingDays);
  const [selectedAttendanceDay, setSelectedAttendanceDay] = useState<string>(
    initialAttendanceDay ?? 'mon',
  );
  const [selectedAttendanceTime, setSelectedAttendanceTime] = useState<string>(
    initialAttendanceTime ?? '20:00',
  );

  const handleReadingDayToggle = (day: string) => {
    const updated = selectedReadingDays.includes(day)
      ? selectedReadingDays.filter((d) => d !== day)
      : [...selectedReadingDays, day];

    if (updated.length === 0) return;

    setSelectedReadingDays(updated);
    onDirtyChange?.(true);
  };

  const handleAttendanceDayChange = (day: string) => {
    setSelectedAttendanceDay(day);
    onDirtyChange?.(true);
  };

  const handleAttendanceTimeChange = (time: string) => {
    setSelectedAttendanceTime(time);
    onDirtyChange?.(true);
  };

  // Form actions
  const [saveState, saveAction, isSaving] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      onDirtyChange?.(false);
      const res = await saveScheduleSettingsAction(null, formData);
      if (res?.ok) {
        onSettingsSaved?.();
      }
      return res;
    },
    null,
  );

  const [resetState, resetAction, isResetting] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      onDirtyChange?.(false);
      const res = await resetPaceGroupScheduleAction(null, formData);
      if (res?.ok) {
        onOverrideReset?.();
      }
      return res;
    },
    null,
  );

  const isGroupScope = paceGroupId !== null && paceGroupId !== 'all';
  const calculatedDaysCount = selectedReadingDays.length;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg font-medium text-card-foreground">
              Reading cadence & schedule
            </CardTitle>
            {isGroupScope ? (
              hasCustomOverride ? (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="size-3" />
                  Custom for this group
                </Badge>
              ) : (
                <Badge variant="outline">Using batch default</Badge>
              )
            ) : (
              <Badge variant="outline">Batch default</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isGroupScope
              ? `Configuring schedule overrides for ${scopeLabel}.`
              : 'Configuring default reading rhythm for all standard pace groups.'}
          </p>
        </div>

        {/* Reset button: visible ONLY when an override exists for this group */}
        {isGroupScope && hasCustomOverride ? (
          <form action={resetAction}>
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="paceGroupId" value={paceGroupId} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isResetting || isSaving}
              className="gap-2 text-xs"
            >
              <RotateCcw className="size-3" />
              {isResetting ? 'Resetting…' : 'Reset to batch default'}
            </Button>
          </form>
        ) : null}
      </CardHeader>

      <CardContent>
        <form action={saveAction} className="space-y-6">
          <input type="hidden" name="batchId" value={batchId} />
          {paceGroupId ? (
            <input type="hidden" name="paceGroupId" value={paceGroupId} />
          ) : null}
          <input
            type="hidden"
            name="readingDaysPerWeek"
            value={calculatedDaysCount}
          />
          <input
            type="hidden"
            name="attendanceDay"
            value={selectedAttendanceDay}
          />
          <input
            type="hidden"
            name="attendanceTime"
            value={selectedAttendanceTime}
          />

          <div className="grid gap-6 md:grid-cols-2">
            {/* Reading days checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Reading days</Label>
                <span className="text-xs text-muted-foreground">
                  {calculatedDaysCount}{' '}
                  {calculatedDaysCount === 1 ? 'day' : 'days'} / week
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-4">
                {BATCH_WEEKDAYS.map((day) => {
                  const isChecked = selectedReadingDays.includes(day);
                  return (
                    <label
                      key={day}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-medium transition-colors ${
                        isChecked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-surface-container text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="readingDays"
                        value={day}
                        checked={isChecked}
                        onChange={() => handleReadingDayToggle(day)}
                        className="sr-only"
                      />
                      <span>{WEEKDAY_LABELS[day]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Attendance day and time */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="size-4 text-muted-foreground" />
                  Attendance day
                </Label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-4">
                  {BATCH_WEEKDAYS.map((day) => {
                    const isSelected = selectedAttendanceDay === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleAttendanceDayChange(day)}
                        className={`rounded-lg border p-2 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-container text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        {WEEKDAY_LABELS[day]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor={timeInputId}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Clock className="size-4 text-muted-foreground" />
                  Attendance submission deadline
                </Label>
                <Input
                  id={timeInputId}
                  type="time"
                  value={selectedAttendanceTime}
                  onChange={(e) => handleAttendanceTimeChange(e.target.value)}
                  className="w-full sm:w-48"
                />
              </div>
            </div>
          </div>

          {/* Feedback & helper messages */}
          {saveState?.ok ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-emerald-600">
              {saveState.message ?? 'Schedule settings saved successfully.'}
            </p>
          ) : null}

          {saveState?.errors?.formErrors?.length ? (
            <p className="rounded-lg border border-border bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveState.errors.formErrors[0]}
            </p>
          ) : null}

          {resetState?.ok ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-emerald-600">
              {resetState.message}
            </p>
          ) : null}

          {resetState?.errors?.formErrors?.length ? (
            <p className="rounded-lg border border-border bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {resetState.errors.formErrors[0]}
            </p>
          ) : null}

          <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-muted-foreground" />
              {role === 'pace_admin'
                ? 'Pace admin edits apply strictly to your assigned group.'
                : isGroupScope
                  ? 'Batch admin override applies strictly to this pace group.'
                  : 'Batch admin default applies to all groups without custom overrides.'}
            </div>

            <Button
              type="submit"
              disabled={isSaving || isResetting}
              className="gap-2"
            >
              {isSaving ? 'Saving…' : 'Save schedule'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
