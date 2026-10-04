'use client';

import { useEffect } from 'react';

import {
  ADMIN_LAST_WORKSPACE_COOKIE,
  buildWorkspaceCookie,
} from '@/lib/admin-workspace';

export function WorkspaceVisitTracker({
  profileId,
  workspacePath,
}: {
  profileId: string;
  workspacePath: string;
}) {
  useEffect(() => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${ADMIN_LAST_WORKSPACE_COOKIE}=${buildWorkspaceCookie(profileId, workspacePath)}; Path=/admin; Max-Age=31536000; SameSite=Lax${secure}`;
  }, [profileId, workspacePath]);

  return null;
}
