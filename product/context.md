# ventures.uzbek-studio — Product Context

*Last updated: 2026-09-25*

> Current state changes often. Durable product definition: `product.md`.

## Current state

Requirements for the first studio slice are confirmed and the repository foundation exists. Product and engineering specifications are documented; the 3D studio, garment meshes, textures, persistence, and exports are not yet implemented. The developer owns the repository's first commit before implementation continues.

## Active tasks

| Task | Status | Notes |
|---|---|---|
| Define durable product and engineering scope | Complete | Requirements, architecture, provenance, and implementation handoff are documented. |
| Complete the nimcha creation workflow | Planned | First executable product slice, including an authored nimcha asset. |
| Prepare usable textile assets | Planned | Generated textures are allowed; provenance must remain explicit. |
| Add remaining catalogue families | Planned | Add `baska`, `kostyum`, `korset`, and `abaya` through the proven asset contract. |
| Validate the creative workflow | Planned | Observe comprehension, visual usefulness, and saved-look continuity with a selected test user. |

## Open questions

- Which nimcha design should become the first authored 3D reference asset?
- Which source-backed or generated textiles should ship in the initial material library?
- Which exact preview image views and resolutions are most useful to creative users?
- What visual fidelity and browser performance thresholds are acceptable after the first real asset is loaded?
- Which remaining family should follow nimcha after the asset workflow is proven?

These questions refine delivery; they do not block the confirmed product model.

## Decisions

- 2026-09-25 — Build a creative 3D web studio centred on a mannequin and fixed authored garments.
- 2026-09-25 — Start with the complete nimcha workflow, then add the other four catalogue families through the same garment contract.
- 2026-09-25 — Let each garment declare selectable parts and built-in attachments; attachments load automatically and are never freely addable.
- 2026-09-25 — Treat texture rotation and U/V offsets as pattern placement, distinct from camera orbit.
- 2026-09-25 — Preserve editable looks locally by default, support portable JSON, and export preview images. These persistence and export choices are implementation defaults rather than user-selected technology decisions.
- 2026-09-25 — Target a desktop editor with responsive compact controls as an implementation default.
- 2026-09-25 — Keep overlays and size or length controls in future scope.
- 2026-09-25 — Exclude ordering, pricing, checkout, CAD, sewing-pattern, and exact-replica promises.
- 2026-09-25 — Allow generated texture imagery and optional Blender asset authoring while separating source, generated, and authored asset provenance.
