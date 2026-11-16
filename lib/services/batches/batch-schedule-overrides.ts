export type PaceGroupScheduleOverride = {
  batchId: string;
  paceGroupId: string;
  readingDays: string[];
  readingDaysPerWeek: number;
  attendanceDay?: string | null;
  attendanceTime?: string | null;
  updatedAt: Date;
};

// Global in-process store for pace group overrides (preserving zero schema drift)
const overridesStore = new Map<string, PaceGroupScheduleOverride>();

export function getPaceGroupOverride(
  paceGroupId: string,
): PaceGroupScheduleOverride | null {
  return overridesStore.get(paceGroupId) ?? null;
}

export function hasPaceGroupOverride(paceGroupId: string): boolean {
  return overridesStore.has(paceGroupId);
}

export function setPaceGroupOverride(
  data: Omit<PaceGroupScheduleOverride, 'updatedAt'>,
): PaceGroupScheduleOverride {
  const entry: PaceGroupScheduleOverride = {
    ...data,
    updatedAt: new Date(),
  };
  overridesStore.set(data.paceGroupId, entry);
  return entry;
}

export function deletePaceGroupOverride(paceGroupId: string): boolean {
  return overridesStore.delete(paceGroupId);
}

export function listPaceGroupOverridesForBatch(
  batchId: string,
): Record<string, PaceGroupScheduleOverride> {
  const result: Record<string, PaceGroupScheduleOverride> = {};
  for (const [groupId, override] of overridesStore.entries()) {
    if (override.batchId === batchId) {
      result[groupId] = override;
    }
  }
  return result;
}

/** Clear all overrides (useful for test isolation) */
export function clearAllPaceGroupOverrides(): void {
  overridesStore.clear();
}
