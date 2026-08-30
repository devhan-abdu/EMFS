import { describe, it, expect } from "vitest";
import { handoffRecords, membershipAuditLogs } from "@/db/schema";
import { getTableColumns } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

describe("EMF-39 Security Audit - Telegram URL Non-Persistence", () => {
  it("21. verifies no handoff or audit schema field is named or intended for a Telegram invite URL", () => {
    const handoffColumns = Object.keys(getTableColumns(handoffRecords));
    const auditColumns = Object.keys(getTableColumns(membershipAuditLogs));

    const forbiddenSubstrings = [
      "telegram_invite_link",
      "telegram_url",
      "invite_url",
      "invite_link",
      "telegram_link",
    ];

    for (const col of handoffColumns) {
      for (const forbidden of forbiddenSubstrings) {
        expect(col.toLowerCase()).not.toContain(forbidden);
      }
    }

    for (const col of auditColumns) {
      for (const forbidden of forbiddenSubstrings) {
        expect(col.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  it("22. searches relevant new schema and service code for t.me/ and Telegram invite URL persistence patterns", () => {
    const rootDir = process.cwd();
    const filesToAudit = [
      path.join(rootDir, "db", "schema", "handoff-records.ts"),
      path.join(rootDir, "db", "schema", "membership-audit-logs.ts"),
      path.join(rootDir, "lib", "services", "handoff.ts"),
      path.join(rootDir, "lib", "services", "membership.ts"),
      path.join(rootDir, "actions", "membership.ts"),
    ];

    for (const file of filesToAudit) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, "utf-8");
        // Ensure no t.me/ URL persistence patterns or invite URL fields are present
        expect(content).not.toMatch(/t\.me\//i);
        expect(content).not.toMatch(/telegram_invite_link/i);
        expect(content).not.toMatch(/invite_link/i);
      }
    }
  });
});
