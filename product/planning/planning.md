# ventures.uzbek-studio — Product Planning

*Last updated: 2026-09-25*

> Product milestones and roadmap. Engineering delivery detail: `../../engineering/planning/planning.md`.

Targets remain sequence-based until delivery dates are agreed.

## Milestones

| Milestone | Target | Status | Definition of done |
|---|---|---|---|
| M0 — Product foundation | Before implementation | Complete | Product boundary, experience contract, provenance rules, architecture, handoff, and initial commit `323b2ed` are established. |
| M1 — Complete nimcha workflow | First product slice | In verification | The local implementation covers select, per-part material editing, texture positioning, inspection, undo/redo, save, reopen, JSON export, and preview export. Human and cross-browser acceptance remain. |
| M2 — Catalogue family coverage | After M1 validation | In progress | Interpretation assets and family-specific parts exist for `baska`, `kostyum`, `korset`, and `abaya`; fidelity and complete workflow acceptance remain. |
| M3 — Designer validation | After family coverage | Planned | A test user can create, save, reopen, and share useful looks; observed friction and fidelity findings are recorded and prioritized. |
| M4 — Extension decisions | After validation | Planned | Evidence determines whether decorative overlays, size controls, or length controls deserve separately scoped product work. |

## Product backlog

- Review the authored nimcha interpretation against the selected catalogue reference and document its fidelity boundaries.
- Validate current garment meshes, material regions, UV mapping, and built-in attachments with a test user.
- Review the initial textile library and its source or generated provenance with a test user.
- Validate save/reopen and portable JSON compatibility across asset revisions.
- Define useful preview export views and image quality with a test user.
- Test large-icon comprehension, part selection clarity, and texture-versus-camera control separation.
- Validate the remaining family interpretations one at a time after the nimcha contract is proven.
- Record fidelity and performance thresholds using real assets rather than placeholder geometry.

## Current evidence

- build-mode TypeScript and focused studio-state tests pass locally.
- automated browser scenarios cover the main creation loop, family controls, export, import rejection, responsive layout, and theme switching.
- no broad manual QA, assistive-technology review, cross-browser sign-off, or Maftuna validation is recorded yet.

## Release gates

- A family name alone does not count as support; a usable authored asset must complete the full workflow.
- Generated studies cannot be presented as source photography or exact construction evidence.
- A preview export does not satisfy persistence; an editable look must reopen successfully.
- No milestone may imply production fit, sewing-pattern validity, ordering, pricing, or exact photographic replication.
