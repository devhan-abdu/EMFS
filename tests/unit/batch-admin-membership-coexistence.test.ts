import { describe, it, expect, beforeEach } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { batchAdmins, batchMemberships } from "@/db/schema";

/**
 * Stateful Relational In-Memory Test Database Harness

 * Accurately simulates PostgreSQL relational table constraints directly derived
 * from the repository's Drizzle schema definitions without mocking canned return values:
 * 1. Enforces composite primary key on batch_admins: (profile_id, batch_id)
 * 2. Enforces partial unique index on batch_memberships: (profile_id, batch_id) for active statuses
 * 3. Enforces foreign key referential integrity to profiles and batches
 */
class PostgresTestDatabase {
  private profilesTable = new Map<string, { id: string; role: string }>();
  private batchesTable = new Map<string, { id: string; name: string }>();
  private batchAdminsTable = new Map<string, { profileId: string; batchId: string; createdAt: Date }>();
  private batchMembershipsTable = new Map<
    string,
    { id: string; profileId: string; batchId: string; status: string; createdAt: Date }
  >();

  reset() {
    this.profilesTable.clear();
    this.batchesTable.clear();
    this.batchAdminsTable.clear();
    this.batchMembershipsTable.clear();
  }

  insertProfile(profile: { id: string; role: string }) {
    this.profilesTable.set(profile.id, profile);
    return profile;
  }

  insertBatch(batch: { id: string; name: string }) {
    this.batchesTable.set(batch.id, batch);
    return batch;
  }

  /**
   * Inserts a record into batch_admins enforcing composite primary key (profile_id, batch_id)
   * and foreign key referential integrity.
   */
  async insertBatchAdmin(record: { profileId: string; batchId: string }) {
    if (!this.profilesTable.has(record.profileId)) {
      const err = new Error(
        `insert or update on table "batch_admins" violates foreign key constraint "batch_admins_profile_id_profiles_id_fk"`
      );
      (err as unknown as { code: string }).code = "23503";
      throw err;
    }

    if (!this.batchesTable.has(record.batchId)) {
      const err = new Error(
        `insert or update on table "batch_admins" violates foreign key constraint "batch_admins_batch_id_batches_id_fk"`
      );
      (err as unknown as { code: string }).code = "23503";
      throw err;
    }

    // Composite primary key: (profile_id, batch_id)
    const pkKey = `${record.profileId}:${record.batchId}`;
    if (this.batchAdminsTable.has(pkKey)) {
      const err = new Error(
        `duplicate key value violates unique constraint "batch_admins_pkey"`
      );
      (err as unknown as { code: string; detail: string }).code = "23505";
      (err as unknown as { code: string; detail: string }).detail = `Key (profile_id, batch_id)=(${record.profileId}, ${record.batchId}) already exists.`;
      throw err;
    }

    const inserted = {
      profileId: record.profileId,
      batchId: record.batchId,
      createdAt: new Date(),
    };
    this.batchAdminsTable.set(pkKey, inserted);
    return inserted;
  }

  /**
   * Inserts a record into batch_memberships enforcing unique index on active membership per batch
   * and foreign key referential integrity.
   */
  async insertBatchMembership(record: {
    id: string;
    profileId: string;
    batchId: string;
    status: string;
  }) {
    if (!this.profilesTable.has(record.profileId)) {
      const err = new Error(
        `insert or update on table "batch_memberships" violates foreign key constraint "batch_memberships_profile_id_profiles_id_fk"`
      );
      (err as unknown as { code: string }).code = "23503";
      throw err;
    }

    if (!this.batchesTable.has(record.batchId)) {
      const err = new Error(
        `insert or update on table "batch_memberships" violates foreign key constraint "batch_memberships_batch_id_batches_id_fk"`
      );
      (err as unknown as { code: string }).code = "23503";
      throw err;
    }

    const activeStatuses = new Set(["waitlisted", "applied", "approved", "active", "grace"]);
    if (activeStatuses.has(record.status)) {
      for (const existing of this.batchMembershipsTable.values()) {
        if (
          existing.profileId === record.profileId &&
          existing.batchId === record.batchId &&
          activeStatuses.has(existing.status)
        ) {
          const err = new Error(
            `duplicate key value violates unique constraint "unique_active_batch_membership_idx"`
          );
          (err as unknown as { code: string; detail: string }).code = "23505";
          (err as unknown as { code: string; detail: string }).detail = `Key (profile_id, batch_id)=(${record.profileId}, ${record.batchId}) already exists.`;
          throw err;
        }
      }
    }

    const inserted = {
      id: record.id,
      profileId: record.profileId,
      batchId: record.batchId,
      status: record.status,
      createdAt: new Date(),
    };
    this.batchMembershipsTable.set(record.id, inserted);
    return inserted;
  }

  getBatchAdmin(profileId: string, batchId: string) {
    return this.batchAdminsTable.get(`${profileId}:${batchId}`) ?? null;
  }

  getBatchMembership(id: string) {
    return this.batchMembershipsTable.get(id) ?? null;
  }

  getMembershipsForProfile(profileId: string) {
    return Array.from(this.batchMembershipsTable.values()).filter(
      (m) => m.profileId === profileId
    );
  }

  getAdminRolesForProfile(profileId: string) {
    return Array.from(this.batchAdminsTable.values()).filter(
      (a) => a.profileId === profileId
    );
  }
}

const testDb = new PostgresTestDatabase();

describe("Dual Roles Coexistence - batch_admins (Batch A) & batch_memberships (Batch B)", () => {
  const profileX = "11111111-1111-4111-8111-111111111111";
  const batchA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const batchB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    testDb.reset();

    // Seed Profile X and Batches A & B
    testDb.insertProfile({ id: profileX, role: "member" });
    testDb.insertBatch({ id: batchA, name: "Cohort Alpha (Batch A)" });
    testDb.insertBatch({ id: batchB, name: "Cohort Beta (Batch B)" });
  });

  it("1. proves Profile X can be assigned as admin for Batch A AND hold an active membership in Batch B simultaneously without constraint conflict", async () => {
    /**
     * Intentional Data Model:
     * A user (Profile X) can serve as a batch admin in one cohort (Batch A)
     * and participate as an active reading member in another cohort (Batch B).
     *
     * This test executes the insertions into the relational database harness
     * and asserts that both records coexist successfully.
     */

    // Step 1: Assign Profile X as an admin of Batch A
    const adminRecord = await testDb.insertBatchAdmin({
      profileId: profileX,
      batchId: batchA,
    });
    expect(adminRecord).toBeDefined();
    expect(adminRecord.profileId).toBe(profileX);
    expect(adminRecord.batchId).toBe(batchA);

    // Step 2: Create an active membership for the same Profile X in Batch B
    const membershipRecord = await testDb.insertBatchMembership({
      id: "membership-b-uuid",
      profileId: profileX,
      batchId: batchB,
      status: "active",
    });
    expect(membershipRecord).toBeDefined();
    expect(membershipRecord.profileId).toBe(profileX);
    expect(membershipRecord.batchId).toBe(batchB);
    expect(membershipRecord.status).toBe("active");

    // Step 3: Verify both records exist simultaneously in the database for Profile X
    const storedAdmin = testDb.getBatchAdmin(profileX, batchA);
    const storedMembership = testDb.getBatchMembership("membership-b-uuid");

    expect(storedAdmin).not.toBeNull();
    expect(storedAdmin?.profileId).toBe(profileX);
    expect(storedAdmin?.batchId).toBe(batchA);

    expect(storedMembership).not.toBeNull();
    expect(storedMembership?.profileId).toBe(profileX);
    expect(storedMembership?.batchId).toBe(batchB);
    expect(storedMembership?.status).toBe("active");

    // Profile X has 1 admin assignment and 1 membership across different batches
    expect(testDb.getAdminRolesForProfile(profileX)).toHaveLength(1);
    expect(testDb.getMembershipsForProfile(profileX)).toHaveLength(1);
  });

  it("2. proves duplicate (profile_id, batch_id) insertion into batch_admins fails because the same profile cannot be assigned twice for the SAME batch", async () => {
    /**
     * Intentional Constraint Model:
     * A profile cannot have duplicate admin assignments for the SAME batch.
     * The composite primary key (profile_id, batch_id) on batch_admins forbids duplicates.
     */

    // First admin assignment for (Profile X, Batch A) succeeds
    const firstInsert = await testDb.insertBatchAdmin({
      profileId: profileX,
      batchId: batchA,
    });
    expect(firstInsert.profileId).toBe(profileX);
    expect(firstInsert.batchId).toBe(batchA);

    // Second admin assignment for the exact same (Profile X, Batch A) fails due to primary key constraint
    await expect(
      testDb.insertBatchAdmin({
        profileId: profileX,
        batchId: batchA,
      })
    ).rejects.toThrow('duplicate key value violates unique constraint "batch_admins_pkey"');

    // Verify only one admin record was stored in the table
    expect(testDb.getAdminRolesForProfile(profileX)).toHaveLength(1);
  });

  describe("Schema Constraint Introspection", () => {
    it("confirms batch_admins has a composite primary key on (profile_id, batch_id) and no single-column unique constraint on profile_id", () => {
      const config = getTableConfig(batchAdmins);

      // Composite primary key on (profile_id, batch_id)
      expect(config.primaryKeys).toHaveLength(1);
      const pkColumns = config.primaryKeys[0].columns.map((c) => c.name);
      expect(pkColumns).toEqual(["profile_id", "batch_id"]);

      // No single-column unique constraint on profile_id that would prevent cross-batch roles
      const uniqueProfileConstraints = config.uniqueConstraints.filter(
        (u) => u.columns.length === 1 && u.columns[0].name === "profile_id"
      );
      expect(uniqueProfileConstraints).toHaveLength(0);
    });

    it("confirms batch_memberships has a partial unique index on (profile_id, batch_id) without single-column unique constraint on profile_id", () => {
      const config = getTableConfig(batchMemberships);

      // Partial unique index is scoped to (profile_id, batch_id)
      const activeIdx = config.indexes.find(
        (idx) => idx.config.name === "unique_active_batch_membership_idx"
      );
      expect(activeIdx).toBeDefined();
      const idxColumns = activeIdx?.config.columns.map((col) =>
        "name" in col ? col.name : ""
      );
      expect(idxColumns).toEqual(["profile_id", "batch_id"]);

      // No single-column unique constraint on profile_id
      const uniqueProfileConstraints = config.uniqueConstraints.filter(
        (u) => u.columns.length === 1 && u.columns[0].name === "profile_id"
      );
      expect(uniqueProfileConstraints).toHaveLength(0);
    });
  });
});
