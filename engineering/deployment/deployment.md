# Deployment

*Last updated: 2026-11-09*

The Dockerfile packages the Vue SPA and .NET API into one image.
Its build context is `engineering/codebase/`. Compose mounts the named `ocharo-studio-data` volume at
`/app/appdata`, which now holds only the retired SQLite store for the one-time import. Workspace state lives in PostgreSQL
(database `ocharo_{env}`, schema `studio`); see `## PostgreSQL move`. Back up the database before replacing or removing the deployment.

```sh
docker compose -f engineering/deployment/docker-compose.yml config
docker build -f engineering/deployment/Dockerfile -t ocharo-studio:local engineering/codebase
```

The local compose endpoint uses `127.0.0.1:18260`.
`publish-docker-image.yml` is the Wheelhouse marker and the only CI file: it calls the shared `delivery.yml` of
`wow-two-platform.pipelines` at commit `e134a47`. A docs-only push builds nothing; a backend change runs the host checks; a
frontend or test change runs the frontend checks and the full three-shard browser suite; a shared file runs all.
Publication then builds `ghcr.io/ocharo-hq/ocharo-studio/studio`. Work lands on `main` only: a `main` build releases `vX.Y.Z` with
`ocharo-studio-release.tar.gz`; Wheelhouse deploys it to dev automatically and promotes that same release to prod
by digest. A short-lived branch or dispatched commit builds a candidate that reaches dev only by hand; there is
no dev or test branch.
It uses the repository's own GitHub identity; no owner, remote, or registry credentials are hardcoded.

The SDK pins live in the manifests: `apps/web/package.json` for the fe SDK, `Directory.Packages.props` for the be SDK.

Sign-in requires HTTPS and `Identity:Client:*`, and the host needs `ConnectionStrings:Database` on a database that holds
Identity's migration set; the Compose preview sets neither of the Identity parts, so it does not boot alone.
Browser-only editing needs no sign-in on any host that does boot.

## Settings

- The release bundle mounts the target's settings file at `/app/appsettings.Target.json` (pipelines `v0.7.0`);
  the host reads it through the be sdk's `AddSettingsFiles`, after `appsettings.json`.
- `deploy.yml` (descriptor 2) types its keys under `settings.keys` (pipelines `v0.10.0`); the runner refuses a deploy
  missing a required one, and Wheelhouse checks each saved value against its type:

  | Key | Type | Source |
  |---|---|---|
  | `Identity:Client:{Authority,ClientSecret}` | linked with `from` | `Sites:identity:Url` and identity's `Identity:Server:Clients:5:ClientSecret`, both in `ocharo-platform`'s descriptor |
  | `Identity:Client:{ClientId,CookieName,PostSignOutRedirectPath}` | defaults | `studio`, `__Host-ocharo-studio`, `/` |
  | `Identity:Client:SignalUrl` | linked with `from` | identity's `Identity:Server:Clients:5:SignalUrl`, an owner key `{site}/api/identity/signal` |
  | `Deployment:TrustedProxies` | required | derived by Wheelhouse: the ingress's address on the server's `platform` network |
  | `AllowedHosts` | — | derived by Wheelhouse: the site's hosts, the service's platform name and `localhost` |
  | `OcharoApps:{Desk,Catalogue,Brand}` | linked with `from` | `Sites:{desk,catalogue,brand}:Url` in `ocharo-platform`'s descriptor: the app menu served at `/api/runtime-config` |
  | `OcharoApps:Studio` | linked with `from` | Studio's own `Sites:studio:Url` |
  | `OcharoApps:{Marketing,Editorial,Atlas,Wear,Blog}` | `url`, optional | the owner, until Marketing deploys its sites; Editorial, Atlas and Wear sit under a path of the blog site; an unset key leaves that app out |

- The one site, `app`, is public; Wheelhouse binds its host per environment.

- Forwarded `X-Forwarded-Proto`, `-Host` and `-For` apply only from loopback and those proxies (the be sdk's
  `AddProxyAwareHosting`), so the sign-in sees `https` and the public host behind Traefik.
  The checked-in default trusts no proxy; another workload's forged headers are ignored.
- `dotnetEnvironment` is on: deployed dev runs as .NET `Development`, prod as `Production`, and
  `appsettings.Development.json` holds deployable defaults only. The runner sets `DEPLOY_ENVIRONMENT`, so a deployed
  host is never a local run: it skips `appsettings.Local.json` and maps no OpenAPI document. A local run needs
  `ConnectionStrings:Database` in the gitignored `appsettings.Local.json`, pointing at a database that already holds
  Identity's set (a local Identity instance's database).
- The dev check (`verify`) runs after each dev rollout: `/health/ready`, then `/api/system/status` from the release image.
  A failure holds the auto-promote to prod.
- State lives in PostgreSQL: the product database `ocharo_{env}` (shared with Desk and Identity), schema `studio`, owned
  by Studio's bespoke SQL migration set `studio` (`OcharoStudio.Persistence/Migrations/001-workspaces`), which depends
  on Identity's set (`DependsOn("identity", 1)`). `ConnectionStrings:Database` is filled per target by Wheelhouse
  (`needs: [postgres]`).
- The deploy's `migrate:` item runs `dotnet OcharoStudio.Api.dll migrate` before Studio restarts, connected through
  `Migrations:ConnectionString`. A deployed boot only verifies migration levels; a local run (`Development` without
  `DEPLOY_ENVIRONMENT`) applies them at boot.
- Identity client 5's `RedirectUris:0` `{site}/api/identity/callback` and `PostSignOutRedirectUris:0` `{site}/` are owner
  keys on `identity`, typed per environment. Sign-in sessions live in the be sdk's PostgreSQL distributed cache (schema `studio_cache`, set
  `distributed_cache`) and the Data Protection key ring in `studio.data_protection_keys`, so a restart or deploy keeps
  everyone signed in.
- `appsettings.Local.json`, `appsettings.Target.json` and the retired `appsettings.Machine.json` are gitignored and
  excluded from the Docker build context.

## Convention adoption status

`deploy.yml` lists the one `studio` service on the public `app` site; Wheelhouse deploys its bundle. Remaining differences from the shared
startup defaults:

- Studio's `/health` (liveness) and `/health/ready` (adds the database and the `studio` schema) are hand-mapped, not the
  SDK boot bundle's endpoints.
- The host composes SDK parts (`AddSettingsFiles`, `AddProxyAwareHosting`, HTTP ProblemDetails) rather than the
  `AddApiDefaults` boot floor.

See `../research/convention-audit.md` for the earlier verified checks.

## PostgreSQL move

The retired store is `appdata/ocharo-studio.db` plus the key ring in `appdata/keys`, on the `studio-data` volume.
The image's `import-sqlite [--dry-run]` verb copies it once per environment, after the deploy that carries the move.

1. Run `import-sqlite --dry-run` as an operator job on the target's image with the `studio-data` volume mounted. It
   writes nothing.
2. Run `import-sqlite` the same way. It reads `LegacySqlite:Path` (default `appdata/ocharo-studio.db`) and
   `LegacySqlite:KeysPath` (default `appdata/keys`), copies every workspace and key PostgreSQL lacks, verifies every row
   (revision plus SHA-256 of state and materials), recovers each workspace's Identity organization and account by
   matching its derived id, then renames the file to `ocharo-studio.db.imported-{UTC stamp}`.
3. Read the last stdout line, `import-result {json}`: counts and digests only.

Exit `0` means copied or nothing to copy; `1` means refused, a diverged row keeps the SQLite file untouched; `2` means
failed. Until it runs, the state and thumbnail routes answer 503 and members keep their browser recovery copy.
