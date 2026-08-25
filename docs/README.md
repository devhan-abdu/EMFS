# EMFS Book Shelf Documentation

Developer documentation for **EMFS Book Shelf** — a mobile-first reading-group
tracking web app built with Next.js, pnpm, Drizzle, PostgreSQL, and Better Auth.

If you are new to the project, read in this order:

1. [Root README](../README.md) for local setup
2. [Onboarding](./ONBOARDING.md) for the beginner runbook
3. [Architecture](./ARCHITECTURE.md) and [Folder Structure](./FOLDER_STRUCTURE.md)
4. [Development Rules](./DEVELOPMENT_RULES.md)
5. [Module Map & User Stories](./requirements/module-map.md)

## Contents

| Doc | What it covers |
| --- | --- |
| [Onboarding](./ONBOARDING.md) | How a new teammate gets oriented and runs the project locally. |
| [PRD](./PRD.md) | Product brief: goals, personas, FR-* features, MVP scope. |
| [Module Map & User Stories](./requirements/module-map.md) | **Citable story SSOT** (`US-*`), MoSCoW, module index, code status. |
| [Tech Stack](./TECH_STACK.md) | Chosen stack and one-line rationale per choice. |
| [Architecture](./ARCHITECTURE.md) | App Router layout, Server Actions, Drizzle, Better Auth flow. |
| [Folder Structure](./FOLDER_STRUCTURE.md) | Proposed Next.js App Router directories and ownership. |
| [Development Rules](./DEVELOPMENT_RULES.md) | Non-negotiable gates, definition of done, review checklist. |
| [Testing](./TESTING.md) | TDD workflow with Vitest + Playwright. |

## Domain truths

Use `docs/domain/*` for what is true about the business:

| Doc | What it covers |
| --- | --- |
| [Glossary](./domain/glossary.md) | Canonical term meanings (batch, pace group, attendance, …). |
| [Roles & Permissions](./domain/roles-and-permissions.md) | Who may do what; object-level isolation rules. |
| [Lifecycles](./domain/lifecycles.md) | Legal state transitions — never invent one. |
| [Batch & intake](./domain/batch-and-intake.md) | **Resolved** batch, registration, capacity, waitlist, handoff. |
| [Admin ops](./domain/admin-ops.md) | **Resolved** roles, duties, in-app groups, attendance removal. |
| [Reflections](./domain/reflections.md) | **Resolved** Profile vs Groups; text attendance (no voice/AI). |
| [User Journeys](./domain/user-journeys.md) | Spine flows, failure recovery, linked open decisions. |
| [Data Model](./domain/data-model.md) | Planned aggregates before/while schema lands. |
| [Open Decisions](./domain/open-decisions.md) | Remaining open items only — do not guess. |
| [Curriculum & pacing](./domain/curriculum-and-pacing.md) | Book catalog, master curriculum, batch pacing, today's task scoping. |

## Requirements

- [Module Map](./requirements/module-map.md) — only citable story source
- [Requirements notes](./requirements/README.md) — provenance
- [PRD](./PRD.md) — narrative product brief (cite stories via module map)

## Apps at a glance

| Surface | Tech | Audience | Dev URL |
| --- | --- | --- | --- |
| Web app | Next.js App Router, shadcn/ui, Tailwind | Members & admins | http://localhost:3000 |
| Database | PostgreSQL + Drizzle | — | Neon / Supabase |
| Auth | Better Auth | — | `/api/auth/*` |
| Hosting | Vercel | — | production |

## Setup docs

- [Root README](../README.md) - install, env, Docker, and first run
- [Onboarding](./ONBOARDING.md) - beginner-friendly local setup and workflow
- [Development Rules](./DEVELOPMENT_RULES.md) - required engineering rules

## Reference

- [Development Rules](./DEVELOPMENT_RULES.md)
- [Architecture](./ARCHITECTURE.md)
- [Testing](./TESTING.md)
