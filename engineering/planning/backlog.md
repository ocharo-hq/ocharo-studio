# Ocharo Studio — Backlog

*Last updated: 2026-11-09*

## Features

| Feature | State | Spec |
|---|---|---|
| Garment design | planned | [studio.md](../../product/features/studio.md) |
| Shared materials | planned | [materials.md](../../product/features/materials.md) |
| Creative handoff | planned | [creative-handoff.md](../../product/features/creative-handoff.md) |

## Product and delivery

| Item | Type | Notes |
|---|---|---|
| Identity follow-ups | engineering | Workspaces saved under Desk's old user ids keep empty Identity keys after the SQLite copy and no member reaches them; decide whether to drop them once the copy runs on prod. |
| Human garment review | product | Validate fidelity, clipping, controls and useful exports with Maftuna. |
| Accessibility | engineering | Assistive-technology and keyboard-only acceptance. |
| Metric textile mapping | feature | Calibrate measured tiles before displaying centimetres. |
| Material revisions | feature | Variants and immutable comparisons preserve source assets. |
| Model rendering | product | Choose generated stills or rotatable scenes and exact scene IDs. |
| Normalized storage | engineering | Workspaces keep state and material JSON as text in `studio.workspaces`; design entity tables and APIs before splitting them. |
| Retire the SQLite volume | engineering | Once `import-sqlite` has run on dev and prod, drop the `studio-data` volume and the `LegacySqlite` settings, the 503 guard and the verb. |
| be sdk: bad-gateway error | sdk gap | No `AppError` type maps to 502; Studio decorates the status mapper to keep a refused Files call at 502 (`StudioErrorHttpStatusCodeMapper`). |
| Pipelines tag pin | engineering | `publish-docker-image.yml` pins `delivery.yml` by SHA `e134a47` because no pipelines tag contains it yet; re-pin to the first tag that does. Covers sweep D-1. |
| fe sdk: slider gesture events | sdk gap | `SliderInput` (0.0.31) emits no gesture start and end, which Studio's undo grouping needs, and has no labelled value readout; `RangeControl.vue` stays a thin wrapper until a `SliderField` lands. |
| fe sdk: confirmation host | sdk gap | `useConfirmation` has no component that renders an `AlertModal` from a request; Studio composes it in its Designer page. |
| fe sdk: re-pin past 0.0.33 | engineering | `ProblemDetailsExtensions` arrived after 0.0.33; Studio reads no problem body yet. `createApiClient` has no per-request `cache`, so Studio passes a `no-store` fetch. |
| Local launch entries | engineering | The workspace's `.claude/launch.json` lacks `ocharo-studio-web-http` (`VITE_HTTPS=false`, `VITE_PORT=8263`) and the port ledger its 8263 row; both live in wow-two-ws. |
| Garment extensions | feature | Sizing, length, decorations and outfit composition need authored support. |
| Production rollout | engineering | Validate actual authenticated deployment and restore procedures. |
| Session-expiry redirect | engineering | Expiry shows one neutral notice and stays on the page; Studio works signed out. Redirect to sign-in once unsaved material edits survive navigation. |
| fe sdk: cancelled revision writes | sdk gap | `LatestRevisionQueue` has no request scope or cancelled outcome, so an ended session settles it `offline` with an error; Studio filters `StudioSessionExpired`. |
| be sdk: proxy trust from settings | sdk gap | `TrustProxiesFrom` binds only `ApiDefaultsOptions`; a host on `AddProxyAwareHosting` reads `Deployment:TrustedProxies` itself. |
| Studio localization (uz/ru) | feature | Uzbek and Russian interface beside English, the language rows in the account menu and translated SDK copy, as Desk and Catalogue carry them; the frame rollout stayed English-only. |
| fe sdk: compact app button | sdk gap | `AppSwitcherMenu` always shows the app name on the trigger; Studio's phone bar hides it with a class hook on the trigger's label span. A mark-only trigger below a breakpoint belongs in the SDK. |
| fe sdk: place controls in the bar | sdk gap | `AppShellHeader` has no slot a routed place fills; Studio teleports its Designer controls into a bar element. A place-actions outlet would make that shared. |
| fe sdk: stylesheet weight | sdk gap | The convention's `@source` over the whole `dist` generates ~856 kB of CSS (55 kB gzip) for every SDK class; Studio's own stylesheet was 61 kB before. A per-component source manifest would generate only what an app imports. |
