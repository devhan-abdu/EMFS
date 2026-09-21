export type BatchStatus = 'draft' | 'open' | 'running' | 'completed';

export function deriveBatchStatus(batch: {
  registrationOpen: boolean;
  startDate: string | null;
}): BatchStatus {
  if (batch.registrationOpen) return 'open';
  if (batch.startDate) return 'running';
  return 'draft';
}

export const batchStatusLabels: Record<BatchStatus, string> = {
  draft: 'Draft',
  open: 'Registration open',
  running: 'Running',
  completed: 'Completed',
};
