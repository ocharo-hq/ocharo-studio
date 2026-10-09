# Generated Ocharo SSO source snapshot

Do not edit these files here. The source is `ocharo-platform/engineering/codebase/ocharo-sso/Ocharo.Sso`. This temporary source snapshot makes standalone CI independent of an unpublished SDK package. Replace with the versioned SDK package after its separate release.

To update, copy all source `.cs` and `.csproj` files from that project, regenerate the SHA-256 entries in `snapshot.json`, then run the host authentication tests. The copied source must be byte-for-byte identical. No credentials or configuration values belong here.

Run `python3 shared/sync-sso.py --check` from the backend root. Compare with the authoritative checkout using `--source /path/to/Ocharo.Sso`. Refresh explicitly using `--update --source /path/to/Ocharo.Sso`; rerun the host authentication tests afterward.
