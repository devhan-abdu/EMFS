import type { PaceGroupRow } from '@/lib/services/pace-groups/pace-group';
import type { PaceAdminAssignmentDetailRow } from '@/lib/services/pace-groups/pace-admin-assignment';

export type PaceGroupWithAdmins = PaceGroupRow & {
  admins: PaceAdminAssignmentDetailRow[];
};
