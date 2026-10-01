# Deployment

*Last updated: 2026-09-29*

The Dockerfile packages the Vue SPA and .NET API into one image.
Its build context is `engineering/codebase/`. Compose mounts the named `ocharo-studio-data` volume at
`/app/appdata`; SQLite stores workspace state in `ocharo-studio.db`. The container does not encrypt that volume.
Back up the volume before replacing or removing the deployment.

```sh
docker compose -f engineering/deployment/docker-compose.yml config
docker build -f engineering/deployment/Dockerfile -t ocharo-studio:local engineering/codebase
```

The local compose endpoint uses `127.0.0.1:18260`.
No image has been published and no deployment exists.
The release workflow is prepared for a future human-published semver release and emits the release tag plus `latest`.
It uses the repository's own GitHub identity; no owner, remote, or registry credentials are hardcoded.

The frontend lockfile consumes published `@wow-two-beta/ui-vue@0.0.9`. The older vendor archive remains preserved.
The connected build requires HTTPS and a trusted Platform introspection origin. The plain HTTP Compose preview
supports browser-only editing; it cannot accept protected-state bearer tickets. This integration pass built the
frontend and backend locally; it did not rebuild or publish a Docker image.

Workflow reference: [GitHub's Docker publishing documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Convention adoption status

The descriptor and local packaging are prepared; no target was deployed. The shared publisher v0.1.0 proposal was withdrawn because its checkout does not materialize required Git LFS assets. Existing Platform/Studio publishing workflows remain unchanged; Assets has no publisher. Current CI must be reviewed before claiming descriptor-driven versioned images. See `../research/convention-audit.md` for verified checks and remaining configuration boundaries.
