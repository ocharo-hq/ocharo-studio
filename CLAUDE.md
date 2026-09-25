# ventures.uzbek-studio

A 3D creative studio for fixed-size Uzbek garments and per-part textile placement on a mannequin.

## Instructions

- Shared wow-two workspace conventions apply; repo-specific scope is in `product/features/studio.md`.
- Open documents only when needed; `.claude/rules/file-references.md` is a lookup table.
- Current implementation is a foundation, not a completed 3D editor.
- Product code lives under `engineering/codebase/`.
- Preserve source photos, generated studies, and authored 3D assets as distinct provenance classes.
- Treat supplied garment photographs as references, never as proof of hidden geometry or fit.
- Keep sizing, length editing, freeform construction, and decoration editing out of the initial release.
- Garment definitions own selectable parts and built-in attachments; never expose arbitrary attachment creation.
- The developer makes the initial commit. Subsequent ordinary local auto commits are authorized after that milestone,
  subject to an active native turn-scoped commit grant. Never push or amend.
- Keep required runtimes in managed terminal sessions and verify readiness before sharing their URLs.

## Layout

- `product/`: scope, features, flows, and business context.
- `engineering/codebase/uzbek-studio.backend-services/`: `UzbekStudio.BackendServices.slnx` and Clean Architecture projects.
- `engineering/codebase/uzbek-studio.frontend-services/`: React and Vite application.
- `engineering/architecture/`: implementation contracts.
- `engineering/planning/`: implementation prompt, status, and verification.

Conventions: the enclosing `wow-two-ws/conventions/` directory.
