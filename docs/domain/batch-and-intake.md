# Batch & intake (resolved policy)

Canonical rules for **batch** terminology, **per-batch registration**,
**capacity / waiting list**, **approval handoff**, and **hard batch isolation**.

Resolved via `OD-003`, `OD-004`, `OD-005`, and stakeholder meeting **2026-08-13**.
Admin role details: [`admin-ops.md`](./admin-ops.md).

Read with:

- [`glossary.md`](./glossary.md)
- [`lifecycles.md`](./lifecycles.md)
- [`roles-and-permissions.md`](./roles-and-permissions.md)
- [`admin-ops.md`](./admin-ops.md)
- [`../requirements/module-map.md`](../requirements/module-map.md) — `US-REG-*`

## Terminology — use **batch**, not session

| Term           | Use                                                                                   |
| -------------- | ------------------------------------------------------------------------------------- |
| **Batch**      | Cohort container: capacity, intake window, members, pace groups, books                |
| **Pace group** | Subdivision **inside** a batch (5 / 10 / 20 / 40 pages). Batch may have **only one**. |
| **Session**    | **Do not use** for cohort/intake — Better Auth login session only                     |

### Hierarchy

```text
batch (max_members, registration_open, auto_approve, start_date, pacing)
  ├── batch_admin (1–3) — assigned by super_admin before intake
  ├── waiting_list
  ├── pace groups (count set at batch create; created by batch admin)
  │     └── members, pace admins, page cursor, group posts
  └── Telegram bot handoff (code → link → activate)
```

## Who creates what

| Action                                                                                                                                                                         | Role                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **Book catalog** — create/reorder books, metadata, curriculum tasks                                                                                                            | `super_admin` only                  |
| Assign **batch admins** (1–3) to a batch                                                                                                                                       | `super_admin` only                  |
| Create batch (max members, # pace groups, `auto_approve`, start date, pacing; catalog always from sequence 1)                                                                  | `super_admin`                       |
| Create pace groups (≥1); configure batch pacing + assign pace admins; open/close registration; optional manual review when `auto_approve = false`; bot-mediated intake handoff | `batch_admin` (1–3) / `super_admin` |
| Daily ops inside pace group (approve/edit today’s page draft)                                                                                                                  | `pace_admin`                        |

## Pre-intake setup (super admin → batch admin)

Registration must **not** open until the steps below are done. Order matters.

```text
1. super_admin — build book catalog (sequence 1, 2, 3, … + metadata + curriculum tasks)
2. super_admin — assign 1–3 batch_admin users to the batch
3. super_admin — create batch (capacity, pace_group_count, start_date, pacing)
                 (batch reads from catalog sequence 1; no per-batch book copies)
4. batch_admin — create pace groups; assign pace admins (+ duty/book split)
5. batch_admin — confirm batch pacing / offsets if needed
6. batch_admin — open registration  ← intake begins here
7. members apply → approved (auto or manual) → bot handoff code → Telegram bot link → active
```

Until step 6, applicants must see registration **closed** for that batch.

## Registration — per batch

- Registration is **not** always open globally.
- Each batch has `registration_open` toggled by `batch_admin` / `super_admin`.
- Each batch has `auto_approve` (boolean, set at batch creation) — see § Application approval.
- Apply only while open and under capacity (else waiting list — below).

### Batch fields (intake-relevant)

| Field               | Type    | Notes                                                                                                                                                                                                                                   |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max_members`       | integer | Capacity; set by super admin at batch creation                                                                                                                                                                                          |
| `registration_open` | boolean | Toggled by batch admin / super admin                                                                                                                                                                                                    |
| `auto_approve`      | boolean | When `true`, applications skip the manual review queue and are approved instantly at submission if capacity remains; else routed to waitlist per existing rules. When `false`, batch admin reviews `applied` → `approved` / `rejected`. |

### Application approval

Approval can be **manual** or **automatic**, per batch:

- **Manual** (`auto_approve = false`): member enters `applied`; batch admin reviews and transitions to `approved` or `rejected`.
- **Automatic** (`auto_approve = true`, first-come-first-served): on submission, if `registration_open` and capacity remains, the system approves instantly and issues a handoff code. This is the default product pattern for intake; it uses a transaction-safe capacity check with `SELECT … FOR UPDATE` on the batch row — identical to the locking pattern documented for waitlist seat advancement.

If registration is closed or the batch is full, both modes route to the **waiting list**.

### Required application fields

1. Registration name
2. Email
3. Telegram username
4. Phone number
5. Pace group assignment (preference / placement)

### Post-approval handoff (`OD-005`)

Do **not** email/send the Telegram group join link immediately.

1. Member is approved (auto or manual).
2. System issues a **handoff code** in the app.
3. Member opens the **Telegram bot** with the code (deep link / `start` payload).
4. Bot verifies the code, records `telegram_chat_id` + `used_at`, and activates membership (`approved` → `active`) atomically.

Purpose: bind a stable Telegram identity to the app account without manual admin DM verification in MVP.

## Capacity & waiting list

- `max_members` set by **super admin** at batch creation (e.g. 100).
- Auto-approve batches enforce capacity inside a single transaction (`FOR UPDATE` on batch row) before creating `approved` membership — same pattern as waitlist seat advancement.
- Waiting list when:
  1. Registration closed — interest for **next** batch, or
  2. Batch full — when a seat opens (remove/reject), next waitlisted person is
     offered/added.
- Prefer **in-app** notifications for waitlist/seat events; Telegram optional.

**Waitlist ≠ reassignment.** Filling an open seat in the **same** batch (via
waitlist) is separate from **cross-batch reassignment** after removal. The latter
is never automatic — see removal/reassignment policy in
[`admin-ops.md`](./admin-ops.md) and `US-REG-10` … `US-REG-11` in
[`module-map.md`](../requirements/module-map.md).

## Hard batch isolation

Members of **batch A must never see batch B** ops data (roster, schedules,
admin dashboards). Posted reflections may be visible to **anyone visiting the website** for
view/react only (`OD-020`) — that is public engagement policy, not cross-batch
membership leakage.

Enforce `batch_id` on membership, progress, attendance, and admin queries.

## Enforcement checklist

1. Batch-scoped tables carry `batch_id`.
2. Reject new `applied` if `registration_open = false` (route to waitlist UX).
3. Reject active join if at `max_members` (waitlist); auto-approve path must re-check capacity under row lock.
4. Approval → handoff code → Telegram bot link → activation (not direct link blast).
5. UI copy uses **batch**, not session.

## Related

- Removal after 3 missed attendances — [`admin-ops.md`](./admin-ops.md)
- Telegram optional for some supplementary features — `OD-018` answered
  (app owns groups).
