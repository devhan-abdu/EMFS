'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AutoRefresh({
  active,
  everyMs = 3000,
}: {
  active: boolean;
  everyMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, router]);

  return null;
}
