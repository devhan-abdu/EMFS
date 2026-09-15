import { Archive, Pencil, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { dutyLabels } from './duty-labels';
import type { PaceGroupWithAdmins } from './types';

export function PaceGroupCard({
  group,
  onEdit,
  onAssignAdmin,
  onArchive,
  isArchiving,
  readOnly,
}: {
  group: PaceGroupWithAdmins;
  onEdit?: () => void;
  onAssignAdmin?: () => void;
  onArchive?: () => void;
  isArchiving?: boolean;
  readOnly?: boolean;
}) {
  return (
    <Card className="card-soft">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-foreground">
              {group.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {group.size} pages / day
            </p>
          </div>
          <div className="flex items-center gap-2">
            {group.archived && <Badge variant="outline">Archived</Badge>}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pace admins
          </p>
          {group.admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pace admin yet — daily tasks can&apos;t be published.
            </p>
          ) : (
            <div className="space-y-2">
              {group.admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex flex-wrap items-center gap-2 text-sm text-foreground"
                >
                  <span className="font-medium">
                    {admin.profile.fullName || admin.profile.email}
                  </span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-primary">
                    {dutyLabels[admin.duty]}
                  </span>
                  {admin.book && (
                    <span className="text-xs text-muted-foreground">
                      · {admin.book.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={onAssignAdmin}>
              <UserPlus className="size-3.5" />
              Assign pace admin
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onArchive}
              disabled={isArchiving}
            >
              <Archive className="size-3.5" />
              {isArchiving ? 'Archiving…' : 'Archive'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
