# Uzbek Studio

*Last updated: 2026-09-25*

A 3D creative studio for exploring Uzbek clothing on a mannequin with selectable garment parts and editable fabric placement.

## State

This repository contains the verified application foundation and implementation brief.
The mannequin editor and garment assets are planned; the running app is currently the template greeting example.
The developer owns the first commit.

## Start

Requires .NET 10 SDK, Node 24, and npm 11.6.1.

```sh
dotnet build engineering/codebase/uzbek-studio.backend-services/UzbekStudio.BackendServices.slnx
dotnet test engineering/codebase/uzbek-studio.backend-services/UzbekStudio.BackendServices.slnx --no-build
dotnet run --project engineering/codebase/uzbek-studio.backend-services/UzbekStudio.Api --no-build --launch-profile https
```

The backend build installs the locked frontend dependencies and builds the SPA into its generated `wwwroot/`.

For frontend hot reload, run `npm run dev` from `engineering/codebase/uzbek-studio.frontend-services/`.
Normal development uses HTTPS at `https://localhost:8262` and proxies the API at `https://localhost:8260`.
The backend also binds `http://localhost:8261`. Accept native certificate setup only through the user-controlled trust prompt.
The explicit `npm run dev-http` profile is available for headless previews.

## Layout

- `product/`: requirements, user flows, and product scope.
- `engineering/codebase/uzbek-studio.backend-services/`: .NET Clean Architecture solution.
- `engineering/codebase/uzbek-studio.frontend-services/`: React, TypeScript, and Vite.
- `engineering/architecture/`: proposed studio and asset contracts.
- `engineering/planning/`: implementation handoff, backlog, and verification.

## Continue

- [Studio requirements](product/features/studio.md)
- [Implementation prompt](engineering/planning/implementation-prompt.md)
- [Verification record](engineering/planning/verification.md)
- [Asset reference provenance](engineering/research/catalogue-evidence.md)
