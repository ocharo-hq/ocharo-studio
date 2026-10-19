# Studio convention audit

*Last updated: 2026-10-19*

## 2026-10-19 — SDK, settings files and ingress

- be sdk `WoW2.Sdk.Beta.Be` `10.0.71-beta`; fe sdk `@wow-two-beta/fe` `0.0.23`; publishing on pipelines `v0.7.0`.
- The host reads `appsettings.Target.json` and, on a local run whose `https` profile sets `LOCAL_SETTINGS=true`,
  `appsettings.Local.json` through `AddSettingsFiles`; the product-local Local loader is gone. OpenAPI keys on
  `IsLocalRun`. The Desk origin left `appsettings.Development.json` for the gitignored Local file.
- Forwarded headers apply only from loopback and `Deployment:TrustedProxies` (`AddProxyAwareHosting`); the descriptor
  requires that key and `OcharoPlatform:BaseUrl`. `dotnetEnvironment` stays off, so deployed hosts run as Production.
- A 401 expires the Desk session once through the fe sdk auth bridge with one neutral notice
  (`feedbackSessionExpiry` on `FeedbackToastHost`); local 401 sync warnings are gone and recovery is unchanged.
- Checks: backend build 0 warnings and 43 tests; frontend lint, format, typecheck, 125 unit tests and production
  build. Playwright, Docker image builds and a live deploy were not run in this pass.

The 2026-10-01 record follows; its publisher gaps closed when Studio moved to the shared pipelines workflow.

*Reviewed: 2026-10-01*

## Changes

The frontend is now a pnpm 10.33.2 workspace: apps/web owns source, public assets, tests, app scripts and Vite configs; root scripts forward tasks. The existing npm dependency lock was imported, then frozen installation succeeded without a dependency-upgrade task. The original npm lock is preserved in ignored .local/convention-migration/package-lock.before-pnpm.json.

Vite generates apps/web/dist; the root deploy script copies that completed build into the unchanged OcharoStudio.Api/wwwroot. Normal backend builds run the frozen install and SPA build; Docker uses its verified Node stage with BuildSpa=false in .NET. Playwright backend and catalogue export paths reflect the move. The existing verification workflow uses pnpm; its discovered double-p typo was corrected.

The descriptor declares a private studio site, persistent SQLite volume and required OcharoPlatform:BaseUrl. The host reads optional deployer settings. Top-bar About uses the shared brand component on both landing and editor pages; source geometry/materials and API contracts are unchanged.

## Executed checks

- Before relocation: 99 existing frontend tests passed.
- After relocation: 99 frontend tests, typecheck and architecture boundaries passed; catalogue contract still contains 5 garments and 46 materials.
- Backend: 24 tests passed.
- Production frontend build and frozen pnpm install passed.
- Pre-move hash comparison: all public assets unchanged; 148 files unchanged and eight intentional metadata/path/version files changed.
- Final Docker build passed: image e0c9fa3557b86be241fd9c4b24430f92e2b8152b6353964cd6cd38449c012cbf.
- Disposable network-isolated image smoke: `/health` and `/api/system/version` returned 200; version dev. Curl is installed. No host port or user volume was used.

## Open integration gaps

- Shared publisher migration remains a proposal until upstream Git LFS checkout and source-revision input are supported.
- Existing publish workflow is retained, not disabled; shared descriptor-driven publication remains pending.
- Browser Desk-origin configuration still has a compiled local default; hosted runtime origin configuration is not accepted yet.
- Human garment, accessibility and Maftuna workflow review remain open; no browser acceptance was claimed during this convention pass.
- The Three.js bundle-size advisory remains.

## Boundaries

- Product v0.1 remains in progress; all developer verification checkboxes remain open.
- Product package versions are 0.0.0 placeholders. Local apps/services report dev; CI accepts APP_VERSION.
- Full assembly informational identity remains available at `/api/system/version`; About loads it on demand.
- No Git index, commit, remote, deployment target, real user data or existing runtime changed in this lane.
- Preserved pre-consolidation notes under research are evidence, not active plans or current permissions.
- The proposed shared publisher v0.1.0 does not hydrate Git LFS assets and does not inject VCS_REF.
- The proposed shared CI migration was withdrawn. Existing Platform/Studio release triggers, jobs and permissions were retained. A narrow follow-up adds validated APP_VERSION/VCS_REF build inputs to both existing workflows and Git LFS checkout to Platform (Studio already hydrates LFS). Ten valid/invalid tag cases and unchanged trigger/job/permission structure were checked locally. Assets has no active publisher. No remote workflow ran.
- Container version smoke proves local packaging only; no product release, hosted acceptance or human approval is claimed.
