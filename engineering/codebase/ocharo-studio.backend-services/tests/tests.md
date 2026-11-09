# Tests

*Last updated: 2026-11-09*

> Backend test projects for Ocharo Studio: three tiers, one project each.

## Prerequisites

- .NET 10 SDK.
- No containers, services or network: Integration uses a temporary SQLite file, E2E boots the host in process with `WebApplicationFactory<Program>`.
- E2E replaces Identity sign-in with a test handler (`StudioTestIdentity`) and Files with an in-memory broker (`TestFiles`); no real accounts are involved.
- xUnit with AwesomeAssertions; versions are central in `Directory.Packages.props`.

## Tiers

| Project | Covers |
|---|---|
| `OcharoStudio.Tests.Unit` | Pure logic with no I/O: document validation (`StudioStateValidator`), the info query handler |
| `OcharoStudio.Tests.Integration` | Below HTTP, against a real SQLite file: `SqliteStudioStateStore` revisions, isolation and persistence |
| `OcharoStudio.Tests.E2E` | Full HTTP flows through the host: session and CSRF rules, workspace separation, ingress, host settings, runtime config, thumbnails, system status, DI composition |

- `StudioTestIdentity` and `TestFiles` are product host wiring and live in the E2E project.
- Test names follow `{Unit}_Should{Expectation}_When{Condition}`.

## Run

From `engineering/codebase/ocharo-studio.backend-services/`:

```bash
dotnet test OcharoStudio.BackendServices.slnx -p:BuildSpa=false
```

- One tier: `dotnet test tests/OcharoStudio.Tests.Unit -p:BuildSpa=false` (likewise `.Integration`, `.E2E`).
- `-p:BuildSpa=false` skips the frontend `pnpm` build; the backend tests do not need it.
