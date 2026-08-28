# Module Map & User Stories

Working requirements map for **EMFS Book Shelf**. **Citable story SSOT.**

Open items → [`../domain/open-decisions.md`](../domain/open-decisions.md).  
Admin/intake policy → [`../domain/admin-ops.md`](../domain/admin-ops.md),
[`../domain/batch-and-intake.md`](../domain/batch-and-intake.md).

## The spine

**catalog setup → assign batch admins → create batch → pace groups → open registration →
register → approve (auto or manual) → bot handoff code → Telegram bot link → join pace group → daily progress →
attendance window → admin review** (removal / waitlist as needed; reassignment
to a later batch is **not** automatic — see §02 and §06).

## Module index

| # | Module | MVP V1 | Status |
|---|--------|--------|--------|
| 01 | Auth & Identity | Must | Not started |
| 02 | Registration & Batch Intake | Must | Policy resolved |
| 03 | Pace Groups & Schedules | Must | Policy resolved |
| 04 | Daily Reading Tracking | Must | Not started |
| 05 | Reflections & Attendance posts | Must | Policy resolved |
| 06 | Attendance (Admin) + removal | Must | Policy resolved (window clock open) |
| 07 | Portfolio & Library | Should | Schedule-based completion (`OD-008`) |
| 08 | In-app groups & messaging | Must | Policy resolved (`OD-017`, `OD-018`) |
| 09 | Admin Operations Shell | Must | Policy resolved |
| 10 | Notifications | Should | In-app first; Telegram optional |
| 11 | Engagement (streaks, leaderboard, reactions) | Should | Public view/react (`OD-020`) |
| 12 | Book Catalog & Curriculum | Must | Policy in [`curriculum-and-pacing.md`](../domain/curriculum-and-pacing.md) |

---

## 01 · Auth & Identity

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-AUTH-01 | As a user, I can register with email and password. | Must | Derived |
| US-AUTH-02 | As a user, I stay signed in via HTTP-only session. | Must | Derived |
| US-AUTH-03 | As a user, I can sign out. | Must | Derived |
| US-AUTH-04 | As the system, I separate Better Auth identity from app profile/role. | Must | Derived |

---

## 02 · Registration & Batch Intake

**Policy:** [`batch-and-intake.md`](../domain/batch-and-intake.md), [`admin-ops.md`](../domain/admin-ops.md).

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-REG-01 | As a member, I can apply to a batch with name, email, Telegram username, phone, and pace group preference. | Must | Meeting |
| US-REG-02 | As a member, I see whether registration is open or closed for a batch. | Must | Meeting |
| US-REG-03 | As a batch admin, I can approve or reject applicants. **Only applies when `auto_approve = false` for the batch. When `auto_approve = true`, approval happens automatically at submission time using the same capacity-lock pattern as waitlist advancement.** | Must | Meeting |
| US-REG-04 | As a member, after approval I receive a handoff code and link via the **Telegram bot**; the bot verifies my code, records my Telegram identity, and activates my membership — no manual admin DM step in MVP. | Must | Meeting · `OD-005` |
| US-REG-05 | As a member in batch A, I cannot see batch B ops/roster data. | Must | Meeting |
| US-REG-06 | As a batch admin, I can open or close registration for my batch. | Must | Meeting |
| US-REG-07 | As a super admin, I create a batch with max members, pace-group count, start date, and pacing (reads from catalog sequence 1). | Must | Meeting |
| US-REG-12 | As a super admin, I assign 1–3 batch admins to a batch before opening registration. | Must | Policy |
| US-REG-08 | As an applicant, when the batch is full or registration is closed I can join a waiting list. | Must | Meeting |
| US-REG-09 | As a batch admin, when a seat opens I can advance the next waitlisted person. | Must | Meeting |
| US-REG-10 | As a batch admin, I can invite a removed member into a lower/later-starting batch when they meet admin-set reassignment criteria (direct invite path). | Must | Policy |
| US-REG-11 | As a removed member who meets reassignment criteria, I can re-enter through the normal application flow for a later batch (re-registration path). | Must | Policy |

**Removal vs reassignment (batch):** Removing a member from a batch is the **default
outcome** — full removal, not an automatic move to another batch. Reassignment to a
lower/later-starting batch happens **only** when the member meets criteria set by the
admin **and** is then either (a) directly invited by an admin (`US-REG-10`), or (b)
re-registers through the normal application flow (`US-REG-11`). Being removed does
**not** guarantee reassignment.

---

## 03 · Pace Groups & Schedules

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-GRP-01 | As a member, I belong to one pace group in my batch (batch may have only one pace group, e.g. 5 or 10 only). | Must | Meeting |
| US-GRP-02 | As a member, I can view my group's reading schedule. | Must | PRD |
| US-GRP-03 | As a pace admin, I can be assigned to one or more pace groups (reuse allowed; may post without being a reading member). | Must | Meeting |
| US-GRP-04 | As a batch admin, I create pace groups and assign pace admins with optional duty/book split. | Must | Meeting |
| US-GRP-05 | As a pace admin, the system proposes today's page target **for my pace group**; I approve and may add/subtract pages; the system advances **this group's** cursor only. | Must | Meeting · `OD-014` |
| US-GRP-06 | As a batch admin, I configure batch pacing, assign pace admins (optional duty/book split), and confirm pace groups are ready before registration opens. | Must | Meeting · `OD-010` |
| US-GRP-07 | As an admin, I can pull a prepared post from the post library/source and forward it into a pace group. | Must | Meeting · `OD-022` |
| US-GRP-08 | As a member, I can request (or an admin can approve) a move from one pace group to another **within the same batch** — a normal in-batch change, unrelated to removal or reassignment criteria. | Must | Policy |

**Pace-group move (in-batch):** Moving between pace groups inside one batch is
independent of batch removal or cross-batch reassignment. No eligibility criteria
beyond admin approval / normal request flow.

---

## 04 · Daily Reading Tracking

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-RDG-01 | As a member, I can mark today Done. | Must | PRD |
| US-RDG-02 | As a member, I can see Done / Not Done. | Must | PRD |
| US-RDG-03 | As a member, progress updates immediately. | Must | PRD |
| US-RDG-04 | As a pace admin, I can see my members' daily activity on the group dashboard. | Must | Meeting |
| US-RDG-05 | As a member, daily tracking loads in under 2s on mobile. | Must | PRD |

---

## 05 · Reflections & Attendance posts

**Policy:** [`reflections.md`](../domain/reflections.md).

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-REF-01 | As a member, I write personal reflections on Profile (author-only). | Must | Resolved |
| US-REF-02 | As a member, I can write many personal reflections per book. | Must | Resolved |
| US-REF-03 | As a member, in the attendance window I submit a text attendance post to my pace group. | Must | Meeting |
| US-REF-04 | As a member, I can view my personal and posted reflections on Profile. | Must | Resolved |
| US-REF-05 | As a batch member, I can read pace-group posts; I post only to my pace group. | Must | Resolved |
| US-REF-06 | As a member, I can edit/delete my own reflections. | Must | Resolved |
| US-REF-08 | As any website visitor, I can view and react to posted reflections but cannot submit unless I am an active pace-group member. | Must | Meeting · `OD-020` |

---

## 06 · Attendance (Admin) + removal

**Policy:** [`admin-ops.md`](../domain/admin-ops.md).

**Batch removal default:** When a member is removed from a batch (attendance path,
admin action, or auto-remove after misses), the outcome is **full removal** from that
batch. The system does **not** automatically reassign them to a lower/later batch.
Any cross-batch reassignment follows `US-REG-10` / `US-REG-11` in §02.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-ATT-01 | As a pace admin, I can view my group roster for a given attendance window. | Must | Meeting |
| US-ATT-02 | As a pace admin, I see Submitted / Not Submitted per member. | Must | Meeting |
| US-ATT-03 | As a pace admin, I can review attendance (text posts). | Must | Meeting |
| US-ATT-04 | As an admin, attendance views load in under 2s for typical group size. | Must | PRD |
| US-ATT-05 | As the system, I derive attendance from qualifying in-window posts. | Must | Meeting |
| US-ATT-06 | As the system, I block attendance posts after the window unless second-chance is granted. | Must | Meeting |
| US-ATT-07 | As a pace/batch admin, after 3 misses I can outreach and grant grace with a **duration I set**; otherwise the system auto-removes. | Must | Meeting · `OD-021` |
| US-ATT-08 | As a pace admin, I can grant a second chance to submit after the window. | Must | Meeting |
| US-ATT-09 | As an admin, when a member is removed I see that removal as the default outcome; reassignment to a later batch is a separate, criteria-gated step (not implied by removal). | Must | Policy |

---

## 07 · Portfolio & Library

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-LIB-01 | As a member, I can see a book as completed on my portfolio when the schedule completes it for me. | Should | Meeting · `OD-008` |
| US-LIB-02 | As a member, I can open personal reflections linked to a book. | Should | PRD |
| US-LIB-03 | As a member, portfolio data persists. | Should | PRD |
| US-LIB-04 | As a pace group / batch, a book can be marked completed from the group schedule perspective. | Should | Meeting · `OD-008` |

---

## 08 · In-app groups & messaging

**Policy:** App is primary. Per batch: pace group(s), **announcement**,
**discussion**. Telegram optional for some features only (`OD-018`).

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-MSG-01 | As an admin, I can reach any member individually in the app (identity via registration fields). | Must | Meeting |
| US-MSG-02 | As an admin, I can send a group-wide message to each member's personal inbox (in-app; **Telegram bot** may deliver to linked members as an optional bridge). | Must | Meeting |
| US-MSG-03 | As a batch member, I can access in-app **announcement** and **discussion** groups for my batch. | Must | Meeting · `OD-017` |
| US-MSG-04 | As a member, I can use my pace group's in-app feed for tasks and attendance (not dependent on Telegram). | Must | Meeting · `OD-018` |
| US-MSG-05 | As the system, Telegram may still support selected supplementary features without owning core groups — including **bot-mediated intake handoff** and **optional group-message delivery** to linked chat IDs. | Should | Meeting · `OD-018` |

---

## 09 · Admin Operations Shell

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-ADM-01 | As a pace admin, I see dashboard: members, streaks, attendance, review, book(s). | Must | Meeting |
| US-ADM-02 | As an admin, I only see data for batches/groups I am authorized for (super: all). | Must | Meeting |
| US-ADM-03 | As a pace admin, I can cover Reflection, Inspiration, Attendance, and/or Daily post duties as assigned (≥4; more later). | Must | Meeting |
| US-ADM-04 | As a super admin, I can perform any batch or pace admin action. | Must | Meeting |
| US-ADM-05 | As an admin, after a member moves pace groups (in-batch) or is removed/reassigned (cross-batch), I can still view their full prior history — attendance, reflections, and progress — nothing deleted. | Must | Policy |
| US-ADM-06 | As an admin, I can see a log of membership moves: who moved, from where to where, when, and whether a removed member was later reassigned or left for good. | Must | Policy |

**History & audit:** For both in-batch pace-group moves (`US-GRP-08`) and cross-batch
removal/reassignment (`US-REG-10`, `US-REG-11`), prior records remain intact and
viewable. Admins rely on the move log to distinguish reassignment from permanent
departure.

---

## 10 · Notifications

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-NOT-01 | As a member, I receive in-app reminders for daily reading / attendance window. | Should | Meeting |
| US-NOT-02 | As a waitlisted user, I am notified when a seat opens (in-app; Telegram optional). | Should | Meeting · `OD-018` |

---

## 11 · Engagement

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-ENG-01 | As a member, I can see a reading streak. | Should | Meeting |
| US-ENG-02 | As a member, I can see a leaderboard based on likes/reactions. | Should | Meeting |
| US-ENG-03 | As a viewer, I can like/react to reflections. | Should | Meeting |

---

## 12 · Book Catalog & Curriculum

**Policy:** [`curriculum-and-pacing.md`](../domain/curriculum-and-pacing.md).

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-CAT-01 | As a super admin, I add program books; the system auto-assigns the next `sequence_order` (no manual number entry). | Must | Stakeholder |
| US-CAT-07 | As a super admin, I can reorder program books; the system renumbers slots to stay contiguous (no gaps). | Must | Stakeholder |
| US-CAT-02 | As a super admin, I set book metadata (title, cover, language) and may link Am+En pairs. | Must | Stakeholder |
| US-CAT-03 | As a super admin, I attach master curriculum tasks to each book (relative day steps, not calendar dates). | Must | Stakeholder |
| US-CAT-04 | As the system, every new batch starts at catalog sequence 1 without copying book rows. | Must | Stakeholder |
| US-CAT-05 | As a pace admin, when I edit today's page target it affects only my batch + pace group, not other batches or master curriculum. | Must | Stakeholder · `OD-014` |
| US-CAT-06 | As a super admin, I can optionally prefill book metadata from an external lookup (ISBN/title). | Out of V1 | `OD-023` — manual only |

---

## Cross-reference

| Area | Stories |
|------|---------|
| Catalog / curriculum | `US-CAT-*` |
| Intake | `US-REG-01` … `US-REG-12` |
| Groups / posts | `US-GRP-*` |
| Reflections | `US-REF-01` … `US-REF-06`, `US-REF-08` |
| Attendance / removal | `US-ATT-01` … `US-ATT-09` |
| Admin shell | `US-ADM-*` |
| Messaging | `US-MSG-*` |
| Engagement | `US-ENG-*` |
| Membership moves & history | `US-GRP-08`, `US-REG-10` … `US-REG-11`, `US-ADM-05` … `US-ADM-06` |
