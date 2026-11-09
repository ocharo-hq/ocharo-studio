# Convention sweep

*Last updated: 2026-11-09*

Swept 2026-11-09 by a read-only agent against `wow-two-ws/conventions/conventions.md`; breaks already recorded as exceptions are excluded. `known` marks a break already in the backlog or in [convention-audit.md](convention-audit.md). Backlog rows that cover these ids: [backlog.md](../planning/backlog.md).

Paths in `where` are repo-relative (backend `B/` = `engineering/codebase/ocharo-studio.backend-services/`, frontend `F/` = `engineering/codebase/ocharo-studio.frontend-services/apps/web/`). Rule paths are relative to `conventions/` in wow-two-ws.

Not flagged: the Three.js renderer staying framework-independent, English-only UI, lock files, generated files, the Files thumbnail work, [renderer.md](renderer.md). Not checked in depth: CSS authoring (3,250 lines of hand-written CSS), responsive screen-class verification, UI copy, logo, i18n.

## Summary

| Area | S | M | L | Changes behaviour or data | No | Total |
|---|---|---|---|---|---|---|
| Backend | 9 | 6 | 1 | 7 | 9 | 16 |
| Frontend | 6 | 3 | 1 | 1 | 9 | 10 |
| Deployment and CI | 4 | 1 | 0 | 1 | 4 | 5 |
| Planning | 3 | 1 | 0 | 0 | 4 | 4 |
| Docs and design | 3 | 2 | 0 | 0 | 5 | 5 |
| Total | | | | | | 40 |

## Backend

| id | where | rule | break | size | changes behaviour or data | fix |
|---|---|---|---|---|---|---|
| S-1 (known) | `B/OcharoStudio.Persistence/SqliteStudioStateStore.cs:1` | `development/backend/dotnet/core/mla/domains/persistence/database/database.md:15` | Workspaces stored in SQLite; products must run PostgreSQL | L | yes | Move to PostgreSQL via Wheelhouse database; migrate existing workspace rows |
| S-2 | `B/OcharoStudio.Persistence/StudioDatabaseInitializer.cs:15-39` | `development/backend/dotnet/core/mla/domains/persistence/migrations/migrations.md:19` | Schema made by inline `CREATE IF NOT EXISTS`/`ALTER`, no versioned bespoke migration stamped with version | M | yes | Replace with bespoke SQL migrations (do with S-1) |
| S-3 (known) | `B/OcharoStudio.Api/Configurations/HostConfiguration.cs:14-35` | `development/backend/dotnet/shapes/service/platform/startup/startup-defaults.md:9` | Host composes SDK parts by hand; no `AddApiDefaults()`/`UseApiDefaults()` | M | yes | Adopt boot bundle; keep Identity BFF and controllers between the calls |
| S-4 | `B/OcharoStudio.Api/Configurations/HostConfiguration.Extensions.cs:144` | `development/backend/dotnet/shapes/service/platform/startup/startup-defaults.md:46` | Hand-written `MapGet("/health")`, no readiness check per dependency | S | yes | Drop with S-3; register SQLite/Files readiness checks on the health builder |
| S-5 | `B/OcharoStudio.Api/Configurations/HostConfiguration.Extensions.cs:126-154` | `deployment/hosting/single-host-serving.md:47` | Hand-wired `UseDefaultFiles`/`UseStaticFiles`/`MapFallbackToFile` instead of `SpaHosting` | S | no | Set `ApiDefaultsOptions.SpaHosting` (with S-3); keep `.glb` content type via SDK option |
| S-6 | `B/OcharoStudio.Api/Configurations/HostConfiguration.Extensions.cs:103` | `development/backend/dotnet/shapes/service/platform/responses/serialization.md:24` | `AddControllers()` instead of `AddControllersWithSdkJson()` | M | yes | Switch; nulls drop and `TimeSpan` goes ISO, retype frontend models, follow `vue-tsc` |
| S-7 | `B/OcharoStudio.Api/Configurations/HostConfiguration.Extensions.cs:139` | `development/backend/dotnet/shapes/service/platform/responses/known-endpoints.md:45` | Extra `/api/system/version` beside `api/system/status`; frontend never calls it | S | yes | Delete the route; `status` already carries the version |
| S-8 | `B/OcharoStudio.Api/Program.cs:5-12` | `development/backend/dotnet/shapes/service/platform/startup/host-configuration.md:33` | Hand-built host and `app.Run()` instead of `ServiceHost.RunAsync` | S | no | Hand `args` to `ServiceHost.RunAsync`, pass `ConfigureAsync` |
| S-9 | `B/OcharoStudio.Api/Configurations/HostConfiguration.Access.cs:1` | `development/backend/dotnet/shapes/service/platform/startup/host-configuration.md:24` | Third `HostConfiguration` partial file; convention allows two | S | no | Fold `AddStudioAccess`/`UseStudioAccess` into `HostConfiguration.Extensions.cs` |
| S-10 | `B/OcharoStudio.Persistence/SqliteStudioStateStore.cs:61,82` | `development/backend/dotnet/core/mla/components/time.md:23` | `DateTimeOffset.UtcNow` read twice in production code | S | no | Inject `TimeProvider` |
| S-11 | `B/OcharoStudio.Application/Studio/Queries/GetStudioInfo/GetStudioInfoQueryHandler.cs:1` | `development/backend/dotnet/shapes/service/architecture/clean/clean.md:55` | Handler, `StudioStateService`, `StudioStateValidator` live in Application; no Infrastructure project | M | no | Add `OcharoStudio.Infrastructure`; move implementations there (3 types) |
| S-12 | `B/OcharoStudio.Api/Controllers/StudioController.cs:60-100` | `development/backend/dotnet/shapes/service/platform/responses/results.md:10` | Controller builds its own `ValidationProblem`/`Problem`; services bypass `AppResult` and mediator | M | yes | Return `AppResult` from handlers, collapse with `.Match` through the problem factory |
| S-13 | `B/OcharoStudio.Api/Controllers/StudioController.cs:1` | `development/backend/dotnet/shapes/service/architecture/clean/domain-structuring.md:9` | Controller in project-wide `Controllers/`; sibling controllers sit under domain folders | S | no | Move to `Studio/Controllers/` |
| S-14 | `B/OcharoStudio.Api/Properties/launchSettings.json:8` | `development/backend/dotnet/shapes/service/platform/startup/launch-profiles.md:11` | `applicationUrl` binds only HTTPS 8260; ledger pair needs `http://localhost:8261` | S | no | Set `https://localhost:8260;http://localhost:8261` |
| S-15 | `B/tests/OcharoStudio.Tests/OcharoStudio.Tests.csproj:1` | `development/backend/dotnet/shapes/service/architecture/clean/testing.md:41` | One bare `OcharoStudio.Tests` project mixes unit, integration, E2E | S | no | Split into `.Unit`, `.Integration`, `.E2E` |
| S-16 | `B/tests/OcharoStudio.Tests/` (13 files, 197 `Assert.`) | `development/backend/dotnet/shapes/service/architecture/clean/testing.md:22` | xUnit `Assert` throughout; no AwesomeAssertions, no `FakeTimeProvider` | M | no | Move to AwesomeAssertions; use `FakeTimeProvider` once S-10 lands |

## Frontend

| id | where | rule | break | size | changes behaviour or data | fix |
|---|---|---|---|---|---|---|
| F-1 | `F/package.json:20` (17 files import it) | `development/frontend/core/mla/domains/icons/lucide/lucide.md:11` | `@lucide/vue` used, not `lucide-vue-next` | S | no | Swap package and 17 imports to the SDK's range |
| F-2 | `F/src/integration/studio/serverRepository.ts:83` (+ `access.ts:57`, `IdentityAccess.ts:66,128`, `modelAssets.ts:15`, `BuildIdentityApi.ts:4`) | `development/frontend/core/mla/domains/data/state-and-data.md:13` | 5 files call raw `fetch`/`.json()`; only `RuntimeConfigApi.ts` uses SDK client and `Result` | M | no | Move to `createApiClient` returning `Result`; read problems via `ProblemDetailsExtensions` |
| F-3 | `F/src/domain/studio/*.ts`, `F/src/application/studio/state.ts`, `F/src/integration/studio/*.ts` | `development/frontend/core/lla/notation/naming/naming.md:11` | 17 `.ts` files lowercase-named (`state.ts`, `catalog.ts`, `repository.ts`, `router.ts`...) | S | no | Rename to PascalCase of primary export; fix imports |
| F-4 | `F/src/domain/studio/`, `F/src/integration/studio/`, `F/src/presentation/studio/` | `development/frontend/shapes/app/architecture/architecture.md:49` | Slices hold files flat; no role-groups, no `pages/`, no `index.ts` barrels | L | no | Open `models/`, `hooks/`, `clients/`, `pages/` per layer; add barrels (`naming.md:67`) |
| F-5 | `F/src/bootstrap/App.vue:1` (816 lines) | `development/frontend/shapes/app/architecture/architecture.md:77` | Routed Designer page sits in `bootstrap/`; pages belong in domain `pages/` | M | no | Move to `presentation/studio/pages/`; split by region |
| F-6 | `F/index.html:20`, `F/src/main.ts:1` | `development/frontend/shapes/app/platform/document.md:17` | Entry is `/src/main.ts`; convention names `/src/bootstrap/main.ts` | S | no | Move `main.ts` into `bootstrap/`; update `index.html` and boundary script |
| F-7 | `F/public/` | `development/frontend/shapes/app/platform/document.md:31` | No `apple-touch-icon.png` (180 x 180) | S | yes | Export from the brand master, link in head |
| F-8 | `F/vite.config.ts:57-65` | `development/frontend/shapes/app/platform/dev-server.md:13` | Dev server always HTTPS; no `VITE_HTTPS=false` fallback or `*-http` launch | S | no | Gate mkcert/https on `VITE_HTTPS`, add `-http` launch entry |
| F-9 | `F/src/presentation/studio/IconButton.vue:1`, `StudioDialog.vue:1`, `RangeControl.vue:1`, `StudioConfirmationDialog.vue:1` | `development/sdk-extraction.md:37` | App-local wrappers over SDK button, modal, alert modal, range | M | no | Use SDK primitives directly; extract gaps to the fe SDK |
| F-10 (known) | `F/src/application/common/UseOcharoApps.ts:32-34` | `deployment/hosting/environment-files.md:22` | App origins carry compiled `localhost` defaults | S | no | Drop defaults; rely on `/api/runtime-config` (audit: Open integration gaps) |

## Deployment and CI

| id | where | rule | break | size | changes behaviour or data | fix |
|---|---|---|---|---|---|---|
| D-1 | `.github/workflows/publish-docker-image.yml:38` | `deployment/descriptor/deploy-descriptor.md:634` | Shared `delivery.yml` pinned to untagged SHA `e134a47`, not a tag | S | no | Re-pin to the first pipelines tag that contains it |
| D-2 (known) | `engineering/deployment/deploy.yml:8` | `deployment/hosting/environment-files.md:12` | `dotnetEnvironment` off; deployed dev and prod both run Production | S | yes | Set `dotnetEnvironment: true`; keep `appsettings.Development.json` deployable |
| D-3 | `engineering/deployment/deploy.yml:1` | `deployment/descriptor/deploy-descriptor.md:52` | Dev auto-promotes to prod (`deployment.md`) but declares no `verify` check | M | no | Add `verify` hitting `/health` and `/api/system/status` |
| D-4 | `product/product.json:1` | `design/identity/product-manifest.md:10` | Retired `product/product.json` still present | S | no | Delete; identity comes from the `ocharo` catalog entry |
| D-5 | `engineering/deployment/deployment.md:25` | `conventions.md` (No duplication, one owner per fact) | States fe `0.0.23` and be `10.0.98-beta`; code pins `0.0.31` and `10.0.105-beta` | S | no | Remove version numbers; point at the manifests |

## Planning

| id | where | rule | break | size | changes behaviour or data | fix |
|---|---|---|---|---|---|---|
| P-1 | `engineering/research/previous-product-notes/planning.md:1`, `previous-work/planning.md:1` | `planning/version-track/version-track.md:17` | Two `planning.md` files beside the canonical track | S | no | Delete both; git holds them (evidence preserved elsewhere) |
| P-2 | `engineering/planning/version-track/v0.1/v0.1.md:18` | `planning/version-track/version-track.md:98` | `Verification` is iteration 3; iterations 4-6 follow it | S | no | Move `Verification` last; fold iteration checks into it |
| P-3 | `engineering/planning/version-track/v0.1/v0.1.md` (12 task lines) | `planning/version-track/version-track.md:126` | 12 task lines exceed 75 characters | S | no | Shorten each to one action |
| P-4 | `engineering/planning/version-track/v0.1/v0.1.md:3` | `planning/version-track/version-track.md:66` | v0.1 open since 2026-10-01 with 6 iterations; limit is 1 week | M | no | Close v0.1 as shipped; open v0.2 for the remaining items |

## Docs and design

| id | where | rule | break | size | changes behaviour or data | fix |
|---|---|---|---|---|---|---|
| G-1 | `engineering/architecture/design.md:1` | `design/design-conventions.md:25` | Design spec at wrong path and not opening with `## Screens` | M | no | Move to `engineering/research/design-research/design-research.md`; add `## Screens` and token tables |
| G-2 | `F/public/assets/brand/` | `design/identity/product-icons.md:11` | No `product/brand/icons/` set under variant names | M | no | Export `short-colored-light`/`-dark` and the rest to `product/brand/icons/` |
| R-1 | `product/features/`, `engineering/research/previous-work/`, `previous-product-notes/`, `previous-version-notes/` | `development/repo/structure/repo-structure.md` § Documents | 4 folders hold docs but no `{folder}.md` lead | S | no | Add leads (`features.md`, ...) or flatten single-file folders |
| R-2 | `B/tests/` | `development/backend/dotnet/shapes/service/architecture/clean/testing.md:49` | Test folder has no lead doc for prerequisites and coverage | S | no | Add `tests/tests.md` |
| R-3 | `AGENTS.md:1` | `~/.claude/conventions/tools.md` § AI tooling (personal rule, not WoW2) | Codex loader file; Codex dropped 2026-10-23 | S | no | Delete `AGENTS.md` |

## Resolution

Worked 2026-11-09 in v0.1 iterations 6–13 ([v0.1](../planning/version-track/v0.1/v0.1.md)). `fixed` rows changed code
or docs; `excepted` rows stay with the reason; open work sits in the [backlog](../planning/backlog.md).

| ids | state | how |
|---|---|---|
| S-1, S-2, S-10 | fixed | PostgreSQL in schema `studio` of `ocharo_{env}`, bespoke set `001-workspaces` keyed into Identity, `TimeProvider` in the store; `import-sqlite` copies the old store |
| S-3, S-4, S-5, S-8, S-9 | fixed | `ServiceHost.RunAsync` and the boot bundle; `/health` and `/health/ready`; `SpaHosting` with `.glb`/`.gltf` types (be sdk `10.0.107-beta`); two `HostConfiguration` files |
| S-6, S-7 | fixed | `AddControllersWithSdkJson` (the SPA reads a missing `draft` as `null`); `/api/system/version` removed |
| S-11, S-12 | fixed | `OcharoStudio.Infrastructure` holds the handlers, service and validator; state and thumbnail requests return `AppResult` through `ISender`, collapsed with `.Match`; a refused Files call is `ExternalRejected` (502, be sdk `10.0.109-beta`) |
| S-13, S-14 | fixed | controller under `Studio/Controllers/`; HTTP 8261 beside HTTPS 8260 |
| S-15, S-16, R-2 | fixed | Unit, Integration and E2E projects on AwesomeAssertions, `tests/tests.md` |
| F-1, F-2, F-8, F-10 | fixed | `lucide-vue-next`; the SDK client with `Result` (`ModelAssets` keeps a plain fetch for a static `.glb`); `VITE_HTTPS=false`; no compiled origins. The `-http` launch entry lives in wow-two-ws: backlog "Local launch entries" |
| F-9 | fixed, one excepted | three wrappers removed; `RangeControl.vue` stays over `SliderInput`, which has no gesture events or readout: backlog "fe sdk: slider gesture events" |
| F-3, F-5, F-6 | fixed | PascalCase files; the Designer page as `presentation/studio/pages/StudioPage.vue` with `DesignerView`; `bootstrap/main.ts` |
| F-4 | fixed, one excepted | role-group folders in every slice and a barrel in `domain/studio`; integration, application and presentation keep no barrel, since importing one would run `createAuthBridge` at startup, before identity loads, instead of when `/studio` opens |
| F-7, G-2 | fixed | `apple-touch-icon.png` linked; `product/brand/icons/short-colored-{light,dark}.svg` from the favicon artwork, for owner review |
| D-1 | excepted | no pipelines tag contains `e134a47` yet: backlog "Pipelines tag pin" |
| D-2, D-3, D-4, D-5 | fixed | `dotnetEnvironment: true`; a `verify` dev check; identity in `deploy.yml`; SDK versions point at the manifests |
| P-1, P-2, P-3 | fixed | both `planning.md` files removed; `Verification` last; task lines within 75 characters |
| P-4 | excepted | closing v0.1 needs every check passed and the developer's confirmation (`version-track.md` § Lifecycle); its owner-review checks are open |
| G-1 | fixed | `research/design-research/design-research.md` opens with `## Screens` and token tables |
| R-1 | fixed, one excepted | leads for `previous-work/` and `previous-version-notes/`, `previous-product-notes/` removed; `product/features/` keeps no lead, since version-track bans a `features.md` and `capabilities.md` already indexes it |
| R-3 | fixed | `AGENTS.md` removed |

## Checked, conforming

Top-level `product/` + `engineering/`; `{slug}.*-services` names; `.slnx` plus both `Directory.*.props`; central package versions; port ledger and `scripts/active.sh` entry; LFS for binaries over 1 MB; `Program.cs` three groups; `descriptor: 2`; `queue: max` without `cancel-in-progress`; `appsettings.Target.json`/`Local.json` ignored in git and docker; `BuildSpa` target and `scripts/deploy.mjs`; pnpm workspace at `apps/web` with one lockfile and `packageManager`; five frontend layers with a boundary lint; `createAppRouter` with titles and not-found; `AppShell`/`AppShellHeader`/`AccountMenu` frame with versions; `/theme.js` pre-paint script and boot splash; `/api/system/status` and `/api/runtime-config` controllers; Identity BFF through the SDK; backlog opens with `Features`.
