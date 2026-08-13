# Admin ops & attendance (resolved policy)

Canonical admin roles, intake, attendance enforcement, and hybrid Telegram
rules from stakeholder meetings **2026-08-13**. Implement from this file and
[`roles-and-permissions.md`](./roles-and-permissions.md).

Read with:

- [`batch-and-intake.md`](./batch-and-intake.md)
- [`reflections.md`](./reflections.md)
- [`../requirements/module-map.md`](../requirements/module-map.md)

## Roles (confirmed)

| Role | Cardinality | Scope |
| --- | --- | --- |
| `super_admin` | System-wide | Year books; create batches (capacity, pace-group count, books); **superset** of batch + pace admin powers |
| `batch_admin` | **1–3 per batch** | Open registration; create pace groups (batch may have **one or many**); assign pace admins; yearly schedule with assigned admins; books; approve/reject; Telegram access handoff |
| `pace_admin` (group admin) | **One or more per pace group**; same person may admin **multiple** groups | Daily task (approve/adjust pages); reflection / inspiration / attendance (+ more duties later); review attendance; group dashboard |

```text
super_admin
  └── batch (max_members, pace_group_count ≥ 1, books)
        └── batch_admin (1–3) — yearly schedule + assign pace admins
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

## Super admin at batch creation

When creating a batch, super admin sets:

1. **Max members** (capacity)
2. **How many pace groups** (may be **1** only — e.g. a batch that only has a
   5-page or 10-page group)
3. **Which book(s)** the batch will read

Super admin also selects/adds year books. Super admin **can do everything**
batch and pace admins can do.

## Batch admin duties

- Open/close **registration** (with **waiting list** — see
  [`batch-and-intake.md`](./batch-and-intake.md))
- Create **pace groups** (one or more)
- **Assign pace admins** (reuse existing admins across groups)
- Create the **yearly reading schedule** with assigned pace admins
- Add books; assign books to pace admins when split
- **Approve or reject** applicants
- Manage **Telegram access-link handoff** (contact + code)

## Pace admin duties

- Manage their pace group(s)
- **Daily task:** system proposes **today’s target/pages** from schedule →
  admin **approves** and may **add or subtract pages** → system advances
  **next page** for the following day
- Daily content **varies by book**
- Cover assigned duties (reflection / inspiration / attendance / posting)
- Review attendance; coach members (system notification and/or admin outreach)

## Registration fields (required)

| Field | Notes |
| --- | --- |
| Registration name | Display / legal name for ops |
| Email | Account + contact |
| Telegram username | Identity for Telegram ops |
| Phone number | Reachability |
| Pace group assignment | Preferred or assigned 5/10/20/40 at apply |

## Intake handoff after approval (`OD-005`)

**Pain:** Members join Telegram but stay inactive; hard to identify later by
username (especially if they change it).

**Current product decision:**

1. Admin **approves** in the app.
2. System does **not** send the Telegram access link directly.
3. Member receives **admin contact** + a **code**.
4. Member **messages the admin** to request the access link.
5. Admin verifies and shares the Telegram group link.

**Open to alternatives** if another feature solves the same identity /
reachability problem equally well.

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

## Attendance format (MVP)

- **Text** attendance / group reflection in the window.
- **No voice upload** and **no AI-generated-content check** in MVP (removed for
  cost/storage).

## Dual language (Amharic + English) — `OD-015`

- Finishing a day’s reading means **both** Amharic and English (when both are
  assigned) so **topics match**.
- Treated as **one admin task** / one Done criterion when dual editions are used
  — see [`admin-ops` / schedule](#pace-admin-duties).

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

| Surface | Scope | Purpose |
| --- | --- | --- |
| **Pace group** | Per pace group inside a batch | Daily tasks, attendance posts, pace feed |
| **Batch** | Whole batch | Batch-wide membership context |
| **Announcement** | Per batch | Official announcements only |
| **Discussion** | Per batch | Member discussion |

### Telegram (optional / supplementary)

- Telegram may still be used for **some** features (optional TG group, outreach,
  registration handoff identity).
- Prefer **in-app** notifications and messaging for new work.
- Core reading / attendance / admin flows must work **in the app**.

### Admin messaging

- Know all members; support **individual outreach**.
- Support **group-wide message** to each member’s **personal inbox** (in-app
  first; Telegram bridge optional).

## Still open

| ID | Topic |
| --- | --- |
| `OD-009` | Exact attendance day/time + timezone |
