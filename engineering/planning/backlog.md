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
| Identity follow-ups | engineering | After the move to Ocharo's Identity (2026-11-05): BFF sessions live in memory, so a restart signs everyone out, and a durable SQLite or shared cache would end that; `deployment/docker-compose.yml` sets no `Identity:Client:*`, so it no longer boots alone; workspaces saved under Desk's old user ids are not migrated to Identity subjects. |
| Human garment review | product | Validate fidelity, clipping, controls and useful exports with Maftuna. |
| Accessibility | engineering | Assistive-technology and keyboard-only acceptance. |
| Metric textile mapping | feature | Calibrate measured tiles before displaying centimetres. |
| Material revisions | feature | Variants and immutable comparisons preserve source assets. |
| Model rendering | product | Choose generated stills or rotatable scenes and exact scene IDs. |
| Normalized storage | engineering | Design entity APIs before changing existing SQLite snapshots. Sweep S-2 (inline schema, no versioned migrations) belongs here: L together with PostgreSQL storage, changes data ([sweep](../research/convention-sweep.md)). |
| PostgreSQL storage | engineering | Studio keeps workspaces in SQLite (`GET /api/studio` reports `storage: sqlite`), which `database.md` bans for products (developer, 2026-10-27); move them to PostgreSQL, with Normalized storage. Covers sweep S-1, S-2: L, changes data ([sweep](../research/convention-sweep.md)). |
| Garment extensions | feature | Sizing, length, decorations and outfit composition need authored support. |
| Production rollout | engineering | Validate actual authenticated deployment and restore procedures. |
| Session-expiry redirect | engineering | Expiry shows one neutral notice and stays on the page; Studio works signed out. Redirect to sign-in once unsaved material edits survive navigation. |
| fe sdk: cancelled revision writes | sdk gap | `LatestRevisionQueue` has no request scope or cancelled outcome, so an ended session settles it `offline` with an error; Studio filters `StudioSessionExpired`. |
| be sdk: proxy trust from settings | sdk gap | `TrustProxiesFrom` binds only `ApiDefaultsOptions`; a host on `AddProxyAwareHosting` reads `Deployment:TrustedProxies` itself. |
| Startup boot floor | engineering | Move the host onto `AddApiDefaults`/`UseApiDefaults` and the SDK `/health`; it composes SDK parts today. Covers sweep S-3, S-4, S-5, S-8, S-9: M, changes behaviour ([sweep](../research/convention-sweep.md)). |
| Studio localization (uz/ru) | feature | Uzbek and Russian interface beside English, the language rows in the account menu and translated SDK copy, as Desk and Catalogue carry them; the frame rollout stayed English-only. |
| fe sdk: compact app button | sdk gap | `AppSwitcherMenu` always shows the app name on the trigger; Studio's phone bar hides it with a class hook on the trigger's label span. A mark-only trigger below a breakpoint belongs in the SDK. |
| fe sdk: place controls in the bar | sdk gap | `AppShellHeader` has no slot a routed place fills; Studio teleports its Designer controls into a bar element. A place-actions outlet would make that shared. |
| fe sdk: stylesheet weight | sdk gap | The convention's `@source` over the whole `dist` generates ~856 kB of CSS (55 kB gzip) for every SDK class; Studio's own stylesheet was 61 kB before. A per-component source manifest would generate only what an app imports. |
| API contract alignment | engineering | Move the host to `AddControllersWithSdkJson` (nulls drop, `TimeSpan` goes ISO; retype frontend models), return `AppResult` from handlers, delete the unused `/api/system/version`. Size M; changes behaviour or data: yes. Covers sweep S-6, S-7, S-12 ([sweep](../research/convention-sweep.md)). |
| Backend structure and tests | engineering | Add the Infrastructure project, inject `TimeProvider`, move the controller under `Studio/`, split the test project into Unit, Integration and E2E, and adopt AwesomeAssertions. Size M; changes behaviour or data: no. Covers sweep S-10, S-11, S-13, S-15, S-16 ([sweep](../research/convention-sweep.md)). |
| Local run profiles | engineering | Bind HTTP 8261 beside HTTPS 8260 in `launchSettings.json`; gate the Vite HTTPS server on `VITE_HTTPS` with an `-http` launch entry. Size S; changes behaviour or data: no. Covers sweep S-14, F-8 ([sweep](../research/convention-sweep.md)). |
| fe SDK adoption | engineering | Swap `@lucide/vue` for `lucide-vue-next`, move raw `fetch` calls to `createApiClient` with `Result`, and replace local button, modal and range wrappers with SDK primitives. Size M; changes behaviour or data: no. Covers sweep F-1, F-2, F-9 ([sweep](../research/convention-sweep.md)). |
| Frontend structure and naming | engineering | PascalCase the 17 lowercase `.ts` files, add role-groups, `pages/` and barrels, move the routed Designer page out of `bootstrap/`, and move `main.ts` into `bootstrap/`. Size L; changes behaviour or data: no. Covers sweep F-3, F-4, F-5, F-6 ([sweep](../research/convention-sweep.md)). |
| Brand and icon assets | engineering | Export `apple-touch-icon.png` (180 x 180) and the `product/brand/icons/` variant set from the brand master. Size M; changes behaviour or data: yes (apple-touch-icon). Covers sweep F-7, G-2 ([sweep](../research/convention-sweep.md)). |
| Deployment and CI hygiene | engineering | Re-pin `delivery.yml` to a tag, set `dotnetEnvironment: true`, add a `verify` check, drop compiled `localhost` origins. Size M; changes behaviour or data: yes (dev environment). Covers sweep D-1, D-2, D-3, F-10 ([sweep](../research/convention-sweep.md)). |
| Docs and planning housekeeping | engineering | Delete the retired manifest, `AGENTS.md` and duplicate `planning.md` files; fix v0.1 (close it, order `Verification` last, shorten tasks); move the design spec; add folder lead docs; drop stale version numbers. Size M; changes behaviour or data: no. Covers sweep P-1, P-2, P-3, P-4, D-4, D-5, G-1, R-1, R-2, R-3 ([sweep](../research/convention-sweep.md)). |
