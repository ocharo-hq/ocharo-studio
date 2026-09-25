# Studio interface

*Last updated: 2026-09-25*

## Direction

A quiet atelier surrounds the garment. Warm ivory, pomegranate accents, compact editorial serif headings,
and rounded floating islands keep fabric colour at the centre of the experience. The layout follows the
user's chosen left library and contextual top toolbar; design choices were made autonomously under the full-build authorization.

The left library switches between five silhouettes, textile swatches, and saved looks. Selecting a garment
loads its fixed-size geometry and category-owned attachments. The top toolbar selects a garment part and
exposes undo/redo. The right island shows the active part's material and pattern placement. Solid materials
hide texture transform controls. The bottom island owns camera presets, zoom, fit, and detail inspection.

## Tokens and surfaces

Semantic tokens live in `src/bootstrap/index.css`, extending the workspace React SDK token stylesheet.
Light and dark palettes share the same layout. The theme preference uses the SDK persistent-state hook;
bootstrap owns the root `dark` class. Ivory/ink surfaces have restrained borders and shadows. Light-mode
secondary text uses `#626b62` for readable contrast against the canvas and cards.

Desktop preserves a large central canvas with floating controls. At tablet widths, the libraries move below
the scene. At phone widths, the contextual toolbar and camera remain with the preview while the inspector
and library stack below. Controls remain reachable without horizontal scrolling.

## Interaction and accessibility

- Native buttons, labelled range inputs, part select, named dialog, and roving keyboard tabs.
- Direct mesh selection has equivalent select/chip controls.
- Camera orbit does not change part selection; texture rotation uses degrees in authored UV space.
- Slider gestures form a single undo operation; material changes never mutate other parts.
- `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, and `Ctrl/Cmd+S` support editing; Escape dismisses dialogs.
- WebGL, model, and texture failures expose retry controls.
- Saving reports storage failure; JSON export remains available as a portable copy.
- Automated light/dark contrast and keyboard checks accompany the browser workflow suite.

## Assets

The six authored GLBs and reproducible authoring script are described in
[garment-authoring.md](../research/garment-authoring.md). Four original textile studies were generated
with the built-in image tool; exact prompts and provenance are preserved in
`engineering/codebase/uzbek-studio.frontend-services/public/assets/textures/manifest.json`.
The selected PNGs are stored through Git LFS. Six authored solid materials supplement these textiles.

[studio-preview.png](../research/studio-preview.png) shows the verified desktop interface.

## Limits

These garments are fixed-size visual interpretations. Physical cloth simulation, fit guarantees, pattern drafting,
sizing, length editing, decorative overlays, and arbitrary attachment placement are outside this release.
Local looks belong to one browser origin; JSON files provide transfer and backup. Accounts and shared cloud storage
are not part of the implementation.
