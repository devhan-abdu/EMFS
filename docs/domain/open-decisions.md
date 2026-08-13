# Open Decisions

The single register of unresolved business/domain questions for EMFS Book Shelf.
If a requirement is still open, track it here — do not invent answers in code.

Status: `Open` | `Stubbable` | `Answered` | `Dropped`

## Register

| ID | Status | Persona | Question | Blocks | Current best source |
| --- | --- | --- | --- | --- | --- |
| **OD-001** | Answered | Member | See [`reflections.md`](./reflections.md). | — | [`reflections.md`](./reflections.md) |
| **OD-002** | Answered | Member | Profile = personal; Groups = pace feeds. **Anyone visiting the website** may view/react to posted reflections but not submit (`OD-020`). | — | [`reflections.md`](./reflections.md) |
| **OD-003** | Answered | Admin | Registration **per batch** + **waiting list** (next batch / seat opens). | — | [`batch-and-intake.md`](./batch-and-intake.md) |
| **OD-004** | Answered | Admin / Member | Use **batch**; hard isolation of ops data. | — | [`batch-and-intake.md`](./batch-and-intake.md) |
| **OD-005** | Answered | Admin | Contact + code handoff (not auto Telegram link). Alternatives welcome if they solve inactive-joiner identity. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-006** | Answered | Admin | Multi pace admins; reuse; duty split. Prepared posts come from a **post library / source place** (not necessarily another live group) and are forwarded into pace groups (`OD-022`). Batch may have only one pace group. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-007** | Answered | Admin | Dashboard: members, streaks, attendance, review, book(s). No voice/AI in MVP. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-008** | Answered | Member / Admin | **Resolved.** Completion is schedule-based: **member** portfolio completion and **group** schedule completion. See [`admin-ops.md`](./admin-ops.md). | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-009** | Stubbable | Member / Admin | Exact attendance **day/time** + timezone. | Attendance | [`admin-ops.md`](./admin-ops.md) |
| **OD-010** | Answered | Super / Batch admin | Super creates batch (capacity, # groups, books). **Batch admin** creates **yearly schedule** with assigned pace admins; opens reg; creates groups; assigns admins; approvals. Super can do all. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-011** | Answered | All admins | `super_admin`, `batch_admin` (1–3), `pace_admin`. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-012** | Answered | Batch / Pace admin | Duties in [`admin-ops.md`](./admin-ops.md). Pace duties: ≥4 today (reflection, inspiration, attendance, daily post); more may be added. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-013** | Answered | Pace admin | Duty/book split; multi-admin; multi-group. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-014** | Answered | Pace admin | System proposes today’s page target → admin **approves** and may **+/- pages** → system sets **next** pages. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-015** | Answered | Pace / Batch admin | When Am + En assigned: **both** must be finished for the day so topics match; one admin task / Done criterion. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-016** | Answered | All admins | Dashboards in [`admin-ops.md`](./admin-ops.md). | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-017** | Answered | Member / Admin | **In-app** discussion + announcement groups per batch (plus pace-group surfaces). See `OD-018`. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-018** | Answered | All | **Resolved.** The **app is a separate system** (not “Telegram only”). Product groups live **in the app**: per **batch**, per **pace group**, plus **announcement** and **discussion**. UX may feel Telegram-like. **Telegram may still be used** for some supplementary features (e.g. optional TG groups, outreach, handoff) — not as the primary group home. | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-019** | Dropped | — | Voice attendance + AI content check **removed from MVP** (cost/storage). | — | — |
| **OD-020** | Answered | Public | **Resolved.** **Anyone who visits the website** can **see** (and react to) posted reflections. They **cannot submit** attendance/reflections unless they are an active pace-group member. Personal Profile notes stay author-only. | — | [`reflections.md`](./reflections.md) |
| **OD-021** | Answered | Admin | **Resolved.** Grace period after 3 misses is **dynamic — set by admin** when granting grace (not a fixed global constant). | — | [`admin-ops.md`](./admin-ops.md) |
| **OD-022** | Answered | Admin | **Resolved.** Prepared daily content lives in a **post source / library** (a place to get what to post — not necessarily another batch’s live group). Admins **forward** from that source into the target pace group. | — | [`admin-ops.md`](./admin-ops.md) |

## Stakeholder follow-ups (remaining)

1. Attendance day/time + timezone → `OD-009`

## How to use this file

1. Search related `US-*` / `FR-*` or persona before implementing.
2. `Open` on attendance, isolation, or admin hierarchy → align with stakeholders.
3. `Stubbable` → configurable mechanism + `TODO: confirm (OD-XXX)`.
4. On answer: update owning domain doc + module map, then mark `Answered`.
