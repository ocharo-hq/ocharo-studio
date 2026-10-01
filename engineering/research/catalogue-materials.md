# Catalogue materials

*Evidence reviewed: 2026-09-25–26. Catalogue baseline: v22.*

## Source and coverage

Source workspace: `/Users/max/Projects/10x-ws/workbench/fam/mft-10x-ws`.

Canonical records live under `context/domains/external/work/career/designer/portfolio/products/<id>/och-<id>.json`. Current `locales.uz.fabric`, `classification.garment_type`, and `assets` fields govern this inventory; historical JSON snapshots do not override them. The v22 corrections retain **Shoyi** for Baska-v03, Korset-v02, and Kostyum-v03.

All **29 classified products** are covered: 16 Nimcha, six Baska, four Kostyum, two Korset, one Abaya. All 49 linked source photographs were visually inspected. Photo-less Nimcha-v06 and Nimcha-v16 were inspected through source-video preview frames in `products/review/och-<id>-video-01-preview.jpg`. The 11 linked source videos remain indexed; this audit did not inspect every video frame.

The six `look-v01`–`look-v06` professional-look groups remain outside this material inventory because their garment/material classification is unresolved. They are not six additional classified products. The original broader inventory has 233 asset references, including generated product references, cutouts and model studies; those generated images are not physical-cloth evidence.

The runtime coverage/provenance manifest is `engineering/codebase/ocharo-studio.frontend-services/apps/web/public/assets/textures/catalogue-materials.json`. It records every product's exact canonical JSON, all original photo/video paths, generated-reference paths in a separate field, material IDs, individual texture prompts, source hashes and output hashes. Runtime definitions are exported by `src/domain/studio/catalogueMaterialDefinitions.ts`.

## Material kinds

Kinds describe the catalogue's literal trade labels, independent of pattern family or colourway. They do **not** verify fibre composition, weave construction, weight, stretch, physical roughness or drape.

| Kind ID | Catalogue label | Products containing this kind |
|---|---|---:|
| `barbi` | Barbi | 16 |
| `atlas` | Atlas | 9 |
| `shoyi` | Shoyi | 3 |
| `beqasam` | Beqasam | 1 |
| `indian-scarf` | Hindiston sharfi | 11 |
| `gobelen` | Gobelen | 1 |
| `synthetic-fabric` | Sintetik mato | 2 |
| `synthetic-poplin` | Sintetik poplin | 1 |

Counts overlap because combined materials remain distinct kinds. `Beqasam` is the canonical source spelling. Older studio Adras and other broad material studies remain separate experiments, not additions to these eight source kinds.

## Pattern and colourway inventory

Twenty-one distinct patterned appearance fields are retained. Sharing a colour palette does not establish the same pattern: Baska-v04's red scroll ikat and Nimcha-v09's angular heart ikat remain separate. A shared pattern can have different stated material kinds: the outlined ivory paisley is registered independently for Atlas, synthetic cloth and synthetic poplin while reusing one texture image.

| Product | Current kinds | Pattern field / solid cloth |
|---|---|---|
| Abaya-v01 | Synthetic poplin | Ivory outlined paisley on black; black/ivory binding appearance |
| Baska-v01 | Barbi | Black solid; ivory circular embroidery stays decoration |
| Baska-v02 | Atlas | Black solid; waistband embroidery/beads stay decoration |
| Baska-v03 | Shoyi | Broad black/ivory ikat; black waistband appearance |
| Baska-v04 | Atlas, Barbi | Crimson scroll ikat sides; scarlet solid front |
| Baska-v05 | Barbi | Ivory solid; black circular embroidery stays decoration |
| Baska-v06 | Synthetic fabric | Ivory outlined paisley on black |
| Korset-v01 | Atlas | Ivory outlined paisley on black |
| Korset-v02 | Shoyi | Broad black/ivory ikat |
| Kostyum-v01 | Atlas | Narrow black/ivory streak ikat; black lapels visible in alternate photos |
| Kostyum-v02 | Beqasam, Atlas | Emerald/magenta/yellow/ivory stripe; emerald lapels/cuffs |
| Kostyum-v03 | Shoyi | Broad black/ivory ikat; black lapels/cuffs |
| Kostyum-v04 | Atlas | Black/orange/yellow floral ikat on ivory; ivory lapels/cuffs |
| Nimcha-v01 | Barbi, Indian scarf | Large scarlet filigree paisley on black; black base |
| Nimcha-v02 | Barbi, Indian scarf | Sand ground with orange/teal/blue flowers; sand base |
| Nimcha-v03 | Barbi, Indian scarf | Slate-blue filigree paisley on ivory; ivory base |
| Nimcha-v04 | Barbi, Indian scarf | Gold/ivory damask on black; black base |
| Nimcha-v05 | Barbi, Indian scarf | Fine ivory florals on black; black base |
| Nimcha-v06 | Synthetic fabric | Ivory outlined paisley on black; video preview evidence |
| Nimcha-v07 | Barbi, Indian scarf | Crimson/pink flowers with olive-gold vines on ivory; ivory base |
| Nimcha-v08 | Atlas | Fine ivory pendant diamonds with gold centres on black |
| Nimcha-v09 | Barbi, Atlas | Crimson angular heart ikat; ivory base, red lapel in alternate photo |
| Nimcha-v10 | Barbi, Indian scarf | Coral/mustard/blue botanical field on ivory; ivory base |
| Nimcha-v11 | Barbi, Indian scarf | Crimson flower medallions and muted gold/olive foliage on black |
| Nimcha-v12 | Atlas | Simple scarlet outline paisley on black |
| Nimcha-v13 | Barbi, Indian scarf | Pink/yellow flowers with turquoise/gold scrolling vines on black |
| Nimcha-v14 | Barbi, Indian scarf | Pale-blue blossoms and ivory/gold vines on burgundy |
| Nimcha-v15 | Barbi, Gobelen | Burgundy/black/ivory geometric stripes; black base |
| Nimcha-v16 | Barbi, Indian scarf | Gold/ivory ornament on scarlet; video preview evidence |

The broad monochrome Shoyi field is shared by Baska-v03, Korset-v02 and Kostyum-v03. The outlined ivory paisley field is shared by Abaya-v01, Baska-v06, Korset-v01 and Nimcha-v06. All eleven Indian-scarf appearances remain distinct.

## Garment and part filtering

The following sets are supported by the classified catalogue, not universal tailoring rules. The category-wide union is a practical first filter; users may experiment within it. A restrictive part filter should not imply that unverified construction details are known.

| Garment | Catalogue kind union | Conservative part recommendation |
|---|---|---|
| Nimcha | Barbi, Atlas, Indian scarf, synthetic fabric, Gobelen | Body accepts all five; collar/tie/binding initially Barbi, Atlas or synthetic fabric. A scarf field applies as a surface study, not proof of full-body scarf construction. |
| Baska | Barbi, Atlas, Shoyi, synthetic fabric | Body/waist/trim accept the four kinds. Beads and embroidery remain separate decoration. |
| Kostyum | Atlas, Beqasam, Shoyi | Body/sleeves accept all three; collar/cuff/trim prefer Atlas or Shoyi, reflecting photographed solid facings. |
| Korset | Atlas, Shoyi | Body/trim accept both. |
| Abaya | Synthetic poplin | Body/collar/sleeves/belt use synthetic poplin. |

The studio's fixed category meshes have body/collar/sleeve/trim/belt regions, not the exact asymmetric panel divisions of every photographed variant. Applying an Indian-scarf material to the common Nimcha body is a creative approximation. Single-sided scarf-panel placement, reversible garment construction and source-specific border layout are not reconstructed by these swatches.

## Generated texture provenance and limits

Each new patterned swatch is generated individually with the built-in `image_gen` tool using an inspected genuine source photo or video-preview frame as a visual reference. Original generated output paths and complete prompts are preserved in the manifest. Runtime WebP conversion only resizes/encodes the generated image; no procedural painting substitutes for source pattern generation.

The images approximate the **field** of each cloth. Distinct straight border bands, hanging fringe, beadwork, bindings and edge embroidery are not silently baked into a repeating field. Scarf floral embroidery contributes to the photographed cloth surface appearance, but the generated colour map does not model individual stitches or add physical decoration controls.

Solid materials are authored colour/finish approximations with no image texture. Material roughness values are rendering choices, not measured properties. Lighting and phone-camera colour shifts prevent calibrated colour claims. The alternate red lapel in Nimcha-v09 has no separately confirmed composition; its available red solid is an appearance approximation within the record's stated kinds.

Existing `pattern-catalogue.html` motifs, symbolism and proposed texture rows remain unconfirmed. This inventory does not promote their suggested names or meanings into verified product facts. All generated swatches remain assistant-inspected approximations, not Maftuna-approved physical textile scans.

## Delivery verification

The completed library exports **36 source-linked materials**: 23 patterned material definitions backed by 21 unique generated textures, plus 13 typed solids. Shared patterns retain separate material kinds. The 21 runtime images total 4,951,506 bytes; every file is a 1024×1024 opaque WebP, between 85,882 and 396,388 bytes. Original generated PNGs remain at their recorded tool-output paths.

All runtime swatches were visually inspected at normal and 2×2 repeated presentation. Three initially transparent generations were rejected and regenerated as opaque cloth. The previews retain source palette and motif families; exact seam continuity, motif dimensions and panel placement remain approximations.

`tests/catalogue.test.ts` passed three checks on 2026-09-26: every one of the 29 expected records maps to declared-kind materials; all 21 unique runtime textures resolve with matching hashes and bounded file sizes; definitions match the provenance manifest and remain reachable through category/part filters with valid defaults. Source photos/video files are referenced, not copied into the public asset library.
