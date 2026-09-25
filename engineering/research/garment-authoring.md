# Garment authoring

*Last updated: 2026-09-25*

## Delivered assets

Six deterministic GLBs provide a fixed atelier mannequin and five garment silhouettes.
The authoring source is `engineering/codebase/uzbek-studio.frontend-services/scripts/author-garments.mjs`.
Outputs live in that frontend's `public/assets/models/` directory.

| Asset | Triangles | Bytes | Editable parts |
|---|---:|---:|---|
| `mannequin.glb` | 12,248 | 310,536 | None |
| `nimcha.glb` | 8,072 | 215,060 | `body`, `collar`, `trim`, `belt` |
| `baska.glb` | 11,712 | 291,348 | `body`, `trim`, `belt` |
| `kostyum.glb` | 11,544 | 291,616 | `body`, `collar`, `sleeves`, `trim` |
| `korset.glb` | 9,560 | 247,680 | `body`, `trim` |
| `abaya.glb` | 14,412 | 360,044 | `body`, `collar`, `sleeves`, `belt` |

`asset-manifest.json` records each GLB's SHA-256, bounds, mesh count, triangle count, and part coverage.
The models contain no embedded image textures; the studio assigns materials separately.

## Reference and provenance

The source catalogue is documented in [Catalogue evidence](catalogue-evidence.md).
Its photographs, generated references, and the new authored 3D assets remain distinct evidence classes.

Visually inspected source references under Maftuna's portfolio include:

- `products/nimcha-v01/media/och-nimcha-v01-source-photo-01.jpg`: asymmetric wrap, broad lapels, pointed hem, side tie.
- `products/look-v03/media/catalogue/och-look-v03-pro-img_7627.jpg`: long outer layer and distinct sleeve sections.
- `catalogue/images/collection/car-collection-layered-all-r01.png`: generated cutout composite showing the five families.

The models interpret visible silhouettes. Backs, internal construction, and fixed mannequin dimensions are authored choices,
not recovered sewing patterns, scans, exact product replicas, or fit guarantees. The baska is a waist-mounted peplum,
leaving the mannequin's upper torso visible as in the catalogue references.

## Geometry

- Curved torso panels follow a shared waist, hip, chest, and shoulder profile with garment-specific ease.
- Nimcha has asymmetric overlapping lapels, a pointed lower front, armhole binding, and an integrated side bow.
- Baska has a fitted waist, flared peplum panels, subtle folds, binding, and an integrated waist sash.
- Kostyum has a cropped body, broad collar, loose cape sleeves, cuffs, and a fixed gold front clasp.
- Korset has a strapless sweetheart edge, fitted waist, flared lower edge, panel seams, and three fixed gold fastenings.
- Abaya has a long open robe, sleeves, front facings, waist belt, knot, and hanging belt tails.
- Garment bodies have actual side and rear surfaces; they are not billboard images.
- The mannequin is a headless linen-coloured dress form with fixed arms and a brass stand.

The generator uses indexed surface meshes, curved lofts, polygon patches, ribbon surfaces, and narrow bound seams.
Garments are thin visual cloth shells rather than watertight solids or simulated cloth.

## Coordinate and mesh contract

- Metres; positive Y is up; positive Z faces forward; all assets share the same origin and scale.
- The stand base touches Y=0 within floating-point tolerance; the mannequin finial reaches Y=1.727.
- Waist Y=1.055; bust approximately Y=1.285; shoulder approximately Y=1.49.
- The widest asset, kostyum, spans approximately X=-0.573 to X=0.573.
- The abaya hem reaches approximately Y=0.224; detailed bounds are in the manifest.
- A practical orbit target is `[0, 1.0, 0]`, with the front camera on positive Z.
- Editable mesh names start with `<partId>.`; `mesh.userData.partId` carries that stable part ID.
- Built-in ties and sashes belong to `belt`; sleeve cuffs and narrow bindings belong to `trim` where defined.
- Fixed gold fastenings have `userData.fixedMaterial=true` and no `partId`.
- The mannequin's meshes are fixed materials and have no selectable part IDs.
- Scene replacement materials preserve `THREE.DoubleSide` for cloth interiors and open sleeves.

Asset-root extras record `assetVersion`, axes, units, authored provenance, and the fixed mannequin interpretation.

## UV contract

Every rendered mesh has finite UV coordinates. Body shells use a continuous circumferential U coordinate and
world-height V coordinate scaled by 0.8 metres. Open-front garments retain the seam at their front opening.
Sleeves unwrap around their circumference; collar patches use planar garment coordinates; ties follow ribbon length.
Shoulder pieces have separate charts, as actual joined garment panels do.

Runtime texture rotation and U/V offsets operate on these authored charts. UVs may extend beyond 0–1 deliberately;
textiles use repeat wrapping and `flipY=false` when assigned to GLTF meshes. The charts support visual textile placement,
not calibrated fabric cutting or guaranteed motif alignment between separately authored pieces.

## Rebuild and verification

From `engineering/codebase/uzbek-studio.frontend-services`:

```sh
node scripts/author-garments.mjs
```

The generator uses the installed `three` package and `GLTFExporter`; its Node `FileReader` shim packages binary buffers.
No external modelling application, remote service, image generation, or network call is needed to rebuild.

The generation pass rejects missing/nonfinite positions, normals, or UVs; invalid indices; unexpected part coverage;
incorrect part-name prefixes; assets above 35,000 triangles or 1,000,000 bytes; and out-of-range vertical bounds.

Executed verification on 2026-09-25:

- All six assets passed generator assertions and exported GLB header/length checks.
- Exported GLB JSON retained the expected selectable part extras and fixed-material classification.
- A repeated generation produced identical manifests and identical SHA-256 hashes for all six GLBs.
- Temporary headless Chrome rendered all five garments on the mannequin from front, three-quarter, and rear views.
- The same rendering check applied the studio's actual atlas, adras, bekasam, and garden textile images.
- Inspected views showed distinct silhouettes, visible backs, sleeve interiors, integrated attachments, and usable textile mapping.
- The running studio was also inspected at 1440×1000 across every garment's front, back, and side views.
- The integrated audit reported no page errors or alerts; the inspected views showed no garment/mannequin clipping.
- Abaya front binding meets the lapels at the waist, avoiding separate upright strips inside the open neckline.

These checks establish the authored assets' current rendering and interface contract. They do not establish physical fit,
patternmaking accuracy, or cloth simulation. Browser interaction and save/export verification belong to the integrated studio checks.
