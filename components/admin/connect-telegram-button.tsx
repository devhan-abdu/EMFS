'use client';
import { useActionState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { connectTelegramAction } from '@/actions/telegram';

export function ConnectTelegramButton({
  batchId,
  disabled,
}: {
  batchId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(connectTelegramAction, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="batchId" value={batchId} />
      <Button type="submit" disabled={disabled || pending}>
        <Send className="size-4" />
        {pending ? 'Preparing…' : 'Add bot to Telegram group'}
      </Button>
      {state?.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}
