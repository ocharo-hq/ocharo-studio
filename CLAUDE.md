# ocharo-studio

A 3D creative studio for fixed-size Uzbek garments and per-part textile placement on a mannequin.

## Instructions

- Shared wow-two workspace conventions apply; repo-specific scope is in `product/features/studio.md`.
- Open documents only when needed; `.claude/rules/file-references.md` is a lookup table.
- Current implementation is a working local 3D editor; verification status lives in `engineering/research/previous-work/verification.md`.
- Product code lives under `engineering/codebase/`.
- Preserve source photos, generated studies, and authored 3D assets as distinct provenance classes.
- Treat supplied garment photographs as references, never as proof of hidden geometry or fit.
- Keep sizing, length editing, freeform construction, and decoration editing out of the initial release.
- Garment definitions own selectable parts and built-in attachments; never expose arbitrary attachment creation.
- The developer's initial commit is `323b2ed`. Ordinary commits follow the persistent repository commit switch.
  Verification is recorded in `engineering/research/previous-work/verification.md`; native per-repository flags govern ordinary commits and pushes. Amend remains forbidden.
- Keep required runtimes in managed terminal sessions and verify readiness before sharing their URLs.

## Layout

- `product/`: scope, features, flows, and business context.
- `engineering/codebase/ocharo-studio.backend-services/`: `OcharoStudio.BackendServices.slnx` and Clean Architecture projects.
- `engineering/codebase/ocharo-studio.frontend-services/`: Vue 3 and Vite application.

- `engineering/architecture/`: implementation contracts.
- `engineering/planning/`: implementation prompt, status, and verification.

The frontend framework is Vue 3 with TypeScript and the Vue SDK (`@wow-two-beta/fe`).
The Three.js renderer stays framework-independent.

Workspace guidance: [Ocharo](../../CLAUDE.md) and [WoW2](../../../../../../../CLAUDE.md).
Conventions: [WoW2 convention index](../../../../../../../conventions/conventions.md).

## Canonical planning

Use `engineering/planning/backlog.md` and `engineering/planning/version-track/v0.1/v0.1.md`. Previous-work research notes preserve evidence only. Working rules are in `engineering/development/rules.md`; convention verification and open integration gaps are in `engineering/research/convention-audit.md`.
