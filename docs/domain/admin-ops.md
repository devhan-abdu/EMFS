# Admin ops & attendance (resolved policy)

Canonical admin roles, intake, attendance enforcement, and hybrid Telegram
rules from stakeholder meetings **2026-08-13**. Implement from this file and
[`roles-and-permissions.md`](./roles-and-permissions.md).

Read with:

- [`batch-and-intake.md`](./batch-and-intake.md)
- [`reflections.md`](./reflections.md)
- [`../requirements/module-map.md`](../requirements/module-map.md)

## Roles (confirmed)

| Role                       | Cardinality                                                               | Scope                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `super_admin`              | System-wide                                                               | **Book catalog** + master curriculum; assign batch admins; create batches (capacity, pace-group count, start/pacing); **superset** of batch + pace admin powers                                                                |
| `batch_admin`              | **1–3 per batch**                                                         | Open registration; create pace groups (batch may have **one or many**); assign pace admins; batch pacing setup; optional manual review queue when `auto_approve = false`; oversee intake via the bot-mediated approval handoff |
| `pace_admin` (group admin) | **One or more per pace group**; same person may admin **multiple** groups | Daily task (approve/adjust pages); reflection / inspiration / attendance (+ more duties later); review attendance; group dashboard                                                                                             |

```text
super_admin
  └── book catalog (sequence 1, 2, 3, …) + master curriculum tasks
  └── batch (max_members, pace_group_count ≥ 1, start_date, pacing)
        └── batch_admin (1–3) — assigned before intake; batch pacing + pace admins
              └── pace_admin(s) on pace groups (may reuse; may be out-of-batch poster)
                    └── members
```

### Pace-admin duty split

Known duties today (**4+**; more may be added later), assignable to different
admins (one person may hold more than one):

1. **Reflection**
2. **Inspiration**
3. **Attendance**
4. **Daily task / posting** (approve system draft, adjust pages)

When a pace group has multiple admins and multiple books, **different admins may
be assigned different books** (admin A → book X, admin B → book Y).

### Prepared posts / post library (`OD-022`)

Daily content is prepared in a **post source / library** — a place admins get
what they need to post (not necessarily another live batch/pace group feed).

- Admins **forward** (or copy) from that source into the target pace group.
- Poster may be an admin who is not a reading member of that batch.
- Still enforce batch isolation for member roster and progress data.

### Pace-admin dashboard (Must)

- Member dashboard for their group(s)
- Streaks
- Attendance + attendance review
- Group’s assigned book(s)

**Out of MVP:** voice attendance, AI content detection.

## Super admin — catalog and batch creation

**Book catalog** (before any batch intake):

1. Create books in **sequence order** (1 = first book every new batch reads).
2. Set metadata: title, cover, language; link Am+En pairs when both run (`OD-015`).
3. Attach **master curriculum tasks** per book (`day_number` steps — not calendar dates).

**Batch creation:**

1. **Assign 1–3 batch admins** (only super admin may do this).
2. **Max members** (capacity).
3. **`auto_approve`** (boolean, per-batch toggle — see § Application approval below).
4. **How many pace groups** (may be **1** only — e.g. a batch that only has a
   5-page or 10-page group).
5. **Start date** and **pacing** (daily / N-times-week / custom cadence).
6. Batch always begins at **catalog sequence 1** — no per-batch book copies.

Super admin **can do everything** batch and pace admins can do.

Pre-intake order: [`batch-and-intake.md`](./batch-and-intake.md) § Pre-intake setup.

## Batch admin duties

- Open/close **registration** (only **after** pace groups + pace admins are ready —
  see pre-intake checklist in [`batch-and-intake.md`](./batch-and-intake.md))
- Create **pace groups** (one or more)
- **Assign pace admins** (reuse existing admins across groups)
- Confirm **batch pacing** / offsets; assign books to pace admins when duty split
- **Approve or reject** applicants — **only when `auto_approve = false`** for the batch; the default product pattern is first-come-first-served bot-mediated auto-approval, but the manual review path remains supported for admin-reviewed cohorts (see § Application approval)
- Monitor intake; members complete **Telegram bot handoff** after approval (no manual DM verification in MVP)

Batch admin does **not** create catalog books or reorder the global sequence.

## Application approval (`auto_approve`)

Each batch has `auto_approve` (boolean, set at batch creation by `super_admin`):

| `auto_approve` | Behavior at submission                                                                                                                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `true`         | **Automatic (first-come-first-served):** if `registration_open` and capacity remains, the system approves instantly, issues a handoff code, and skips the manual review queue. Uses a transaction-safe capacity check with `SELECT … FOR UPDATE` on the batch row — same locking pattern as waitlist seat advancement. |
| `false`        | **Manual:** application enters `applied`; batch admin reviews and transitions to `approved` or `rejected`.                                                                                                                                                                                                             |

If capacity is full or registration is closed, both modes route to the **waiting list** per existing rules. Both modes remain supported; `auto_approve` is per-batch configuration, not a global replacement of the manual review fallback. In the default product flow, batches should use `auto_approve = true` so applications are approved on submission when capacity remains and the bot then completes the handoff.

## Pace admin duties

- Manage their pace group(s)
- **Daily task:** system proposes **today’s target/pages per pace group** from
  batch schedule state + group page cursor → admin **approves** and may **add or
  subtract pages** → system advances **that group’s** cursor only (does not
  change master curriculum or other batches) → see
  [`curriculum-and-pacing.md`](./curriculum-and-pacing.md)
- Daily content **varies by book**
- Cover assigned duties (reflection / inspiration / attendance / posting)
- Review attendance; coach members (system notification and/or admin outreach)

## Registration fields (required)

| Field                 | Notes                                     |
| --------------------- | ----------------------------------------- |
| Registration name     | Display / legal name for ops              |
| Email                 | Account + contact                         |
| Telegram username     | Identity for Telegram ops                 |
| Phone number          | Reachability                              |
| Pace group assignment | Preferred or assigned 5/10/20/40 at apply |

## Intake handoff after approval (`OD-005`)

**Pain:** Members join Telegram but stay inactive; hard to identify later by
username (especially if they change it).

**Current product decision (bot-mediated — no manual admin DM in MVP):**

1. Member is **approved** (automatically when `auto_approve = true`, or by batch admin when `auto_approve = false`).
2. System issues a **handoff code** in the app (does **not** blast a Telegram group invite link).
3. Member opens the **Telegram bot** via deep link / `start` payload carrying the code.
4. Bot verifies the code, records `telegram_chat_id` + `used_at` on the handoff record, and **activates** membership (`approved` → `active`) in the **same database transaction**.
5. Member is fully linked — no batch-admin DM step required for identity verification in MVP.

Batch admins may still manage optional supplementary Telegram groups; core activation is bot-driven.

## Capacity & waiting list (`OD-003`)

- Fixed `max_members` at batch creation.
- Waiting list for: (1) next batch after registration closes; (2) seat opens
  after remove/reject.
- Prefer **in-app** notifications; Telegram optional (`OD-018`).

## Attendance window & removal

- Submit inside day/time window (`OD-009`).
- After window: blocked unless **second chance**.
- **3 missed attendances** → outreach → admin may grant **grace** with a
  **dynamic duration set by the admin** at grant time → else auto-remove; seat
  may open for waitlist (`OD-021`).

### Batch removal vs cross-batch reassignment

**Default outcome is full removal** — not an automatic move to a lower/later
batch. Reassignment to a later batch is **opt-in**: the member must meet
admin-set criteria **and** then either (a) be directly invited by a batch admin,
or (b) re-register through the normal application flow for that batch. Removal
does **not** guarantee reassignment. Story IDs: `US-REG-10`, `US-REG-11`,
`US-ATT-09` in [`module-map.md`](../requirements/module-map.md).

### In-batch pace-group moves

A member may move from one pace group to another **within the same batch** via
a normal request/approval flow — unrelated to removal or cross-batch
reassignment criteria (`US-GRP-08`).

### History & move audit

After any pace-group move or batch removal/reassignment, the member's prior
attendance, reflections, and progress **remain intact and viewable** (nothing
deleted). Admins see a log of who moved, from where to where, when, and whether
a removed member was later reassigned or left for good (`US-ADM-05`, `US-ADM-06`).

## Attendance format (MVP)

- **Text** attendance / group reflection in the window.
- **No voice upload** and **no AI-generated-content check** in MVP (removed for
  cost/storage).

## Dual language (Amharic + English) — `OD-015`

- One pace group may include members on **Amharic** and **English** editions of the
  **same program book** (same `sequence_order` / curriculum day).
- Each member reads **one** edition — the language they can read — not both every day.
- The group stays aligned: same curriculum step, same pace-group schedule; everyone
  finishes the slot on the same timeline.
- **One admin daily task** per pace group; topics match because the curriculum step
  is shared (`OD-022`).
- Member **Done** = completed today's pages in **their** assigned edition.

## Library / completed books — `OD-008`

- **Member perspective:** book marked completed for the user’s portfolio.
- **Group perspective:** book completed for the pace group / batch schedule.
- Driven by **schedule** (when the plan finishes), plus member-facing completion
  — details in library stories.

## Visibility & leaderboard (`OD-020`)

- **Anyone visiting the website** may **view and react** to **posted**
  reflections.
- Visitors **cannot submit** reflections or attendance unless they are an
  active pace-group member.
- Personal Profile reflections remain **author-only**.
- Leaderboard by likes/reactions on posted reflections.

## Messaging & groups (`OD-017`, `OD-018`)

**Principle:** EMFS Book Shelf is a **separate product**. Groups and feeds live
**in the app**. UX may feel Telegram-like, but Telegram is not the system of
record for groups.

### In-app group surfaces (Must)

| Surface          | Scope                         | Purpose                                  |
| ---------------- | ----------------------------- | ---------------------------------------- |
| **Pace group**   | Per pace group inside a batch | Daily tasks, attendance posts, pace feed |
| **Batch**        | Whole batch                   | Batch-wide membership context            |
| **Announcement** | Per batch                     | Official announcements only              |
| **Discussion**   | Per batch                     | Member discussion                        |

### Telegram (optional / supplementary)

- Telegram may still be used for **some** features (optional TG group, outreach,
  **bot-mediated intake handoff**).
- The **Telegram bot** is the system integration for intake linking and may also
  **deliver batch/group messages** to members who have linked their chat ID
  (supplement to in-app inbox; useful for reminders and announcements).
- Prefer **in-app** notifications and messaging for new work.
- Core reading / attendance / admin flows must work **in the app**.

### Admin messaging

- Know all members; support **individual outreach**.
- Support **group-wide message** to each member’s **personal inbox** (in-app
  first; **Telegram bot** may deliver the same message to linked `telegram_chat_id`
  values as an optional bridge).
- For batch/group updates, the bot is the preferred push channel to linked
  Telegram members; use in-app inbox as the default fallback when a member has
  not linked a chat yet.

## Still open

| ID       | Topic                                |
| -------- | ------------------------------------ |
| `OD-009` | Exact attendance day/time + timezone |
