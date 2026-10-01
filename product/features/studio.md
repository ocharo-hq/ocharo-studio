# 3D Creative Studio

*Last updated: 2026-09-28*

## Outcome

A designer can turn an authored garment and textile images into a named, editable look without learning specialist 3D controls.

## Experience contract

The mannequin and current garment remain the visual focus. A left menu exposes garments, materials, and saved looks. The top toolbar changes with the current garment or part. Floating cloud or island panels keep choices close to the object without crowding it. Primary actions use large icons with text labels or accessible tooltips.

### Garments and parts

- Choosing a garment replaces the current garment in one action and fits it to the fixed mannequin.
- Each garment exposes only the parts authored for that asset, such as body, collar, sleeve, or border.
- Selecting parts highlights their edges in amber. The styled picker supports grouped selection on touch screens; modifier-click extends selection on the model.
- Buttons, side ties, knots, and similar attachments belong to the garment definition and appear automatically.
- Users cannot add arbitrary attachments, move the garment freely, reshape it, or change its size or length in the first release.

### Materials and texture placement

- Choosing a material applies it immediately to every selected part. Group choices are limited to materials compatible with all selected parts.
- Group editing changes garment-relative horizontal/vertical offsets in one undo step; rotation and both placement anchors remain individual.
- Material Studio opens from the header or Edit material in the inspector. It previews scale locally before an explicit save.
- Saving material scale updates every assignment using that material, including previously saved looks. It preserves rotation, offsets and anchors.
- Each editable part retains its chosen material, rotation, offsets, and material and garment anchors. Portable exports also include the resolved scale.
- Legacy per-part scales remain until the material is explicitly saved. Undo, reset and opening/importing designs retain the current shared material scale.
- Controls make pattern movement visible while they are adjusted and provide a practical reset.
- Camera orbit, zoom, and animated front/back/side views remain distinct from texture placement. Every garment starts at the same full-height mannequin frame; changing garments preserves the current camera.
- Pixel-mode two-finger scrolling orbits, pinch zooms, and explicit zoom controls remain available.
- A failed or unsupported material assignment produces a clear recoverable state and does not corrupt the current look.

### Creative continuity

- New design sits beside the actual brand wordmark. It preserves meaningful drafts in My looks and refuses a new retained draft when the collection is full.
- The inactive name is centered with the current garment beneath it; the editable name aligns left.
- A contextual walkthrough spotlights actual controls and waits for requested user interactions. It remains accessible in Settings.
- Undo restores meaningful editing actions without unexpectedly changing the camera.
- Saving as a new look preserves the source look and gives the variant a distinct identity.
- Saving requires or obtains a usable look name and preserves garment identity, garment version, part selections, material identities, texture transforms, and relevant asset versions.
- Reopening a saved look restores an editable composition rather than only a rendered image.
- Portable JSON export contains enough versioned data to re-import a compatible look.
- Preview export produces a clean presentation image without editor chrome.
- A failed server write preserves the browser recovery copy, reports offline or conflict state, and permits retry.
- A stale revision never overwrites another tab's newer state; conflict recovery remains exportable.
- Deletion and discarded material-preview changes use accessible, blurred confirmation dialogs with cancel and keyboard dismissal.

## Implementation status

The local application implements the five garment-family selectors, per-part materials, pattern placement, camera controls, undo and redo, named saved looks,
save-as-copy, SQLite persistence with optimistic revisions, per-tab browser recovery, schema-1 migration, validated
schema-2 JSON import, and JSON and preview export. Authored interpretation meshes and generated textile studies are
present for the current local build.

Automated domain tests cover state isolation, bounded history, corrupt data, storage failures, persistence retry, save-copy identity, and draft recovery.
Executed counts and host-specific results are maintained in [verification](../../engineering/research/previous-work/verification.md). Human usability, visual fidelity, performance,
and cross-browser review also remain pending; implementation presence does not establish those acceptance results.

## Acceptance criteria

1. From a fresh session, a user can load an authored nimcha on the mannequin and recognize its declared editable parts.
2. The user can select two different parts and give each a different material without either assignment leaking to the other.
3. Rotation and garment-relative offset visibly reposition the selected part's pattern. Material Studio scale updates every current and saved use; camera orbit rotates only the view.
4. The garment's authored attachments load with it and no interface offers arbitrary attachment creation.
5. Undo reverses the last material or texture-placement change; redo reapplies that change.
6. A named look can be saved, the studio reopened, and that look restored from the same browser workspace with the same garment, part materials, and texture transforms.
   Saving a variant as a new look preserves the original.
7. Exported JSON is portable and versioned; an exported preview is a clean image suitable for sharing.
8. Compact controls remain usable on narrower screens, while desktop remains the primary editing experience.
9. Source photographs, generated studies or textures, and authored 3D assets remain distinguishable in product metadata.
10. The interface makes no claim that an interpreted asset is an exact replica, production pattern, or fit guarantee.

## Content acceptance

The nimcha slice is complete only when at least one real authored garment asset runs through every acceptance criterion. A later family is complete only when its authored garment loads with its own valid part list and attachments and completes the same save/reopen/export loop.

## Deferred extensions

The fixed mannequin is the Ocharo silhouette: a cream dress form over a floor-length ivory skirt, after the brand silhouettes and sized to the catalogue model (asset version 2.0.0). It gains soft arms only under sleeved garments. Studio render (Export) creates print-size PNGs of a look on the silhouette or the catalogue model (the model girl), from four views on four backdrops. The model is still stylised and faceless; a high-definition likeness is planned in `engineering/research/model-girl-hd.md`. Scene backgrounds from the catalogue baselines and a rigged character remain out of scope. Normalized relational APIs are planned but deferred.

Decorative overlays and garment-specific size or length controls may be explored after the five-family workflow is usable. They require their own asset rules and acceptance criteria before implementation.
