import type { PaceAdminDuty } from '@/db/schema/pace-admin-assignments';

export const dutyLabels: Record<PaceAdminDuty, string> = {
  daily_task: 'Daily task',
  reflection: 'Reflection',
  inspiration: 'Inspiration',
  attendance: 'Attendance',
};
