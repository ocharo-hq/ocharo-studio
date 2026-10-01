# High-definition model girl

*Last updated: 2026-09-28*

> How to build a high-definition 3D version of the catalogue model for studio renders.
> Status: analysis and recommendation. Nothing here is built yet; the downloads need approval.

## Target

- **Likeness:** the reusable catalogue model (`catalogue/images/mock/car-model-baseline-white-v1.png` and the eight
  baselines): a young woman with dark wavy hair in a low bun, an embroidered burgundy-and-gold headband, gold drop
  earrings, a soft smile, and the crinkled cream dress with a mandarin collar and bishop sleeves.
- **Fit:** the five garments are built on the dress surface in `figure.py`. A new body must keep that dress envelope,
  or every garment has to be refitted.
- **Licence:** in-browser renders download the GLB, so its licence must allow redistribution in a web app.
- **Budget:** the web GLB should stay near 10–15 MB, with 2K textures. Offline catalogue stills have no such limit.

Today's `och-model.glb` is a stylised, faceless figure with the right proportions and dress. The studio render
already uses it (**Export → Studio render → Model**), so a better model only swaps the asset.

## Options

| Route | Likeness | Separable body for garments | Licence for the web | Effort and needs |
|---|---|---|---|---|
| Image-to-3D services (Rodin, Meshy, Tripo, Hunyuan3D) | Good silhouette; face soft at full-body scale | No — body, dress and hair fuse into one mesh with lighting baked in | Paid plans allow commercial use; check each | Account and image upload by you; minutes per try; heavy clean-up |
| Local open-source generators (TRELLIS, Hunyuan3D) | Same as above | No | Varies | TRELLIS needs CUDA; Hunyuan3D textures need CUDA. This Mac (M4 Max) cannot run them properly |
| MPFB2 parametric human in Blender | Approximate through face sliders; close from the front with a projected face texture | Yes — rigged body, eyes, brows, lashes, teeth, hair assets | Assets and exported people are CC0 | Two free downloads; I can drive it headless with Blender scripts |
| MetaHuman (Unreal Engine 5.6+) | Best photorealism; likeness by in-editor sculpting | Yes | Allowed outside Unreal since June 2025, including commercially; check the standalone-asset terms before shipping the GLB | Unreal install (tens of GB), Epic account, interactive editing |
| Hand sculpt (ZBrush or Blender Sculpt) | Excellent in a character artist's hands | Yes | Yours | I cannot hand-sculpt a portrait through scripts; ZBrush adds cost, not ability. A hired artist takes 1–3 weeks |
| Photogrammetry or Gaussian splats | — | No | — | Needs a real person photographed from all sides; the catalogue model is generated |

**Short answers:**
- Generation tools give a quick statue of her, but not a model that can wear our garments.
- I can script sculpting (shapes, proportions, hair shells), but not a true portrait likeness.
- ZBrush would not help me; it would help a human artist.
- Blender, with the MPFB2 extension, is the right place for this.

## Recommendation

1. **Body:** MPFB2 young-adult female, proportions set to the current figure (crown 1.69 m, raised waist 1.12 m,
   slim frame), arms relaxed. Shape keys pull the torso to the `figure.py` envelope so every garment still fits.
2. **Face:** face sliders tuned against the catalogue front view. The catalogue face is then projected onto the
   head from a camera matched to that photo, giving her eyes, brows and lips. Front and three-quarter views read as
   her; profiles stay approximate.
3. **Skin and eyes:** MakeHuman natural-female skin (CC0) and MPFB procedural eyes. For the web: a physical
   material with light sheen. For offline stills: Cycles subsurface skin.
4. **Hair:** dark wavy hair drawn back into the low bun. Hair cards for the web (the current shell upgraded); Blender
   hair curves for offline stills.
5. **Headband and earrings:** modelled; the headband takes an embroidery texture cut from the catalogue photo.
6. **Dress:** the existing dress, plus a crinkle-stripe normal map for its seersucker texture.
7. **Delivery:** `och-model.glb` in the library (≤12 MB, 2K textures), synced as the studio's `model.glb`. A
   Blender scene sets up catalogue-grade Cycles stills of any saved look.

Optional second phase: a MetaHuman or artist-made hero head for catalogue stills only, if the scripted likeness is
not close enough.

## Approvals needed

- Download the MPFB2 extension (`mpfb` 2.0.17, 42.9 MB) from `extensions.blender.org`. The page lists Blender
  4.2+ support and does not mention 5.0 explicitly.
- Download the MakeHuman system assets (267 MB, CC0: skins, eyes, teeth, eyebrows, hair) from
  `static.makehumancommunity.org`, plus the natural-female skin pack.
- Confirm that the face may be projected from the catalogue image. That image is generated, not a real person.

## Rendering already in place (2026-09-28)

- The studio viewport now uses neutral tone mapping, 4× multisampling and soft key-light shadows with a floor catcher.
  Cloth gets sheen, satin highlights for silks and a procedural weave relief per cloth kind.
- **Studio render** creates 1600×2000 or 2400×3000 PNGs on the silhouette or the model. It supports four views and
  four backdrops, including transparent. Renders use 8× multisampling and ambient occlusion, with a lighter path
  on devices without a GPU.
- Textile images top out at 1254 px (their generated originals). True 2K cloth needs the textiles regenerated at 2048.
