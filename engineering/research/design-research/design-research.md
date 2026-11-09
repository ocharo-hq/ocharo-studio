# Studio interface

*Last updated: 2026-11-09*

## Screens

| Class | Width | Served | Layout |
|---|---|---|---|
| desktop | ≥ 1024px | primary | large central canvas with floating library, part, inspector and camera islands |
| tablet | 768–1023px | yes | Canvas, Library and Edit part switch; an open sheet reserves the lower screen |
| phone | < 768px | yes | as tablet, sheets over the lower screen; the frame drops its bottom bar (owner, 2026-10-20) |

The steps answer the editor's own width, so the sidebar rail and an expanded sidebar move them as the viewport would.

## Tokens

Every colour comes from the fe SDK `ocharo` theme (`@wow-two-beta/fe` `themes.css`, `theme-ocharo` on `<html>`);
`src/bootstrap/styles/tokens.css` maps Studio's short names onto it. Values below are the theme's as of fe `0.0.31`;
the theme file wins where they differ.

| Studio token | `@wow-two-beta/fe` token | Light | Dark |
|---|---|---|---|
| `--canvas` | `--color-background` | `#f5f6fa` | `#141416` |
| `--paper` | `--color-card` | `#ffffff` | `#1d1d20` |
| `--ink` | `--color-foreground` | `#181b25` | `#f4f2f5` |
| `--muted` | `--color-muted-foreground` | `#555e72` | `#b7b3bd` |
| `--wash` | `--color-muted` | `#eef0f6` | `#262629` |
| `--line` | `--color-border` | `#dfe3ed` | `#3d3b42` |
| `--accent` | `--color-primary` | `#8b2459` | `#c24783` |
| `--on-accent` | `--color-primary-foreground` | `#ffffff` | `#ffffff` |
| `--accent-soft` | `--color-primary-soft` | `#f8e9f0` | `#392330` |
| `--accent-ink` | `--color-primary-soft-foreground` | `#892257` | `#e69abc` |
| `--info` · `--info-soft` | `--color-info` · `--color-info-soft` | `#176d8b` · `#e3f1f9` | `#94c6e1` · `#20333c` |
| `--success` · `--success-soft` | `--color-success` · `--color-success-soft` | `#426553` · `#e9f0e9` | `#a6cfb4` · `#263d30` |
| `--warning` · `--warning-soft` | `--color-warning` · `--color-warning-soft` | `#906623` · `#f8efdd` | `#e1bd79` · `#473b25` |
| `--danger` · `--danger-soft` | `--color-destructive` · `--color-destructive-soft` | `#a0443d` · `#fae9e6` | `#efaaa1` · `#492b28` |
| `--shadow` | none: a scene neutral | `rgb(24 27 37 / 0.05)` island depth | `rgb(0 0 0 / 0.22)` |

Type: `--font-sans` `"Avenir Next", "Segoe UI", sans-serif`, Studio's own. Shape: the theme's `--radius-md` · `-lg` ·
`-xl` (`0.625` · `0.875` · `1.25rem`).

## Direction

A quiet atelier surrounds the garment. Warm ivory, pomegranate accents, compact editorial serif headings,
and rounded floating islands keep fabric colour at the centre of the experience. The layout follows the
user's chosen left library and contextual top toolbar; design choices were made autonomously under the full-build authorization.

The left library switches between five silhouettes, textile swatches, and saved looks. Selecting a garment
loads its fixed-size geometry and category-owned attachments. The top toolbar selects a garment part and
exposes undo/redo. The right island shows the active part's material and pattern placement. Solid materials
hide texture transform controls. The bottom island owns camera presets, zoom, fit, and detail inspection.

## Tokens and surfaces

Since the Ocharo frame rollout (2026-10-20) every colour comes from the fe SDK `ocharo` theme: Ink and Raspberry in
light, Neutral graphite in dark, with its medium ambient backdrop behind the frame. `src/bootstrap/styles/tokens.css`
maps Studio's short names (`--canvas`, `--paper`, `--ink`, `--accent`, …) onto the theme tokens; accent-coloured text
reads `--accent-ink` (the theme's primary-soft foreground) and text on an accent fill reads `--on-accent`, so both
stay readable in dark. The top bar, sidebar and menus wear the theme's approved glass through the SDK glass
variants (fe SDK 0.0.31); the canvas, textiles and editing islands stay solid. The SDK colour-mode provider owns the
root `dark` class and the System / Light / Dark choice in the account menu. Scene neutrals follow the theme canvas:
the fog fades towards `#f5f6fa` or `#141416`, and the floor shadow stays a coverage-only black.

Desktop preserves a large central canvas with floating controls. Compact tablet and phone layouts switch between
Canvas, Library and Edit part; an open sheet reserves the lower screen while the garment remains above it.
Controls remain reachable without horizontal scrolling. The layout steps answer the editor's own width, so the
sidebar rail and an expanded sidebar move them as the viewport would.

## Interaction and accessibility

- Native buttons, labelled range inputs, part select, named dialog, and roving keyboard tabs.
- Direct mesh selection has equivalent select/chip controls.
- Camera orbit does not change part selection; texture rotation uses degrees in authored UV space.
- Slider gestures form a single undo operation; material changes never mutate other parts.
- `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, and `Ctrl/Cmd+S` support editing; Escape dismisses dialogs.
- WebGL, model, and texture failures expose retry controls.
- Saving reports offline and revision-conflict states; JSON export remains available as a portable copy.
- Automated light/dark contrast and keyboard checks accompany the browser workflow suite.

## Assets

The six authored GLBs and reproducible authoring script are described in
[garment-authoring.md](../garment-authoring.md). Four original textile studies were generated
with the built-in image tool; exact prompts and provenance are preserved in
`engineering/codebase/ocharo-studio.frontend-services/apps/web/public/assets/textures/manifest.json`.
Original PNGs are stored through Git LFS; runtime WebPs are compressed. The current catalogue contains 46 material
definitions; [catalogue coverage](../catalogue-materials.md) records the 21 additional generated texture fields.

[studio-preview.png](../studio-preview.png) shows the verified desktop interface.

## Limits

These garments are fixed-size visual interpretations. Physical cloth simulation, fit guarantees, pattern drafting,
sizing, length editing, decorative overlays, and arbitrary attachment placement are outside this release.
Looks are stored in PostgreSQL under a browser-held workspace UUID with a local recovery cache. JSON files provide
transfer and backup. The UUID grants no account identity or authorization; collaborative editing is not implemented.

## Landing and editor separation

The existing palette, serif typography and rounded forms are retained. The landing page at `/` owns the editorial
headline, garment introduction, three-step explanation, textile gallery and studio calls to action. The editor at
`/studio` contains working controls and an accessible hidden heading, without promotional text over the mannequin.
The reclaimed vertical space increases the interactive garment area across breakpoints.

The landing hero is a native transparent PNG exported by the actual studio renderer, not a substitute garment
illustration. Its supporting swatch and six gallery textures come from the current material definitions. Five
family glyphs describe the selectable forms. No pricing, ordering, customer claims or account signup is implied.

Routes use the shared SDK adapter with lazy pages, initial loading, route errors, title/meta updates, scroll
restoration and focus announcements. `/editor` redirects to `/studio`; unknown pages have an explicit fallback.
The landing page does not initialize studio persistence, onboarding, WebGL or model downloads. Valid name edits
enter the recovery cache immediately, while one focused editing gesture creates one undo step. Editor navigation
lets queued writes finish; per-tab recovery remains available when offline or after a reload. The studio
opens its current draft when returning. Camera and inspector view state reset when the editor remounts.

The landing header keeps the `StudioBrand` wordmark with the build-identity pill; the frame replaces both in the
editor with the suite's app button, the app version and the account menu's versions. Native in-page anchors and router links retain
keyboard and modified-click behavior. Landing layouts use a split hero on large screens and stacked content on
phones; light/dark themes share the same semantic tokens. No new design direction approval is needed because the
user explicitly retained this visual system and authorized the landing build.
