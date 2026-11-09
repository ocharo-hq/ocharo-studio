# Deployment

*Last updated: 2026-11-05*

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
`wow-two-platform.pipelines` at commit `e134a47`. A docs-only push builds nothing; a backend change runs the host checks; a
frontend or test change runs the frontend checks and the full three-shard browser suite; a shared file runs all.
Publication then builds `ghcr.io/ocharo-hq/ocharo-studio/studio`. Work lands on `main` only: a `main` build releases `vX.Y.Z` with
`ocharo-studio-release.tar.gz`; Wheelhouse deploys it to dev automatically and promotes that same release to prod
by digest. A short-lived branch or dispatched commit builds a candidate that reaches dev only by hand; there is
no dev or test branch.
It uses the repository's own GitHub identity; no owner, remote, or registry credentials are hardcoded.

The SDK pins live in the manifests: `apps/web/package.json` for the fe SDK, `Directory.Packages.props` for the be SDK.

Sign-in requires HTTPS and `Identity:Client:*`, which the Compose preview does not set, so it no longer boots alone;
browser-only editing needs no sign-in on any host that does boot.

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
  | `OcharoApps:{Desk,Catalogue,Studio,Marketing,Editorial,Brand,Atlas,Wear,Blog}` | `url`, optional | the owner: the Ocharo app menu served at `/api/runtime-config`; an unset key leaves that app out |

- The one site, `app`, is public; Wheelhouse binds its host per environment.

- Forwarded `X-Forwarded-Proto`, `-Host` and `-For` apply only from loopback and those proxies (the be sdk's
  `AddProxyAwareHosting`), so the sign-in sees `https` and the public host behind Traefik.
  The checked-in default trusts no proxy; another workload's forged headers are ignored.
- `dotnetEnvironment` stays off: deployed dev and prod both run as .NET `Production`. The runner sets
  `DEPLOY_ENVIRONMENT`, so a deployed host is never a local run: it skips `appsettings.Local.json` and maps no
  OpenAPI document. `DB_CONNECTION` still overrides the SQLite connection string.
- Startup creates or extends the SQLite schema on the data volume before serving; a failure aborts startup. Studio
  has no EF migrations.
- Identity client 5's `RedirectUris:0` `{site}/api/identity/callback` and `PostSignOutRedirectUris:0` `{site}/` are owner
  keys on `identity`, typed per environment. Sign-in sessions live in memory, so a restart or deploy signs everyone out
  once; the Data Protection key ring stays at `/app/appdata/keys`.
- `appsettings.Local.json`, `appsettings.Target.json` and the retired `appsettings.Machine.json` are gitignored and
  excluded from the Docker build context.

## Convention adoption status

`deploy.yml` lists the one `studio` service on the public `app` site; Wheelhouse deploys its bundle. Remaining differences from the shared
startup defaults:

- Studio's `/health` is hand-mapped, not the SDK boot bundle's endpoint.
- The host composes SDK parts (`AddSettingsFiles`, `AddProxyAwareHosting`, HTTP ProblemDetails) rather than the
  `AddApiDefaults` boot floor.

See `../research/convention-audit.md` for the earlier verified checks.
