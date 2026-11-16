'use client';

import { SettingsAndOffsetsView } from '@/components/admin/settings/settings-and-offsets-view';
import type { BatchBreakWithScope } from '@/lib/services/batches/breaks';
import type { PaceGroupScheduleOverride } from '@/lib/services/batches/batch-schedule-overrides';

export function BatchSettingsForm({
  batchId,
  batchName,
  readingDaysPerWeek,
  paceGroups = [],
  initialBreaks = [],
  initialOverrides = {},
  role = 'batch_admin',
}: {
  batchId: string;
  batchName: string;
  readingDaysPerWeek: number;
  paceGroups?: { id: string; name: string }[];
  initialBreaks?: BatchBreakWithScope[];
  initialOverrides?: Record<string, PaceGroupScheduleOverride>;
  role?: 'super_admin' | 'batch_admin' | 'pace_admin';
}) {
  return (
    <SettingsAndOffsetsView
      batch={{
        id: batchId,
        name: batchName,
        readingDaysPerWeek,
      }}
      paceGroups={paceGroups}
      initialBreaks={initialBreaks}
      initialOverrides={initialOverrides}
      role={role}
    />
  );
}
