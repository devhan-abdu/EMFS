# User Journeys

Policies: [`batch-and-intake.md`](./batch-and-intake.md), [`admin-ops.md`](./admin-ops.md),
[`curriculum-and-pacing.md`](./curriculum-and-pacing.md), [`reflections.md`](./reflections.md).

## Journey 0: Super admin — catalog → batch → ready for intake

1. Create **book catalog** entries in sequence (book 1, 2, …) with title, cover,
   language; link Am+En pairs when needed.
2. Attach **master curriculum tasks** to each book.
3. **Assign 1–3 batch admins** to the new batch.
4. **Create batch** (capacity, pace-group count, start date, pacing).
5. Batch admin creates pace groups, assigns pace admins, confirms pacing.
6. Batch admin **opens registration** — member intake begins (Journey 1).

---

## Journey 1: Register → approve → bot handoff → active

1. Apply to open batch (name, email, Telegram, phone, pace preference) or
   **waiting list**.
2. **Approved** — automatically when `auto_approve = true` and capacity remains
   (first-come-first-served), or by batch admin when `auto_approve = false`.
3. Member receives **handoff code** in app → opens **Telegram bot** with code →
   bot links identity and activates membership → **active** in pace group.

**Open:** none for channel ownership (`OD-018` answered). Telegram bot handles
intake linking; in-app groups remain the primary home for reading ops.

---

## Journey 2: Daily reading + page target

1. System resolves **today’s curriculum step** for the batch (from start date +
   pacing + master library).
2. System proposes **today’s page target per pace group** (5/10/20/40 + cursor).
3. Pace admin **approves** and may **+/- pages** — only this group’s cursor moves.
4. Optional: forward prepared post from **post library/source** (`OD-022`).
5. Member marks Done for **their** edition (Am **or** En) — same curriculum day as the group (`OD-015`).

**Open:** `OD-009` timezone.

---

## Journey 3: Attendance window

1. Personal notes anytime on Profile.
2. In window, member submits **text** attendance to own pace group.
3. Late blocked unless second chance.
4. 3 misses → outreach → admin grants **grace with duration they set**, or
   auto-remove (**full removal** from batch — not auto-reassignment); waitlist
   may fill the **same-batch** seat.

**Open:** `OD-009`.

---

## Journey 3b: Removal, reassignment, and pace-group moves

1. **Batch removal (default):** Member is fully removed from the batch. System
   does **not** automatically place them in a later batch.
2. **Cross-batch reassignment (opt-in):** Only if the member meets admin-set
   criteria **and** (a) a batch admin directly invites them, or (b) they
   re-register through normal intake for that later batch.
3. **In-batch pace-group move:** Member or admin requests a move between pace
   groups in the **same** batch — normal ops, not tied to removal criteria.
4. **Admin view:** Full prior history (attendance, reflections, progress) remains
   viewable; move log shows from/to, when, and reassignment vs permanent
   departure.

Policy: [`admin-ops.md`](./admin-ops.md) · Stories: `US-REG-10` … `US-REG-11`,
`US-GRP-08`, `US-ADM-05` … `US-ADM-06`.

---

## Journey 4: Pace admin review

Dashboard: members, streaks, attendance, book(s). Batch admin sees rollup;
batch admin owns batch pacing setup. Super can do all.

---

## Journey 5: Engagement

**Anyone on the website** can view/react to posted reflections; only members
submit (`OD-020`). Leaderboard by likes/reactions.

---

## Journey 6: Completed books

Schedule finishes → **member** portfolio completion and **group** schedule
completion (`OD-008`).
