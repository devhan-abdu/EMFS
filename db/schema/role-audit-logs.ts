import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { profiles, roleEnum } from './users';
import { relations } from 'drizzle-orm';

export type RoleAssignmentChange = {
  batchesAdded?: { id: string; name?: string }[];
  batchesRemoved?: { id: string; name?: string }[];
  paceGroupsAdded?: { id: string; name?: string; duty: string }[];
  paceGroupsRemoved?: { id: string; name?: string; duty?: string }[];
};

export const roleAuditLogs = pgTable(
  'role_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetProfileId: uuid('target_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    actorProfileId: uuid('actor_profile_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    previousRole: roleEnum('previous_role').notNull(),
    newRole: roleEnum('new_role').notNull(),
    previousIsSuperAdmin: boolean('previous_is_super_admin')
      .notNull()
      .default(false),
    newIsSuperAdmin: boolean('new_is_super_admin').notNull().default(false),
    assignmentChanges:
      jsonb('assignment_changes').$type<RoleAssignmentChange>(),
    reason: text('reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('role_audit_logs_target_profile_id_idx').on(table.targetProfileId),
    index('role_audit_logs_actor_profile_id_idx').on(table.actorProfileId),
    index('role_audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export const roleAuditLogsRelations = relations(roleAuditLogs, ({ one }) => ({
  targetProfile: one(profiles, {
    fields: [roleAuditLogs.targetProfileId],
    references: [profiles.id],
    relationName: 'roleAuditTarget',
  }),
  actorProfile: one(profiles, {
    fields: [roleAuditLogs.actorProfileId],
    references: [profiles.id],
    relationName: 'roleAuditActor',
  }),
}));

export type RoleAuditLog = typeof roleAuditLogs.$inferSelect;
export type NewRoleAuditLog = typeof roleAuditLogs.$inferInsert;
