# Data Model (planned)

Planned aggregates **before** Drizzle schema exists. Code wins on drift.

Read with: [`glossary.md`](./glossary.md), [`admin-ops.md`](./admin-ops.md),
[`batch-and-intake.md`](./batch-and-intake.md), [`reflections.md`](./reflections.md).

## Aggregate map

| Aggregate | Purpose | Key relations | Notes |
| --- | --- | --- | --- |
| **Auth identity** | Better Auth user/session | 1:1 app user | |
| **App user** | Profile + roles | name, email, telegram, phone | Registration fields |
| **Batch** | Cohort | `max_members`, `registration_open`, books, pace_group_count ≥ 1 | May be a single pace group only |
| **Waiting list entry** | Queue | user ↔ batch | |
| **Membership** | Intake state | waitlisted → applied → … → active / removed | [lifecycles](./lifecycles.md) |
| **Pace group** | 5/10/20/40 | belongs to batch | |
| **Pace group admin** | Assignment | admin ↔ pace group; duties; optional book_ids; may be non-member poster | Multi-admin; multi-group OK |
| **Batch admin assignment** | Assignment | admin ↔ batch | Max 3 |
| **Book** | Title / materials | year + batch; Am+En pair when dual | Both required for Done (`OD-015`) |
| **Reading schedule** | Yearly plan | batch + pace group + page cursor | Batch admin creates; feeds daily target |
| **Admin post** | Daily task / inspiration | draft \| published \| held; optional `source_post_id` from library | `OD-022` |
| **Post library entry** | Prepared content to forward | reusable templates / drafts | `OD-022` |
| **Daily progress** | Done/Not Done | member + date; dual-lang flag | `OD-009` |
| **Reflection** | Personal or attendance | `private` \| `posted_to_group`; **text** only MVP | No voice/AI |
| **Attendance week** | Derived status | submitted bool; miss count | |
| **Second chance grant** | Late-submit allow | member + window | |
| **Reaction** | Like on reflection | user ↔ reflection | Leaderboard |
| **Library entry** | Completed book | member and/or group scope | `OD-008` |
| **Discussion / announcement channel** | In-app batch surfaces | batch-scoped | `OD-017`, `OD-018` |

## Modeling rules

- Batch-scoped rows carry `batch_id`.
- Derive attendance from qualifying posts; track miss count for removal.
- Personal reflections: `author_id` only.
- Capacity enforced before `applied`/`active` when at `max_members`.
