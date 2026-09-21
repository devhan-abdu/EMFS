import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface LotusProps {
  className?: string;
  variant?: 'auto' | 'color' | 'white';
  alt?: string;
  priority?: boolean;
}

export function Lotus({
  className,
  alt = 'EMFS',
  priority = false,
}: LotusProps) {
  return (
    <span
      className={cn(
        'relative inline-block size-6 overflow-hidden rounded-md',
        className,
      )}
    >
      <Image
        src="/emfsc-logo.jpg"
        alt={alt}
        fill
        className="object-contain"
        priority={priority}
      />
    </span>
  );
}

export function EMFSLogo({
  className,
  alt = 'EMFS',
  priority = false,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        'relative inline-block size-16 overflow-hidden rounded-xl',
        className,
      )}
    >
      <Image
        src="/emfsc-logo.jpg"
        alt={alt}
        fill
        className="object-contain"
        priority={priority}
      />
    </span>
  );
}

export function LotusWatermark({
  className,
  alt = 'EMFS',
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={cn(
        'pointer-events-none relative inline-block size-16 opacity-15',
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/brand/lotus-white.png"
        alt={alt}
        fill
        className="object-contain"
        priority
      />
    </span>
  );
}
