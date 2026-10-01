# Catalogue evidence

*Last updated: 2026-09-26*

## Source and baseline

Source workspace: `/Users/max/Projects/10x-ws/workbench/fam/mft-10x-ws`.

Portfolio root, relative to that workspace: `context/domains/external/work/career/designer/portfolio/`.
Unless stated otherwise, paths below are relative to this portfolio root. Source files remain in Maftuna's workspace; this document records evidence without copying or modifying them.

The printed catalogue baseline is **v22**. `catalogue/studies/car-journal-v22-review.md:41–44` records Maftuna's confirmation and printing. The three editions contain 16 pages each:

- `catalogue/exports/car-ocharo-journal-v22-uz.pdf`
- `catalogue/exports/car-ocharo-journal-v22-ru.pdf`
- `catalogue/exports/car-ocharo-journal-v22-en.pdf`
- Editable counterparts: `catalogue/html/car-ocharo-journal-v22-uz.html`, `car-ocharo-journal-v22-ru.html`, and `car-ocharo-journal-v22-en.html`.
- Review and validation: `catalogue/studies/car-journal-v22-review.md` and `catalogue/studies/car-journal-v22-validation.json`.

The review records the v22 material correction to Shoyi / Шёлк / Silk for `baska-v03`, `korset-v02`, and `kostyum-v03`. Current canonical JSON takes precedence over earlier catalogue drafts or historical provenance snapshots.

## Canonical inventory

Direct parsing of current `products/*/och-*.json` found **29 classified product records across five families**, plus **six separate unclassified photographic looks**. Counts describe reference variants, not finished 3D assets or a requirement to model every variant initially.

| Family | Records | Current IDs | Example canonical JSON |
|---|---:|---|---|
| Nimcha / vest | 16 | `nimcha-v01` through `nimcha-v16` | `products/nimcha-v01/och-nimcha-v01.json` |
| Baska / peplum | 6 | `baska-v01` through `baska-v06` | `products/baska-v01/och-baska-v01.json` |
| Kostyum / cropped cape jacket | 4 | `kostyum-v01` through `kostyum-v04` | `products/kostyum-v01/och-kostyum-v01.json` |
| Korset / corset | 2 | `korset-v01`, `korset-v02` | `products/korset-v01/och-korset-v01.json` |
| Abaya | 1 | `abaya-v01` | `products/abaya-v01/och-abaya-v01.json` |
| Unclassified photographic looks | 6 | `look-v01` through `look-v06` | `products/look-v03/och-look-v03.json` |

Each listed ID has a canonical `products/<id>/och-<id>.json`. Current JSON retains `nimcha-v06`; the metadata guide and collection manifest also contain the historical alias `yarimta-nimcha-v01`. That alias is not a sixth family or another product.

The six look records have unknown garment type, name, fabric, decoration, and sizes. Their photographs may show complete ensembles or multiple garments; they do not establish new classified products. See `products/look-v03/och-look-v03.json:13–72` and `catalogue/studies/car-professional-photos-batch-02.md:7–16`.

## Available assets and provenance

All **233 registered asset paths** in the current canonical records resolved on 2026-09-25. These are registered references, not a count of unique photographic subjects or checksum-distinct originals.

| Canonical asset field | Count | Evidence class and permitted interpretation |
|---|---:|---|
| `source_images` | 77 | Supplied product images and professional photographs; includes 28 images across six looks |
| `source_videos` | 11 | Supplied product videos; usable for visible construction evidence |
| `product_reference_images` | 58 | Generated front and shallow three-quarter garment views, two per classified product |
| `cutout_images` | 58 | Transparent derivatives of generated garment references |
| `model_images` | 29 | Generated dressed-model studies, one selected per classified product |

`products/och-metadata-guide.md:23–29` distinguishes original media from generated references. `products/och-model-images.md:19–26` records generation provenance and the limitation that textile detail and apparent fit remain approximations. Per-product `provenance` and `history` retain prompts, source references, and hashes; historical entries are not current asset selections.

Original photographs, generated studies or textures, and future authored 3D assets remain distinct provenance classes. Catalogue approval does not convert a generated image into photographic, geometric, or fit evidence.

## Inspectable references

| Reference | Exact relative path | Interpretation |
|---|---|---|
| Nimcha real source photograph | `products/nimcha-v01/media/och-nimcha-v01-source-photo-01.jpg` | Visible black wrap vest, broad lapels, asymmetric red patterned front, side tie, pointed lower overlap |
| Nimcha generated front | `products/nimcha-v01/references/och-nimcha-v01-product-front-r01.png` | Isolated visual interpretation of that garment |
| Nimcha generated angle | `products/nimcha-v01/references/och-nimcha-v01-product-three-quarter-r01.png` | Estimated depth; not measured geometry |
| Nimcha transparent reference | `products/nimcha-v01/references/och-nimcha-v01-product-front-r01-transparent.png` | Compositing derivative, not a new source photograph |
| Real editorial photograph | `products/look-v03/media/catalogue/och-look-v03-pro-img_7627.jpg` | Long patterned outer layer with red embroidered sleeve sections and yellow fringe; product scope unclassified |
| Preserved editorial original | `products/look-v03/media/originals/och-look-v03-pro-img_7627.jpg` | Original corresponding to the preceding working image |
| Five-family overview | `catalogue/images/collection/car-collection-layered-all-r01.png` | Composite of existing generated cutouts, not a photograph of the collection |
| Nimcha reference board | `catalogue/images/collection/car-nimcha-all-reference-board.jpg` | Inventory board of generated garment references |
| Nimcha mannequin study | `catalogue/images/collection/car-nimcha-mannequins-all-r01.png` | Generated collection display; not 16 captured mannequins or 3D models |

Board provenance lives in `catalogue/images/collection/car-collection-overview-assets.json` and `catalogue/images/collection/car-nimcha-mannequins-all-r01.json`. The former states that existing transparent cutouts were composited; the latter records `image_gen` and labels its result a generated visual study.

The overview visibly differentiates waist-mounted flared baskas, sleeveless wrap nimchas, cropped cape-like kostyum jackets, strapless fitted korset forms, and a long open-front belted abaya. These are visual reference distinctions, not approved sewing specifications. Preserve asymmetric panel sides, ties, overlap, and fringe positions when interpreting a selected variant; `products/och-pattern-sweep-20260910.md:11` explicitly prohibits mirroring the garment to create another view.

## Missing geometry and known unknowns

The source-workspace scan found no files with the inspected 3D/CAD extensions: `.glb`, `.gltf`, `.obj`, `.fbx`, `.blend`, `.stl`, `.usdz`, `.dxf`, `.zprj`, `.zpac`, `.u3m`, `.pac`, `.rul`, `.aama`, `.mdl`, `.val`, `.vit`, `.plt`, or `.gerber`. No actual technical sewing-pattern files were located. This is a bounded file and text inventory, not inspection of every PDF page or archive member.

There is no verified garment mesh, fixed mannequin mesh, UV layout, authored part map, attachment geometry, measurement set, or cloth-simulation model in this evidence set. Photos do not establish unseen backs, internal seams, physical drape parameters, or fit. Generated three-quarter images estimate visible depth; rear construction remains unknown unless a selected product's real media shows it.

The agreed app scope uses newly authored single-size garments on a fixed mannequin. Each category's garment definition owns selectable parts and built-in attachments. Sizing, length changes, arbitrary attachment creation, and decoration editing are deferred. These are product decisions, not capabilities supplied by the catalogue assets.

## Textile register

Workspace-relative source: `context/domains/external/work/ventures/ocharo/ideas/pattern-catalogue.html`.

This is a proposed cloth/motif/colourway system, not a sewing-pattern library or ready 3D material set. Lines 103–126 define seven cloth IDs, fourteen motif IDs, six colourway IDs, and generation conventions. Several motif names explicitly say “ask her”; lines 178–180 distinguish literature labels from Maftuna's own terminology. Treat cultural names, meanings, and prescribed motif scales as source claims awaiting appropriate confirmation, not established app metadata.

The eight register rows at lines 240–247 have blank generation and “seen by her” cells. The register therefore does not establish generated or approved reusable textures. Existing garment photographs and generated patterned cutouts also do not establish seamless, calibrated fabric scans. Any app texture needs its own actual file, provenance, repeat/scale metadata, and review status.
