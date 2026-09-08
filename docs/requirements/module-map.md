# Module Map & User Stories

Working requirements map for **EMFS Book Shelf**. **Citable story SSOT.**

Open items → [`../domain/open-decisions.md`](../domain/open-decisions.md).  
Admin/intake policy → [`../domain/admin-ops.md`](../domain/admin-ops.md),
[`../domain/batch-and-intake.md`](../domain/batch-and-intake.md).

## The spine

**catalog setup → assign batch admins → create batch → open registration →
register → approve (auto or manual) → bot handoff code → Telegram bot link → active batch member →
create/assign pace groups → place member → daily progress →
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
| US-REG-01 | As a member, I can apply to a batch with name, email, Telegram username, phone, and pace preference when the batch has selectable pace groups. | Must | Meeting |
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

**Policy:** Registration may open once the batch is created, its registration
settings/capacity/start date/pacing are valid, and one to three batch admins are
assigned. Pace groups and pace admins are optional before registration. Batch
membership and pace-group membership are separate: an accepted member is active
in the batch while awaiting placement when no active pace-group membership exists.

Until placement, the member sees: **“You are accepted into this batch. Your pace
group will be assigned soon.”** Schedule, daily Done tracking, pace-group
attendance/reflection submission, and the pace-group feed remain unavailable.

Recommended placement status on batch membership: `awaiting_placement` or
`assigned`. Keep the batch membership `active`; do not overload `active` to mean
that a pace-group membership exists.

### 03.1 — Pace-group data and authorization foundation
**[Assignee: group-data]**

- Add pace-group configuration: batch, name, daily page pace, active status, and current page cursor for each book/edition context.
- Add pace-admin assignment records with optional duties: daily task, reflection, inspiration, and attendance; allow one admin on multiple groups and multiple admins per group.
- Add optional assigned-book scope for a pace admin when duties are split by book.
- Enforce one active pace-group membership per member within the same batch.
- Add membership-move audit records containing member, old group, new group, reason, actor, and time.
- Add local daily-task records scoped to `batch + pace_group + schedule_date`, with final page range, status (`draft`, `published`), reusable-task reference, and publishing admin.
- Enforce one daily task per pace group per date and prevent duplicate page-cursor advancement during retries.
- Create reviewed reversible Drizzle migrations and indexes for roster, task, schedule, and dashboard queries.

Do not create copied catalog books or copied reusable task content per batch.

**Goal:** Give every pace group its own members, admins, cursor, and daily
operational records while preserving batch isolation.

Stories: `US-GRP-01`, `US-GRP-03`, `US-GRP-04`, `US-GRP-05`, `US-GRP-08`.

### 03.2 — Pace-group setup and pace-admin assignment
**[Assignee: group-setup]**

- Build the authorized batch-admin/super-admin flow to create, edit, archive, and list pace groups inside a batch.
- Validate that every group has a name and valid configured pace, such as 5, 10, 20, or 40 pages per day.
- Enforce the batch’s planned pace-group count unless an authorized admin deliberately updates the batch plan.
- Assign one or more pace admins to each group.
- Allow optional duty and book assignments without requiring every admin to have every duty.
- Show group readiness status: groups created, pace admins assigned, and daily-task owner available. Group readiness must not gate registration.
- Support a volunteer request visible to batch members, member applications, and batch-admin review/confirmation before granting a pace-admin assignment.
- Never grant pace-admin permissions automatically when a member volunteers.
- Prevent batch admins from viewing or changing groups outside their assigned batches.
- Build mobile-ready, accessible forms using the project form/action rules.

Do not allow batch admins to edit global catalog books or reusable shared task content.

**Goal:** Let a batch admin finish group setup confidently before or after registration opens.

Stories: `US-GRP-03`, `US-GRP-04`, `US-GRP-06`.

### 03.3 — Pace-group placement and in-batch move workflow
**[Assignee: group-membership]**

- Support an accepted active batch member with no active pace-group membership and an explicit `awaiting_placement` status.
- Place a member into exactly one pace group in their active batch, individually or through a confirmed bulk action.
- Show pace preference only when selectable groups existed at application time; preference is advisory, not automatic placement.
- Build member requests and batch-admin approval/rejection for in-batch group changes.
- Allow an authorized batch admin or super admin to move a member directly when operationally necessary.
- Keep batch membership active during a normal group move.
- Close the old group membership, create the new one, and write the move audit record in one transaction.
- Preserve old daily progress, reflections, and attendance history; never rewrite it to the new group.
- Ensure a move does not alter any other member’s membership or group cursor.
- Provide a confirmed bulk action such as “Place all unassigned active members into 10-page group”; create an audit record for every member.

Do not use this workflow for removal or cross-batch reassignment.

**Goal:** Members can move between groups without losing history or being treated as removed.

Stories: `US-GRP-01`, `US-GRP-08`, `US-ADM-05`, `US-ADM-06`.

### 03.4 — Today’s page-target generator and local task publishing
**[Assignee: daily-task-engine]**

- Read the batch’s current catalog book from the shared schedule service and the pace group’s last saved page cursor.
- Generate the next page-range suggestion using the group’s configured pace; for example, cursor 8 and pace 10 proposes pages 9–18.
- Let the assigned pace admin approve the suggestion or increase/decrease the final range. An authorized batch admin may publish when no pace admin is assigned.
- Save the final page range and advance only that pace group’s cursor after publishing.
- Refuse generation when the batch has not started, the curriculum is exhausted, no book is available, or today already has a published task.
- Make retries idempotent so duplicate submissions cannot create tasks or skip pages.
- Use the product timezone and calendar dates, not server-clock timestamps.

**Goal:** The system proposes each group’s next range while authorized admins retain control of the final task.

Stories: `US-GRP-05`, `US-CAT-05`, `OD-014`.

### 03.5 — Reusable task selection and pace-group publishing
**[Assignee: task-reuse]**

- Match reusable task content to the current catalog book and reading step/range; attach it to the local task when found.
- If no content exists, allow a local draft and optionally publish its content into the reusable library for later batches.
- Keep reusable content separate from the local final page range.
- Preserve the task version/reference used at publish time so historic tasks do not change when reusable content is edited.
- Initially support the structure for image, quote, topic, and short description even if the full editor comes later.
- Enforce pace-admin book/group scope and batch isolation on every read and write.

Do not share a local daily task record between batches. Only reusable content is shared.

**Goal:** Useful task content can be reused without sharing cursors, members, or local changes.

Stories: `US-GRP-07`, `OD-022`.

### 03.6 — Member and admin schedule views
**[Assignee: schedule-web]**

- Build member and authorized-admin schedule views with today’s published task, page range, current book, and next task when available.
- Show explicit states for awaiting placement, before batch start, no published task, rest/unscheduled day, exhausted curriculum, empty group, and server error.
- Ensure members see only their active pace group and batch; pace admins only assigned groups; batch admins only assigned batches; super admins all batches.
- Make the member schedule mobile-first and fast enough for daily reading.
- Use pagination or explicit caps for historical task lists.

Do not show another batch’s roster, cursor, or unpublished daily tasks to normal members.

**Goal:** Everyone sees the correct schedule for their authorized group without cross-batch data leakage.

Stories: `US-GRP-02`, `US-GRP-05`.

### 03.7 — Pace-group release verification
**[Assignee: groups-quality]**

- Test role allow/deny cases for member, pace admin, batch admin, and super admin.
- Test group creation, known-user assignment, volunteer application/approval, placement, bulk placement, moves, and history preservation.
- Test one active group per member per batch and the awaiting-placement state.
- Test page-range generation, admin adjustment, cursor advancement, duplicate-submit protection, and exhausted-book behavior.
- Test two groups with different paces and two batches using the same reusable task source.
- Prove a cursor/task update in one group cannot affect any other group or batch.
- Add end-to-end coverage: batch setup → registration opens without groups → member activated/unassigned → groups/admins assigned → member placed → daily task published → member can view it.
- Run the required lint, type, test, and verification gates.

**Goal:** Release Module 03 as one reliable flow, not separate setup and task screens.

---

## 04 · Daily Reading Tracking

### 04.1 — Daily progress data and secure service
**[Assignee: reading-progress-data]**

You own the persisted daily reading-progress record and its server-side workflow.

Your tasks:

- Add a daily progress record linked to the member, batch, pace group, and local published daily task.
- Store a `done`/`not_done` state and timestamps needed for operational history.
- Enforce one progress record per member per daily task.
- Implement an idempotent toggle/set service: marking Done twice must not create duplicates.
- Permit a member to change Done back to Not Done when product policy allows.
- Require active batch membership and active pace-group membership on every mutation.
- Verify the task belongs to the member’s current authorized group and is published for the relevant date.
- Use the server session as the actor; never accept a client-provided member ID.
- Add indexes for a member’s Today view and a pace-admin group activity view.

Do not use daily reading progress as attendance. Attendance comes from qualifying
text posts in Module 05/06.

**Goal:** Persist a trustworthy answer to: “Did this member complete today’s assigned reading task?”

Stories: `US-RDG-01`, `US-RDG-02`, `US-RDG-03`.

### 04.2 — Member “Today” reading experience
**[Assignee: member-today-web]**

You own the mobile member screen for viewing today’s task and marking it Done.

Your tasks:

- Build the authenticated Today screen using the group’s published local daily task.
- Show current book, cover when available, final assigned page range, optional topic/content, and Done/Not Done status.
- Provide one accessible native form action to mark Done or Not Done.
- Update the visible status immediately after a successful action and revalidate the authoritative server state.
- Prevent duplicate submissions while an action is pending.
- Show useful states: no active batch, not yet placed in a group, before batch start, no task published today, and task already completed.
- Keep the screen mobile-first and designed for normal low-bandwidth phone use.
- Meet the under-two-second typical-load target through efficient server reads, targeted indexes, and lightweight UI.

Do not let members mark progress for another member, another date, another group,
or an unpublished task.

**Goal:** A member can open the app, understand today’s pages, and mark completion with one dependable action.

Stories: `US-RDG-01`, `US-RDG-02`, `US-RDG-03`, `US-RDG-05`.

### 04.3 — Edition-aware progress rules
**[Assignee: reading-editions]**

You own the rule that members in the same pace group may read different language editions of the same program book.

Your tasks:

- Persist or retrieve each member’s assigned reading edition for the current program slot.
- Ensure a member reads one edition only for a task; never require both Amharic and English pages.
- Keep the pace group on one shared curriculum day and one shared daily topic/task.
- Display the member’s correct edition title, cover, and page range where editions have different pagination.
- Ensure a member’s Done state means completion of their own edition’s assigned pages.
- Allow authorized admin assignment/correction of an edition without changing the shared group curriculum day.
- Add tests for mixed-language members in one group and for edition changes that must not affect other members.

**Goal:** English and Amharic readers can stay in one pace group and follow the same topic/calendar while reading the correct pages in their own book edition.

Stories: `US-RDG-01`, `US-RDG-02`, `OD-015`.

### 04.4 — Pace-admin daily activity dashboard
**[Assignee: progress-dashboard]**

You own the group-level daily reading activity view for pace admins.

Your tasks:

- Build an authorized group dashboard for the selected date/task.
- Show each active member’s Done/Not Done status, completion time when available, and correct reading edition.
- Provide summaries such as completed count and remaining count without relying on incomplete client-loaded data.
- Support pagination for larger rosters and clear loading, empty, and error states.
- Let pace admins access only their assigned groups; batch admins only groups in assigned batches; super admins all.
- Preserve history after a member changes pace group: historical progress remains tied to the old daily task/group.
- Keep attendance status separate from reading progress; do not label Not Done as an attendance miss.

**Goal:** Pace admins can see who completed today’s reading without exposing another group’s members or confusing reading with attendance.

Stories: `US-RDG-04`, `US-ADM-01`, `US-ADM-02`.

### 04.5 — Daily progress performance, reliability, and test coverage
**[Assignee: progress-quality]**

You own release verification for Module 04.

Your tasks:

- Add unit tests for Done/Not Done transitions, idempotency, duplicate requests, and authorization failures.
- Add tests for active/inactive/removed/grace membership behavior.
- Test that a member cannot mutate another member’s progress or progress for another batch/group.
- Test that progress cannot be recorded for unpublished, expired, or nonexistent daily tasks.
- Test mixed Amharic/English edition behavior.
- Add end-to-end coverage: published group task → member opens Today → marks Done → pace admin sees the update.
- Measure and address the mobile Today load target for a typical active member.
- Verify no unbounded roster/history reads and no internal error details are exposed to users.

**Goal:** Make daily reading tracking quick, secure, and dependable enough to become the habit-forming core of the product.

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
