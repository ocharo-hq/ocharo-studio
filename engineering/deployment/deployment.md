# Deployment

*Last updated: 2026-10-18*

The Dockerfile packages the Vue SPA and .NET API into one image.
Its build context is `engineering/codebase/`. Compose mounts the named `ocharo-studio-data` volume at
`/app/appdata`; SQLite stores workspace state in `ocharo-studio.db`. The container does not encrypt that volume.
Back up the volume before replacing or removing the deployment.

```sh
docker compose -f engineering/deployment/docker-compose.yml config
docker build -f engineering/deployment/Dockerfile -t ocharo-studio:local engineering/codebase
```

The local compose endpoint uses `127.0.0.1:18260`.
`publish-docker-image.yml` is the Wheelhouse marker: each push, and each dispatched `commit`, runs `verify.yml`
and then the shared `publish.yml` of `wow-two-platform.pipelines`, which builds `ghcr.io/ocharo-hq/ocharo-studio/studio`.
A `main` build releases `vX.Y.Z` with `ocharo-studio-release.tar.gz`; other builds are candidates.
It uses the repository's own GitHub identity; no owner, remote, or registry credentials are hardcoded.

The frontend lockfile consumes published `@wow-two-beta/fe@0.0.22`.
The connected build requires HTTPS and a trusted Platform introspection origin. The plain HTTP Compose preview
supports browser-only editing; it cannot accept protected-state bearer tickets. This integration pass built the
frontend and backend locally; it did not rebuild or publish a Docker image.

## Convention adoption status

`deploy.yml` lists the one `studio` service; Wheelhouse deploys its bundle. Before a usable deployment:

- Studio's `/health` is hand-mapped, not the SDK boot bundle's endpoint.
- Integration tickets and SSO require HTTPS requests, but Studio has no trusted-proxy support behind a TLS-terminating ingress.

See `../research/convention-audit.md` for the earlier verified checks.
