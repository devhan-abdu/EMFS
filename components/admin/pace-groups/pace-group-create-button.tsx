'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaceGroupFormDialog } from './pace-group-form-dialog';

export function PaceGroupCreateButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create pace group
      </Button>
      <PaceGroupFormDialog
        open={open}
        onOpenChange={setOpen}
        batchId={batchId}
        initial={null}
        onSuccess={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
