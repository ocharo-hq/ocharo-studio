# Ocharo Studio logic and next features

> Preserved pre-consolidation evidence; not an active plan. Current work belongs to the canonical version track and backlog. Historical permissions and runtime observations are not current authorization.

*Analyzed: 2026-09-26*

## Scope and decisions

Material Studio now has a dedicated `/studio/materials` page. It previews and saves a material's shared
relative scale across the current draft and saved looks. The physical UV calibration, immutable revision
history, outfit composition and catalogue rendering below remain proposals.

- Confirmed direction: motif scale belongs to the material and affects every use of that material.
- Confirmed on 2026-09-26: saving material scale also updates previously saved looks.
- Implemented: workspace-scoped material scale metadata with revision stamps, atomic propagation and recovery.
- Open from the earlier rendering request: generated stills versus rotatable 3D scenes, and the exact six scene IDs.
- No unanswered or queued message is treated as agreement to these feature decisions.

## Current studio behavior

| Area | Verified implementation | Implication |
| --- | --- | --- |
| Design | One garment, named document, assignments for every declared part | Choosing another garment replaces the silhouette and assignments; it does not add an outfit layer |
| Selection | One or more parts; group-compatible materials are intersected | Group edits reject incompatible materials atomically |
| Placement | Parts own rotation, shifts and both anchors; shared scale is edited in Material Studio | Schema-2 documents bake the resolved scale for portable exports |
| Material assignment | Resolves the selected material's shared scale, or its default | A new fabric does not inherit the previous fabric's scale |
| Mapping | Runtime cylindrical coordinates replace authored mesh UVs | A common scale number does not guarantee a common motif width around bodies and sleeves |
| History | Up to 100 document snapshots; continuous gestures form one undo entry | Undo does not yet include a separate material library |
| Save | Updates the current saved look; Save as copy creates another identity | Saved looks are snapshots, not an immutable revision history |
| Recovery | Per-tab browser recovery, serialized server writes, optimistic revision conflicts | Local work survives offline/conflicting writes; this is not collaborative editing |
| Storage | .NET 10, SQLite, one JSON state row plus material metadata per browser workspace | Draft, saved looks and material metadata commit under one optimistic revision; no Redis |
| Export | Preview image or validated portable design JSON | No material bundle, production cutting pattern or render job exists |

Source owners: `src/domain/studio/types.ts`, `document.ts`, `placement.ts`,
`src/application/studio/state.ts`, `UseStudioPersistence.ts`,
`src/integration/studio/scene/SurfaceCoordinates.ts`, and the backend `StudioStateValidator.cs` /
`SqliteStudioStateStore.cs`. Frontend paths are relative to `ocharo-studio.frontend-services`.

## Delivered Material Studio slice

- Entry points: header **Materials**, inspector **Edit material**, direct `/studio/materials`, and `/materials` alias.
- Searchable catalogue, repeat grid, relative scale control, live 3D garment preview and affected-piece list.
- Save applies one scale to every current/saved assignment using that material. Other placement fields remain unchanged.
- Cancel leaves the workspace unchanged; leaving or changing fabric with an unsaved preview uses the blurred SDK dialog.
- New assignments, garment changes, imports, undo/redo and placement reset preserve the canonical shared scale.
- Unedited legacy fabrics retain their existing per-part values. The page identifies mixed legacy scales before saving.
- Updated saved looks discard obsolete thumbnails; their next explicit save captures a current thumbnail.
- Source textures and catalogue definitions remain unchanged. Solid colours expose no motif-scale control.
- The existing cylindrical mapping and vertical repeat factor remain unchanged. Values are relative, not centimetres.
- Portable schema-2 exports freeze resolved values. Importing into a workspace with a shared scale uses that workspace value.
- A single per-tab recovery envelope stores materials, draft, looks, settings and sync metadata together.
- SQLite adds a material-metadata column without rewriting existing design rows. Legacy writes cannot erase a nonempty library.
- API validation rejects mismatched shared/baked scales, duplicate metadata and invalid revisions or bounds.

Material revision stamps support conflict detection; they are not an immutable revision archive. Metric UVs,
material variants, source/crop editing and revision comparison remain future work.

## Separate the three editing subjects

### Material Studio

The material owns the source tile, crop/repeat, canonical grain direction, motif size, surface appearance,
compatibility and provenance. A material is identified by a stable ID; its type remains the existing
`MaterialKind` value set. Do not encode individual fabrics as enum members.

The existing `MaterialDefinition.repeat` is a relative sampling frequency, not a physical tile measurement.
Introduce calibrated tile dimensions explicitly rather than changing the meaning of that field in old designs.

The fuller material editor needs:

1. A flat repeat preview with a seam grid and a ruler. Show centimetres only after calibration; label
   unmeasured catalogue reconstructions as relative scale.
2. One shared motif-size control with aspect ratio locked by default. Separate repeat width and height
   can be introduced for measured tiles; do not stretch artwork accidentally.
3. Side-by-side previews on the relevant garment and selected parts, plus an affected-use list.
4. Save material, Cancel and Duplicate as variant. Variant creation is the escape hatch when one look
   intentionally needs a different motif size; per-part scale is not silently reintroduced.
5. A before/after preview and explicit commit. Slider movement previews the material draft; one save
   publishes one material revision rather than modifying the library on every pointer movement.

Solid colours have no motif-size control. Existing catalogue definitions seed the workspace library;
editing a user's fabric must not mutate the shared starter catalogue or original source image.

### Garment Studio

The garment owns the shape, editable parts, seams, compatible materials and required attachments.
The design owns which material is assigned to each part and where its motif lands.

- Keep rotation, garment-relative horizontal/vertical shifts and the two placement anchors per part.
- Motif size now lives in Material Studio. The inspector links to the selected material's editor.
- Group edits keep material assignment and shifts. If selected parts use different materials, show
  their identities and open one material explicitly; do not silently resize unrelated materials.
- Applying a material resolves its shared size immediately; it cannot inherit an old part's scale.
  Existing schema-2 assignments retain their appearance until that fabric is explicitly saved in Material Studio.
- A material draft preview updates every visible assignment referencing that material.
- Preserve the current camera, selected parts and unsaved garment design when entering Material Studio.
- Keep material undo separate from garment-placement undo; show which editor owns the current action.

### Looks and renders

The proposed look revision records garment geometry/mapping versions, material revisions/content hashes and
placements under an immutable revision identity. A future render references that frozen look revision,
model reference and scene reference. Thumbnail and render cache keys must include those revisions so a
material change cannot leave a stale preview labelled as current. None of this revision model exists in
today's mutable `SavedLook` snapshots, which store a document and optional thumbnail.

The saved-look update policy is confirmed: all saved looks update. A future immutable revision archive should
retain the prior revision; the current editor shows affected uses, updates assignments atomically and invalidates
stale thumbnails. An exported
file or completed render remains pinned to its original inputs; it must not change retrospectively.

## Physical scale requires a mapping contract

The current runtime uses `atan2(x, z)` for horizontal texture position and a shared height transform for
vertical position. The same angular span has different physical lengths at the waist, chest and sleeves.
Moving `placement.scale` into `MaterialDefinition` alone would preserve that distortion.

The replacement contract should use panel UVs with a common metric density. For example, every UV unit
can represent one metre of cloth, and a measured 0.20 m tile repeats five times per metre. Garment panels
retain their sewing orientation and seam islands. Material orientation defines the fabric's grain;
part rotation defines how that fabric is cut or placed on a particular panel.

Define UV units, both grain axes, island orientation and a measurable distortion tolerance. A proposed gate
is no more than 5% error between a test grid's declared interval and the measured surface length on representative
body, collar and sleeve patches; intentional folds and seam discontinuities are measured separately. This is
a proposed visual-calibration criterion, not a tailoring accuracy claim or an already-passed check.

The garment orb becomes a stable surface attachment (panel/triangle plus barycentric coordinates),
resolved into that panel's UVs. The textile orb remains a normalized point within the tile, independent of
the panel UV's metric units. This avoids depending on
one cylindrical UV coordinate having the same meaning on disconnected sleeves, collars and body panels.
The fixed-size silhouette remains unchanged; this does not add sizing or fit simulation.

Existing anchors contain only two UV numbers. Multiple disconnected meshes can share those coordinates;
the current resolver selects the first containing triangle or nearest vertex. Recovering a unique panel/
triangle attachment is therefore not always possible. Conversion needs the exact legacy geometry and mapping,
and a visual/manual confirmation when several surface attachments are plausible. Legacy offsets are translations
in cylindrical UV space, not metres; neither offsets nor anchor numbers can be copied unchanged into metric UVs.
Rotation must also be checked against each new panel's grain orientation.

Do not replace the current mapper invisibly. Introduce a new document schema across the frontend, backend,
persistence and portable import/export. Both current validators reject extra schema-2 keys; the new surface
attachment also needs its own validation rather than the old anchors' shared 0–1 limits. Keep the schema-2
reader and renderer. Version geometry and mapping independently, without repurposing the existing `assetVersion`
field, and offer a visual conversion preview. Current GLB authoring already
has distinct panel UVs, but they need calibration and continuity checks before they establish real units.

## Persistence and migration

Shared material editing is the point where targeted relational tables become useful. SQLite can remain
the database; changing engines or adding Redis does not solve reference/version ownership.

| Record | Required relationship |
| --- | --- |
| Material | Workspace, stable ID, current revision |
| Material revision | Immutable source asset, crop, repeat size, surface properties and provenance |
| Design and design revision | Workspace, geometry/mapping versions and frozen document |
| Part assignment | Design revision, part ID, material revision and local placement |
| Asset | Content hash, type, dimensions, source and optimized resource location |

Use workspace-scoped API resources with optimistic revisions and transactions. Keep binaries out of JSON;
retain the current snapshot endpoint during migration. A material update checks its expected revision and
changes references according to the chosen saved-look policy. Deleting an in-use material should archive
it or require reassignment, not leave broken parts. Browser workspace IDs are not authentication; membership
and access control are a prerequisite for a shared public deployment, not an implied current capability.

Migration must preserve existing appearances:

- Back up schema-2 snapshots and preserve their original documents.
- If one material has several old per-part scales, create explicit variants keyed by its source revision
  and complete effective repeat/calibration. Preserve `material.repeat / placement.scale` and the current
  renderer's vertical factor of `2.075`. Never select one arbitrary value for every old assignment or allow
  later catalogue-repeat edits to change a migrated look.
- Keep legacy mapping until a user accepts a converted look; metric UV conversion is a separate change.
- Version the portable file format and include referenced material revision metadata/assets or a resolvable bundle.
- Preserve IDs and timestamps where semantics remain unchanged; record conversion provenance.
- Verify counts, references, images and rollback before switching reads. Failed imports leave current work intact.

Acceptance checks include the same motif width across different panel shapes, every shared assignment
updating together, Cancel restoring all previews, one material save per history action, conflict recovery,
offline retries, saved-look policy, variant migration and portable export/import without the source library.

## Landing hero proposal

Recommended first step: a textile sampler using three renderer-exported previews of one Nimcha. Three
accessible fabric buttons change the visible garment. “Design this look” opens that exact starting point
while retaining any existing draft. It demonstrates the product through one immediate action.

| Option | Benefit | Tradeoff |
| --- | --- | --- |
| Textile sampler | Shows a meaningful transformation using the actual editor output | Needs three consistent renders and a draft-safe configuration handoff |
| Garment switcher | Reuses existing Nimcha/Baska/Korset stills | Explains silhouettes but demonstrates less of the material workflow |
| Activated 3D hero | Allows rotation and material changes directly | Loads WebGL/model resources; needs explicit activation and mobile performance checks |

Keep the initial landing lightweight and keyboard accessible. Respect reduced motion; avoid mandatory
autoplay and automatically loading the editor's API/state. Marketing copy stays on the landing page;
studio copy identifies controls, selections and outcomes. The current cards use decorative muted numbers.

## Refinement sequence

1. **Current visual pass:** waist-only Baska representation, stronger selection boundaries, stable rename
   tutorial target, control typography and removal of editor marketing copy.
2. **Source-faithful models:** correct cape/open-arm construction, shorten Abaya outer sleeves, improve
   shoulder topology, roll lapels, flatten hem bindings and add cloth thickness. Source photos establish
   visible fronts, not hidden backs or measurements. Keep this work separate from a digital human.
3. **Material Studio expansion:** the relative-scale page and saved-look propagation are implemented.
   Physical calibration, mapping conversion, editable variants and immutable revisions require their own migration.
4. **Look management:** material usage/search, duplicate variants, archive/recovery and revision comparison.
5. **Model renders:** settle output type and six scene IDs before choosing the rendering architecture.
6. **Outfit composition, if wanted:** multiple garment layers require compatibility, ordering and clipping
   rules. The current one-garment editor must not imply those capabilities merely by renaming “look”.

Sizes/length, decoration layers, arbitrary attachments, production patterns and physical simulation remain
outside this iteration. The earlier render inventory remains authoritative in
`../research/brand-and-render-assets.md`.

## Points

These are unanswered product decisions, separate from the implementation sequence above.

- [x] Material-scale edits update previously saved looks (confirmed 2026-09-26).
- [ ] Choose generated stills or rotatable 3D for the model-render workflow.
- [ ] Select the exact six scene IDs from the eight recorded references.
