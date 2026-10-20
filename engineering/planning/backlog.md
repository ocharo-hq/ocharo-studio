# Ocharo Studio — Backlog

*Last updated: 2026-10-20*

## Features

| Feature | State | Spec |
|---|---|---|
| Garment design | planned | [studio.md](../../product/features/studio.md) |
| Shared materials | planned | [materials.md](../../product/features/materials.md) |
| Creative handoff | planned | [creative-handoff.md](../../product/features/creative-handoff.md) |

## Product and delivery

| Item | Type | Notes |
|---|---|---|
| Human garment review | product | Validate fidelity, clipping, controls and useful exports with Maftuna. |
| Accessibility | engineering | Assistive-technology and keyboard-only acceptance. |
| Metric textile mapping | feature | Calibrate measured tiles before displaying centimetres. |
| Material revisions | feature | Variants and immutable comparisons preserve source assets. |
| Model rendering | product | Choose generated stills or rotatable scenes and exact scene IDs. |
| Normalized storage | engineering | Design entity APIs before changing existing SQLite snapshots. |
| Garment extensions | feature | Sizing, length, decorations and outfit composition need authored support. |
| Production rollout | engineering | Validate actual authenticated deployment and restore procedures. |
| Session-expiry redirect | engineering | Expiry shows one neutral notice and stays on the page; Studio works signed out. Redirect to sign-in once unsaved material edits survive navigation. |
| fe sdk: cancelled revision writes | sdk gap | `LatestRevisionQueue` has no request scope or cancelled outcome, so an ended session settles it `offline` with an error; Studio filters `StudioSessionExpired`. |
| be sdk: proxy trust from settings | sdk gap | `TrustProxiesFrom` binds only `ApiDefaultsOptions`; a host on `AddProxyAwareHosting` reads `Deployment:TrustedProxies` itself. |
| Startup boot floor | engineering | Move the host onto `AddApiDefaults`/`UseApiDefaults` and the SDK `/health`; it composes SDK parts today. |
| Studio localization (uz/ru) | feature | Uzbek and Russian interface beside English, the language rows in the account menu and translated SDK copy, as Desk and Catalogue carry them; the frame rollout stayed English-only. |
| fe sdk: compact app button | sdk gap | `AppSwitcherMenu` always shows the app name on the trigger; Studio's phone bar hides it with a class hook on the trigger's label span. A mark-only trigger below a breakpoint belongs in the SDK. |
| fe sdk: account menu sideways scroll | sdk gap | The `AccountMenu` panel's `overflow-y-auto` wrapper scrolls sideways because `MenuSeparator`'s negative inline margin overflows it; Studio passes `overflow-x-hidden` through `panel-class`. |
| fe sdk: menu panel material | sdk gap | `panelClass` on `AccountMenu` (via `DropdownMenuContent`) lands on an inner div inside the opaque raised menu surface, so the approved glass never shows on the menu (Catalogue too). |
| fe sdk: glass strength token | sdk gap | The approved 84% / 92% glass is copied as app-local `oc-glass` utilities in every suite app until glass strength is a theme token. |
| fe sdk: place controls in the bar | sdk gap | `AppShellHeader` has no slot a routed place fills; Studio teleports its Designer controls into a bar element. A place-actions outlet would make that shared. |
| fe sdk: stylesheet weight | sdk gap | The convention's `@source` over the whole `dist` generates ~856 kB of CSS (55 kB gzip) for every SDK class; Studio's own stylesheet was 61 kB before. A per-component source manifest would generate only what an app imports. |
