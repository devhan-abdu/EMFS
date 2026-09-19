'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toggleDailyProgressAction } from '@/actions/daily-progress';

export function TodayTaskCompleteButton({
  taskId,
  initialCompleted,
}: {
  taskId: string;
  initialCompleted: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [isPending, startTransition] = React.useTransition();

  function handleToggle() {
    const nextStatus = completed ? 'not_done' : 'done';

    startTransition(async () => {
      const result = await toggleDailyProgressAction({
        taskId,
        status: nextStatus,
      });

      if (result.ok) {
        setCompleted(nextStatus === 'done');
        toast.success(
          nextStatus === 'done'
            ? "Marked today's reading as read"
            : 'Unmarked reading completion',
        );
        router.refresh();
        return;
      }

      toast.error(
        result.errors?.formErrors?.[0] ?? 'Could not update reading progress.',
      );
    });
  }

  return (
    <Button
      size="sm"
      variant={completed ? 'default' : 'outline'}
      onClick={handleToggle}
      disabled={isPending}
      className={`gap-2 ${completed ? 'bg-teal text-teal-foreground hover:bg-teal/90' : ''}`}
    >
      <Check className="size-4" />
      {isPending ? 'Saving…' : completed ? 'Completed' : 'Mark as read'}
    </Button>
  );
}
