# ventures.ocharo-studio — Product Context

*Last updated: 2026-10-20*

> Current state changes often. Durable product definition: `product.md`.

## Current state

The agreed first-release scope is implemented locally after initial commit `323b2ed`. The running WebGL studio includes
one silhouette mannequin, five garment interpretations, per-part materials and anchored texture placement, SQLite-backed
per-browser workspaces with local recovery, JSON and PNG export, and responsive controls. Final automated checks and
human validation remain tracked in planning and verification.

## Active tasks

| Task | Status | Notes |
|---|---|---|
| Define durable product and engineering scope | Complete | Requirements, architecture, provenance, and implementation handoff are documented. |
| Complete the nimcha creation workflow | In verification | Editing, durable save/reopen, and export exist locally. |
| Prepare usable textile assets | In verification | The generated catalogue preserves material source and provenance metadata. |
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
- 2026-09-26 — Persist state in SQLite by browser-generated workspace UUID with local recovery and optimistic revisions; the UUID grants no account or authorization identity.
- 2026-09-25 — Support portable JSON transfer and preview-image export.
- 2026-09-25 — Target a desktop editor with responsive compact controls as an implementation default.
- 2026-09-25 — Keep overlays and size or length controls in future scope.
- 2026-09-25 — Exclude ordering, pricing, checkout, CAD, sewing-pattern, and exact-replica promises.
- 2026-09-25 — Allow generated texture imagery and optional Blender asset authoring while separating source, generated, and authored asset provenance.
- 2026-09-26 — Replace the dress form with a faceless figure after the catalogue model and remodel all five garments in Blender; the reusable 3D library lives in Maftuna's workspace (`assets/3d/ocharo-garments/`) and the studio syncs copies.
- 2026-09-27 — Make the brand silhouette (cream dress form over an ivory skirt) the studio's garment holder; the catalogue-model figure, the model girl, moves to the later final-render feature.
- 2026-09-28 — Add Studio render (print-size PNGs on the silhouette or the model) and physically based cloth shading; build the high-definition model girl in Blender with MPFB2 once its downloads are approved.
- 2026-10-20 — Wear the Ocharo workspace frame: the SDK `ocharo` theme replaces Studio's palette; one 56px top bar with the app button and the account menu, a Designer/Materials sidebar collapsed to an icon rail by default, and no frame bottom bar on phones. Studio stays English-only for this rollout.

## Version ownership

The active plan is `engineering/planning/version-track/v0.1/v0.1.md`; future work is in `engineering/planning/backlog.md`. Existing implementation and historical local checks do not constitute a product release or manual acceptance. Preserved pre-consolidation notes are evidence only; current authenticated contracts and source take precedence.
