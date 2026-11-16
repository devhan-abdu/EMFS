'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(refreshIfVisible, everyMs);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [everyMs, router]);

  return null;
}
