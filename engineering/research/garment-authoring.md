# Garment authoring

*Last updated: 2026-09-29*

## Source of the assets

The silhouette, the catalogue-model figure and the five garments are authored in Blender and kept in the
[Ocharo Assets garment library](../../../ocharo-assets/engineering/codebase/ocharo-assets.library/garments/och-3d-garments.md).
The library holds the Python build source, one `.blend` scene with every asset, the exported GLBs with their own
manifest, and review renders. Studio consumes copies of the GLBs.

To update the studio after a library rebuild, from `engineering/codebase/ocharo-studio.frontend-services`:

```sh
pnpm assets:sync -- --from ../../../../ocharo-assets/engineering/codebase/ocharo-assets.library/garments
```

`scripts/sync-garments.mjs` verifies each GLB against the library manifest hash, checks the binary structure, part
coverage, fixed attachments, finite positions, normals and UVs, index ranges, and size limits, then copies the files
into `public/assets/models/` and writes `asset-manifest.json`. `OCHARO_3D_LIBRARY` can replace `--from`. The earlier
Three.js generator (`scripts/author-garments.mjs`) was retired with the remodel; git history keeps it.

## Delivered assets (asset version 2.0.0)

| Studio file | Library source | Triangles | Bytes | Editable parts | Fixed attachments |
|---|---|---:|---:|---|---|
| `mannequin.glb` | `och-silhouette.glb` | 23,472 | 538,664 | None | Whole silhouette; soft arms only with `sleeves` |
| `model.glb` | `och-model.glb` | 46,828 | 1,095,016 | None | Whole figure; studio renders only |
| `nimcha.glb` | `och-nimcha.glb` | 31,240 | 844,916 | `body`, `collar`, `trim`, `belt` | None |
| `baska.glb` | `och-baska.glb` | 15,944 | 420,848 | `body`, `trim`, `belt` | None |
| `kostyum.glb` | `och-kostyum.glb` | 33,196 | 832,432 | `body`, `collar`, `sleeves`, `trim` | Gold clasp |
| `korset.glb` | `och-korset.glb` | 17,732 | 474,124 | `body`, `trim` | Three gold fastenings |
| `abaya.glb` | `och-abaya.glb` | 37,388 | 945,628 | `body`, `collar`, `sleeves`, `belt` | None |

The models contain no embedded image textures; the studio assigns textile materials per part.
`model.glb` (the catalogue model) loads only in **Studio render**; the editor keeps the silhouette.

## The silhouette

The garment holder follows the brand silhouettes — the headless, armless cream dress forms over long ivory skirts in
`brand/backgrounds/och-silhouettes-*` and `catalogue/images/collection/car-nimcha-mannequins-all-r01.png`.

- Torso and skirt are the catalogue model's dress surface without the waist crease, so every garment keeps the ease it
  was built with. Arm plates widen the shoulders like a dress form's; the bust is softer than the dress's.
- The torso rises into a neck with a domed cap at Y≈1.506. There is no head, hair or face.
- Soft fabric arms follow the model's arm path inside every garment sleeve. The node `silhouette_arms` carries
  `extras.showWith="sleeves"`; `StudioScene` removes it when the garment has no `sleeves` part, so the nimcha, baska
  and korset sit on the armless form of the brand imagery.
- Three fixed-material meshes: `silhouette_form` (cream linen), `silhouette_skirt` (ivory), `silhouette_arms`.

## The catalogue model (final renders)

The library also interprets the reusable catalogue model (`catalogue/images/mock/car-model-baseline-white-v1.png`
and the arms-down baseline `och-baseline-04-wood-panel.png`): a slim, faceless adult figure in the ivory base dress
with hair in a low bun and a burgundy headband. It shares the silhouette's torso and skirt, so the same garments fit
it. Studio render uses it; a high-definition replacement is planned in [model-girl-hd](model-girl-hd.md).

## Garment interpretations

Each garment follows its catalogue family; exact cloth, fit and hidden construction remain interpretations.

- Nimcha (`nimcha-v01` family): fitted sleeveless wrap vest. The wearer's left front crosses to the right waist and
  ties in a bow with two loops and hanging tails; a broad diagonal facing runs up that edge into the collar; the right
  front shows a notched lapel. Pointed hem, bound armholes and hem.
- Baska (`baska-v01`): tall waistband closing under a centre-front knot, two stiff front panels open at centre front
  that slant to points beside the gap, bound hems with beaded fringe. The back carries the waistband only.
- Kostyum (`kostyum-v01`–`v04`): cropped jacket ending at the dress waist, fronts meeting edge to edge below the
  break point, rolled notched lapels, stand-and-fall collar, cape sleeves set into the armholes with a front slit and
  contrast linings and hem bands. The sleeves hang close to the arms and end past the wrist.
- Korset (`korset-v01`): strapless princess-seamed bodice, straight across the front and lower under the arms and at
  the back, waist seam, flared peplum with soft folds, border band and top binding.
- Abaya (`abaya-v01`): floor-length open robe, contrast facings up both fronts and around the back neck as a shawl
  collar, wide sleeves set into dropped armholes with contrast cuffs, sash with knot, long ties and tassels.

Part mapping follows the unchanged catalogue definitions: facings, lapels, collars and abaya cuffs are `collar`;
kostyum linings, sleeve hem bands and hem binding are `trim`; nimcha armhole and hem bindings are `trim`; the baska
waistband and knot are `belt`.

## Construction

- Garments are patterned as 2D outlines around the dress (angle and height). Each outline is filled with a conforming
  triangle mesh, mapped onto a smooth garment envelope of the dress plus an ease field, and given real thickness.
- The envelope removes the waist-seam crease and skirt folds and blurs over about a centimetre of height, so offsets
  cannot fold back on themselves. Skirt fold depth is added to the ease wherever a garment passes over the skirt.
- Panels that share a seam are sampled on the same curve, so seams close without gaps.
- Sleeves are set in: their first row lies on the garment's armhole, then blends into rings around the arm.
- Lapel and facing edges carry a rounded roll that spans the panel beneath and the lapel on top.
- Checks reject non-finite vertices, stray edges, missing UVs, multi-material meshes and unexpected part coverage.

## Coordinate and mesh contract

- Metres; positive Y is up; positive Z faces forward; all assets share one origin and scale.
- The skirt hem rests on the floor (min Y 0.003); the silhouette's neck cap reaches Y≈1.506 (the model's
  headband Y≈1.718).
- Raised waist seam Y=1.12; bust ≈ 1.25; shoulder line ≈ 1.35.
- The widest garment is the abaya (X ±0.394); the kostyum sleeves reach X ±0.350.
- Each editable mesh is one node per part named after its part ID, with `extras.partId`; fixed attachments carry
  `extras.fixedMaterial=true` and no part ID. Every mesh has one material.
- Asset-root nodes record `assetId`, `assetVersion`, units, axes, provenance and the fit disclaimer.
- Mannequin nodes with `extras.showWith=<partId>` load only with a garment that has that part.
- The camera framing (target `[0, 0.76, 0]`, front camera `[0, 0.86, 3.3]`) fits the silhouette from neck cap to
  hem inside the stage, clear of the toolbar and view controls.

## UV contract

Every mesh carries finite metric UVs from its pattern outline (1 unit = 1 metre). The studio still replaces them at load
with `mapSurfaceCoordinates()` (global cylindrical mapping), so saved schema-2 documents keep their anchors; document
`assetVersion` remains `1`. A move to the authored panel UVs needs an explicit mapping version and migration.

## Verification (2026-09-27, silhouette)

- The library build stayed deterministic: every garment GLB and the model are byte-identical to the previous build;
  only `och-silhouette.glb` is new. The sync script accepted it, including the `showWith` node extra.
- Clearance: rays from the form's axis and the soft arms' axes found no silhouette point outside the nimcha, baska or
  korset. Kostyum and abaya contacts lie only in the armpits and under the sleeve caps, the places the model's own
  sleeves occupied; front, back, side, shoulder and top close-ups showed nothing through the cloth.
- The actual `StudioScene` renderer showed all five garments with catalogue textiles in front, side, back and detail
  views, plus the studio at 1440 px (light and dark) and 390 px. Landing renders were recaptured with the new framing.

## Verification (2026-09-26)

- Two consecutive library builds produced byte-identical GLBs.
- The sync script accepted all six GLBs against the library manifest and the part contract.
- The actual `StudioScene` renderer loaded each garment with its default catalogue materials through the running dev
  server (temporary review page, headless Chromium); front, side, back and detail captures showed no page errors,
  continuous textile mapping across panels, closed seams and no garment/figure clipping in the inspected views.
- Part selection outlines render on the new meshes; frontend lint, catalogue agreement, 82 unit tests and formatting
  passed after the change.
- The landing renders (`public/assets/landing/*.png`) were recaptured from the same renderer; see their manifest.

These checks establish the rendering and interface contract. They do not establish physical fit, patternmaking
accuracy or cloth simulation.
