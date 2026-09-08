import Image from "next/image";
import { cn } from "@/lib/utils";

export function Lotus({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block h-24 w-24", className)}>
      <Image
        src="/brand/lotus-color.png"
        alt="EMFSC Book Shelf"
        fill
        className="object-contain dark:hidden"
        priority
      />
      <Image
        src="/brand/lotus-white.png"
        alt="EMFSC Book Shelf"
        fill
        className="hidden object-contain dark:block"
        priority
      />
    </span>
  );
}

export function LotusWatermark({ className }: { className?: string }) {
  return (
    <span
      className={cn("h-16 w-16 opacity-15 relative inline-block", className)}
    >
      <Image
        src="/brand/lotus-white.png"
        alt="EMFSC Book Shelf"
        fill
        className="block object-contain "
        priority
      />
    </span>
  );
}
