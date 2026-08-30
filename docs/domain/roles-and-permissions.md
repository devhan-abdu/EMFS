# Roles & Permissions

Canonical capability map for EMFS Book Shelf. Frontend nav hiding is **UX only**;
every Server Action and sensitive query must enforce the same rules.

**Policy SSOT (stakeholder meeting 2026-08-13):** [`admin-ops.md`](./admin-ops.md).

Read with:

- [`../requirements/module-map.md`](../requirements/module-map.md)
- [`admin-ops.md`](./admin-ops.md)
- [`batch-and-intake.md`](./batch-and-intake.md)
- [`reflections.md`](./reflections.md)
- [`open-decisions.md`](./open-decisions.md)

Until a formal permission-key enum exists in code, treat the tables below as the
**intended** matrix. Implement enforcement in one place — do not scatter literals.

## Roles (MVP — confirmed)

| Role          | Who                                                                                                         | Scope                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `member`      | Reading-group participant                                                                                   | Own profile/progress; post attendance to own pace group; batch-scoped Groups read                                                            |
| `pace_admin`  | Group admin — **≥1 per pace group**; may admin **multiple** groups; may post without being a reading member | Daily target approve (+/- pages); Reflection / Inspiration / Attendance / Post duties; group dashboard (streaks, attendance, book)           |
| `batch_admin` | **1–3 per batch**                                                                                           | Registration; pace groups (**≥1**); batch pacing setup + pace admins; optional manual review when `auto_approve = false`; intake monitoring  |
| `super_admin` | System boss                                                                                                 | Book catalog + curriculum; assign batch admins; create batches (capacity, pace-group count, start/pacing); **all** batch + pace capabilities |

### Hierarchy

```text
super_admin
  └── batch_admin (1–3 per batch)
        └── pace_admin (one or more per pace group; may reuse across groups)
              └── member
```

### Confirmed rules

1. Super admin is a **superset** of batch and pace admin powers.
2. Multiple pace admins per group; duties may split (Reflection / Inspiration /
   Attendance); books may be assigned per admin within a group.
3. Same person may be pace admin on **more than one** pace group.
4. Personal Profile reflections remain **author-only** — no admin bypass.

## Permission matrix (intended)

| Capability                                                                | Member          | Pace admin  | Batch admin | Super admin | Notes                                                                           |
| ------------------------------------------------------------------------- | --------------- | ----------- | ----------- | ----------- | ------------------------------------------------------------------------------- |
| Register / sign in                                                        | ✓               | ✓           | ✓           | ✓           | Fields: name, email, Telegram, phone, pace preference                           |
| Select / manage book catalog                                              | —               | —           | —           | ✓           | Super admin only                                                                |
| Create / reorder catalog books & curriculum tasks                         | —               | —           | —           | ✓           |                                                                                 |
| Create batch (capacity, # pace groups, `auto_approve`, start/pacing)      | —               | —           | —           | ✓           | Always starts catalog seq 1                                                     |
| Assign batch admins                                                       | —               | —           | —           | ✓           | 1–3 per batch; before intake                                                    |
| Open/close batch registration                                             | —               | —           | ✓           | ✓           |                                                                                 |
| Create pace groups                                                        | —               | —           | ✓           | ✓           | Count planned at batch create                                                   |
| Assign pace admins (+ duty / book split)                                  | —               | —           | ✓           | ✓           | Reuse across groups OK                                                          |
| Configure batch pacing / offsets                                          | —               | —           | ✓           | ✓           | Not master curriculum content                                                   |
| Approve/reject applicants                                                 | —               | —           | ✓           | ✓           | Only when `auto_approve = false`; auto path is system-driven                    |
| Complete intake via Telegram bot (handoff code → link → activate)         | ✓               | —           | —           | —           | Member action; no admin DM required in MVP                                      |
| Manage optional Telegram group access link                                | —               | —           | ✓           | ✓           | Supplementary; not the primary activation path                                  |
| Waiting list / seat fill                                                  | —               | —           | ✓           | ✓           |                                                                                 |
| Auto daily target draft; admin +/- pages; advance **this group's** cursor | —               | ✓           | ✓           | ✓           | `OD-014`; scoped — see [`curriculum-and-pacing.md`](./curriculum-and-pacing.md) |
| Reflection / inspiration / attendance / post duties                       | —               | ✓           | ✓           | ✓           | ≥4 duties; more later                                                           |
| View group dashboard (streaks, attendance, book)                          | —               | ✓           | ✓ (batch)   | ✓           | No voice/AI in MVP                                                              |
| Review attendance; grant second chance                                    | —               | ✓           | ✓           | ✓           | Window: `OD-009`                                                                |
| Mark own daily progress                                                   | ✓               | ✓           | —           | —           | Done = today's pages in **member's** edition (`OD-015`)                         |
| Personal reflections (Profile)                                            | ✓               | ✓           | —           | —           | Author-only                                                                     |
| Post attendance text (window)                                             | ✓               | ✓           | —           | —           | Text only MVP                                                                   |
| Forward from post library into pace group                                 | —               | ✓           | ✓           | ✓           | `OD-022`                                                                        |
| Read posted reflections                                                   | ✓ (public site) | ✓           | ✓           | ✓           | Anyone visiting website                                                         |
| View/react without submit                                                 | ✓ (visitor)     | ✓           | ✓           | ✓           | Submit only if pace member (`OD-020`)                                           |
| Grant grace with admin-set duration                                       | —               | ✓           | ✓           | ✓           | After 3 misses (`OD-021`)                                                       |
| Leaderboard (likes/reactions)                                             | ✓               | ✓           | ✓           | ✓           | Engagement                                                                      |
| Individual / broadcast inbox message                                      | —               | ✓ / confirm | ✓           | ✓           | In-app first; Telegram optional                                                 |
| Cross-batch ops                                                           | —               | —           | —           | ✓           |                                                                                 |

## Object-level rules (NON-NEGOTIABLE)

1. **Batch isolation** — [`batch-and-intake.md`](./batch-and-intake.md).
2. **Pace-admin scope** — admin surfaces limited to assigned pace group(s),
   except batch/super rollups.
3. **Profile privacy** — personal reflections author-only
   ([`reflections.md`](./reflections.md)).
4. **Attendance window** — late posts blocked unless second-chance flag
   ([`admin-ops.md`](./admin-ops.md)).
5. **Removal** — after 3 misses + outreach; grace duration is **admin-set**
   (`OD-021`); else auto-remove (**full removal** from batch — not automatic
   cross-batch reassignment). Reassignment and in-batch pace-group moves:
   [`admin-ops.md`](./admin-ops.md).
6. **Derived attendance** — from in-window **text** submission; no voice/AI in MVP.

## How to extend

1. Add the story to the module map.
2. Add or update a row here and in [`admin-ops.md`](./admin-ops.md).
3. Enforce in Server Action / service — not only UI.
4. Add Vitest allow/deny cases.
