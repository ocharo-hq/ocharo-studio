# Ocharo Studio interaction and render refinement

> Preserved pre-consolidation evidence; not an active plan. Current work belongs to the canonical version track and backlog. Historical permissions and runtime observations are not current authorization.

*Last updated: 2026-09-26*

## Requested iteration

- [x] Apply the approved Ocharo logo and assess its existing needle detail for square icons.
- [x] Inspect and remove the old IDE-only folder after the IDE closes.
- [x] Replace the static guide with an interactive, accessible tour of actual controls.
- [x] Animate front/back/side views with reduced-motion support and gesture cancellation.
- [x] Support two-finger trackpad orbit and pinch zoom.
- [x] Keep a common full-height starting frame and preserve camera position across garment changes.
- [x] Replace the native part selector with a styled multi-select control.
- [x] Edit selected material assignments and horizontal/vertical placement in one undoable action.
- [x] Edit shared material scale in Material Studio, updating current and previously saved looks.
- [x] Keep rotation and anchor placement individual; hide these controls for a group.
- [x] Add a top-level New design action and center the inactive design name.
- [x] Match both panel dimensions and corners; keep the inspector header outside its scrolling body.
- [x] Move the garment label beside the design name and remove the fixed-size canvas caption.
- [x] Remove the library's decorative footer text.
- [ ] Analyze and implement the agreed model-render workflow using the exact requested scene references.
- [x] Verify responsive layouts, keyboard interactions, persistence and production packaging.

## Editing contracts

Selection is transient editor state and does not change the portable design schema. At least one valid part
remains selected. Modifier-click on the model or inspector extends selection; the toolbar supports touch-friendly
multi-selection. Materials shown for a group are the intersection of all selected parts' compatible materials.
An incompatible material changes no part. Group movement sets a shared absolute value; differing values are
shown as Mixed until edited. Group edits preserve each part's rotation and anchors. Group reset affects only
horizontal and vertical placement. A continuous gesture and a material assignment each produce one undo step.

Material Studio owns relative pattern scale. Saving a material updates its canonical scale, the current design,
and every saved look referencing it in one atomic state change. Rotation, movement and anchors stay per part.
Undo, redo, import and reopening a look resolve the current material scale; garment placement reset preserves it.
Legacy appearances remain intact until the user explicitly saves that material. Changed thumbnails are invalidated
and recreated when the affected look is next saved. Material Studio preview edits remain local until Save material.

New design creates a fresh identity and defaults to Nimcha. Meaningful unsaved work is retained in My looks;
an untouched initial design is not duplicated. The 100-look limit blocks this operation rather than discarding
unsaved work. Existing saved looks and the offline recovery behavior remain intact.

Camera presets rotate the view along the shortest horizontal arc, with easing. Reduced-motion preferences
snap to the destination. Pointer or wheel input cancels the transition. The initial full-height frame is shared
by every garment; changing a garment preserves the user's current camera. Pixel-mode scrolling orbits,
Ctrl-wheel browser pinch zooms, and line/page-mode mouse-wheel input zooms. Browsers do not expose device identity;
pixel-mode mouse wheels follow the same orbit behavior, and explicit zoom buttons remain available.

## Persistence decision

The backend is .NET 10 with SQLite. SQLite is a relational database engine, but the current application stores
one workspace snapshot per row: workspace ID, revision, JSON state, material-scale JSON and timestamp. No Redis is
used. An atomic revision comparison prevents conflicting tabs from silently replacing one another's work. The
existing state endpoint now includes validated material metadata. Its additive SQLite migration preserves existing
looks. Older clients cannot silently clear a nonempty material library; they receive a reload/upgrade error.

A normalized model becomes worthwhile when accounts, large collections, asset ownership or render jobs arrive:

| Entity | Purpose | Suggested API |
| --- | --- | --- |
| Workspace and membership | Identity, access and collection ownership | `/api/workspaces`, `/members` |
| Design | Name, garment, current revision and lifecycle | `/api/designs`, `/api/designs/{id}` |
| Design revision | Immutable exportable document and provenance | `/api/designs/{id}/revisions` |
| Part assignment | Queryable per-part material and placement | `/api/designs/{id}/parts/{partId}` |
| Garment, part and material | Versioned asset and compatibility catalogue | `/api/catalog/garments`, `/materials` |
| Asset | Original, optimized image, mesh and derived output | `/api/assets` |
| Render job and output | Pinned design revision, model, scene, status and result | `/api/render-jobs` |
| User preferences | Theme and completed tutorial state | `/api/preferences` |

Use transactions and optimistic revisions for mutations. Keep saved document snapshots as immutable revisions,
even with normalized current-state tables. Move binary images/GLBs out of JSON into an asset store. Add additive,
versioned migrations, backfill existing snapshots, reconcile record counts/hashes, and test rollback/recovery
before switching reads. SQLite remains suitable for a local host; PostgreSQL becomes an operational choice when
shared hosting and concurrent users require it. Redis would be optional for distributed caching or coordination,
not the design system of record. Full database/API normalization is deferred with the user's stated scope.

## Render workflow and source limits

The source catalogue includes an approved model baseline plus eight synthetic background scenes. No authored,
rigged 3D model of that girl is present. All eight backgrounds appear in canonical product records, so six cannot
be inferred from catalogue frequency. Exact scene selection and photorealistic-still versus interactive-3D output
are pending user clarification. The asset inventory is in `../research/brand-and-render-assets.md`.

For generated stills, pin the design revision, clean front/back/detail exports, texture samples, model reference,
scene reference and generation settings. Preserve results separately from editable designs and label them as
visualizations. A generated image cannot establish sewing feasibility, physical fit or identical printed placement.
A rotatable 3D workflow instead needs a separately authored and rigged character, garment fitting/retopology,
scene geometry, lighting and physically appropriate materials; a background photograph is not a 3D scene.

## Functionality to sequence

The current logic audit, delivered Material Studio slice, physical mapping requirements, landing hero options and
refinement order are in [studio evolution](studio-evolution.md). The user confirmed that shared scale updates
previously saved looks. Relative scale is implemented; measured textile repeat, material variants and immutable
material revision history remain future capabilities.

Decoration layers, sizes, freeform attachments and physical cloth simulation remain separate product capabilities.
They should not be implied by image generation or the current rigid garment meshes.
