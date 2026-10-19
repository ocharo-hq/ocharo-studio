# Deployment

*Last updated: 2026-10-19*

The Dockerfile packages the Vue SPA and .NET API into one image.
Its build context is `engineering/codebase/`. Compose mounts the named `ocharo-studio-data` volume at
`/app/appdata`; SQLite stores workspace state in `ocharo-studio.db`. The container does not encrypt that volume.
Back up the volume before replacing or removing the deployment.

```sh
docker compose -f engineering/deployment/docker-compose.yml config
docker build -f engineering/deployment/Dockerfile -t ocharo-studio:local engineering/codebase
```

The local compose endpoint uses `127.0.0.1:18260`.
`publish-docker-image.yml` is the Wheelhouse marker and the only CI file: it calls the shared `delivery.yml` of
`wow-two-platform.pipelines` `v0.9.1`. A docs-only push builds nothing; a backend change runs the host checks; a
frontend or test change runs the frontend checks and the full three-shard browser suite; a shared file runs all.
Publication then builds `ghcr.io/ocharo-hq/ocharo-studio/studio`. Work lands on `main` only: a `main` build releases `vX.Y.Z` with
`ocharo-studio-release.tar.gz`; Wheelhouse deploys it to dev automatically and promotes that same release to prod
by digest. A short-lived branch or dispatched commit builds a candidate that reaches dev only by hand; there is
no dev or test branch.
It uses the repository's own GitHub identity; no owner, remote, or registry credentials are hardcoded.

The frontend lockfile consumes published `@wow-two-beta/fe@0.0.23`; the host pins `WoW2.Sdk.Beta.Be` `10.0.71-beta`.

The connected build requires HTTPS and a trusted Platform introspection origin. The plain HTTP Compose preview
supports browser-only editing; it cannot accept protected-state bearer tickets. This integration pass built the
frontend and backend locally; it did not rebuild or publish a Docker image.

## Settings

- The release bundle mounts the target's settings file at `/app/appsettings.Target.json` (pipelines `v0.7.0`);
  the host reads it through the be sdk's `AddSettingsFiles`, after `appsettings.json`.
- `deploy.yml` requires two keys there, and the runner refuses a deploy missing either:

  | Key | Value on the VPS |
  |---|---|
  | `OcharoPlatform:BaseUrl` | the Desk origin Studio introspects tickets against, `https://…` |
  | `Deployment:TrustedProxies` | a JSON array naming the ingress: Traefik's `platform` address, `[ "172.30.0.2" ]` |

- Forwarded `X-Forwarded-Proto`, `-Host` and `-For` apply only from loopback and those proxies (the be sdk's
  `AddProxyAwareHosting`), so Desk tickets and the account sign-in see `https` and the public host behind Traefik.
  The checked-in default trusts no proxy; another workload's forged headers are ignored.
- `dotnetEnvironment` stays off: deployed dev and prod both run as .NET `Production`. The runner sets
  `DEPLOY_ENVIRONMENT`, so a deployed host is never a local run: it skips `appsettings.Local.json` and maps no
  OpenAPI document. `DB_CONNECTION` still overrides the SQLite connection string.
- Startup creates or extends the SQLite schema on the data volume before serving; a failure aborts startup. Studio
  has no EF migrations.
- `appsettings.Local.json`, `appsettings.Target.json` and the retired `appsettings.Machine.json` are gitignored and
  excluded from the Docker build context.

## Convention adoption status

`deploy.yml` lists the one `studio` service; Wheelhouse deploys its bundle. Remaining differences from the shared
startup defaults:

- Studio's `/health` is hand-mapped, not the SDK boot bundle's endpoint.
- The host composes SDK parts (`AddSettingsFiles`, `AddProxyAwareHosting`, HTTP ProblemDetails) rather than the
  `AddApiDefaults` boot floor.

See `../research/convention-audit.md` for the earlier verified checks.
