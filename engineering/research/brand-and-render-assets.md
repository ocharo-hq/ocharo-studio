# Ocharo brand and model render sources

*Verified: 2026-09-26*

## Source boundary

The source workspace is `/Users/max/Projects/10x-ws/workbench/fam/mft-10x-ws`.
It was inspected read-only. Paths below are relative to
`context/domains/external/work/career/designer/portfolio/` within that workspace.
The app's assets are separate copies or display adaptations; source masters remain unchanged.

## Actual logo

`brand/logo/och-logo-approved-ivory-v1.png` is the approved tilted-needle master.
`brand/logo/och-logo-notes.md:5–9` explicitly distinguishes it from the black and white
transparent export drafts, whose contours and placement differ slightly. The wordmark reads
“Ocharo”, with the tilted sewing needle integrated into its script. No exact vector master was found.

The app now uses this approved master, rather than the former typed approximation:

- `public/assets/brand/ocharo-approved-ivory.png`: byte-identical 1536 × 1024 source copy.
  SHA-256: `32f2efeb381b92fdbf228c6f551909c8d1f78bc1212f1c6b79778cbbf8bcd33e`.
- `public/assets/brand/ocharo-wordmark.webp`: 768 × 512 format conversion, 17,484 bytes.
  `StudioBrand.vue` places it in an inline SVG using the original artwork coordinates.
  CSS supplies a monochrome light/dark presentation without tracing or redrawing letters.
- `public/assets/brand/ocharo-icon-source.webp`: 384 × 256 format conversion, 6,120 bytes.
- `public/favicon.svg`: 8,606 bytes, embeds that raster directly and clips the actual needle
  away from adjoining letters. There are no external image dependencies. This is an app icon
  adaptation, not a newly approved brand master.
- `public/assets/brand/manifest.json`: source, transforms, hashes, dimensions and runtime paths.

The full wordmark becomes unreadable inside a 16 px square. The needle retains a recognizable
silhouette at 16 px and a visible eye at 32 px. Headless Chrome decoded and rendered both options
at 16, 32, 64 and 128 px. Desktop/phone, light/dark wordmark layouts were visually inspected.
The favicon's warm ivory square retains space around the needle; no new monogram was invented.
The running app at `https://127.0.0.1:8262/` decoded both runtime assets successfully.
Its actual desktop, phone and dark-mode brand renderings were inspected, with no page or
brand-asset response errors. Vue SFC compilation and focused formatting checks pass.

`brand/och-brand-assets.md:5–9` records the selected social profile as the charcoal v8 composition
with the white wordmark. Its six mannequins are a brand scene, not six separate render environments.
That photographic composition is unsuitable for a tiny browser icon. The founder portrait at
`brand/portraits/och-maftuna-portrait-original.jpg` is a separate identity asset.

## Model reference and scene library

The reusable catalogue model is `catalogue/images/mock/car-model-baseline-white-v1.png`.
`catalogue/studies/car-study-notes.md:40` records it as generated from the approved Nimcha model
with the vest removed. It depicts an adult model in a white dress and cap; it must not be
misidentified as Maftuna's founder photograph.

`catalogue/images/baselines/och-baseline-00-original-interior.png` is an identical copy:
both SHA-256 hashes are `edf1d257f17c579fd60c8196d79a316dc56d145e7b304f841db8b96d0dd7ab9f`.
The authoritative guide is `catalogue/images/baselines/car-baseline-guide.md`;
`car-baseline-index.pdf` provides the eight-option overview.

| ID | Exact filename under `catalogue/images/baselines/` | Scene / pose | Current canonical products |
|---|---|---|---:|
| 00 | `och-baseline-00-original-interior.png` | Original warm interior; hands at waist | Original reference |
| 01 | `och-baseline-01-ivory-studio.png` | Ivory studio; hands at waist | 4 |
| 02 | `och-baseline-02-warm-plaster.png` | Warm plaster; arms down | 4 |
| 03 | `och-baseline-03-stone-arch.png` | Stone arch; slight turn | 4 |
| 04 | `och-baseline-04-wood-panel.png` | Walnut wall; arms down | 4 |
| 05 | `och-baseline-05-garden-wall.png` | Garden wall; small step | 3 |
| 06 | `och-baseline-06-gallery.png` | Grey gallery; weight shift | 4 |
| 07 | `och-baseline-07-terracotta.png` | Terracotta wall; slight turn | 3 |
| 08 | `och-baseline-08-window-light.png` | Window light; near frontal | 3 |

All eight scenes occur in the 29 canonical `products/<product-id>/och-<product-id>.json`
records via `assets.baseline_id`. The six unclassified `look-v01`–`look-v06` records have
no baseline assignment. Therefore neither the product records nor the scene guide establishes
which “exact six” the user intends. The separate T01–T06 marketing templates are layouts,
not model scene references. Selection remains pending clarification.

The scene images were visually inspected together. The guide labels them synthetic background
concepts, not photographs proving real venues (`car-baseline-guide.md:21`). Its reuse recipe
requires retaining face, apparent proportions, camera, white dress, styling, pose and background
while changing only the outer garment, with necessary sleeve/hand adjustments (`:25–29`).
It explicitly warns that generation may drift and that apparent height is not a measured size.

## Rendering implications

No `.glb`, `.gltf`, `.fbx`, `.blend`, `.obj`, `.dae`, `.vrm`, `.usd` or `.usdz` assets were found
in the source workspace. The located references provide no 3D body, rig, scene geometry,
camera calibration, depth map or measured fit contract for this model.

1. A generated photographic preview can use a selected baseline directly with the current
   garment image. Preserve the baseline and record exact inputs/prompt/hashes separately.
   Each output needs visual comparison for identity, garment shape and textile placement.
2. An interactive 3D version needs a separately authored model/rig and scene geometry.
   Reconstructing these from the raster references would be an interpretation, not the exact
   source model or scene. The existing mannequin remains the verified interactive asset.

Update 2026-09-26: the interactive mannequin became an authored, faceless 3D interpretation of this catalogue model in
the white dress ([garment authoring](garment-authoring.md)); it is not a reconstruction of the photographed person or scene.

Update 2026-09-27: the interactive mannequin is now the brand silhouette (cream dress form over an ivory skirt). The
catalogue-model figure stays in the 3D library as the model girl for the later final-render mode; option 2 above can
start from it, but the rendering mode and scene choice still wait for the user.

No model girl was generated or reconstructed during this investigation. The rendering mode
and six scene IDs require the user's choice before dependent implementation.
