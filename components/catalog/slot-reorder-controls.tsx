"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlotReorderControlsProps {
  slot: number;
  totalSlots: number;
  onMoveUp?: (slot: number) => void;
  onMoveDown?: (slot: number) => void;
  isPending?: boolean;
}

export function SlotReorderControls({
  slot,
  totalSlots,
  onMoveUp,
  onMoveDown,
  isPending = false,
}: SlotReorderControlsProps) {
  const isFirst = slot === 1;
  const isLast = slot === totalSlots;

  return (
    <div
      className="flex items-center gap-2 shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isFirst || isPending}
        onClick={() => onMoveUp?.(slot)}
        className="h-11 w-11 rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label={`Move Slot ${slot} up to Slot ${slot - 1}`}
        title={isFirst ? "Top slot" : `Move Slot ${slot} up`}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isLast || isPending}
        onClick={() => onMoveDown?.(slot)}
        className="h-11 w-11 rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label={`Move Slot ${slot} down to Slot ${slot + 1}`}
        title={isLast ? "Bottom slot" : `Move Slot ${slot} down`}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}