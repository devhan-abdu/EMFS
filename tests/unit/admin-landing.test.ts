import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceCookie,
  parseWorkspaceCookie,
} from '@/lib/services/admin/workspace';
import { resolveAdminLanding } from '@/lib/services/admin/workspace-landing';

const profileId = 'profile-1';
const user = { profile: { id: profileId, isSuperAdmin: false } };

function batch(
  id: string,
  overrides: {
    registrationOpen?: boolean;
    startDate?: string | null;
    createdAt?: Date;
  } = {},
) {
  return {
    id,
    name: id,
    startDate: null,
    registrationOpen: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function group(id: string, createdAt: string) {
  return {
    id,
    name: id,
    createdAt: new Date(createdAt),
    archived: false,
  };
}

describe('admin workspace landing', () => {
  it('always sends super admins to the platform', () => {
    expect(
      resolveAdminLanding(
        { profile: { id: profileId, isSuperAdmin: true } },
        [batch('batch-a')],
        [],
        buildWorkspaceCookie(profileId, '/admin/b/batch-a'),
      ),
    ).toBe('/admin/platform');
  });

  it('sends a user with one batch to that batch', () => {
    expect(resolveAdminLanding(user, [batch('batch-a')], [])).toBe(
      '/admin/b/batch-a',
    );
  });

  it('prefers a saved workspace that remains assigned', () => {
    const savedPath = '/admin/g/group-b';
    expect(
      resolveAdminLanding(
        user,
        [batch('batch-a')],
        [group('group-b', '2026-01-01T00:00:00.000Z')],
        buildWorkspaceCookie(profileId, savedPath),
      ),
    ).toBe(savedPath);
  });

  it('falls back when the saved workspace is no longer assigned', () => {
    expect(
      resolveAdminLanding(
        user,
        [batch('batch-a', { registrationOpen: true })],
        [],
        buildWorkspaceCookie(profileId, '/admin/b/revoked-batch'),
        '2026-10-04',
      ),
    ).toBe('/admin/b/batch-a');
  });

  it('prefers an active batch over a newer draft', () => {
    expect(
      resolveAdminLanding(
        user,
        [
          batch('newest-draft', {
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          }),
          batch('active-batch', {
            startDate: '2026-10-01',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        ],
        [],
        undefined,
        '2026-10-04',
      ),
    ).toBe('/admin/b/active-batch');
  });

  it('selects the newest group when the user only has group access', () => {
    expect(
      resolveAdminLanding(
        user,
        [],
        [
          group('older-group', '2026-01-01T00:00:00.000Z'),
          group('newer-group', '2026-02-01T00:00:00.000Z'),
        ],
      ),
    ).toBe('/admin/g/newer-group');
  });

  it('does not land in an archived pace group', () => {
    expect(
      resolveAdminLanding(
        user,
        [],
        [
          {
            ...group('archived-group', '2026-02-01T00:00:00.000Z'),
            archived: true,
          },
        ],
      ),
    ).toBe('/me');
  });

  it('sends users with no workspaces to /me', () => {
    expect(resolveAdminLanding(user, [], [])).toBe('/me');
  });

  it('does not reuse another profile’s saved workspace', () => {
    const cookie = buildWorkspaceCookie('another-profile', '/admin/b/batch-a');
    expect(parseWorkspaceCookie(cookie, profileId)).toBeUndefined();
  });
});
