'use client';

import { useState } from 'react';
import { Layers, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export type ScopeOption = {
  id: string; // 'all' or paceGroupId
  label: string;
};

interface ScopeSelectorProps {
  scopes: ScopeOption[];
  activeScopeId: string;
  onScopeChange: (scopeId: string) => void;
  isDirty?: boolean;
  role: 'super_admin' | 'batch_admin' | 'pace_admin';
}

export function ScopeSelector({
  scopes,
  activeScopeId,
  onScopeChange,
  isDirty = false,
  role,
}: ScopeSelectorProps) {
  const [pendingScopeId, setPendingScopeId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSelect = (scopeId: string) => {
    if (scopeId === activeScopeId) return;

    if (isDirty) {
      setPendingScopeId(scopeId);
      setShowConfirmDialog(true);
    } else {
      onScopeChange(scopeId);
    }
  };

  const handleConfirmDiscard = () => {
    if (pendingScopeId) {
      onScopeChange(pendingScopeId);
      setPendingScopeId(null);
    }
    setShowConfirmDialog(false);
  };

  const handleCancelSwitch = () => {
    setPendingScopeId(null);
    setShowConfirmDialog(false);
  };

  // If Pace Admin has only 1 group, render a simple banner instead of unnecessary switcher
  if (role === 'pace_admin' && scopes.length <= 1) {
    const single = scopes[0];
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground">
        <Users className="size-4 text-muted-foreground" />
        <span className="font-medium">Assigned group:</span>
        <span>{single?.label ?? 'Your Pace Group'}</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {role === 'pace_admin'
            ? 'Select pace group'
            : 'Settings & view scope'}
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {scopes.map((scope) => {
            const isActive = scope.id === activeScopeId;
            const isAll = scope.id === 'all';

            return (
              <button
                key={scope.id}
                type="button"
                onClick={() => handleSelect(scope.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-card text-card-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {isAll ? (
                  <Layers className="size-4" />
                ) : (
                  <Users className="size-4" />
                )}
                <span>{scope.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits in your schedule settings. Switching scope
              will discard these unsaved modifications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSwitch}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
