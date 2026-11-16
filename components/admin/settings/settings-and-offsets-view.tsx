'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  ScopeSelector,
  type ScopeOption,
} from '@/components/admin/settings/scope-selector';
import { ScheduleSettingsCard } from '@/components/admin/settings/schedule-settings-card';
import { BreaksCard } from '@/components/admin/settings/breaks-card';
import type { BatchBreakWithScope } from '@/lib/services/batches/breaks';
import type { PaceGroupScheduleOverride } from '@/lib/services/batches/batch-schedule-overrides';

interface SettingsAndOffsetsViewProps {
  batch: {
    id: string;
    name: string;
    readingDaysPerWeek: number;
  };
  paceGroups: {
    id: string;
    name: string;
  }[];
  initialBreaks: BatchBreakWithScope[];
  initialOverrides: Record<string, PaceGroupScheduleOverride>;
  role: 'super_admin' | 'batch_admin' | 'pace_admin';
  initialScopeId?: string; // 'all' or a specific groupId
  assignedGroupIds?: string[]; // For pace admins assigned to specific groups
}

export function SettingsAndOffsetsView({
  batch,
  paceGroups,
  initialBreaks,
  initialOverrides,
  role,
  initialScopeId,
  assignedGroupIds,
}: SettingsAndOffsetsViewProps) {
  const router = useRouter();

  // For Pace Admin, restrict paceGroups to only their assigned groups
  const availableGroups = useMemo(() => {
    if (role === 'pace_admin' && assignedGroupIds) {
      return paceGroups.filter((g) => assignedGroupIds.includes(g.id));
    }
    return paceGroups;
  }, [paceGroups, assignedGroupIds, role]);

  // Default scope:
  // - Batch admin / Super admin: 'all'
  // - Pace admin: their assigned group id (never 'all')
  const defaultScope =
    role === 'pace_admin'
      ? (initialScopeId ?? availableGroups[0]?.id ?? '')
      : (initialScopeId ?? 'all');

  const [activeScopeId, setActiveScopeId] = useState<string>(defaultScope);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [overrides, setOverrides] =
    useState<Record<string, PaceGroupScheduleOverride>>(initialOverrides);

  // Build scope options for the selector
  const scopeOptions: ScopeOption[] = useMemo(() => {
    if (role === 'pace_admin') {
      // NO "All pace groups" choice for Pace Admin
      return availableGroups.map((g) => ({
        id: g.id,
        label: g.name,
      }));
    }

    return [
      { id: 'all', label: 'All pace groups' },
      ...availableGroups.map((g) => ({
        id: g.id,
        label: g.name,
      })),
    ];
  }, [availableGroups, role]);

  const activeGroup = availableGroups.find((g) => g.id === activeScopeId);
  const isGroupScope = activeScopeId !== 'all';
  const scopeLabel = isGroupScope
    ? (activeGroup?.name ?? 'Pace Group')
    : 'All pace groups';

  // Determine current settings values based on active scope
  const activeOverride = isGroupScope ? overrides[activeScopeId] : undefined;
  const hasCustomOverride = Boolean(activeOverride);

  const currentReadingDaysPerWeek =
    activeOverride?.readingDaysPerWeek ?? batch.readingDaysPerWeek;
  const currentReadingDays = activeOverride?.readingDays;
  const currentAttendanceDay = activeOverride?.attendanceDay;
  const currentAttendanceTime = activeOverride?.attendanceTime;

  const handleOverrideReset = () => {
    if (isGroupScope) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[activeScopeId];
        return next;
      });
      router.refresh();
    }
  };

  const handleSettingsSaved = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Scope Selector */}
      <ScopeSelector
        scopes={scopeOptions}
        activeScopeId={activeScopeId}
        onScopeChange={(newScopeId) => {
          setActiveScopeId(newScopeId);
          setIsFormDirty(false);
        }}
        isDirty={isFormDirty}
        role={role}
      />

      {/* Schedule Settings Card */}
      <ScheduleSettingsCard
        key={`settings-${activeScopeId}`}
        batchId={batch.id}
        paceGroupId={isGroupScope ? activeScopeId : null}
        scopeLabel={scopeLabel}
        defaultReadingDaysPerWeek={currentReadingDaysPerWeek}
        initialReadingDays={currentReadingDays}
        initialAttendanceDay={currentAttendanceDay}
        initialAttendanceTime={currentAttendanceTime}
        hasCustomOverride={hasCustomOverride}
        role={role}
        onDirtyChange={setIsFormDirty}
        onOverrideReset={handleOverrideReset}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* Breaks Management Card */}
      <BreaksCard
        key={`breaks-${activeScopeId}`}
        batchId={batch.id}
        activeScopeId={activeScopeId}
        scopeLabel={scopeLabel}
        paceGroups={availableGroups}
        breaks={initialBreaks}
        role={role}
        onBreakCreated={() => router.refresh()}
        onBreakDeleted={() => router.refresh()}
      />
    </div>
  );
}
