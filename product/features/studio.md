# 3D Creative Studio

*Last updated: 2026-09-25*

## Outcome

A designer can turn an authored garment and textile images into a named, editable look without learning specialist 3D controls.

## Experience contract

The mannequin and current garment remain the visual focus. A left menu exposes garments, materials, and saved looks. The top toolbar changes with the current garment or part. Floating cloud or island panels keep choices close to the object without crowding it. Primary actions use large icons with text labels or accessible tooltips.

### Garments and parts

- Choosing a garment replaces the current garment in one action and fits it to the fixed mannequin.
- Each garment exposes only the parts authored for that asset, such as body, collar, sleeve, or border.
- Selecting a part makes its material and texture-placement controls available and clearly identifies the selection on the model.
- Buttons, side ties, knots, and similar attachments belong to the garment definition and appear automatically.
- Users cannot add arbitrary attachments, move the garment freely, reshape it, or change its size or length in the first release.

### Materials and texture placement

- Choosing a material applies it immediately to the selected part.
- Each editable part retains its chosen material, rotation, U offset, and V offset.
- Controls make pattern movement visible while they are adjusted and provide a practical reset.
- Camera orbit, zoom, and view reset are visually and behaviourally distinct from texture placement.
- A failed or unsupported material assignment produces a clear recoverable state and does not corrupt the current look.

### Creative continuity

- Undo restores meaningful editing actions without unexpectedly changing the camera.
- Saving requires or obtains a usable look name and preserves garment identity, garment version, part selections, material identities, texture transforms, and relevant asset versions.
- Reopening a saved look restores an editable composition rather than only a rendered image.
- Portable JSON export contains enough versioned data to re-import a compatible look.
- Preview export produces a clean presentation image without editor chrome.

## Acceptance criteria

1. From a fresh session, a user can load an authored nimcha on the mannequin and recognize its declared editable parts.
2. The user can select two different parts and give each a different material without either assignment leaking to the other.
3. Rotation and U/V offset visibly reposition the selected part's pattern while camera orbit continues to rotate only the view.
4. The garment's authored attachments load with it and no interface offers arbitrary attachment creation.
5. Undo reverses the last material or texture-placement change; redo reapplies that change.
6. A named look can be saved, the studio reopened, and that look restored with the same garment, part materials, and texture transforms.
7. Exported JSON is portable and versioned; an exported preview is a clean image suitable for sharing.
8. Compact controls remain usable on narrower screens, while desktop remains the primary editing experience.
9. Source photographs, generated studies or textures, and authored 3D assets remain distinguishable in product metadata.
10. The interface makes no claim that an interpreted asset is an exact replica, production pattern, or fit guarantee.

## Content acceptance

The nimcha slice is complete only when at least one real authored garment asset runs through every acceptance criterion. A later family is complete only when its authored garment loads with its own valid part list and attachments and completes the same save/reopen/export loop.

## Deferred extensions

Decorative overlays and garment-specific size or length controls may be explored after the five-family workflow is usable. They require their own asset rules and acceptance criteria before implementation.
