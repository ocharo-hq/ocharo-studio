# Foundation verification

*Last updated: 2026-09-25*

## Verified

| Check | Result |
|---|---|
| .NET restore | Six projects restored; SDK `10.0.58-beta` resolved from NuGet |
| Full solution build | Passed with zero warnings and zero errors |
| Frontend build | `BuildSpa` ran `npm ci`, TypeScript checking, and Vite production build |
| Dependency audit | 125 npm packages audited; zero reported vulnerabilities at verification time |
| Existing backend test | `1/1` passed |
| Solution structure | Six projects grouped under `Services` and `Tests` in the `.slnx` solution |
| Compose configuration | `docker compose config --quiet` passed |
| Release workflow syntax | Ruby YAML parser accepted the workflow |
| Docker image build | Passed; local tag `uzbek-studio:foundation` |
| Managed local host | Started and stopped successfully |
| Managed container | Started in Production, created its SQLite schema, and stopped successfully |
| Workspace registration | `scripts/active.sh -l` resolves both new project paths |
| Catalogue source links | All 27 cited source paths in the evidence document resolve |

## HTTP smoke evidence

The same checks passed against the local .NET host on HTTP port `8261` and the packaged container on port `18260`.

| Route | Status | Response |
|---|---:|---|
| `/health` | 200 | JSON |
| `/api/greeting` | 200 | JSON |
| `/` | 200 | Generated SPA HTML |
| `/editor` | 200 | SPA fallback HTML |
| `/api/missing` | 404 | Problem JSON |

`/editor` verifies fallback routing only; it does not establish that a clothing editor exists.
Both temporary runtimes were stopped after verification.

## Commands

Executed from the backend directory, with Node `24.11.0` and npm `11.6.1` on `PATH`:

```sh
dotnet restore UzbekStudio.BackendServices.slnx
dotnet build UzbekStudio.BackendServices.slnx --no-restore
dotnet test UzbekStudio.BackendServices.slnx --no-build --no-restore
```

Executed from the repository root:

```sh
docker compose -f engineering/deployment/docker-compose.yml config --quiet
docker build -f engineering/deployment/Dockerfile -t uzbek-studio:foundation engineering/codebase
dotnet run --project engineering/codebase/uzbek-studio.backend-services/UzbekStudio.Api --no-build --no-restore --launch-profile https
docker run --rm --name uzbek-studio-foundation-check -p 127.0.0.1:18260:8080 uzbek-studio:foundation
```

Required restore, build, test, daemon, and local-socket checks completed through native escalation where necessary.

## Scope and remaining work

- This is a working application foundation with a greeting example, not the completed clothing studio.
- Garment/mannequin meshes, generated textures, part editing, island controls, and saved looks remain unimplemented.
- No browser visual QA, frontend certificate trust flow, Blender authoring, or image generation was performed.
- No hosted CI run, remote repository creation, image publication, or deployment occurred.
- The developer's first commit remains pending; no agent commit was made.
- Shared workspace registrations were added while preserving pre-existing edits; those shared files remain unstaged.

Implementation continues using the [new-chat prompt](implementation-prompt.md).
