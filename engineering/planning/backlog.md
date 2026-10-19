# Ocharo Studio — Backlog

*Last updated: 2026-10-19*

## Features

| Feature | State | Spec |
|---|---|---|
| Garment design | planned | [studio.md](../../product/features/studio.md) |
| Shared materials | planned | [materials.md](../../product/features/materials.md) |
| Creative handoff | planned | [creative-handoff.md](../../product/features/creative-handoff.md) |

## Product and delivery

| Item | Type | Notes |
|---|---|---|
| Human garment review | product | Validate fidelity, clipping, controls and useful exports with Maftuna. |
| Accessibility | engineering | Assistive-technology and keyboard-only acceptance. |
| Metric textile mapping | feature | Calibrate measured tiles before displaying centimetres. |
| Material revisions | feature | Variants and immutable comparisons preserve source assets. |
| Model rendering | product | Choose generated stills or rotatable scenes and exact scene IDs. |
| Normalized storage | engineering | Design entity APIs before changing existing SQLite snapshots. |
| Garment extensions | feature | Sizing, length, decorations and outfit composition need authored support. |
| Production rollout | engineering | Validate actual authenticated deployment and restore procedures. |
| Session-expiry redirect | engineering | Expiry shows one neutral notice and stays on the page; Studio works signed out. Redirect to sign-in once unsaved material edits survive navigation. |
| fe sdk: cancelled revision writes | sdk gap | `LatestRevisionQueue` has no request scope or cancelled outcome, so an ended session settles it `offline` with an error; Studio filters `StudioSessionExpired`. |
| be sdk: proxy trust from settings | sdk gap | `TrustProxiesFrom` binds only `ApiDefaultsOptions`; a host on `AddProxyAwareHosting` reads `Deployment:TrustedProxies` itself. |
| Startup boot floor | engineering | Move the host onto `AddApiDefaults`/`UseApiDefaults` and the SDK `/health`; it composes SDK parts today. |
