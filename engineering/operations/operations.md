# Operations

*Last updated: 2026-10-19*

## Isolated review

Use the workspace review process described in [the build record](../../../../docs/platform-build.md).
Studio review API uses HTTPS `8348` / HTTP `8349`; frontend uses HTTPS `8356`.
The preexisting Studio ports remain `8260` / `8261` / `8262`; inspect ownership before any restart.
Required runtimes belong in managed terminals. Existing databases and runtime processes remain isolated.

- `DB_CONNECTION` selects a dedicated SQLite file, for example `Data Source=<review-directory>/studio.db;Cache=Shared`.
- `Identity__Client__Authority=https://localhost:8404` selects the Identity instance, beside the rest of `Identity:Client`.
- `STUDIO_API_URL=https://localhost:8348` selects Vite's API proxy with certificate verification enabled.
- `STUDIO_TLS_CERT` and `STUDIO_TLS_KEY` reuse an existing trusted certificate pair and skip mkcert.
- `NODE_EXTRA_CA_CERTS` can supply the existing local CA to Node; never disable TLS verification.
- Use the declared Node `24` and pnpm `10` versions; a login shell can otherwise select older system Node.
- The frontend consumes published `@wow-two-beta/fe@0.0.23`; the host pins `WoW2.Sdk.Beta.Be` `10.0.71-beta`.
- The review launcher passes these values explicitly and sets no `LOCAL_SETTINGS`, so it never reads the IDE run's
  `appsettings.Local.json`; only the `https` launch profile reads that file.

## Storage and connection

`GET /api/studio/session`, `GET /api/studio/state`, and `PUT /api/studio/state` require a session from Ocharo's Identity
with a role in its organization. Only people holding `studio:edit` can write, and a write carries `X-Csrf-Token`.
Workspace UUIDs route the authenticated organization/member collection and never grant access by themselves.
State and session responses carry `Cache-Control: no-store`.
A `401` ends the connection once through the fe sdk's auth bridge: Studio clears the cached account state, shows one neutral `Signed out — sign in again` notice and keeps browser recovery and local edits.
Later `401`s stay silent. A `403` still warns that access changed. Studio does not redirect on expiry; the account
sign-in returns to the page.

`PUT` preserves atomic optimistic revisions and returns `409` for stale writes. Browser recovery binds to its
workspace, remains available after expiry, and stops automatic upload when another member or organization connects.
The browser-only editor works without signing in. Designs can be transferred explicitly through portable JSON.
The default database remains `appdata/ocharo-studio.db`; review runs must select their isolated file.
Normal Docker Compose preserves `/app/appdata` in `ocharo-studio-data`.

## Creative packages

Export → Submit for review downloads one PNG and one `.ocharo-review.json` manifest. Review acknowledgement means
ready for review; it does not publish, send a campaign, or approve product facts and media rights.
Original assets, recovery data, certificates, generated output and credentials remain outside source publication.
