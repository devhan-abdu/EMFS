# Lifecycles

Legal state transitions for EMFS Book Shelf. **Never invent a transition** that
is not listed here. Link open policy to [`open-decisions.md`](./open-decisions.md).

## Registration / membership

**Stories:** `US-REG-*` · [`batch-and-intake.md`](./batch-and-intake.md) · [`admin-ops.md`](./admin-ops.md)

| State | Meaning |
| --- | --- |
| `waitlisted` | Interested; next batch and/or batch full |
| `applied` | Applied while registration open; awaiting decision |
| `approved` | Approved; contact+code handoff; awaiting Telegram join / activation |
| `rejected` | Rejected; not in cohort |
| `active` | In a pace group; may track/read/attend |
| `grace` | After 3 misses + valid reason; extension **duration set by admin** (`OD-021`) |
| `removed` | Removed (ops or auto after misses); seat may open for waitlist |

### Allowed transitions

```txt
(none) -> waitlisted                 # closed reg or full batch
waitlisted -> applied                # when registration opens / invited
(none) -> applied                    # open registration + under capacity
applied -> approved
applied -> rejected
approved -> active                   # after handoff + join
active -> grace                      # after 3 misses + admin grants grace
active -> removed                    # admin remove or auto-remove path
grace -> active                      # resumes compliance
grace -> removed                     # no response / continued misses
waitlisted -> active                 # seat opened; offered and accepted
```

- `registration_open` and `max_members` are batch properties.
- Post-approval: **contact + code**, not direct link blast.

## Daily progress

**Stories:** `US-RDG-*` · timezone: `OD-009`

| State | Meaning |
| --- | --- |
| `not_done` | Default for the calendar day |
| `done` | Member marked complete |

```txt
not_done -> done
done -> not_done
```

## Reflection / attendance post

**Policy:** [`reflections.md`](./reflections.md)

| State | Meaning |
| --- | --- |
| `private` | Profile personal note |
| `posted_to_group` | Group attendance post (**text**) |
| `held_draft` | Pace-admin daily task draft held before publish |

```txt
(none) -> private
(none) -> posted_to_group            # in attendance window or second-chance
private -> posted_to_group
private -> private | (deleted)
posted_to_group -> posted_to_group | (deleted)
(none) -> held_draft -> published    # admin daily task path
```

- Late member attendance posts **blocked** without second-chance.
- **No** voice upload or AI content check in MVP.

## Weekly attendance

| State | Meaning |
| --- | --- |
| `not_submitted` | No qualifying post in window |
| `submitted` | Qualifying text post accepted |

```txt
not_submitted -> submitted
submitted -> not_submitted           # delete / invalidate
```

- Three `not_submitted` windows → miss path in [`admin-ops.md`](./admin-ops.md).

## Book / library completion

**Stories:** `US-LIB-*` · `OD-008` answered — schedule-based.

| State | Meaning |
| --- | --- |
| `in_progress` | Currently on the reading schedule |
| `completed_member` | Completed for the member’s portfolio |
| `completed_group` | Completed for the pace group / batch schedule |

```txt
in_progress -> completed_member
in_progress -> completed_group
```

Both perspectives may apply when the plan finishes.

## Interim rules

- Prefer fewer states; add only when workflow needs them.
- Side effects (attendance, removal, waitlist seat fill) run in services,
  same transaction as the triggering write when dependent.
