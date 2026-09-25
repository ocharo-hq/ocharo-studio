# Deployment

*Last updated: 2026-09-25*

The Dockerfile packages the React SPA and .NET API into one image.
Its build context is `engineering/codebase/`; compose stores SQLite data in a named volume.

```sh
docker compose -f engineering/deployment/docker-compose.yml config
docker build -f engineering/deployment/Dockerfile -t uzbek-studio:local engineering/codebase
```

The local compose endpoint uses `127.0.0.1:18260`.
No image has been published and no deployment exists.
The release workflow is prepared for a future human-published semver release and emits the release tag plus `latest`.
It uses the repository's own GitHub identity; no owner, remote, or registry credentials are hardcoded.

Workflow reference: [GitHub's Docker publishing documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
