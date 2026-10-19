# Ocharo Studio verification

> Preserved pre-consolidation evidence; not an active plan. Current work belongs to the canonical version track and backlog. Historical permissions and runtime observations are not current authorization.

*Last updated: 2026-10-19*

## Current build — 2026-09-29

Studio now consumes Platform audience tickets, protects stored designs using current organization membership,
and preserves browser-only recovery. The backend rejects bearer credentials over HTTP. A connection change cannot
silently upload recovery into another member or organization, even when revisions match or the destination is empty.
The independently owned Studio consumes published `@wow-two-beta/ui-vue@0.0.9`; the previous vendor file is preserved.

The seven-model immutable release is pinned as `ocharo-garments@2.0.0` with SHA-256
`9672e9b74e70521154455487d53f0196db4ce2b3fde8e0a9f0d85b27f0bfbf2a`.
Models are verified before rendering. Explicit creative review export downloads a PNG and manifest containing
source design/revision, model release, material provenance and content hashes. Receiving products retain review rights.

| Executed check | Result |
| --- | --- |
| Studio frontend, Node 24.11.0 | 99/99 unit tests; Vue typecheck, 23 SFCs, and production build passed |
| Studio boundaries/catalogue | 142 local imports and 5-garment/46-material contract passed |
| Studio backend | 24/24 .NET 10 tests passed, including HTTP rejection, live-membership checks and workspace isolation |
| Assets integrity | Seven original GLBs match the pinned release; 4/4 immutable-release tests passed |
| HTTPS browser suite | 36/36 passed in 4.1 minutes: authenticated persistence/conflicts, materials, docs, cameras, responsive access, preview and print-size exports; TLS validation enabled |
| Atomic model import | All seven imported into a temporary consumer; a corrupt final GLB rejected with every consumer byte unchanged |

Transparent preview and print-size shadows remain neutral; pixel regressions reject saturated color artifacts.
Camera checks wait for the lazy editor to mount before testing readiness and retain exact frame assertions.
A final 3/3 focused rerun checked the Desk connection form at 1440px and 320px after its spacing correction.
The real-canvas export fixture is synthetic review material, not business approval or product evidence.
It retained the exact PNG length/hash and immutable release metadata; the browser issued no remote write.
The API tests exercise middleware with a controlled Platform transport; they do not prove a live Platform connection.
Historical browser, Docker, Git, runtime and package observations below describe their stated dates and are not
claims about this current build. Current browser persistence tests use a synthetic authenticated transport;
real Platform tickets and database persistence are verified separately by the workspace integration review.
Current commands and isolated ports are documented in [operations](../../operations/operations.md).
No Git operation, production deployment, paid-provider call, or original-model edit occurred in this finishing pass.

## Historical evidence

### Delivered iteration

The studio now supports two independent placement anchors, garment-relative horizontal/vertical movement at every
rotation, scale and rotation, selected-part amber outlines, category-compatible catalogue materials, responsive
island layouts, contextual controls, a timed two-invitation storybook, corrected action icons and save status,
.NET/SQLite persistence, offline recovery and cross-tab revision conflicts.

The interaction refinement adds the approved Ocharo wordmark and needle favicon, a contextual interactive SDK
tour, multi-part material assignment/movement editing, animated camera presets, pixel-mode trackpad orbit, common
full-height framing, a styled touch-friendly part picker and a prominent New design action. The inactive name
is centered with the current garment beneath it. The canvas caption and decorative library footer are removed.

The `/` landing page now carries the editorial headline, workflow, five garment families and a catalogue textile
gallery. `/studio` gives the mannequin the reclaimed canvas space. Native garment renders introduce the actual
editor; editor state, API calls, models and WebGL remain deferred until entry. Browser history, direct links,
legacy `/editor` redirects, focused-name recovery and delayed-save navigation are covered by regression tests.

Material Studio at `/studio/materials` now owns shared relative scale. Saving updates current and previously
saved looks atomically, preserves other placement fields, and invalidates stale thumbnails. The header Materials
button and inspector Edit material action open its searchable catalogue, repeat grid, live garment preview and
affected-piece list. Preview cancellation uses the shared blurred confirmation dialog.

The frontend is now Vue 3.5 with TypeScript, Vite and the Vue SDK. All 21 SFCs use external styles;
Vue composables manage state and lifecycle while the Three.js renderer and document reducer remain framework-independent.
React, React DOM and the React SDK are absent from the installed product dependency tree.

The repository, project directories, .NET namespace, frontend package and workspace launcher use Ocharo Studio.
GitHub resolves `sulton-max/ventures.ocharo-studio`; the local remote URL update remains user-owned because the
workspace Git hook rejects agent-side remote mutation. Initial implementation history remains intact at `646000a`.
The product persistent commit switch is OFF; this iteration has not been committed or pushed.
The old local folder contained only `.idea/workspace.xml` and empty parents. It was removed, then removed again
after the IDE recreated it. Closing the old IDE project prevents further metadata regeneration.

### Executed checks

| Check | Result |
| --- | --- |
| Frontend | Vue typecheck, 21 compiled SFCs, architecture boundaries (106 local imports), catalogue agreement and Prettier passed |
| Domain and persistence | 82/82 Vitest tests passed |
| Backend | .NET build and format checks passed; 16/16 tests passed |
| HTTPS development browser | Material Studio, grouped edits, persistence, confirmations, notification focus, phone header and tour regressions passed; Chromium |
| Packaged production browser | 32/32 scenarios passed against the final .NET Docker host |
| Accessibility | Keyboard navigation, named dialogs, mobile skip-link focus and axe light/dark WCAG checks passed within the browser suite |
| Responsive layout | Editor and landing laptop/tablet/phone layouts checked; landing additionally verified at 320×740 without document overflow |
| Runtime assets | All six GLBs and 25 WebPs served with expected MIME types and byte-identical contents |
| Texture decoding | All 25 runtime textiles decoded at 1024×1024; no failed requests or browser errors in production visual review |
| Database durability | Exact revision and contents survived complete container replacement using the same SQLite volume |
| API routing | Health, metadata, state, SPA root/fallback and missing-API behavior checked |
| Vue SDK | Original controls/tour checks retained; confirmation hook 2/2 and overlay DOM 24/24 passed; typecheck, 409 SFC checks, build and 79 packed exports passed |
| React SDK checkpoint | Earlier extracted controls and router changes passed their focused checks; the product no longer consumes this package |
| Packaging | Locked npm install and full multi-stage Docker image build passed; local SDK tarball resolves inside Docker |
| Git | Product whitespace check passed; PNG originals and local SDK package use Git LFS |

The new browser scenarios cover grouped assignments, joint transforms, recovery-safe New design, full-height
camera framing, animated/reduced-motion presets, trackpad orbit and the complete guided workflow at 1440, 390 and 320px.

Browser workflows exercise independent materials, rotations and anchors, undo/redo, save/load/copy, JSON and PNG
export, import rejection, every garment/view/part, phone controls, themes, keyboard navigation, camera dragging,
conflicting tabs across reloads, offline retry, and the second onboarding invitation. Domain regression checks
include rotated motion invariance, legacy metallic assignments, corrupt-new-cache fallback to original keys,
coalesced gestures and collection limits. Backend tests cover validation, revision conflicts and SQLite storage.
Name edits persist while focused and form one undo step; browser Back and reload retain those edits. A delayed PUT
test verifies that navigation waits for the write before leaving the editor. Landing checks confirm that no
studio API or GLB requests occur before entry and that the keyboard skip link transfers focus on phones.
Vue-specific tests cover lifecycle cleanup, immutable live state, loading-time recovery edits, and recoverable lazy-route import failures.

### Catalogue and assets

All 29 classified catalogue products are mapped to material evidence: 16 Nimcha, six Baska, four Kostyum, two Korset
and one Abaya. The inventory includes 49 linked source photographs and 11 linked videos; video-only products use
source preview frames, not an assertion that every video frame was inspected.

- 36 catalogue material choices: 23 patterned material definitions sharing 21 new generated texture fields, plus 13 solids.
- Ten original studio studies remain available, yielding 46 total definitions.
- Typed material kinds and per-garment/part applicability drive both frontend options and the embedded API contract.
- New generated WebPs total approximately 4.95 MB.
- Four original texture downloads shrink from 12,068,342 PNG bytes to 649,548 WebP bytes (94.62% reduction).
- Original PNGs remain unchanged; manifests retain sources, prompts, hashes and runtime encoding details.
- Six unclassified professional-look groups remain excluded until garment/material classification is established.

See [catalogue coverage](../catalogue-materials.md) for the product-to-material mapping and evidence limits.
Generated studies approximate source appearances; they are not calibrated fabric scans or approved production cloth.

### SDK adoption and architecture

Ocharo consumes the tested, checked-in `@wow-two-beta/ui-vue` tarball under `engineering/codebase/vendor/`.
Reusable point selection, interactive tours, visit invitations, confirmation requests, modal shells, serialized latest-revision writes, storage brokers and file downloads
live in the Vue SDK. Ocharo consumes its router, navigation blocker, route recovery and page metadata behavior;
product wrappers provide the custom loading/error appearance. Garment state transitions, 3D coordinates, persistence binding and editorial composition remain
in the product. The root app delegates to focused header, library, inspector, controls and dialog components;
external styles separate tokens, base rules, studio layout, components and responsive rules.
The latest cleanup removes 22 obsolete brand, status and library-footer rule blocks.

The SDK `StorageBroker` return change is compatible with existing workspace callers. External custom implementations
returning `void` must return `boolean`; the SDK adoption note records this release consideration. SDK source changes
remain separate from unrelated SDK work. No SDK publication occurred.

PointControl, TourPopover and Modal have public component-only stylesheet exports. PointControl source scanning is
limited to its own compiled chunk; tour and modal layout use concrete scoped CSS. Shared CSS is 32.97 KB minified /
7.69 KB gzip; the lazy editor stylesheet is 13.14 KB / 3.20 KB gzip.
The broader Vue SDK run completed 2,090 assertions but failed on a Firefox session timeout; full-suite success is
not claimed. The product passes its complete Chromium suite against both development and packaged production.

### Figure and garment remodel (2026-09-26)

The dress form and the five garments were replaced by Blender-authored assets (asset version `2.0.0`): a faceless
figure after the catalogue model in the ivory base dress, and remodelled nimcha, baska, kostyum, korset and abaya.
The library lives in Maftuna's workspace (`assets/3d/ocharo-garments/`); the studio imports it with
`npm run assets:sync`. Contract and construction: [garment authoring](../garment-authoring.md).

| Check | Result |
| --- | --- |
| Library build | Two consecutive Blender 5.0 builds produced byte-identical GLBs; mesh checks found no stray edges, missing UVs or part gaps |
| Import | `sync-garments.mjs` verified hashes, part coverage, fixed attachments, finite attributes, indices and limits for all six files |
| Runtime | Actual `StudioScene` (temporary review page on the dev server, headless Chromium) loaded every garment with default materials; no page errors |
| Visual | Front, side, back and detail captures show closed seams, continuous textile mapping and no garment/figure clipping in the inspected views |
| Frontend | Lint and catalogue agreement, 82/82 unit tests and formatting passed |
| Landing | `public/assets/landing/*.png` recaptured from the same renderer; hashes and pixel counts updated in their manifest |

The packaged production image recorded below predates this remodel and still carries the earlier models until rebuilt.
The browser suite was not rerun for this asset change.

### Silhouette holder, toasts and preview (2026-09-27)

- **Garment holder:** `mannequin.glb` now comes from the library's `och-silhouette.glb` — a cream dress form over
  the ivory skirt, after the brand silhouettes. The catalogue-model figure (the model girl) stays in the library for
  the later final-render feature. Soft arms (`silhouette_arms`, `extras.showWith: "sleeves"`) load only with the
  kostyum and abaya; `StudioScene` removes them for the other garments.
- **Camera:** target `[0, 0.76, 0]`, front `[0, 0.86, 3.3]` (was `[0, 0.9, 0]` and `[0, 1.02, 3.65]`), so the
  silhouette fills the stage from neck cap to hem, clear of the toolbar and the view controls.
- **Notifications:** studio messages use the Vue SDK `ToastHost` (component-only entry
  `@wow-two-beta/ui-vue/presentation/feedback/toast-host` with its stylesheet): top right, a countdown bar that
  pauses on hover or focus, and one deduplicated slot. Failures, conflicts and rejected imports use the warning tone
  for 7 s; dismissing a store notice clears it. Info, success, warning and danger tokens exist for both themes.
- **Material Studio preview:** 276 px tall (248 px up to 1180 px, 300 px on phones), inset 30 px from the card
  sides and 16 px above the Front/Back/Side buttons; the figure stays centred.
- **SDK package:** `vendor/wow-two-beta-ui-vue-0.0.7-ocharo-7a5ed4d.tgz`, named by SDK commit so npm cannot reuse
  a stale tarball of the same version.

| Check | Result |
| --- | --- |
| Library and import | Garment and model GLBs byte-identical to the previous build; the sync accepted all six studio files |
| Clearance | Rays from the form and arm axes found no silhouette point outside nimcha, baska or korset; kostyum and abaya contacts lie only in armpits and under sleeve caps; close-ups showed nothing through the cloth |
| Renderer | Five garments × front/side/back/detail with catalogue textiles; studio at 1440 px (light, dark) and 390 px; landing recaptured |
| Toasts | Light, dark and 390 px captures of neutral and warning toasts; the bar colour follows the tone |
| Frontend | Typecheck, 21 SFCs, boundaries, catalogue agreement, Prettier and 82/82 unit tests passed |
| HTTPS development browser | 31/32 with one worker. `camera.spec.ts` stable-frame checks fail intermittently here, equally on the previous camera and model; parallel workers add shared-backend failures |

The packaged production image and its browser suite were not rebuilt for this change.

### Cloth shading and Studio render (2026-09-28)

- **Viewport:** neutral tone mapping (exposure 0.78) replaces ACES, so textiles stay close to their swatches. The
  composer target is 4× multisampled. The key light casts soft PCF shadows onto the garments and a floor catcher.
  The old clearcoat is gone: every cloth kind now has sheen, a weave relief and satin anisotropy where it applies.
  The silhouette's form and skirt share this cloth shading.
- **Studio render** (Export → Studio render): an offscreen PNG at 1600×2000 or 2400×3000 on the silhouette or the
  model. It offers front, three-quarter, side and back views and studio, linen, charcoal or transparent backdrops,
  with a preview and a PNG download. Renders use 8× multisampling, GTAO ambient occlusion and a 4096 shadow map.
  Software WebGL gets a lighter path.
- **Timing:** 1600×2000 takes 1.9 s on the Apple M4 Max GPU (Metal, headless Chromium) and 2.8 s on SwiftShader
  with the lighter path. The full path took minutes on SwiftShader, which is why the lighter path exists.
- **Assets:** the catalogue model is synced as `model.glb` for renders only; the editor keeps the silhouette.

| Check | Result |
| --- | --- |
| Frontend | Typecheck (22 SFCs), boundaries (127 imports), catalogue agreement and Prettier passed; 87/87 unit tests, including weave tiling, finish coverage and render framing |
| Browser (Playwright-managed API and Vite, one worker) | 32/33. The new render test makes a 1600×2000 transparent PNG on the model and downloads it. The failure is the `camera.spec.ts` stable-frame check, which fails intermittently as it did before |
| Renderer captures | Viewport shading at 1440 px; weave close-ups; GPU renders of the kostyum on the model and the abaya on the silhouette (transparent) |

The packaged production image and Docker host were not rebuilt for this change.

### Local review

Inspected production captures: landing [desktop](../landing-preview.png) and [phone](../landing-phone-preview.png),
editor [desktop](../studio-preview.png) and [phone](../studio-phone-preview.png).
Guided-tour captures show [desktop](../studio-guide-desktop.png) and [320px phone](../studio-guide-320.png).
The earlier [garment anchor](../studio-orb-preview.png) capture illustrates placement behavior.

- Development landing: `https://127.0.0.1:8262/`; editor: `https://127.0.0.1:8262/studio` (managed Vite HMR).
- Development API: `https://localhost:8260/`; HTTP API: `http://localhost:8261/`.
- Production landing: `http://127.0.0.1:18260/`; editor: `http://127.0.0.1:18260/studio`.
- Material Studio: `http://127.0.0.1:18260/studio/materials`.
- Final image: `sha256:9798c4d0f18e5e577e0a1e7fed2787a93686bb78b4d911247bf11f1be510de77`.
- Managed runtimes remain available for the next review. They are not orphan background processes.
- The production review container uses its own `ocharo-studio-review-data` volume.
- Normal Compose uses `ocharo-studio-data`; preserve or back up that volume before replacement.

Local remote update, run by the user:

```sh
git -C /Users/max/Projects/10x-ws/workbench/career/engineering/wow-two/wow-two-ws/workbench/mfts-projects/ventures/ocharo-hq/ocharo-ws/workbench/ventures.ocharo-studio remote set-url origin https://github.com/sulton-max/ventures.ocharo-studio.git
```

Ordinary commits require a genuine standalone user message containing:

```text
~commit_on workbench/mfts-projects/ventures/ocharo-hq/ocharo-ws/workbench/ventures.ocharo-studio
```

### Reproduce

From `engineering/codebase/ocharo-studio.frontend-services/`:

```sh
npm ci
npm run lint
npm run format:check
npm test
npm run build
npm run dev
# With the API and frontend running, in another terminal:
npm run test:e2e
```

For an existing HTTPS certificate pair, `STUDIO_TLS_CERT` and `STUDIO_TLS_KEY` make Vite read those files directly
and skip mkcert completely. The managed preview uses this mode; no system trust changes are required.
Both paths must be supplied together. Without them, the normal mkcert setup may require explicit trust approval.

`STUDIO_URL` selects a different existing host. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium
binary. CI starts its own explicit HTTP frontend and API profiles; interactive development remains HTTPS.

From the repository root:

```sh
dotnet build engineering/codebase/ocharo-studio.backend-services/OcharoStudio.BackendServices.slnx -p:BuildSpa=false
dotnet test engineering/codebase/ocharo-studio.backend-services/OcharoStudio.BackendServices.slnx --no-build --no-restore
docker compose -f engineering/deployment/docker-compose.yml config --quiet
docker build -f engineering/deployment/Dockerfile -t ocharo-studio:local engineering/codebase
docker run --rm --name ocharo-studio-review -p 127.0.0.1:18260:8080 --mount source=ocharo-studio-review-data,target=/app/appdata ocharo-studio:local
```

### Practical limits

- Chromium automation passed; Safari, Firefox, real touch devices and assistive-technology review remain human checks.
- Authored meshes preview rigid garment shapes; they do not simulate tailoring fit, cloth physics or sewing patterns.
- Source-specific mixed-material panel divisions are limited by the five current authored mesh contracts.
- Workspace UUIDs isolate local collections; they do not provide accounts, authentication or collaboration.
- SQLite is local and unencrypted. Browser recovery and JSON export complement server state; clearing browser identity loses that collection reference.
- The API accepts up to 100 saved looks and 4 MiB total state; settings and thumbnails also have bounded limits.
- The main JavaScript bundle is approximately 109 KB minified / 42 KB gzip; the landing chunk is 7 KB / 2.7 KB gzip,
  the shared garment chunk is 28 KB / 6 KB gzip, the lazy editor is approximately 177 KB / 54 KB gzip, and Three.js is 690 KB / 175 KB gzip.
  Vite still reports its >500 KB advisory for the Three.js chunk. Formal device performance profiling was not performed.
- Exact model renders await output-mode and six-scene selection. The source has eight scene references and no rigged 3D character.
- A normalized relational API is planned in [studio refinement](studio-refinement.md); the current .NET/SQLite snapshot API uses no Redis.
- Garment size/length, decoration overlays, free attachments, accounts and cloud collaboration remain deferred.
- No source push, hosted CI execution, package publication or external deployment occurred.

### Equal-panel layout follow-up

Both studio panels share their width, height and corner rules. The inspector now has a fixed heading and divider,
with part controls inside a separate scrolling body. Outer overflow clips native scrollbars to the rounded shell.
The former inspector-only max-height, width and padding rules were removed across responsive breakpoints.

Geometry inspection passed at widths 1600, 1440, 1185, 1180, 1024, 900, 820, 390 and 320px: exact width/height/radius parity,
no horizontal overflow, a stationary inspector header during body scrolling, and reachable bottom controls.
Seven existing browser checks passed on both HTTPS development and the packaged production host, including
the mobile tour, grouped edits and keyboard access. Production desktop/phone captures show no browser errors.
Build, architecture/catalogue checks and formatting passed. No domain or backend logic changed.

[Scrolled inspector proof](../studio-panel-scroll-preview.png) shows the header and rounded shell retained at the end of the body.

### Part-dropdown containment follow-up

The dropdown no longer inherits the toolbar's no-wrap rule. Its rows use shrinkable grid tracks,
with helper text and labels wrapping inside the panel. On narrow screens it centers against the toolbar,
keeping the panel inside the viewport as the selected-part count changes.

Live geometry checks passed on both HTTPS development and packaged production at 1440, 1024, 820, 390 and 320px: every row and helper stayed within the menu,
the menu stayed inside the viewport, and no horizontal overflow occurred. Arrow keys, Space selection,
Escape dismissal and focus restoration passed at each width.

Visual evidence: [desktop](../studio-dropdown-desktop.png) and [320px phone](../studio-dropdown-phone.png).

### Garment and visual refinement

The landing garment cards now use large muted decorative numbers. Baska's glyph, wording, mesh and native
preview show a waist-only layer with separate pointed front hip panels and an open centre. Dense, surface-matched
edge bindings avoid floating arcs. The existing `body`, `trim` and `belt` IDs and schema-2 mapping remain intact.
The other five GLBs are unchanged. Generator assertions cover Baska's split, balanced points and waist envelope.
The packaged Baska hash matches the manifest:
`cd4a6c6c1a3628a967f92d1d956cd95e32aa52a43392c3e866b4176c5149a930`.

Selection combines a stronger amber silhouette with thresholded mesh boundaries. Front/back/side checks in
light and dark themes show panel boundaries without triangle wireframes. Clean PNG export hides these boundaries
and restores selection afterward. The regenerated transparent Baska preview records its source mesh hash and
measured capture metadata in `public/assets/landing/manifest.json`.

The design-name target keeps the same width when focused, so the guide highlight contains the input at desktop
and 390/320px widths. Promotional panel copy is removed. Important inspector/import labels are 13px; helper and
orbit text are 12px. Typography rules live in their existing owning stylesheets; obsolete description rules and
the unused part-name prop were removed.

Final light/dark visual checks passed at 1440, 1024, 820, 390 and 320px. Camera controls no longer stretch between
conflicting top/bottom positions on small screens. The wrapped orbit hint, camera controls, Guide button and
bottom navigation remain separate; the 320px camera moves left to retain a 30px gap before Guide. A dedicated
browser regression checks these actual rectangles at 820, 390 and 320px.

Validation: 64 unit tests passed, all 26 browser scenarios passed on the final packaged preview, and formatting,
typecheck, catalogue/boundary checks and Docker build passed. The backend contract is unchanged and still reports
schema 2 / SQLite. The existing review database volume was retained when replacing the task-owned container.
This garment pass preceded Material Studio, delivered in the follow-up below. The landing hero sampler remains
a proposal in [studio evolution](studio-evolution.md); model-render choices remain open.

Visual evidence: [garment cards](../landing-garment-cards.png),
[Baska selection](../studio-baska-preview.png), and
[phone canvas controls](../studio-canvas-phone.png).

### Material Studio, dialogs and notification follow-up

The user confirmed that material scale changes update previously saved looks. A workspace-scoped material library
stores relative scale and revision stamps. Save projects the scale into draft and saved schema-2 documents together;
rotation, horizontal/vertical placement and both anchors remain unchanged. Undo, redo, reset, garment selection,
opening looks and importing resolve the current shared scale. Legacy per-part values remain unchanged until that
fabric is explicitly saved. Exported JSON freezes its resolved scale; imports use a receiving workspace's saved scale.

The page opens from Materials in the header, Edit material in the inspector, `/studio/materials`, or the `/materials`
alias. Search, solid-material behavior, grid preview, garment preview, responsive controls and the affected-use list
are implemented. Uncommitted preview changes stay isolated and receive a discard confirmation when leaving or
switching fabric. The original garment canvas remains mounted when switching editors.

SQLite adds `materials_json` alongside the existing snapshot. Metadata and all assignments commit under one
optimistic workspace revision. Validation rejects malformed metadata, duplicate keys, unsupported identities and
out-of-range or mismatched scales. Old clients cannot erase an established library by omitting it. A single browser
recovery envelope preserves metadata, draft, looks and sync status together. Stale saved-look thumbnails are removed
and regenerated on the next explicit look save. No immutable material history or physical-centimetre mapping is claimed.

The apparent notification border was a focus outline on the router-focused workspace container. Its outline is
suppressed while interactive controls keep focus indicators. The notification regression verifies that the navbar
border stays unchanged. At 390 and 320px, all five header actions are separated from the name input and pass
bottom-edge pointer hit tests.

All studio dialogs use the Vue SDK modal shell with a blurred backdrop. Deletion and discarded material previews
use the shared `useConfirmation` hook. Browser tests cover initial cancel focus, Escape, Cancel, focus restoration,
acceptance and absence of native JavaScript dialogs. The SDK's footer actions now retain normal flow positioning.

Final validation: 82 frontend tests, 16 backend tests and all 32 packaged-production browser scenarios passed.
The Docker image was replaced with the same named database volume. Light/dark Material Studio layouts were
inspected at 1440, 1024, 820, 390 and 320px; both themes pass WCAG checks after theme transitions settle.
Production visual evidence is recorded alongside the existing review captures.

Inspected production proofs: Material Studio [desktop](../material-studio-desktop.png) and
[phone](../material-studio-phone.png), [blurred deletion dialog](../studio-confirmation-preview.png),
and [notification separator](../studio-notification-preview.png). These captures had no page, console or
HTTP errors. The dialog backdrop computes to `blur(4px)`; the notification retains the header's original one-pixel border.
