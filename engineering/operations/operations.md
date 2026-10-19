# Operations

*Last updated: 2026-10-19*

## Isolated review

Use the workspace review process described in [the build record](../../../../docs/platform-build.md).
Studio review API uses HTTPS `8348` / HTTP `8349`; frontend uses HTTPS `8356`.
The preexisting Studio ports remain `8260` / `8261` / `8262`; inspect ownership before any restart.
Required runtimes belong in managed terminals. Existing databases and runtime processes remain isolated.

- `DB_CONNECTION` selects a dedicated SQLite file, for example `Data Source=<review-directory>/studio.db;Cache=Shared`.
- `OcharoPlatform__BaseUrl=https://localhost:8340` selects the trusted Platform introspection endpoint.
- `VITE_OCHARO_PLATFORM_ORIGIN=https://localhost:8340` fixes the frontend's accepted Desk issuer.
- `STUDIO_API_URL=https://localhost:8348` selects Vite's API proxy with certificate verification enabled.
- `STUDIO_TLS_CERT` and `STUDIO_TLS_KEY` reuse an existing trusted certificate pair and skip mkcert.
- `NODE_EXTRA_CA_CERTS` can supply the existing local CA to Node; never disable TLS verification.
- Use the declared Node `24` and pnpm `10` versions; a login shell can otherwise select older system Node.
- The frontend consumes published `@wow-two-beta/fe@0.0.23`; the host pins `WoW2.Sdk.Beta.Be` `10.0.71-beta`.
- The review launcher passes these values explicitly and sets no `LOCAL_SETTINGS`, so it never reads the IDE run's
  `appsettings.Local.json`; only the `https` launch profile reads that file.

## Storage and connection

`GET /api/studio/session`, `GET /api/studio/state`, and `PUT /api/studio/state` require a valid five-minute
`ocharo-studio` ticket. The server checks current Platform membership on every request. Only editors can write.
Workspace UUIDs route the authenticated organization/member collection and never grant access by themselves.
State and session responses carry `Cache-Control: no-store`; requests use explicit bearer headers without cookies.
A `401` ends the connection once through the fe sdk's auth bridge: Studio clears the ended ticket (or the cached
account state), shows one neutral `Signed out — sign in again` notice and keeps browser recovery and local edits.
Later `401`s stay silent, and a stale ticket at load settles browser-only without a notice. A `403` still warns that
access changed. Studio does not redirect on expiry; the Settings reconnect or account sign-in returns to the page.

`PUT` preserves atomic optimistic revisions and returns `409` for stale writes. Browser recovery binds to its
workspace, remains available after expiry, and stops automatic upload when another member or organization connects.
The browser-only editor works without Platform. Designs can be transferred explicitly through portable JSON.
The default database remains `appdata/ocharo-studio.db`; review runs must select their isolated file.
Normal Docker Compose preserves `/app/appdata` in `ocharo-studio-data`.

## Review checks

Run the read-only check from `engineering/codebase/ocharo-studio.frontend-services`:

```sh
OCHARO_STUDIO_API=https://localhost:8348 \
OCHARO_STUDIO_TICKET_FILE=<private-ticket-file> \
node scripts/verify-connected-studio.mjs
```

The script checks valid connection, fabricated-ticket rejection, cache policy, anonymous rejection, and workspace
selection without modifying saved designs. Keep credentials in the private file or environment, never command arguments.

The complete browser suite runs against the managed HTTPS review frontend:

```sh
STUDIO_URL=https://localhost:8356 \
VITE_OCHARO_PLATFORM_ORIGIN=https://localhost:8340 \
npx playwright test --workers=1
```

`tests/e2e/fixtures/studioFixture.ts` supplies an isolated synthetic member/organization and revisioned transport
for each browser context. It rejects missing bearer headers, mismatched workspaces, and stale writes. The original
conflict, offline retry, material, export, navigation, and accessibility scenarios retain their behavior coverage.
`connection.spec.ts` separately checks browser-only recovery, expiry, and real PNG/manifest downloads.
Every scenario enables TLS validation; API replies in these browser checks are controlled fixtures. Live Platform
introspection, real database writes, and cross-app imports remain separate workspace integration evidence.

## Creative packages

Export → Submit for review downloads one PNG and one `.ocharo-review.json` manifest. Review acknowledgement means
ready for review; it does not publish, send a campaign, or approve product facts and media rights.
Original assets, recovery data, certificates, generated output and credentials remain outside source publication.
