import type { PaceGroupRow } from '@/lib/services/pace-groups/pace-group';
import type { PaceAdminAssignmentDetailRow } from '@/lib/services/admin/pace-admin-assignment';

export type PaceGroupWithAdmins = PaceGroupRow & {
  admins: PaceAdminAssignmentDetailRow[];
};
export type PaceGroupPreview = Pick<
  PaceGroupWithAdmins,
  'name' | 'max_pages' | 'id' | 'archived'
>;
