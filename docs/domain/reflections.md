# Reflections (resolved policy)

Canonical rules for personal and group reflections / attendance posts.
See also [`admin-ops.md`](./admin-ops.md).

**Still open:** attendance clock (`OD-009`).

**Out of MVP:** voice attendance, AI-generated-content detection (`OD-019` dropped).

## Two member surfaces

| Surface | Content | Who reads | Who writes |
| --- | --- | --- | --- |
| **Profile page** | Personal reflections | **Author only** | Author only |
| **Groups page** | Pace group feeds | **Anyone on the website** (view/react) | **Pace group members** in attendance window |

## Personal reflection (Profile)

- Many notes, any day; `private`; never attendance.
- No admin may read another member’s personal notes.

## Attendance / group post (MVP = text)

- Submit **text** inside the attendance window (`OD-009`).
- After window: blocked unless **second chance**.
- One counted submission per member per window.
- Author may edit/delete per policy.

## Visibility & engagement (`OD-020`)

- **Any website visitor** may view and react to posted reflections.
- Only active pace-group members may submit attendance/reflections to a group.
- Leaderboard by likes/reactions.

## Admin-side content

Pace admins publish daily task (system target → +/- pages → next day),
inspiration, etc. Prepared content comes from a **post library / source** and
is **forwarded** into the pace group (`OD-022`).

## Attendance linkage

```txt
In-window text attendance post
  → weekly attendance = submitted

Miss window (no second chance)
  → not_submitted → miss streak → removal path (admin-ops)
```

## Enforcement checklist

1. `private` → author only.
2. Attendance create → pace-group member + window (or second-chance).
3. Public/visitor → view/react OK; create attendance/reflection denied.
4. No voice/AI pipeline in MVP.
