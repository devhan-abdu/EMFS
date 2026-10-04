# GitNexus Engineering Plan

> Task: Split the batch-admin overview into focused routes and make its summary actionable.
> Evidence verified at commit `0d00dde7d2e41de2e4cd6cf85916d958f646d740`; GitNexus index refreshed with `--index-only --pdg`, current at the pinned commit.
> Evidence provenance schema 2; global dirty digest `f320ab5b9ce82bda0996734d7bab5e4e46725c7d0534c0ca3b9382192b4c7eab`; cited-path manifest 42 sorted entries; generated plan `docs/plans/2026-10-04-gitnexus-plan-batch-admin-overview-routes.md` excluded.

## Objective (§1)

Make the batch overview a true overview, move operational tabs to routes, reuse the super-admin lifecycle badge, and expose only real, batch-scoped data/actions.

## Current Behaviour (§2–3)

[verified] `app/admin/b/[batchId]/page.tsx` re-exports `BatchWorkspacePage`, which guards with `requireBatchAccess`, loads batch detail/apps/groups/placement, and renders metrics plus `PaceGroupTabs`.
[verified] Tabs are Groups, Members & placements, Volunteer requests, and Daily tasks & cursors. Volunteer and task panels are mock-only; the Members panel embeds pending moves/history.
[verified] Applications has a page. Groups, Members, singular Move, and History route files are empty. Sidebar points Move Requests to plural `/moves`; Progress and Settings routes do not exist. `/admin` back link returns to the default workspace.
[verified] `StatusBadge`/`deriveBatchStatus` are already used on this overview and super-admin batch list. The overview also shows a super-admin-only Edit batch action.
[verified] Batch layout uses shared `AdminWorkspaceLayout` and `requireBatchAccess`. `batch_daily_tasks`, `daily_progress`, resolver/publish services exist; current `getAdminPaceGroups` progress fields are placeholders. Publish services lack an admin scope wrapper. `batch_breaks` has schema only; member schedule code does not read it. `updateBatchAction` is super-admin-only.

## Findings (§4–5)

[graph] Refreshed EMFS `context("BatchWorkspacePage")` resolves status, tabs, groups, placement, registration, authorization, and data service calls.
[graph] `impact("PaceGroupTabs", upstream, depth 3, include-tests)` is LOW with one direct caller (`BatchWorkspacePage`); source confirms it. `impact("StatusBadge", ...)` is LOW with two callers (overview and platform batch list); preserve it.
[graph] `impact("BatchWorkspacePage")` is UNKNOWN (no resolved caller); source re-export and text search confirm the route caller. Do not treat zero graph callers as unused.
[inferred] Move groups, roster, pending requests, history, tasks, and settings into routes beneath the existing scoped layout; do not duplicate authorization in UI.
PDG query returned a large callgraph-bridge result and was not retained; no statement-level graph claims are used. Source confirms `requireBatchAccess` precedes batch detail and overview data loads.

## Proposed Changes (§6)

- `components/admin/batch-workspace-page.tsx`: retain identity/status, supported metrics, registration control, and quick links; remove tabs, `/admin` back link, and Edit batch.
- `app/admin/b/[batchId]/groups/page.tsx`: render `PaceGroupList` with scoped groups/admin assignments, including archived read-only rows.
- `.../members/page.tsx` + `member-placement-panel.tsx`: roster/placement only; preserve URL filters and remove embedded move panels.
- `.../move/page.tsx`, `.../history/page.tsx`: load and reuse `PendingMoveRequestsPanel`/`MoveHistoryPanel` via batch-scoped server loaders.
- `.../tasks/page.tsx` (new): show next task per group via `resolveTodayTask`, latest published task, and real completion aggregates from tasks/progress.
- New task server actions: begin with required admin guard, verify group belongs to batch with `requireBatchAccessForPaceGroup`, call pioneer/follower publisher, record actor, sanitize failures.
- `.../settings/page.tsx` (new): numeric reading cadence and break CRUD; use new narrow batch-scoped actions, not `updateBatchAction`.
- Break service/action + `getMemberHomeState`: list/create/remove batch or group break ranges and apply confirmed break semantics to schedule calculation.
- `BatchSidebar`: route Move Requests to `/move`, Progress to `/tasks`, Settings & Offsets to `/settings`; retain Groups/Members/Applications links.
- Overview quick actions: Applications, Members, Groups, Move Requests, Tasks, Settings. Show counts only from live scoped queries; reuse `StatusBadge`.

## Implementation Sequence (§7)

1. Implement scoped break CRUD and update member schedule resolution so breaks pause reading-day progression. Keep current numeric cadence model.
2. Build task overview read model and batch/group-guarded publish actions around `resolveTodayTask` and existing publisher services.
3. Expose pending/history loaders; fill Groups, Members, Move, History, Tasks, and Settings routes under shared `AdminWorkspaceLayout`.
4. Make Members roster-only and remove its move/history panels; retain existing mutation guards.
5. Remove `PaceGroupTabs` and mock volunteer/task panels; rebuild concise overview with live stats, status, registration, and route quick actions.
6. Remove Edit batch and `/admin` back link; correct sidebar URLs and unsupported destinations.
7. Add focused overview, break/schedule, task authorization, and route tests; verify batch isolation.

## Test Strategy (§8)

- New `tests/unit/batch-workspace-overview.test.ts`: lifecycle mapping, live counts/links, empty state, no `/admin` back-link or Edit batch action.
- Extend `tests/curriculum-task-creation.test.ts` and `tests/resolve-today-task.test.ts`; test unauthorized user, wrong-batch group, invalid step, duplicate publish, and successful pioneer/follower action.
- Add break tests for batch/group scope, invalid dates, and schedule before/during/after break. Keep numeric cadence validation.
- Retain `tests/unit/move-requests-and-history.test.ts`, `tests/unit/admin-authorization-and-isolation.test.ts`, and `tests/unit/placement-operations.test.ts` coverage for filters, audit scope, and cross-batch isolation.
- Manual: open each sidebar route as assigned/unassigned admins; verify actions stay within batch and light/dark states.
- Commands: `pnpm test -- tests/unit/batch-workspace-overview.test.ts tests/unit/move-requests-and-history.test.ts tests/unit/admin-authorization-and-isolation.test.ts tests/unit/placement-operations.test.ts tests/curriculum-task-creation.test.ts tests/resolve-today-task.test.ts`; `pnpm typecheck`. Refresh stale `.next` route validators before attributing generated-route errors to source.

## Risks and Impact (§9)

- [graph] `PaceGroupTabs` has one direct caller; `StatusBadge` has two and must remain unchanged.
- [verified] Shared layout is the batch scope boundary; preserve action/service checks on every mutation.
- [verified] New task publishers currently lack an admin guard; direct UI invocation would be unsafe.
- [verified] Fake progress/volunteer values must not be presented as live. Breaks currently have no CRUD or scheduling effect.
- [verified] `readingDaysPerWeek` stores a count; a weekday selector requires schema/calendar-engine change. Do not infer weekday semantics from the prototype.

## Implementation Context (§11)

```json
{
  "implementation_context": {
    "task_summary": "Split the batch-admin overview into route-specific workspaces with truthful metrics and scoped task/settings operations.",
    "acceptance_criteria": [
      "Keep overview concise and use StatusBadge consistently.",
      "Move groups, roster, move requests, move history, task management, and settings to dedicated batch routes.",
      "Use live batch-scoped facts, remove mock-only UI, and hide the super-admin batch edit action.",
      "Enforce batch/group authorization on task and settings mutations; honor the agreed break behavior."
    ],
    "evidence_provenance": {
      "schema_version": 2,
      "head_commit": "0d00dde7d2e41de2e4cd6cf85916d958f646d740",
      "generated_plan_path": "docs/plans/2026-10-04-gitnexus-plan-batch-admin-overview-routes.md",
      "global_dirty_digest": {
        "algorithm": "sha256",
        "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
        "value": "f320ab5b9ce82bda0996734d7bab5e4e46725c7d0534c0ca3b9382192b4c7eab"
      },
      "cited_path_manifest": [
        {
          "path": "AGENTS.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:02bd10b1e8ee2a71624fe4f383c82debb9b7b5df641b2c105cf63fb05fdbe1fb",
          "index_digest": "sha256:02bd10b1e8ee2a71624fe4f383c82debb9b7b5df641b2c105cf63fb05fdbe1fb",
          "worktree_digest": "sha256:7582f38c87bc98602a0d093b4f7689e0defee855b03fc07ab8bbab81f9734cf9",
          "untracked_digest": "absent"
        },
        {
          "path": "actions/batch.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d524d9054242f73cafc2b85ae70d4f3dda7b05ca5ff378df063f9b0e6980a354",
          "index_digest": "sha256:d524d9054242f73cafc2b85ae70d4f3dda7b05ca5ff378df063f9b0e6980a354",
          "worktree_digest": "sha256:75c5ec3bd965b1dfd07a76fd0ef812c3545f7a8ff4efdab599e0f61ca8e7faa4",
          "untracked_digest": "absent"
        },
        {
          "path": "actions/daily-progress.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:98439492495c43c64f9015a14dac0d0eb3433280a0ebf9aa699fcd4f9036887e",
          "index_digest": "sha256:98439492495c43c64f9015a14dac0d0eb3433280a0ebf9aa699fcd4f9036887e",
          "worktree_digest": "sha256:98439492495c43c64f9015a14dac0d0eb3433280a0ebf9aa699fcd4f9036887e",
          "untracked_digest": "absent"
        },
        {
          "path": "app/admin/b/[batchId]/applications/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:ae88520e415589bc7db5f72ef17c74a2ec308cb7ed738f4f62ed7252ce3fb875"
        },
        {
          "path": "app/admin/b/[batchId]/groups/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "app/admin/b/[batchId]/history/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "app/admin/b/[batchId]/layout.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:11f69e6bd962485a7784c46096e53083f135a3401c812afa432a0623c2fdad13"
        },
        {
          "path": "app/admin/b/[batchId]/members/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "app/admin/b/[batchId]/move/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "app/admin/b/[batchId]/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:4442fcc8f641137a68dd0005003553629818e862f22296389d0e75007043a6ba"
        },
        {
          "path": "components/admin/StatusBadge.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6d347f1a836e90e20337ba10170edbfbd7a9b69ab6406fb753d8dbf3710ba26e",
          "index_digest": "sha256:6d347f1a836e90e20337ba10170edbfbd7a9b69ab6406fb753d8dbf3710ba26e",
          "worktree_digest": "sha256:6d347f1a836e90e20337ba10170edbfbd7a9b69ab6406fb753d8dbf3710ba26e",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/admin-workspace-layout.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:b2a03452b5f53ba73b753f161cd658134d7e3e00b6501d58f97431b25ce5cdb1"
        },
        {
          "path": "components/admin/batch-workspace-page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:6955c539dde9a1c33b9329bd1203422e2ff8873687585a717ec34ef599a0c7cf"
        },
        {
          "path": "components/admin/pace-groups/daily-task-panel.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a0546a2325fdb6108d798bc2dc267d7e95f37ae2a91e656065a4abc5df3324b0",
          "index_digest": "sha256:a0546a2325fdb6108d798bc2dc267d7e95f37ae2a91e656065a4abc5df3324b0",
          "worktree_digest": "sha256:a0546a2325fdb6108d798bc2dc267d7e95f37ae2a91e656065a4abc5df3324b0",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/member-placement-panel.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:13d5c751973d67d3e4fcb5da45c31e7c2a4d6bd37ab971f5358314d2c3ac100a",
          "index_digest": "sha256:13d5c751973d67d3e4fcb5da45c31e7c2a4d6bd37ab971f5358314d2c3ac100a",
          "worktree_digest": "sha256:13d5c751973d67d3e4fcb5da45c31e7c2a4d6bd37ab971f5358314d2c3ac100a",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/member-placement-secondary-panels.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:609f2956ba30158ef9bc263433370582420b18383a4eb9e1f83511b1835cd315",
          "index_digest": "sha256:609f2956ba30158ef9bc263433370582420b18383a4eb9e1f83511b1835cd315",
          "worktree_digest": "sha256:609f2956ba30158ef9bc263433370582420b18383a4eb9e1f83511b1835cd315",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/move-history-panel.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:82531ac7e40a5c5c90b86dfe5b649d8095b8fc50b0c94ad1d98ff7f5e65fd9af",
          "index_digest": "sha256:82531ac7e40a5c5c90b86dfe5b649d8095b8fc50b0c94ad1d98ff7f5e65fd9af",
          "worktree_digest": "sha256:82531ac7e40a5c5c90b86dfe5b649d8095b8fc50b0c94ad1d98ff7f5e65fd9af",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/pace-group-list.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8c36d42477041fa0d5e03dbb38fd78b9e0977e8b4e5b9dc803ba90fb066f9a8c",
          "index_digest": "sha256:8c36d42477041fa0d5e03dbb38fd78b9e0977e8b4e5b9dc803ba90fb066f9a8c",
          "worktree_digest": "sha256:8c36d42477041fa0d5e03dbb38fd78b9e0977e8b4e5b9dc803ba90fb066f9a8c",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/pace-group-tabs.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:cee2a2f5f5cfe2f61f9013bc9c2286fd021aa0f770613bab73ba58d8b26e22d8",
          "index_digest": "sha256:cee2a2f5f5cfe2f61f9013bc9c2286fd021aa0f770613bab73ba58d8b26e22d8",
          "worktree_digest": "sha256:cee2a2f5f5cfe2f61f9013bc9c2286fd021aa0f770613bab73ba58d8b26e22d8",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/pending-move-requests-panel.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:87a47208d1f32c0457193b1840d392dd2f4a202e591a2464ede7af1f464f4f6a",
          "index_digest": "sha256:87a47208d1f32c0457193b1840d392dd2f4a202e591a2464ede7af1f464f4f6a",
          "worktree_digest": "sha256:87a47208d1f32c0457193b1840d392dd2f4a202e591a2464ede7af1f464f4f6a",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/pace-groups/volunteer-requests-panel.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f6b6f6de16dd81660e2eb33757803f832b6fd4b0a47cb4ccdd4d305779ce689a",
          "index_digest": "sha256:f6b6f6de16dd81660e2eb33757803f832b6fd4b0a47cb4ccdd4d305779ce689a",
          "worktree_digest": "sha256:f6b6f6de16dd81660e2eb33757803f832b6fd4b0a47cb4ccdd4d305779ce689a",
          "untracked_digest": "absent"
        },
        {
          "path": "components/admin/sidebars/BatchSidebar.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:189a0473d219022d005235e7d356063a601b919190f6d2d7c8dce5c0be118310"
        },
        {
          "path": "db/schema/batch_breaks.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:71f5958f877d28d52aa90ef40b2e41577d60a75ab93950dfc652bd767e4028f0",
          "index_digest": "sha256:71f5958f877d28d52aa90ef40b2e41577d60a75ab93950dfc652bd767e4028f0",
          "worktree_digest": "sha256:71f5958f877d28d52aa90ef40b2e41577d60a75ab93950dfc652bd767e4028f0",
          "untracked_digest": "absent"
        },
        {
          "path": "db/schema/batches.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:11103f739ee34d37a20e04bc0c209dc1abc30311bf622927758478b7fbbc972a",
          "index_digest": "sha256:11103f739ee34d37a20e04bc0c209dc1abc30311bf622927758478b7fbbc972a",
          "worktree_digest": "sha256:11103f739ee34d37a20e04bc0c209dc1abc30311bf622927758478b7fbbc972a",
          "untracked_digest": "absent"
        },
        {
          "path": "db/schema/daily-progress.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a9ea402c82577e85f2a38495d01ac9f21e6dbf6061d33ca4035acb548a6b036e",
          "index_digest": "sha256:a9ea402c82577e85f2a38495d01ac9f21e6dbf6061d33ca4035acb548a6b036e",
          "worktree_digest": "sha256:a9ea402c82577e85f2a38495d01ac9f21e6dbf6061d33ca4035acb548a6b036e",
          "untracked_digest": "absent"
        },
        {
          "path": "db/schema/daily-tasks.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:c8d7be001710136c1acc010853c16433b197e50c1714052cac8aa7a0e99581dd",
          "index_digest": "sha256:c8d7be001710136c1acc010853c16433b197e50c1714052cac8aa7a0e99581dd",
          "worktree_digest": "sha256:c8d7be001710136c1acc010853c16433b197e50c1714052cac8aa7a0e99581dd",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/auth/authorize.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7e69f0b3d5736f49dfd30200f667c771bfc0d18c7901d4e47712a87645eddce1",
          "index_digest": "sha256:7e69f0b3d5736f49dfd30200f667c771bfc0d18c7901d4e47712a87645eddce1",
          "worktree_digest": "sha256:085407ed492d7b288f3cdb1e2d46b0d23b54e01a11d68517440cb48c57986c99",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/services/admin.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3e32c1357f099476efbd91f32bf67cbd2c99eeb30b451aed5dd44a50d73d350d",
          "index_digest": "sha256:3e32c1357f099476efbd91f32bf67cbd2c99eeb30b451aed5dd44a50d73d350d",
          "worktree_digest": "sha256:73b4c4a1ab6e3d39e9fce391298a728585f3dd4d326bf564b87d125072fcc616",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/services/batches/batch-detail.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:9f6828f0c65c6f474a91c987a94871b87140b74d3550d68eef65b3da3e8ae709",
          "index_digest": "sha256:9f6828f0c65c6f474a91c987a94871b87140b74d3550d68eef65b3da3e8ae709",
          "worktree_digest": "sha256:9f6828f0c65c6f474a91c987a94871b87140b74d3550d68eef65b3da3e8ae709",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/services/batches/batch-status.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:07d6f44b22d7f67231b4086ded70bc45f67618f54fea797531df098a141718bd",
          "index_digest": "sha256:07d6f44b22d7f67231b4086ded70bc45f67618f54fea797531df098a141718bd",
          "worktree_digest": "sha256:07d6f44b22d7f67231b4086ded70bc45f67618f54fea797531df098a141718bd",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/services/curriculum/publish-follower-task.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:0d1541039aa19a7df7e5953e88f1ee25dcb0e1574ec91e430aaa341f41eea7bd"
        },
        {
          "path": "lib/services/curriculum/publish-pioneer-task.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:7aaa76903c6c2e26d5572cd72c87a69a308b6dc13c45099eb9f2f95e6013e640"
        },
        {
          "path": "lib/services/curriculum/resolve-today-task.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:3b3cb823c3f5982ccb02cdeba4bb5179e2a1924ab139ffe98758c5aeb5856d02"
        },
        {
          "path": "lib/services/daily-progress.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ef3dba4088a2dc454e6651008baa1c89c69fd0173de3922c14dc87159fc273fe",
          "index_digest": "sha256:ef3dba4088a2dc454e6651008baa1c89c69fd0173de3922c14dc87159fc273fe",
          "worktree_digest": "sha256:1fff545855704d056730b4473bf40acbc0375c7e4c6955ba45efbe3908679b9a",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/services/member/get-member-home-state.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8db4575bbc3890d702c61134f9a5a05fa856cbe8d5be4129c69dde7c6513e0aa",
          "index_digest": "sha256:8db4575bbc3890d702c61134f9a5a05fa856cbe8d5be4129c69dde7c6513e0aa",
          "worktree_digest": "sha256:fa27750dc9b48cc4fe4d995afdbf5fe325c7bac6ee31225e83c3f12f0481c37a",
          "untracked_digest": "absent"
        },
        {
          "path": "lib/services/pace-groups/placement.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8409e7d8925fd91184062c52bd26622481d2380c8c8b9d4e8678944a7f6baf7b",
          "index_digest": "sha256:8409e7d8925fd91184062c52bd26622481d2380c8c8b9d4e8678944a7f6baf7b",
          "worktree_digest": "sha256:8409e7d8925fd91184062c52bd26622481d2380c8c8b9d4e8678944a7f6baf7b",
          "untracked_digest": "absent"
        },
        {
          "path": "package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b0d29daa3220c26344578cfd23314f58f5a79765e679bf777bf50c2cc9a5608c",
          "index_digest": "sha256:b0d29daa3220c26344578cfd23314f58f5a79765e679bf777bf50c2cc9a5608c",
          "worktree_digest": "sha256:b0d29daa3220c26344578cfd23314f58f5a79765e679bf777bf50c2cc9a5608c",
          "untracked_digest": "absent"
        },
        {
          "path": "tests/curriculum-task-creation.test.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:9eaf5db96373001168dab067e14ab9e22a20a0049c20f4f25cb8b58479f458b6"
        },
        {
          "path": "tests/resolve-today-task.test.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:727528b4ed895fa80de4c4a5b1612054e6428f171b51790a9446febf0916db50"
        },
        {
          "path": "tests/unit/admin-authorization-and-isolation.test.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6f1d39dfdf5aa6964e5931f66c61dae90f729cc90dd165eacac9ed038a596c3f",
          "index_digest": "sha256:6f1d39dfdf5aa6964e5931f66c61dae90f729cc90dd165eacac9ed038a596c3f",
          "worktree_digest": "sha256:f5239d5cdfd4f8509c5992eb2ec4520b3f0240e322471d0cbf31535d220626ab",
          "untracked_digest": "absent"
        },
        {
          "path": "tests/unit/move-requests-and-history.test.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:0cc53aaaade2c97b3b3c936d0bba9199cc305e7909ec2d855db1c4672925ed0b",
          "index_digest": "sha256:0cc53aaaade2c97b3b3c936d0bba9199cc305e7909ec2d855db1c4672925ed0b",
          "worktree_digest": "sha256:d7b0f3c82e8705bda901e19c08dedcde8d301ed30d64d93856362437fa65fcca",
          "untracked_digest": "absent"
        },
        {
          "path": "tests/unit/placement-operations.test.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:e9fb1f4e30df5cb474ca0e5850d56472784d2445719f3d8c627317fd35ce86ba",
          "index_digest": "sha256:e9fb1f4e30df5cb474ca0e5850d56472784d2445719f3d8c627317fd35ce86ba",
          "worktree_digest": "sha256:b87376265536b24bb0b6d5d49e637c9a81c0da0bf227e9103b8f1b4dc478ef8e",
          "untracked_digest": "absent"
        }
      ]
    },
    "primary_symbols": [
      {
        "symbol": "BatchWorkspacePage",
        "file": "components/admin/batch-workspace-page.tsx",
        "lines": "81-310",
        "role": "Current overview composition and page-local data/auth flow."
      },
      {
        "symbol": "requireBatchAccess",
        "file": "lib/auth/authorize.ts",
        "lines": "144-154",
        "role": "Batch-scoped workspace authorization."
      },
      {
        "symbol": "PaceGroupTabs",
        "file": "components/admin/pace-groups/pace-group-tabs.tsx",
        "lines": "5-31",
        "role": "Current four-tab composition with one caller."
      },
      {
        "symbol": "resolveTodayTask",
        "file": "lib/services/curriculum/resolve-today-task.ts",
        "lines": "1-80",
        "role": "Resolve a group's next shared or pioneer curriculum task."
      }
    ],
    "related_symbols": [
      {
        "symbol": "StatusBadge",
        "relationship": "CALLS",
        "relevance": "Shared with platform batch listing; preserve."
      },
      {
        "symbol": "deriveBatchStatus",
        "relationship": "CALLS",
        "relevance": "Existing status mapping for overview."
      },
      {
        "symbol": "PaceGroupList",
        "relationship": "CALLS",
        "relevance": "Real groups management UI to move to /groups."
      },
      {
        "symbol": "MemberPlacementPanel",
        "relationship": "CALLS",
        "relevance": "Real roster/placement UI to move to /members."
      },
      {
        "symbol": "getPendingMoveRequests",
        "relationship": "CALLS",
        "relevance": "Data source for /move."
      },
      {
        "symbol": "getBatchMoveHistory",
        "relationship": "CALLS",
        "relevance": "Data source for /history."
      },
      {
        "symbol": "createAndPublishPioneerTask",
        "relationship": "CALLS",
        "relevance": "Existing publisher lacks an admin scope wrapper."
      },
      {
        "symbol": "publishFollowerTask",
        "relationship": "CALLS",
        "relevance": "Existing publisher lacks an admin scope wrapper."
      },
      {
        "symbol": "getMemberHomeState",
        "relationship": "CALLS",
        "relevance": "Member schedule path that must honor persisted breaks."
      },
      {
        "symbol": "updateBatchAction",
        "relationship": "CALLS",
        "relevance": "Currently super-admin-only; do not broaden."
      }
    ],
    "execution_path": [
      "/admin/b/[batchId] delegates to shared AdminWorkspaceLayout with batch scope.",
      "BatchWorkspacePage checks requireBatchAccess, loads batch/application/group/placement state, then renders summary and client tabs.",
      "Dedicated route pages remain inside the same scoped layout and reuse existing panels/services.",
      "New task/settings actions validate role and batch/group scope before domain mutations."
    ],
    "pdg_constraints": [
      {
        "description": "PDG query output was not retained; no statement-level dependency claims are made. Preserve source-verified authorization and mutation order.",
        "affected_statements": [
          "components/admin/batch-workspace-page.tsx:85-118",
          "lib/auth/authorize.ts:144-154"
        ],
        "implementation_consequence": "Keep batch scope guard before reading route data and require scoped guards on every new server action."
      }
    ],
    "architectural_patterns": [
      {
        "pattern": "Shared workspace layout provides scope guard and shell.",
        "example_location": "app/admin/b/[batchId]/layout.tsx",
        "usage_guidance": "Add route pages beneath this segment; do not duplicate the shell or remove its guard."
      },
      {
        "pattern": "Server page composes scoped services and passes typed data into existing UI panels.",
        "example_location": "components/admin/pace-groups/member-placement-panel.tsx",
        "usage_guidance": "Reuse current panels and service contracts rather than clone their business logic."
      }
    ],
    "files_to_modify": [
      {
        "file": "components/admin/batch-workspace-page.tsx",
        "symbols": ["BatchWorkspacePage"],
        "intended_change": "Replace embedded tabs with supported overview metrics and quick actions; remove /admin return and super-admin edit link."
      },
      {
        "file": "components/admin/pace-groups/pace-group-tabs.tsx",
        "symbols": ["PaceGroupTabs"],
        "intended_change": "Remove after verifying its sole caller is gone."
      },
      {
        "file": "components/admin/pace-groups/member-placement-panel.tsx",
        "symbols": ["MemberPlacementPanel"],
        "intended_change": "Keep roster and placement responsibilities only."
      },
      {
        "file": "components/admin/pace-groups/member-placement-secondary-panels.tsx",
        "symbols": ["PendingMovesLoader", "MoveHistoryLoader"],
        "intended_change": "Expose/reuse server loaders from dedicated routes."
      },
      {
        "file": "app/admin/b/[batchId]/groups/page.tsx",
        "symbols": [],
        "intended_change": "Render authorized pace group management."
      },
      {
        "file": "app/admin/b/[batchId]/members/page.tsx",
        "symbols": [],
        "intended_change": "Render URL-filtered roster and placement."
      },
      {
        "file": "app/admin/b/[batchId]/move/page.tsx",
        "symbols": [],
        "intended_change": "Render real pending move requests."
      },
      {
        "file": "app/admin/b/[batchId]/history/page.tsx",
        "symbols": [],
        "intended_change": "Render batch-scoped move history."
      },
      {
        "file": "app/admin/b/[batchId]/tasks/page.tsx",
        "symbols": [],
        "intended_change": "Add live task/cursor and completion overview."
      },
      {
        "file": "app/admin/b/[batchId]/settings/page.tsx",
        "symbols": [],
        "intended_change": "Add numeric cadence and break management."
      },
      {
        "file": "components/admin/sidebars/BatchSidebar.tsx",
        "symbols": ["BatchSidebar"],
        "intended_change": "Correct move URL and map Progress/Settings to implemented routes."
      },
      {
        "file": "actions/batch-settings.ts",
        "symbols": [],
        "intended_change": "Add narrow scoped cadence and break actions; avoid updateBatchAction."
      },
      {
        "file": "actions/curriculum-task.ts",
        "symbols": [],
        "intended_change": "Add scoped pioneer/follower publish actions with actor identity and sanitized errors."
      },
      {
        "file": "lib/services/batches/batch-breaks.ts",
        "symbols": [],
        "intended_change": "Add batch/group break CRUD and read model."
      },
      {
        "file": "lib/services/member/get-member-home-state.ts",
        "symbols": ["getMemberHomeState"],
        "intended_change": "Apply persisted breaks to member schedule after semantics are confirmed."
      },
      {
        "file": "lib/services/curriculum/resolve-today-task.ts",
        "symbols": ["resolveTodayTask"],
        "intended_change": "Reuse next-step resolution from batch task workspace."
      },
      {
        "file": "tests/unit/batch-workspace-overview.test.ts",
        "symbols": [],
        "intended_change": "Add overview metric/status/action scenarios."
      },
      {
        "file": "tests/curriculum-task-creation.test.ts",
        "symbols": [],
        "intended_change": "Extend with action authorization and invalid group/step cases."
      },
      {
        "file": "tests/resolve-today-task.test.ts",
        "symbols": [],
        "intended_change": "Add break-aware schedule and fallback scenarios."
      },
      {
        "file": "tests/unit/move-requests-and-history.test.ts",
        "symbols": [],
        "intended_change": "Preserve/query move-history contracts if route loaders change."
      }
    ],
    "tests": [
      {
        "file": "tests/unit/batch-workspace-overview.test.ts",
        "scenarios": [
          "Active/open/draft -> shared status and truthful counts.",
          "No data -> valid empty state and no dead/super-admin links.",
          "Quick action -> correct batch-scoped route."
        ]
      },
      {
        "file": "tests/curriculum-task-creation.test.ts",
        "scenarios": [
          "Assigned admin + valid group -> pioneer/follower publish succeeds.",
          "Unauthorized or wrong-batch group -> rejected before mutation.",
          "Invalid step or duplicate date/day -> sanitized failure."
        ]
      },
      {
        "file": "tests/resolve-today-task.test.ts",
        "scenarios": [
          "Shared step -> correct next step/range.",
          "No shared step -> pioneer range.",
          "Break date -> confirmed pause/shift rule."
        ]
      },
      {
        "file": "tests/unit/move-requests-and-history.test.ts",
        "scenarios": [
          "Pending moves remain batch-scoped.",
          "History remains paginated and batch-scoped."
        ]
      },
      {
        "file": "tests/unit/admin-authorization-and-isolation.test.ts",
        "scenarios": [
          "Cross-batch access remains denied.",
          "Batch-scoped actions cannot mutate another batch."
        ]
      }
    ],
    "verification_commands": [
      "pnpm test tests/unit/batch-workspace-overview.test.ts tests/unit/move-requests-and-history.test.ts tests/unit/admin-authorization-and-isolation.test.ts tests/unit/placement-operations.test.ts tests/curriculum-task-creation.test.ts tests/resolve-today-task.test.ts",
      "pnpm typecheck"
    ],
    "risks": [
      "Task publish helpers currently lack admin authorization wrappers.",
      "Break schema has no CRUD or schedule effect yet.",
      "readingDaysPerWeek is numeric, not selected weekdays.",
      "Existing .next generated validators refer to empty/deleted routes and may need refresh."
    ],
    "assumptions": [
      "Same status card means existing StatusBadge.",
      "Keep numeric readingDaysPerWeek control.",
      "Breaks pause affected groups unless product decides otherwise; verify before implementation."
    ],
    "open_questions": [
      "Should a break pause batchDayNumber progression or only shift dates?",
      "Should batch-wide breaks apply to every group, with optional per-group overrides?"
    ],
    "avoid": [
      "Do not broaden super-admin updateBatchAction to batch admins.",
      "Do not expose mock volunteer approval or preview-only task publishing as live.",
      "Do not treat placeholder admin/currentBook/dayProgress fields as real progress.",
      "Do not add another picker; keep shared workspace switcher and scoped layout.",
      "Do not replace existing batch/group guards with client-only checks."
    ]
  }
}
```

## Assumptions and Open Questions (§12)

- Assumption: “same status card” means the existing `StatusBadge` lifecycle component.
- Confirmed: Breaks pause the affected group’s `batchDayNumber` sequence; batch-wide breaks apply to every group, while group-specific breaks affect only that group.
- Assumption: keep the numeric days-per-week control; selected weekdays are a separate schema/scheduling migration.
- Preserve the shared workspace switcher. No picker or duplicate batch selector in overview.

## Definition of Done (§13)

- Overview has no embedded tabs, mock approvals/publishing, misleading progress placeholders, Edit batch, or `/admin` back link.
- Status is consistent with platform batch list; metrics/actions are live, scoped, and point to valid routes.
- Groups, Members, Move, History, Tasks, and Settings routes work beneath the existing batch guard.
- Task/break mutations enforce role plus batch/group scope; member schedule reflects the agreed break rule.
- Focused tests and typecheck pass with current generated route types.
