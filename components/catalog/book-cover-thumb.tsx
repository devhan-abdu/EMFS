import Image from "next/image";

import { cn } from "@/lib/utils";

const FALLBACK_BG = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-primary",
  "bg-secondary",
] as const;

type BookCoverThumbProps = {
  coverUrl?: string | null;
  title: string;
  /** Stable seed for fallback color (book id preferred). */
  seed?: string;
  alt?: string;
  className?: string;
  sizes?: string;
  unoptimized?: boolean;
};

function hashToIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

function fallbackInitial(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function BookCoverThumb({
  coverUrl,
  title,
  seed,
  alt,
  className,
  sizes = "44px",
  unoptimized,
}: BookCoverThumbProps) {
  const colorSeed = seed ?? title;
  const bgClass = FALLBACK_BG[hashToIndex(colorSeed, FALLBACK_BG.length)]!;
  const initial = fallbackInitial(title);
  const resolvedUnoptimized =
    unoptimized ??
    Boolean(coverUrl?.startsWith("data:") || coverUrl?.startsWith("blob:"));

  return (
    <div
      className={cn(
        "relative h-[60px] w-[44px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-container",
        className,
      )}
    >
      {coverUrl ?
        <Image
          src={coverUrl}
          alt={alt ?? title}
          fill
          className="object-cover"
          sizes={sizes}
          unoptimized={resolvedUnoptimized}
        />
      : <div
          className={cn(
            "flex h-full w-full items-center justify-center font-medium text-primary-foreground",
            bgClass,
          )}
          aria-hidden={alt ? undefined : true}
          role={alt ? "img" : undefined}
          aria-label={alt}
        >
          <span className="text-lg leading-none">{initial}</span>
        </div>
      }
    </div>
  );
}
