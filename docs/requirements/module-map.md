# Module Map & User Stories

Working requirements map for **EMFS Book Shelf**, extracted from
[`../PRD.md`](../PRD.md) (MVP V1 – Consistency System). **This file is the
citable story SSOT.** The PRD remains the narrative product brief.

How to use this file:

- **Story IDs are stable** (`US-REG-01`, `US-RDG-02`, …). Cite them in plans,
  PRs, tests, and reviews instead of paraphrasing scope.
- **Priorities are MoSCoW** (Must / Should / Could).
- **Source** tells provenance: `PRD` (agreed in PRD), `Derived` (needed for a
  coherent production release — confirm if unsure), `Future` (explicitly out of
  MVP V1).
- **Open items** link to [`../domain/open-decisions.md`](../domain/open-decisions.md).
  Do not invent policy.
- **Code status** reflects the repo today. Verify in source before relying on it.

## The spine

Everything connects through the **batch** (cohort isolation) and the **pace
group** (5/10/20/40 pages). The member loop is:

**register → approve → join pace group → daily progress → weekly reflection →
attendance**.

Domains: Identity, Intake, Groups, Reading, Accountability, Library, Platform.

## Module index and code status

| # | Module | Source | MVP V1 | Code status (verified 2026-08-11) |
|---|--------|--------|--------|-----------------------------------|
| 01 | Auth & Identity | Derived | Must | Not started — docs-only scaffold |
| 02 | Registration & Batch Intake | PRD FR-4 | Must | Not started |
| 03 | Pace Groups & Schedules | PRD Group structure | Must | Not started |
| 04 | Daily Reading Tracking | PRD FR-1 | Must | Not started |
| 05 | Reflections | PRD FR-2 | Must | Not started |
| 06 | Attendance (Admin) | PRD FR-3 | Must | Not started |
| 07 | Reading Portfolio & Library | PRD FR-5 + Library | Should (basic) | Not started — FR-5 listed basic; Library semantics open (`OD-008`) |
| 08 | General Group / Communication | PRD Group structure | Could / confirm | Not started — visibility model open (`OD-002`) |
| 09 | Admin Operations Shell | Derived | Must | Not started |
| 10 | Notifications & Reminders | PRD Future work | Future | Out of MVP V1 |
| 11 | Engagement (streaks, leaderboard, reactions) | PRD Future work | Future | Out of MVP V1 |

---

## 01 · Auth & Identity — Derived

**Key users:** Members · Admins  
**Purpose:** Sign-up / sign-in, session, and the app user record that roles attach to.  
**Relates to:** Registration, Admin shell, all authorized actions.  
**Tech note:** Better Auth owns credentials/sessions; the app owns profile + role.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-AUTH-01 | As a user, I can register with email and password so that I have a secure account. | Must | Derived |
| US-AUTH-02 | As a user, I can sign in and stay signed in via a secure HTTP-only session so that I can return daily without re-entering credentials every page. | Must | Derived |
| US-AUTH-03 | As a user, I can sign out so that my session ends on a shared device. | Must | Derived |
| US-AUTH-04 | As the system, I distinguish Better Auth identity from the app profile/role record so that auth and business rules stay separable. | Must | Derived |

---

## 02 · Registration & Batch Intake — PRD FR-4

**Key users:** Members (apply) · Admins (approve)  
**Purpose:** Controlled onboarding into a **batch/session** with open/closed join windows and admin approval.  
**Relates to:** Auth, Pace groups, Admin shell.  
**Open:** `OD-003`, `OD-004`, `OD-005`.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-REG-01 | As a member, I can register for a reading session/batch so that I can request entry. | Must | PRD |
| US-REG-02 | As a member, I see whether joining is open or closed for the current session so that I know if I can apply. | Must | PRD |
| US-REG-03 | As an admin, I can approve or reject a registration request so that only intended members join. | Must | PRD |
| US-REG-04 | As an admin, I can send a group access link after approval so that the member can enter their pace group. | Must | PRD · confirm `OD-005` |
| US-REG-05 | As a member in batch A, I cannot see roster, groups, or content from batch B so that cohorts stay isolated. | Must | PRD · `OD-004` |
| US-REG-06 | As an admin, I can open or close registration for a batch/session so that intake matches the cohort calendar. | Must | PRD · confirm `OD-003` |

> **Confirm:** always-on registration vs batch windows (`OD-003`); exact invite-link behavior (`OD-005`).

---

## 03 · Pace Groups & Schedules — PRD Group structure

**Key users:** Members · Admins  
**Purpose:** Divide members by daily page target (5 / 10 / 20 / 40) with one or more admins and a reading schedule per group.  
**Relates to:** Daily tracking, Reflections, Attendance, Library.  
**Open:** `OD-006`, `OD-010`.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-GRP-01 | As a member, I belong to exactly one pace group in my batch (5/10/20/40 pages) so that my daily target is clear. | Must | PRD |
| US-GRP-02 | As a member, I can view my group's reading schedule so that I know what to read. | Must | PRD |
| US-GRP-03 | As an admin, I can be assigned to one or more pace groups so that I can oversee those members. | Must | PRD · confirm `OD-006` |
| US-GRP-04 | As an admin, I can manage membership of my assigned pace group(s) within my batch so that the roster stays correct. | Must | Derived |
| US-GRP-05 | As an authorized admin, I can create or update a pace group's reading schedule for a batch so that members have a plan. | Must | PRD · confirm `OD-010` |

---

## 04 · Daily Reading Tracking — PRD FR-1

**Key users:** Members · Assigned admins  
**Purpose:** Simple daily Done / Not Done progress against the pace-group page target.  
**Relates to:** Pace groups, Admin visibility, Attendance (indirect).  
**Open:** `OD-007`, `OD-009`.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-RDG-01 | As a member, I can mark today's reading as completed so that my daily status is Done. | Must | PRD |
| US-RDG-02 | As a member, I can see whether today is Done or Not Done so that I know my status. | Must | PRD |
| US-RDG-03 | As a member, when I mark progress, the status updates immediately so that I get fast feedback. | Must | PRD |
| US-RDG-04 | As an assigned admin, I can see my members' daily activity so that I can coach accountability. | Must | PRD · confirm `OD-007` |
| US-RDG-05 | As a member, the daily tracking screen loads in under 2 seconds on a typical mobile connection so that the habit stays frictionless. | Must | PRD |

---

## 05 · Reflections — PRD FR-2

**Key users:** Members · Admins (view per policy)  
**Purpose:** Store reflections; exactly one designated submission counts toward weekly attendance.  
**Relates to:** Attendance, Portfolio, General group (visibility).  
**Open:** `OD-001`, `OD-002`, `OD-009`.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-REF-01 | As a member, I can submit a reflection linked to my current book so that my thinking is recorded. | Must | PRD |
| US-REF-02 | As a member, I can write more than one reflection per book over time so that daily/weekly notes are allowed. | Must | PRD · confirm `OD-001` |
| US-REF-03 | As a member, I can designate (or the system designates) one reflection that counts for this week's attendance so that only one counts. | Must | PRD · confirm `OD-001` |
| US-REF-04 | As a member, I can view my past reflections with timestamps so that I can revisit them. | Must | PRD |
| US-REF-05 | As a permitted viewer (per policy), I can see reflections I am allowed to see so that accountability/visibility works as designed. | Must | PRD · confirm `OD-002` |

---

## 06 · Attendance (Admin) — PRD FR-3

**Key users:** Admins  
**Purpose:** Automated weekly attendance from the designated reflection submission.  
**Relates to:** Reflections, Pace groups, Admin shell.  
**Open:** `OD-001`, `OD-009`.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-ATT-01 | As an admin, I can view all members in my scope for a given week so that I see the roster. | Must | PRD |
| US-ATT-02 | As an admin, I see each member marked Submitted or Not Submitted for the week so that I can spot inactive members quickly. | Must | PRD |
| US-ATT-03 | As an admin, I can view a weekly attendance summary so that I can report consistency. | Must | PRD |
| US-ATT-04 | As an admin, the attendance view loads in under 2 seconds for a typical group size so that ops stay efficient. | Must | PRD |
| US-ATT-05 | As the system, I derive attendance from the single counted reflection for the week so that admins do not track manually. | Must | PRD |

---

## 07 · Reading Portfolio & Library — PRD FR-5 + Library

**Key users:** Members · (optional) Admins  
**Purpose:** Long-term record of completed books and linked reflections; Library stores completed/read books for the community or batch.  
**Relates to:** Reflections, Pace groups.  
**Open:** `OD-008`.  
**MVP note:** PRD lists FR-5 as basic; MVP V1 feature list emphasizes FR-1–FR-4. Ship a minimal personal portfolio if capacity allows; do not block Consistency System on full Library.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-LIB-01 | As a member, I can view my completed books so that I see personal growth. | Should | PRD |
| US-LIB-02 | As a member, I can open reflections linked to a completed book so that history stays connected. | Should | PRD |
| US-LIB-03 | As a member, my portfolio data persists across sessions so that history is not lost. | Should | PRD |
| US-LIB-04 | As a member, I can browse the Library of completed/read books for my batch (once policy is set) so that shared reading history is visible. | Could | PRD · confirm `OD-008` |

---

## 08 · General Group / Communication — PRD Group structure

**Key users:** Members · Admins  
**Purpose:** A space for all members in a batch to communicate.  
**Open:** `OD-002` (Discord-like vs simpler).  
**MVP note:** Do not build chat infrastructure until `OD-002` is answered. Stubbable as announcements-only.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-GEN-01 | As a member, I can access the General group for my batch so that I can see shared communication. | Could | PRD · confirm `OD-002` |
| US-GEN-02 | As an admin, I can post to the General group so that I can announce schedule or discipline notes. | Could | Derived · confirm `OD-002` |

---

## 09 · Admin Operations Shell — Derived

**Key users:** Admins  
**Purpose:** Navigation and queues for approval, attendance, member activity, and group management.  
**Relates to:** All admin stories.

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-ADM-01 | As an admin, I land in an admin shell with links to approvals, attendance, and my pace groups so that I can operate the cohort. | Must | Derived |
| US-ADM-02 | As an admin, I only see data for batches/groups I am authorized for so that isolation and least privilege hold. | Must | Derived · `OD-004`, `OD-006` |

---

## 10 · Notifications & Reminders — Future

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-NOT-01 | As a member, I receive reminders to mark daily reading or submit the weekly reflection so that consistency improves. | Could | Future |
| US-NOT-02 | As a member, I receive a notification when my registration is approved so that I know I can join. | Should | Future / Derived |

---

## 11 · Engagement extras — Future

| ID | User story | Priority | Source |
|----|-----------|----------|--------|
| US-ENG-01 | As a member, I can see a reading streak so that I stay motivated. | Could | Future |
| US-ENG-02 | As a member, I can see a leaderboard so that peer visibility motivates me. | Could | Future |
| US-ENG-03 | As a member, I can react to reflections (like/comment) so that peers encourage each other. | Could | Future |

---

## Cross-reference: PRD feature → modules

| PRD | Modules | Must-ship stories (MVP V1) |
|-----|---------|----------------------------|
| FR-1 | 04 | `US-RDG-01` … `US-RDG-05` |
| FR-2 | 05 | `US-REF-01` … `US-REF-05` (policy via OD-001/002) |
| FR-3 | 06 | `US-ATT-01` … `US-ATT-05` |
| FR-4 | 02, 03 | `US-REG-*`, `US-GRP-*` |
| FR-5 | 07 | `US-LIB-01` … `US-LIB-03` (Should) |
| Auth / shell | 01, 09 | `US-AUTH-*`, `US-ADM-*` |
