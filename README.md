# Ocharo Studio

*Last updated: 2026-09-29*

A 3D creative studio for exploring Uzbek clothing on a mannequin with selectable garment parts and editable fabric placement.

## State

The repository contains a running browser studio with one fixed mannequin and five authored garment interpretations:
`nimcha`, `baska`, `kostyum`, `korset`, and `abaya`. Each garment declares its own editable parts and
built-in details. The generated catalogue supports per-part material choice, rotation, scale, offsets, and anchored
pattern placement.

Connected looks persist in SQLite under a Platform organization/member identity, with browser recovery.
Without a Desk connection, the editor keeps designs in this browser and supports explicit JSON backup.
They can be saved as independent copies, reopened, exported as portable JSON, or captured as PNG previews.
The responsive editor uses floating island controls around a WebGL canvas. The `/` landing page introduces the
workflow, garment families, and catalogue textiles; `/studio` opens the editor with an unobstructed mannequin.
The landing page uses native garment exports and loads no editor API, models, or WebGL scene.
Current check results and remaining manual validation are recorded in
[verification](engineering/research/previous-work/verification.md).

![Landing preview](engineering/research/landing-preview.png)

[Editor preview](engineering/research/studio-preview.png)

## Start

Requires Git LFS, .NET 10 SDK, Node 24, pnpm 10.33.2, and a WebGL-capable browser.

PNG images, GLB models and the preserved earlier SDK archive are stored through Git LFS.
Without Git LFS, these files check out as pointer text. Runtime textures use compressed WebP. After cloning:

```sh
git lfs install
git lfs pull
```

Build and run the single host:

```sh
dotnet build engineering/codebase/ocharo-studio.backend-services/OcharoStudio.BackendServices.slnx
dotnet test engineering/codebase/ocharo-studio.backend-services/OcharoStudio.BackendServices.slnx --no-build
dotnet run --project engineering/codebase/ocharo-studio.backend-services/OcharoStudio.Api --no-build --launch-profile https
```

The backend build installs the locked frontend dependencies and builds the SPA into its generated `wwwroot/`.
The lockfile resolves published `@wow-two-beta/ui-vue@0.0.9`; the older vendor archive is preserved as source history.

For frontend work, run these commands from `engineering/codebase/ocharo-studio.frontend-services/`:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Normal development uses HTTPS at `https://localhost:8262` and proxies the API at `https://localhost:8260`.
Open `/` for the landing page and `/studio` for the editor. The legacy `/editor` URL redirects to `/studio`.
The backend also binds `http://localhost:8261`. Accept native certificate setup only through the user-controlled trust prompt.
The explicit `pnpm dev-http` profile supports browser-only previews; connected state requires HTTPS.
The [operations guide](engineering/operations/operations.md) describes isolated review ports and trusted certificates.

The browser suite uses an authenticated, isolated test transport for persistence and conflict workflows.
`tests/e2e/connection.spec.ts` separately covers browser-only recovery, expiry, and actual PNG review export.
See the verification record for executed checks and live-integration evidence boundaries.

## Layout

- `product/`: requirements, user flows, and product scope.
- `engineering/codebase/ocharo-studio.backend-services/`: .NET API, Application, Domain, Persistence, and tests.
- `engineering/codebase/ocharo-studio.frontend-services/`: Vue 3, TypeScript, and Vite.
- `engineering/architecture/`: implemented studio, state, persistence, and asset contracts.
- `engineering/planning/`: current backlog, archived foundation brief, and verification.

The backend exposes capability information at `GET /api/studio` and workspace state at
`GET|PUT /api/studio/state`. Session and state require a short-lived `ocharo-studio` bearer ticket and current
Platform membership. A supplied `X-Studio-Workspace` UUID must match the server-derived workspace.

## Boundaries

Garment assets are authored visual interpretations, not exact catalogue replicas. The app does not simulate cloth,
prove fit, resize garments, or generate sewing patterns. SQLite remains unencrypted. Platform owns identity;
Studio validates current access and owns independently editable designs. Collaborative editing is outside this build.
Portable JSON remains the user-controlled transfer format. No source catalogue media or secrets are copied into this repository.

The canonical repository is `ocharo-hq/ocharo-studio`. Reusable model sources belong to sibling `ocharo-assets`;
Studio pins its immutable seven-model release. Creative review export produces a PNG plus a provenance manifest.
Receiving applications own rights review, product association, and publication; a download performs no remote write.

## Continue

- [Studio requirements](product/features/studio.md)
- [Archived implementation prompt](engineering/research/previous-work/implementation-prompt.md)
- [Verification record](engineering/research/previous-work/verification.md)
- [Asset reference provenance](engineering/research/catalogue-evidence.md)
