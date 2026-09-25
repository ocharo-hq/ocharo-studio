# Architecture

*Last updated: 2026-09-25*

## Runtime

A single .NET host serves `GET /api/studio` and the built React SPA. Development uses Vite HMR with a same-origin
API proxy. The backend retains API, Application, Domain, and test projects; unused Infrastructure, Persistence,
database, and greeting code have been removed.

The frontend follows domain, application, integration, presentation, and bootstrap layers. React owns application
orchestration and controls; a lifecycle hook adapts the renderer at the application-to-integration boundary.
Three.js owns the WebGL scene without entering serializable design state.

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
optional supporting maps, provenance, and version. The current library has four generated patterned textures and
six authored solid materials.
Generate seamless textile images where useful; keep baked shadows and mannequin silhouettes out of reusable swatches.
Source catalogue imagery remains reference evidence and must not be relabelled as physically measured material data.

Each selected part stores material identity plus texture rotation in degrees and normalized U/V offsets.
Texture placement occurs in the part's authored UV space, independently of camera orbit.
Defaults should give a useful scale; additional scale controls can follow only if the initial interaction requires them.
Material decoration overlays, accurate cloth simulation, resizing, and sewing-pattern generation are deferred.

## Persistence

A versioned JSON design document contains garment and asset versions, every declared part assignment, and per-part
texture transforms. Guarded local storage keeps a separate autosaved draft and explicit saved looks. Users can update
a look, save a copy with a new identity, import or export validated JSON, and export the current view as PNG.

Validation rejects unknown schemas, assets, garments, materials, parts, malformed IDs and dates, incomplete part maps,
and non-finite or out-of-range transforms without replacing the active design. Storage failures remain recoverable
and never report an unsafe save as durable.

Persistence is local to one browser profile. There are no accounts, remote storage, or multi-user collaboration.

## Asset authoring

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
