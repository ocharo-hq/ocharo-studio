# Ocharo Studio iteration

> Preserved pre-consolidation evidence; not an active plan. Current work belongs to the canonical version track and backlog. Historical permissions and runtime observations are not current authorization.

## Acceptance

- [x] Rename the local repository, frontend, backend projects and workspace registrations.
- [x] Verify the GitHub repository rename to `sulton-max/ventures.ocharo-studio`.
- [x] Anchor a material point to a garment point; garment-relative shifts remain horizontal/vertical at every rotation.
- [x] Add scale, rotation, reset and pointer/keyboard anchor placement; preserve undo/import/export.
- [x] Highlight selected parts with warm yellow-orange edges; keep exports clean.
- [x] Inventory all catalogue materials and generate grounded textile studies with per-record coverage.
- [x] Filter material kinds and compatible materials per garment/part.
- [x] Preserve the visual system on laptop, tablet and phone; use context-specific controls.
- [x] Correct import/export arrows, rename focus, combined save/status, hover and toast placement.
- [x] Introduce a two-invitation storybook guide, persistent Settings access and first-skip launcher.
- [x] Persist draft, saved looks and settings through .NET and SQLite with concurrency checks.
- [x] Migrate old browser keys and schema-1 documents; preserve offline recovery.
- [x] Extract proven reusable controls/hooks to UI SDK and verify the packed consumer.
- [x] Sweep architecture, styles, failure paths and performance; rerun focused regression checks.

## Contracts

- Design document schema 2 adds scale and material/garment anchor coordinates per part.
- Anchors are normalized in [0,1], default (0.5,0.5); scale [0.25,4].
- Material preview coordinates have origin top-left; garment coordinates use a cylindrical surface,
  front center at chest-to-waist midpoint (y=1.17m). Horizontal shifts follow the garment surface.
- Sampling rotates/scales about the material anchor and translates in garment coordinates before sampling.
- API GET/PUT `/api/studio/state`; header `X-Studio-Workspace` is a browser-owned UUID.
- Payload `{ revision, draft, looks, settings }`; PUT atomically compares revision, returns incremented state.
- Conflict (409) never overwrites stored state. Local recovery remains downloadable before server reload.
- Workspace IDs isolate browser collections; this is a local creative studio, not authenticated account storage.
- Onboarding second invitation: 12h after skip, 7 days after completion, only on a later visit.
  After two invitations, access remains in Settings. No repeated timer-driven modal while editing.

## Ownership

- Root: coordinate math, renderer, schema, state/API integration, tests, rename and verification.
- Catalogue lane: source inventory, material coverage, texture assets and provenance.
- Backend lane: .NET state API, SQLite durability, validation and integration tests.
- UI lane: responsive component decomposition, onboarding, SDK extraction and controls.

## Handoff

- The repository, project names, namespace, workspace launcher and registered ports use Ocharo Studio.
- GitHub rename is verified. Local `origin` still uses the old URL because the workspace hook blocks agent-side remote mutation; the user can run the exact command in the verification record.
- Product and SDK changes are prepared for review. The installed persistent commit switch reports OFF; no new commit or push has occurred.
- [Verification](verification.md) records current tests, production image, asset coverage and practical limits.

## Landing follow-up

- [x] Move editorial hero text from the working canvas to a dedicated `/` landing page.
- [x] Reclaim canvas height across laptop, tablet and phone.
- [x] Introduce the workflow, five garment families and varied catalogue textiles using the established design.
- [x] Use actual clean garment exports and defer editor/WebGL loading until `/studio`.
- [x] Reuse SDK routing and add its missing initial loading outcome.
- [x] Verify navigation, state retention, accessibility and production direct links.
- [x] Preserve focused name edits through Back/reload and coalesce each rename into one undo step.

## Vue migration

The frontend uses Vue 3 and the Vue SDK. The migration preserves the verified landing/editor behavior,
visual system, Three.js renderer, assets, document schema, API and SQLite data. The final build passes 55 unit
tests and 17 browser scenarios on both development and production hosts.

- [x] Replace React presentation and bootstrap with Vue 3 SFCs and the Vue SDK router adapter.
- [x] Port state, persistence, onboarding and renderer lifecycle hooks to Vue composables.
- [x] Extract point placement, invitation scheduling and revisioned writes into the Vue SDK.
- [x] Adopt the packed Vue SDK and remove React runtime/build dependencies.
- [x] Verify build, package, state/recovery, export/import, responsive layouts and all browser workflows.
- [x] Remove the residual old project folder after confirming it contains only IDE metadata.
