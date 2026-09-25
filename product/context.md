# ventures.uzbek-studio — Product Context

*Last updated: 2026-09-25*

> Current state changes often. Durable product definition: `product.md`.

## Current state

The agreed first-release scope is implemented locally after initial commit `323b2ed`. The running WebGL studio includes
one mannequin, five garment interpretations, per-part materials and texture placement, local saved looks, JSON and PNG
export, and responsive controls. Final automated checks and human validation remain tracked in planning and verification.

## Active tasks

| Task | Status | Notes |
|---|---|---|
| Define durable product and engineering scope | Complete | Requirements, architecture, provenance, and implementation handoff are documented. |
| Complete the nimcha creation workflow | In verification | The complete local workflow and authored interpretation asset exist. |
| Prepare usable textile assets | In verification | Four generated textures and six solid materials preserve explicit provenance. |
| Add remaining catalogue families | In verification | `baska`, `kostyum`, `korset`, and `abaya` use the shared asset contract. |
| Validate the creative workflow | Planned | Observe comprehension, visual usefulness, and saved-look continuity with a selected test user. |

## Open questions

- Which catalogue references should anchor fidelity review of the authored garment interpretations?
- Which exact preview image views and resolutions are most useful to creative users?
- What visual fidelity and browser performance thresholds should gate wider use?
- Which family should receive the first post-validation asset refinement?

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
