import { describe, expect, it } from 'vitest';

import { buildAdminWorkspaceOptions } from '@/lib/services/admin/workspace';

const activeBatch = {
  id: 'batch-active',
  name: 'Batch 04',
  registrationOpen: false,
  startDate: '2026-10-01',
};

describe('admin workspace options', () => {
  it('groups all batches and their pace groups for super admins', () => {
    const options = buildAdminWorkspaceOptions({
      isSuperAdmin: true,
      batches: [
        activeBatch,
        {
          id: 'batch-other',
          name: 'Batch 03',
          registrationOpen: true,
          startDate: null,
        },
      ],
      paceGroups: [
        {
          id: 'group-1',
          name: 'Nur',
          batchId: 'batch-other',
          batchName: 'Batch 03',
          archived: false,
        },
      ],
      today: '2026-10-07',
    });

    expect(options[0]).toEqual({
      title: 'EMFSC Platform',
      href: '/admin/platform',
      kind: 'platform',
    });
    expect(options[2]).toMatchObject({
      id: 'batch-other',
      title: 'Batch 03',
      href: '/admin/b/batch-other',
      kind: 'batch',
      groups: [
        {
          id: 'group-1',
          title: 'Nur',
          href: '/admin/g/group-1',
          searchOnly: false,
        },
      ],
    });
  });

  it('groups all assigned-batch groups and direct group assignments by batch', () => {
    const options = buildAdminWorkspaceOptions({
      isSuperAdmin: false,
      batches: [activeBatch],
      paceGroups: [
        {
          id: 'group-in-batch',
          name: 'Nur',
          batchId: 'batch-active',
          batchName: 'Batch 04',
          archived: false,
        },
        {
          id: 'direct-group',
          name: 'Nur',
          batchId: 'batch-other',
          batchName: 'Batch 03',
          archived: false,
        },
      ],
      today: '2026-10-07',
    });

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      id: 'batch-active',
      href: '/admin/b/batch-active',
      groups: [{ href: '/admin/g/group-in-batch' }],
    });
    expect(options[1]).toMatchObject({
      id: 'batch-other',
      href: null,
      groups: [{ href: '/admin/g/direct-group' }],
    });
  });

  it('keeps draft batches and archived groups searchable', () => {
    const options = buildAdminWorkspaceOptions({
      isSuperAdmin: false,
      batches: [
        {
          id: 'batch-draft',
          name: 'Batch Draft',
          registrationOpen: false,
          startDate: null,
        },
      ],
      paceGroups: [
        {
          id: 'archived-group',
          name: 'Archived group',
          batchId: 'batch-draft',
          batchName: 'Batch Draft',
          archived: true,
        },
      ],
      today: '2026-10-07',
    });

    expect(options[0]).toMatchObject({
      searchOnly: true,
      groups: [{ searchOnly: true }],
    });
  });
});
