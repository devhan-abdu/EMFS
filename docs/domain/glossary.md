# Domain Glossary

Canonical business terms for EMFS Book Shelf. This file owns **what a term
means**. Once code exists, add a **Code anchor** column pointing at schema or
lib paths.

Read with:

- [`../requirements/module-map.md`](../requirements/module-map.md)
- [`batch-and-intake.md`](./batch-and-intake.md)
- [`admin-ops.md`](./admin-ops.md)
- [`roles-and-permissions.md`](./roles-and-permissions.md)
- [`lifecycles.md`](./lifecycles.md)
- [`open-decisions.md`](./open-decisions.md)

## Terms

| Term                           | Meaning                                                                                                                                                                                                            | Not this                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Better Auth user**           | Identity account for sign-in, session, and password ownership.                                                                                                                                                     | Not the app profile/role used for group membership.  |
| **App user**                   | Application person record: profile fields, role(s), batch membership.                                                                                                                                              | Not a pace group; not a reflection.                  |
| **Member**                     | App user in an active pace group (reads, reflects, marks daily progress).                                                                                                                                          | Not automatically an admin.                          |
| **Admin**                      | Generic operator. Prefer `pace_admin`, `batch_admin`, or `super_admin`.                                                                                                                                            | Not a single flat permission.                        |
| **Pace admin**                 | Group admin for one or more pace groups; may post without being a reading member. Duties include Reflection, Inspiration, Attendance, Daily post (≥4; more later).                                                 | Not batch-wide intake owner.                         |
| **Book catalog**               | Global sequenced library of books + metadata (title, cover, language). Super admin only.                                                                                                                           | Not a batch-owned copy.                              |
| **Master curriculum**          | Shared tasks tied to catalog books (`day_number` relative steps). Super admin content.                                                                                                                             | Not a calendar date; not per-batch.                  |
| **Batch admin**                | 1–3 per batch: registration, pace groups, batch pacing setup, pace-admin assignment, optional manual review only when `auto_approve = false`.                                                                      | Not system-wide boss; does not create catalog books. |
| **Super admin**                | Book catalog + curriculum; assign batch admins; create batches (capacity, pace-group count, start/pacing); can do all batch + pace actions.                                                                        | Not limited to one batch.                            |
| **Batch**                      | Cohort with `max_members`, `registration_open`, `auto_approve`, waiting list, pace groups (**≥1**; may be only one pace), books. Ops data isolated across batches.                                                 | Not a pace group; not a login session.               |
| **Pace group**                 | Subdivision inside a batch by daily page target (5/10/20/40). A batch may have only one.                                                                                                                           | Not the batch.                                       |
| **Waiting list**               | Queue for next batch and/or when a full batch has a seat open.                                                                                                                                                     | Not active membership.                               |
| **Reading schedule**           | Batch pacing config + per–pace-group page cursor; drives auto **draft** daily posts. See [`curriculum-and-pacing.md`](./curriculum-and-pacing.md).                                                                 | Not Done/Not Done; not a duplicated yearly calendar. |
| **Daily progress**             | Per-member Done / Not Done for the calendar day.                                                                                                                                                                   | Not attendance.                                      |
| **Daily task post**            | System proposes today’s pages **per pace group** → admin approves +/- → system advances **that group’s** cursor. Edits do not change other batches or master curriculum. May **forward from post library/source**. | Not member attendance.                               |
| **Post library / source**      | Place where prepared posts live so admins can forward into pace groups (`OD-022`).                                                                                                                                 | Not a live member chat; not another group’s roster.  |
| **Inspiration**                | Pace-admin duty / content type.                                                                                                                                                                                    | Not member personal notes.                           |
| **Profile page**               | Personal reflections + portfolio; **author-only**.                                                                                                                                                                 | Not Groups page.                                     |
| **Groups page**                | Pace group feeds; batch read; member post in own group (attendance window).                                                                                                                                        | Not personal notes.                                  |
| **Personal reflection**        | Private Profile note; never attendance.                                                                                                                                                                            | Not group post.                                      |
| **Attendance post**            | In-window **text** submission that counts for attendance.                                                                                                                                                          | Not daily Done; not voice/AI (out of MVP).           |
| **Attendance**                 | Submitted / Not Submitted for the window; drives miss count and removal.                                                                                                                                           | Not daily progress.                                  |
| **Miss streak**                | Count of missed attendance windows; **3** triggers outreach → grace → auto-remove.                                                                                                                                 | Not daily Not Done alone.                            |
| **Batch removal**              | Member leaves a batch (admin action, auto-remove after misses, etc.). Default outcome; **not** an automatic move to a later batch.                                                                                 | Not cross-batch reassignment.                        |
| **Cross-batch reassignment**   | Removed member joins a **later/lower** batch when admin-set criteria are met and they are invited or re-register. Opt-in; removal does not guarantee it.                                                           | Not waitlist seat fill in the same batch.            |
| **Pace-group move (in-batch)** | Member changes pace group within the **same** batch via normal request/approval. Unrelated to removal or reassignment criteria.                                                                                    | Not batch removal.                                   |
| **Membership move log**        | Admin-auditable record: who moved, from/to, when; whether a removed member was reassigned or left for good. Prior history stays viewable.                                                                          | Not deletion of attendance/reflections/progress.     |
| **Second chance**              | Explicit permission to submit attendance after the window closes.                                                                                                                                                  | Not default late submit.                             |
| **Access handoff**             | After approval: system issues a handoff code; member links via the **Telegram bot** (code in `start` payload); bot records `telegram_chat_id` and activates membership. No manual admin DM in MVP.                 | Not auto-blasting the Telegram group invite link.    |
| **Telegram bot**               | System integration for intake linking (`code` → verify → activate) and optional delivery of batch/group messages to linked members.                                                                                | Not the primary in-app group home (`OD-018`).        |
| **Leaderboard**                | Ranking by likes/reactions on reflections.                                                                                                                                                                         | Not attendance score alone.                          |
| **Non-batch / public visitor** | Anyone who visits the website; may view/react to posted reflections; cannot submit (`OD-020`).                                                                                                                     | Not an active pace-group member.                     |
| **Discussion group**           | **In-app** batch surface for member discussion (`OD-017`, `OD-018`).                                                                                                                                               | Not announcements; not Telegram-as-source-of-truth.  |
| **Announcement group**         | **In-app** batch surface for official announcements.                                                                                                                                                               | Not discussion.                                      |
| **Pace group (in-app)**        | In-app feed for that pace group’s tasks and attendance posts.                                                                                                                                                      | Not only a Telegram chat.                            |
| **Library**                    | Completed books — **member** portfolio and **group** schedule perspectives (`OD-008`).                                                                                                                             | Not Groups feed alone.                               |
| **Portfolio**                  | Profile history of books + personal reflections.                                                                                                                                                                   | Not Groups feed.                                     |
| **Open decision**              | Unresolved question in `open-decisions.md`.                                                                                                                                                                        | Not a silent code guess.                             |

## Language rules

- Use **batch** + **pace group**; never “session” for cohort.
- Admin / intake / attendance policy → [`admin-ops.md`](./admin-ops.md).
- Reflections → [`reflections.md`](./reflections.md).
- Batch intake → [`batch-and-intake.md`](./batch-and-intake.md).
- Book catalog & pacing → [`curriculum-and-pacing.md`](./curriculum-and-pacing.md).
