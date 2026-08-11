# Requirements Folder Notes

`module-map.md` is the **only citable requirements source** in this directory for
story IDs and MoSCoW priority.

Supporting product narrative lives in [`../PRD.md`](../PRD.md). Domain truths
(glossary, roles, lifecycles, journeys, open decisions) live in
[`../domain/`](../domain/).

How to use:

- Cite stable story IDs (`US-REG-01`, `US-RDG-02`, …) in plans, PRs, and tests.
- If the PRD and module map disagree, reconcile into the module map and record
  any unresolved policy in [`../domain/open-decisions.md`](../domain/open-decisions.md).
- Do **not** invent answers for rows marked *confirm* or linked to an `OD-XXX`.
