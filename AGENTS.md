# AGENTS.md — Frontend rules for this repo

Any AI coding agent (Claude Code, Cursor, Copilot, etc.) working in this
repo must follow these rules without exception.

## Colors

- NEVER hardcode hex/rgb/hsl values in component code.
- ONLY use semantic tokens: bg-primary, text-secondary, border-border, etc.
- These tokens are defined once in app/globals.css and MUST NOT be
  duplicated or overridden per-component.

## Spacing

- ONLY use even-numbered Tailwind spacing utilities (p-2, p-4, p-6, p-8,
  gap-2, gap-4...). NEVER odd values (p-1, p-3, p-5) or arbitrary values
  (p-[13px]).

## Typography

- Headings (h1-h4) automatically use font-heading ( Text) via
  globals.css — do not manually add font-heading to heading tags.
- Body/UI text uses font-sans (Inter) by default — do not override per
  component.
- Use only the existing Tailwind text-{size} scale. Do not introduce new
  font sizes.

## Components

- shadcn primitives live in components/ui/ — NEVER hand-edit these files
  except for token-level fixes. If a shadcn component needs new behavior,
  wrap it in components/shared/, don't fork the primitive.
- Any new interactive component with visual variants MUST use CVA
  (class-variance-authority), matching the pattern in
  components/ui/button.tsx. Never write conditional className strings
  inline (e.g. variant === 'x' ? '...' : '...').
- Feature-specific components go in components/features/<epic-name>/,
  matching the project's Linear epic names.

## Dark mode

- Every component must be checked in both light and dark mode before
  being considered done. Toggling the `dark` class on <html> is the
  test — if any text or icon becomes low-contrast or invisible, it's
  not done.
- Never write a `dark:` prefixed utility class manually — dark mode is
  handled entirely by the CSS variable swap in globals.css. If you find
  yourself writing dark:bg-something, that's a signal the base token
  usage is wrong, not that a dark: override is needed.

## Server actions & forms

- All admin-only actions MUST call requireRole(...) as the first line,
  before any input parsing.
- Forms MUST use useActionState + native <form action={...}> — not
  manual onSubmit + useState for pending/error state.

## Before marking any UI task done

1. Confirm zero hardcoded colors (grep for `#` or `rgb(` in the diff).
2. Confirm zero odd-numbered spacing values.
3. Confirm dark mode was actually toggled and checked, not assumed.
4. Confirm shadcn components were used where one exists — don't
   hand-roll an <input> or <button> from scratch.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **EMFS** (1774 symbols, 2886 relationships, 68 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/EMFS/context` | Codebase overview, check index freshness |
| `gitnexus://repo/EMFS/clusters` | All functional areas |
| `gitnexus://repo/EMFS/processes` | All execution flows |
| `gitnexus://repo/EMFS/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
