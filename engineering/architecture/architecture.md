# Architecture

*Last updated: 2026-09-25*

## Foundation

A single .NET host serves API routes and the built React SPA. Development uses Vite HMR with a same-origin API proxy.
Clean Architecture retains API, Application, Domain, Infrastructure, and Persistence projects.
The current greeting vertical is template demonstration code, not a clothing-domain implementation.

## Browser studio — proposed implementation

Use Three.js through an appropriate React integration after verifying current dependency compatibility.
The renderer consumes serializable design state; rendering objects must not become the persistence format.
Separate camera navigation, garment selection, part selection, and texture placement.

## Asset contract

Each versioned garment definition declares:

- Stable garment/category identifiers and a display name.
- One mannequin-compatible, fixed-size mesh asset, preferably GLB.
- Named selectable parts mapped to stable mesh/material-slot identifiers.
- Valid default materials and texture coordinates for each part.
- Category-specific buttons, side ties, knots, and other built-in meshes.
- Whether an attachment shares a part's material or retains its own fixed material.
- Default placement, thumbnail, provenance, and asset version.

Garment assets must fit the same mannequin coordinate system, scale, and pose.
Attachment geometry is authored with the garment and loaded automatically.
Raycasting maps a visible surface to its stable part identifier.
Changing one part's texture must not mutate another part through a shared material or texture-transform instance.

## Materials

A material definition contains a stable identifier, preview swatch, colour texture, surface parameters,
optional supporting maps, provenance, and version.
Generate seamless textile images where useful; keep baked shadows and mannequin silhouettes out of reusable swatches.
Source catalogue imagery remains reference evidence and must not be relabelled as physically measured material data.

Each selected part stores material identity plus texture rotation and U/V offsets.
Texture placement occurs in the part's authored UV space, independently of camera orbit.
Defaults should give a useful scale; additional scale controls can follow only if the initial interaction requires them.
Material decoration overlays, accurate cloth simulation, resizing, and sewing-pattern generation are deferred.

## Persistence — implementation default

Use a versioned JSON design document containing garment/asset versions, per-part material assignments,
per-part texture transforms, and optional camera settings.
Local browser persistence, portable JSON import/export, and preview image export form the proposed first save workflow.
Account storage and remote collaboration are not required for the first complete slice.
Validate imported document versions and identifiers; provide a clear message for missing assets or incompatible documents.

## Asset authoring

Blender is permitted for modelling, UV unwrapping, and GLB export.
Keep authoring source or reproducible scripts with an asset manifest.
Apply the workspace binary/LFS rules before staging large assets.
Front references alone cannot establish exact backs, seams, fit, or drape; label new shapes as interpretations.
First prove a complete nimcha workflow, then add the remaining catalogue families through the same contract.

## References

- [Three.js textures](https://threejs.org/docs/pages/Texture.html): texture repeat, rotation, and offset controls.
- [Three.js glTF loading](https://threejs.org/manual/pages/load-gltf.html): authored 3D scene loading.
- [Catalogue evidence](../research/catalogue-evidence.md): local source locations and provenance.
