# Architecture

*Last updated: 2026-10-19*

## Runtime

A single .NET host serves the studio API and built Vue SPA. Development uses Vite HMR with a same-origin API proxy.
The backend has API, Application, Domain, Persistence, and test projects. Application owns portable-document
validation; Persistence owns SQLite storage; the host composes both and initializes the additive schema before serving.

The frontend follows domain, application, integration, presentation, and bootstrap layers. Vue owns application
orchestration and controls; a lifecycle composable adapts the renderer at the application-to-integration boundary.
Three.js owns the WebGL scene without entering serializable design state.
The landing and editor are lazy Vue routes created by the shared Vue SDK adapter. React runtime, TSX components,
and the React SDK package are absent from the application. Immutable reducer operations remain pure TypeScript;
Vue composables expose live getters and own persistence, onboarding, and renderer teardown.

## Browser studio

The responsive editor places a fixed mannequin at the centre of floating library, contextual, inspector, camera,
and help islands. Garment choice, part choice, material application, pattern placement, and camera navigation remain
separate operations. Keyboard-accessible form controls provide alternatives to canvas part selection.

## Asset contract

Each versioned garment definition declares:

- Stable garment/category identifiers and a display name.
- One mannequin-compatible, fixed-size mesh asset, preferably GLB.
- Named selectable parts mapped to stable mesh/material-slot identifiers.
- Valid default materials and texture coordinates for each part.
- Category-specific buttons, side ties, knots, and other built-in meshes.
- Whether an attachment shares a part's material or retains its own fixed material.
- Default placement, thumbnail, provenance, and asset version.

Five GLBs implement the catalogue families against one mannequin GLB. Garment assets share its coordinate system,
scale, and pose.
Attachment geometry is authored with the garment and loaded automatically.
Raycasting maps a visible surface to its stable part identifier.
Changing one part's texture must not mutate another part through a shared material or texture-transform instance.

## Materials

A material definition contains a stable identifier, preview swatch, colour texture, surface parameters,
optional supporting maps, provenance, and version. The generated catalogue is the source for frontend choices and the
embedded backend validation contract.
Generate seamless textile images where useful; keep baked shadows and mannequin silhouettes out of reusable swatches.
Source catalogue imagery remains reference evidence and must not be relabelled as physically measured material data.

Each selected part stores material identity, rotation, scale, normalized offsets, and material and garment anchors.
Texture placement occurs in the shared authored surface coordinates, independently of camera orbit.
Material decoration overlays, accurate cloth simulation, resizing, and sewing-pattern generation are deferred.

## Persistence

A versioned JSON design document contains garment and asset versions, every declared part assignment, and per-part
texture transforms. SQLite stores one draft, saved looks, settings, and shared material scales per authenticated workspace.
The API derives that workspace deterministically from the current Platform organization and member identity.
Optimistic revisions serialize writes and return a conflict rather than overwriting newer state. Per-tab browser
recovery protects unsynchronized edits. Users can update a look, save a copy with a new identity, import or export
validated JSON, and export the current view as PNG.

Validation rejects unknown schemas, assets, garments, materials, parts, malformed IDs and dates, incomplete part maps,
incompatible part/material assignments, oversized payloads, and non-finite or out-of-range transforms without
replacing the active design. The generated frontend catalogue contract is embedded in the Application assembly so
backend acceptance matches the shipped catalogue. Schema-1 imports preserve any globally known legacy material and
migrate to schema 2 in the client.

One state request may contain at most 100 looks and 4 MiB total; settings are capped at 128 KiB and each thumbnail at
1 MiB. The total budget still applies when many looks contain thumbnails. Invalid or oversized state returns `400`,
does not change SQLite, and leaves the browser recovery copy available.

Desk issues five-minute tickets for the `ocharo-studio` audience. Studio accepts credentials only over HTTPS and
rechecks ticket expiry, current membership, and write rights through Platform introspection on every protected request.
`X-Studio-Workspace` can select only the authenticated workspace; a UUID alone grants no access. The frontend sends
an explicit bearer header with ambient cookies omitted. Studio owns no account/password database.
Behind the ingress, TLS ends at Traefik: forwarded scheme and host apply only from `Deployment:TrustedProxies`, so
the HTTPS-only ticket and account checks see the public origin and no other sender can claim it.

The browser routes every Studio 401 through one fe sdk auth bridge. The first current 401 of a connected session
expires it once: the ticket or cached account state clears, one neutral notice appears and browser recovery stays.
Studio deliberately stays on the page instead of redirecting to sign-in, because it remains usable signed out and
unsaved material edits would not survive navigation.

An exact configured Desk issuer and Studio audience guard the connection fragment, which is removed before its
credential enters tab-scoped session storage. Browser-only designs remain usable without a ticket. Recovery binds
to the authenticated workspace; switching members or organizations requires preserving recovery and explicitly
loading the destination workspace rather than silently uploading existing local work. Portable JSON is the explicit
transfer and backup format. SQLite and browser storage are unencrypted local development stores.

## Reviewed creative handoff

Export → Submit for review produces a PNG and a JSON review manifest after explicit author acknowledgement.
The manifest freezes the design document and revision, model release hash, material source/hash, image hash and
`creative-visualization` classification. The PNG is limited to 5 MiB. Receivers authorize the current operator and
organization independently; client workspace identity and author acknowledgement do not grant publication rights.
Platform or Marketing retain ownership of receiving review, rights decisions, and publication.

## Asset authoring

Reusable authoring source lives in the
[Ocharo Assets garment library](../../../ocharo-assets/engineering/codebase/ocharo-assets.library/garments/och-3d-garments.md).
Studio pins the immutable seven-model `ocharo-garments@2.0.0` release and verifies every GLB before parsing.
The importer validates every source and semantic part map before replacing any consumer file.
Studio imports hash-checked GLB copies through the [garment authoring workflow](../research/garment-authoring.md).

Blender is permitted for modelling, UV unwrapping, and GLB export.
Keep authoring source or reproducible scripts with an asset manifest.
Apply the workspace binary/LFS rules before staging large assets.
Front references alone cannot establish exact backs, seams, fit, or drape; label new shapes as interpretations.
All five current family assets use the same contract. They remain visual interpretations pending the fidelity and
human validation recorded in planning.

## Limits

WebGL is required. The renderer provides authored rigid garment surfaces rather than true cloth physics, fit
simulation, tailoring accuracy, resizing, or production patterns. The repository contains generated studies and
authored assets, not copied source-catalogue media or secrets.

## References

- [Three.js textures](https://threejs.org/docs/pages/Texture.html): texture repeat, rotation, and offset controls.
- [Three.js glTF loading](https://threejs.org/manual/pages/load-gltf.html): authored 3D scene loading.
- [Catalogue evidence](../research/catalogue-evidence.md): local source locations and provenance.
