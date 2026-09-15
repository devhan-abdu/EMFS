import type { PaceGroupWithAdmins } from './types';

export type MockMember = {
  id: string;
  name: string;
  email: string;
  pacePreference: string | null;
  placement: 'awaiting_placement' | 'assigned';
  paceGroup: string | null;
};

export function buildMockRoster(groups: PaceGroupWithAdmins[]): MockMember[] {
  const firstActiveGroup = groups.find((g) => !g.archived)?.name ?? null;
  return [
    {
      id: 'm1',
      name: 'Hanan Ibrahim',
      email: 'hanan@example.com',
      pacePreference: '10',
      placement: 'awaiting_placement',
      paceGroup: null,
    },
    {
      id: 'm2',
      name: 'Sagal Ahmed',
      email: 'sagal@example.com',
      pacePreference: '5',
      placement: 'assigned',
      paceGroup: firstActiveGroup,
    },
    {
      id: 'm3',
      name: 'Ilhan Mohamed',
      email: 'ilhan@example.com',
      pacePreference: null,
      placement: 'awaiting_placement',
      paceGroup: null,
    },
  ];
}
