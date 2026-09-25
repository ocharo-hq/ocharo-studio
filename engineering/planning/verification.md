# Studio verification

*Last updated: 2026-09-25*

## Verified implementation

The agreed local creative-studio scope is implemented: five fixed-size garments on one authored mannequin,
category-owned attachments, selectable garment regions, four generated textile textures plus six solid materials,
independent material placement, orbit/zoom/view controls, undo/redo, editable saved looks, JSON transfer,
PNG export, and responsive floating controls.

The initial developer commit is `323b2ed`. This record describes the completed implementation, superseding
foundation-only checks from that commit.

## Executed checks

| Check | Result |
|---|---|
| TypeScript | `tsc -b` passed; checks both referenced frontend projects |
| Architecture boundaries | 27 local imports checked; forbidden-edge self-tests passed |
| Formatting | Prettier check passed |
| State and persistence | 17/17 Vitest tests passed |
| Backend | Final .NET build passed, 0 warnings/errors; 1/1 contract test passed |
| Browser, HTTPS Vite | 5/5 Playwright tests passed in installed Chrome |
| Browser, production container | The same 5/5 tests passed against the packaged .NET application |
| Accessibility | Keyboard tabs/dialogs and axe WCAG 2 A/AA + 2.1 AA checks passed for settled light/dark surfaces |
| Responsive layout | Desktop 1440×1000 and phone 390×844 checked; no horizontal overflow |
| Visual garment review | All five garments inspected from front, back, and side; no visible mannequin clipping found |
| Asset validation | Finite positions/normals/UVs, expected part metadata, GLB headers, deterministic generator hashes passed |
| Docker | Compose configuration and full production image build passed |
| Workflow syntax | Both GitHub workflow YAML files parsed successfully |
| npm dependencies | Locked installation audit reported zero vulnerabilities at verification time |
| Git hygiene | Whitespace check passed; generated textures use Git LFS |

### Browser workflows

1. Apply different materials to main panels and collar; change rotation/offset independently; reset, undo, redo.
2. Name/save/reload a look; export and import its JSON; export a preview PNG; reject incompatible input.
3. Load every garment, use front/back/side presets, select all defined parts, and apply/rotate textiles.
4. Switch themes; operate phone controls; navigate tabs by keyboard; open/dismiss the named export dialog.
5. Confirm rendered pixels change after material edits; click visible cloth to select its part;
   drag the camera without changing selection.

State tests additionally cover malformed/missing-part documents, degree and offset bounds, corrupt storage,
independent assignments, bounded/coalesced history, saved-copy identity, save retry, and dirty-state recovery.

## HTTP smoke checks

These checks passed on the local .NET host (`8261`) and production container (`18260`).

| Route | Status | Response |
|---|---:|---|
| `/health` | 200 | JSON |
| `/api/studio` | 200 | Studio name, schema version, browser-local storage, edit/save/import/export capabilities |
| `/` | 200 | Built studio HTML |
| `/editor` | 200 | SPA fallback HTML |
| `/api/missing` | 404 | Problem JSON |
| `/assets/models/nimcha.glb` | 200 | `model/gltf-binary`, valid GLB header |
| `/assets/textures/atlas-rose.png` | 200 | `image/png`, generated texture bytes |

All six GLBs also returned `200 model/gltf-binary` from the local .NET host. The production browser suite
loaded every garment and all required material assets. Explicit GLB/GLTF MIME mappings are part of the host.

## Build artifact

- Local Docker tag: `uzbek-studio:local`.
- Verified image: `sha256:8f6bd1e8acfdab6b1e71db0097911c5a3503880feefc81c70c45f26158c10c06`.
- Node `24.11.0`, npm `11.6.1`, .NET SDK `10.0.300` used locally.
- The Three.js application bundle is approximately 939 KB minified / 253 KB gzip. Vite emits its default
  >500 KB chunk advisory; formal device performance profiling was not performed.
- [Desktop preview](../research/studio-preview.png).
- [Asset authoring and provenance](../research/garment-authoring.md).
- [Textile assets and exact built-in image-generation prompts](../codebase/uzbek-studio.frontend-services/public/assets/textures/manifest.json).

## Reproduce

From `engineering/codebase/uzbek-studio.frontend-services/`:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run dev
# In another terminal; install Playwright Chromium first if it is unavailable:
npx playwright install chromium
npm run test:e2e
```

The test suite defaults to the existing HTTPS development server. `STUDIO_URL` points it at another host.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects installed Chrome; verification used the macOS application.
CI starts the explicit HTTP headless development profile. Normal interactive development remains HTTPS.

From the repository root:

```sh
dotnet build engineering/codebase/uzbek-studio.backend-services/UzbekStudio.BackendServices.slnx
dotnet test engineering/codebase/uzbek-studio.backend-services/UzbekStudio.BackendServices.slnx --no-build --no-restore
docker compose -f engineering/deployment/docker-compose.yml config --quiet
docker build -f engineering/deployment/Dockerfile -t uzbek-studio:local engineering/codebase
docker run --rm -p 127.0.0.1:18260:8080 uzbek-studio:local
```

## Practical limits

- Automated checks used Chromium; Safari, Firefox, real touch devices, and assistive technology need human review.
- Garments are authored interpretations; there is no physical drape simulation or measured-fit guarantee.
- Pattern names describe generated studies, not catalogue-approved production fabric scans.
- Looks and drafts are browser-local; portable JSON export is the backup/transfer mechanism.
- Sizing, length changes, decorative overlays, free attachments, accounts, and collaboration remain deferred.
- No remote push, hosted CI execution, publication, or deployment occurred.
- Temporary verification runtimes are stopped at handoff; documented commands restart the application.
