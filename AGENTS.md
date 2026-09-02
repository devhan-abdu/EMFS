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
