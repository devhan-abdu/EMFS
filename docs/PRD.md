# EMFS Book Shelf – Product Requirements Document

## Objective

### What we want to do

Build a mobile-first web platform that supports structured reading groups by
enabling:

- Daily reading tracking
- Weekly reflection submission
- Attendance tracking
- Member engagement and visibility

### Why we want to do it

Current system (Telegram-based) has limitations:

- No clear progress tracking
- Reflections get lost in chat
- Attendance tracking is manual
- Low visibility reduces motivation

### Who needs it

- Reading group members
- Pace (group) admins, batch admins, and super admins
- Telegram remains optional for some features; **groups live in the app**

### Vision

Create a system where reading becomes consistent, structured, and visible,
helping members grow and stay accountable.

**Domain policy SSOTs:** [`domain/admin-ops.md`](./domain/admin-ops.md),
[`domain/batch-and-intake.md`](./domain/batch-and-intake.md),
[`domain/reflections.md`](./domain/reflections.md).

## Goals (first 30–60 days)

- 80% of members submit weekly reflections
- 60% of members maintain consistent reading activity
- Reduce admin attendance tracking effort by 70%

## Initiatives

- Structured reading workflow
- Weekly accountability system
- Admin visibility tools

## Personas

### Member

- Reads daily based on assigned pages
- Writes private Profile reflections; submits **text** attendance in window
- Needs motivation and structure (streaks, leaderboard)

### Pace admin (group admin)

- Approves daily page target (+/- pages); system advances next day
- Duties may split: Reflection / Inspiration / Attendance / Daily post (≥4)
- Reviews attendance, streaks; may coach after misses
- May post/forward prepared content without being a reading member of the batch

### Batch admin (1–3 per batch)

- Opens registration **after** pace groups and pace admins are ready
- Creates pace groups (batch may have only one); assigns pace admins; batch
  pacing setup; approvals
- Oversees intake; members complete **Telegram bot handoff** after approval
- Does **not** create global catalog books

### Super admin

- **Book catalog** + master curriculum (sequenced books, metadata, tasks)
- Assigns batch admins; creates batches (capacity, pace-group count, start/pacing)
- Can perform all batch and pace admin actions

## Group structure

- **Batch** = cohort with max capacity, registration window, waiting list, books
- Members in **pace groups** (5/10/20/40); a batch may have **only one** pace group
- Multiple pace admins; duties/books can split; admins may be reused; prepared
  posts come from a **post library** and are forwarded into pace groups
- **Anyone on the website** can view/react to posted reflections (not submit)
- Grace after 3 misses: **duration set by admin**
- **Removal** from a batch is full removal by default; **cross-batch reassignment**
  is criteria-gated (admin invite or re-registration) — not automatic
- Members may **move pace groups within a batch**; prior history and an admin
  move log are preserved (`US-REG-10` … `US-ADM-06` in module map)
- **Discussion** + **announcement** groups **in the app** per batch; pace-group
  feeds in-app (`OD-017`, `OD-018`). Telegram may still be used for some
  supplementary features only.
- Library: member + group completion from schedule

## Features

### FR-1: Daily reading tracking

**Description.** Members track daily reading progress based on their assigned
group pages.

**User goal.** Track daily reading completion.

**Pain point.** No clear way to track daily progress.

**Solution.** Provide a simple daily progress tracking system.

**Acceptance criteria**

- User can mark daily reading as completed
- System shows daily status (Done / Not Done)
- Progress updates instantly
- Page loads in under 2 seconds
- The member activity must be shown to assigned admin

### FR-2: Reflections & weekly attendance post

**Description.** Members write personal reflections on Profile; post to their
pace group on Groups page for weekly attendance.

**User goal.** Record private thinking daily; share one post per week for
accountability.

**Pain point.** Reflections are scattered and visibility is unclear.

**Solution.** Profile page for personal notes; Groups page for pace-group posts
that drive attendance.

**Acceptance criteria** — see [`domain/reflections.md`](./domain/reflections.md):

- Personal reflections any day on Profile (author-only)
- Attendance in a day/time window as **text** (no voice/AI in MVP)
- Late posts blocked unless second chance
- Batch members and **any website visitor** can read posted reflections;
  only pace members submit (`OD-020`)
- Edit/delete own reflections; leaderboard by likes/reactions

### FR-3: Attendance tracking (admin)

**Description.** Pace admins review attendance; enforce window; remove after
3 misses (outreach → grace → auto-remove). See [`domain/admin-ops.md`](./domain/admin-ops.md).

**User goal (admin).** Spot inactive members and keep the cohort healthy.

**Pain point.** Manual Telegram tracking and hard-to-identify inactive joiners.

**Solution.** Derived attendance + dashboards + removal workflow.

**Acceptance criteria**

- Dashboard: roster, Submitted/Not Submitted, streaks, book(s)
- Window enforcement + second chance
- 3 misses → outreach → grace (**admin sets duration**) or **full removal** from batch (not auto-reassignment to a later batch); same-batch seat may fill from waiting list
- Loads in under 2 seconds for typical group size

### FR-4: User registration & batch joining

**Description.** Apply to a **batch** with required fields; per-batch registration;
capacity + waiting list; `auto_approve` toggle for instant first-come-first-served
approval; post-approval **Telegram bot handoff** before active membership.
See [`domain/batch-and-intake.md`](./domain/batch-and-intake.md).

**User goal.** Join a reading batch and pace group with reachable identity.

**Pain point.** Many join Telegram but never activate; usernames hard to track.

**Solution.** Rich registration fields + bot-mediated handoff + waiting list.

**Acceptance criteria**

- Fields: name, email, Telegram username, phone, pace preference
- Registration open/closed per batch; max members and `auto_approve` set by super admin
- Waiting list for next batch / seat opens
- Auto-approve (`auto_approve = true`): default product path — instant approval at submission when capacity remains (transaction-safe row lock)
- Manual approve (`auto_approve = false`): supported fallback for admin-reviewed batches; batch admin reviews `applied` applicants only in that mode
- Approve → handoff code → member links Telegram bot → membership activated
- Hard isolation of batch ops data

### FR-5: Reading portfolio (basic)

**Description.** Users can see their completed books and reflections.

**User goal.** Track personal growth.

**Pain point.** No long-term record.

**Solution.** Simple personal reading history.

**Acceptance criteria**

- User can view completed books
- Reflections linked to books
- Data persists over time

## Release plan

### Release name

MVP V1 – Consistency System

### Timeline

Estimated duration: 2–4 weeks  
Start date: To be confirmed

### Features included

- FR-1: Daily Reading Tracking
- FR-2: Weekly Reflection
- FR-3: Attendance Tracking
- FR-4: Registration & Group Joining

### Milestones

1. UI Design
2. Backend Setup
3. Core Feature Development
4. Testing & Deployment

## Dependencies

- Authentication system
- Database
- Hosting environment

## User flow

1. Super admin creates batch (capacity, `auto_approve`, pace groups, books); batch admin opens registration
2. User applies (name, email, Telegram, phone, pace preference) or joins waiting list
3. Approved (auto when `auto_approve = true`, else batch admin) → handoff code → Telegram bot link → active
4. Pace admin approves daily pages (+/-); member marks Done in their edition (Am or En)
5. Member submits **text** attendance in window; admin reviews
6. After 3 misses: outreach → grace or full removal from batch (reassignment to a later batch is separate, criteria-gated); same-batch seat may open for waitlist
7. Reactions / leaderboard; completed books (member + group schedule)

## Analytics

### Hypothesis

Weekly structured reflection and visible tracking will increase reading
consistency.

### Success metrics

- Weekly reflection submission rate
- Daily activity rate
- Attendance completion rate

## Future work

- Streak system
- Leaderboard
- Reflection reactions (likes/votes)
- Notifications/reminders
- Mobile app version
