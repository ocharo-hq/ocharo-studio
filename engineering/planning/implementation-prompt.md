# Implementation prompt

*Last updated: 2026-09-25*

> Archived foundation brief. The implementation described below now exists after initial commit `323b2ed`.
> Do not reuse this prompt as current status. See [planning](planning.md) and [verification](verification.md).

---

Build Uzbek Studio into a working 3D web creative studio using the existing wow-two venture foundation.
Read `CLAUDE.md`, `product/features/studio.md`, `engineering/architecture/architecture.md`,
and `engineering/research/catalogue-evidence.md`. Follow the enclosing workspace conventions.
Inspect the initial commit and existing changes before editing; preserve other work.

The user designs and saves Uzbek clothing looks on a mannequin. Use real, rotatable 3D garment meshes,
not flat garment images presented as 3D. Garments are authored in one fixed size for the same mannequin.
Start with a complete nimcha workflow and extend the asset system to baska, kostyum, korset, and abaya.
Use Maftuna's v22 catalogue and canonical product media as visual references, preserving their provenance.
Catalogue images do not establish hidden geometry or physical fit. Blender is permitted for asset authoring,
and image generation is permitted for seamless textile textures; inspect every generated asset.

A garment loads with one click, including its predefined category-specific buttons, side ties, and knots.
Each category defines selectable parts such as body panels, collar, sleeves, or borders where applicable.
Click a part and apply a material with one click. Provide texture rotation and horizontal/vertical offsets
to align the pattern in that part's UV space. These controls change the texture, not the garment's position.
Part edits must remain independent, including when multiple parts initially share a material.
Attachments are built into each garment; do not add an arbitrary attachment-placement tool.

Use a spacious 3D stage with a floating cloud/island layout: left menu/library, contextual top toolbar,
large intuitive icons, obvious selection states, and controls that adapt to the selected garment, part,
or editing stage. Provide camera orbit/zoom/reset, undo/redo, and useful loading/error states.
Prioritize a desktop editor with responsive compact controls.
Save and reopen editable looks; use versioned local design documents with JSON import/export and preview image export
as the first persistence approach. Keep asset/material identifiers and per-part transforms in saved state.

Exclude size/length/silhouette editing, freeform construction, decorative material overlays, arbitrary buttons or knots,
physical cloth simulation, sewing-pattern export, commerce, and account flows from this first build.
Decorations and sizing are later features. Avoid placeholder geometry that cannot read as the garment category.
Keep authored source or reproducible asset-generation scripts and apply binary/LFS rules before staging large assets.

Complete the product through actual browser and runtime verification: loading a garment also loads the right attachments;
all declared parts can be selected; applying, rotating, or offsetting one part leaves others unchanged;
camera movement never changes design values; undo/redo and save/reopen preserve edits; unknown assets or invalid imports
fail clearly; generated textures and meshes render without obvious seams, clipping, or mannequin intersections.
Run relevant builds and focused tests, own required runtimes in managed terminals, and report evidence accurately.

The developer owns the first commit. After confirming that commit exists, the user authorizes ordinary local automatic
commits for verified cohesive batches. Activate the native repository/turn commit grant where supported; do not bypass
a denied or unavailable grant. Never push, amend, rewrite history, publish, or modify Maftuna's source workspace.
Keep implementation progress in the repository planning documents.
