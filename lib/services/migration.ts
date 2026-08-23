import {
  type BatchMembershipStatus,
  BATCH_MEMBERSHIP_STATUSES,
} from "@/db/schema/batch-memberships";

export interface HistoricalMappingRule {
  historicalStatus: string;
  canonicalStatus: BatchMembershipStatus;
  explanation: string;
}

/**
 * Documented historical mapping decisions between v1 schema and canonical 7-state lifecycle.
 */
export const HISTORICAL_STATUS_MAPPINGS: Record<string, HistoricalMappingRule> = {
  active: {
    historicalStatus: "active",
    canonicalStatus: "active",
    explanation: "Historical 'active' mapped directly to canonical 'active'.",
  },
  removed: {
    historicalStatus: "removed",
    canonicalStatus: "removed",
    explanation: "Historical 'removed' mapped directly to canonical 'removed'.",
  },
  completed: {
    historicalStatus: "completed",
    canonicalStatus: "removed",
    explanation:
      "Historical v1 status 'completed' mapped conceptually to canonical terminal status 'removed' with cohort completion metadata.",
  },
  pending: {
    historicalStatus: "pending",
    canonicalStatus: "applied",
    explanation:
      "Historical concept 'pending' represented an application awaiting decision; normalized to canonical 'applied'.",
  },
  waitlist: {
    historicalStatus: "waitlist",
    canonicalStatus: "waitlisted",
    explanation:
      "Historical variant 'waitlist' normalized to canonical 'waitlisted'.",
  },
  accepted: {
    historicalStatus: "accepted",
    canonicalStatus: "approved",
    explanation:
      "Historical variant 'accepted' normalized to canonical 'approved' awaiting handoff.",
  },
};

export interface MembershipDataRow {
  id: string;
  profileId: string;
  batchId: string;
  status: BatchMembershipStatus;
  startDate: Date;
  endDate: Date | null;
  removalReason: string | null;
  createdAt: Date;
}

/**
 * Validates that a membership record conforms to the canonical 7-state lifecycle model.
 */
export function validateCanonicalMembershipRow(row: MembershipDataRow): boolean {
  if (!BATCH_MEMBERSHIP_STATUSES.includes(row.status)) {
    throw new Error(`Invalid canonical membership status '${row.status}'.`);
  }

  if (!row.id || !row.profileId || !row.batchId) {
    throw new Error("Missing required primary or foreign key in membership row.");
  }

  return true;
}

/**
 * Applies lifecycle consistency normalization to a batch membership record.
 * Ensures terminal statuses ('removed', 'rejected') have an endDate.
 */
export function normalizeMembershipLifecycleRow(
  row: MembershipDataRow
): MembershipDataRow {
  validateCanonicalMembershipRow(row);

  const isTerminal = row.status === "removed" || row.status === "rejected";

  return {
    ...row,
    endDate: isTerminal ? (row.endDate ?? row.createdAt) : row.endDate,
  };
}
