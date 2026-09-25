# Studio renderer

*Last updated: 2026-09-25*

> Three.js rendering contract for the garment studio viewport.

## Coordinates and assets

- models use metres, Y-up, front toward positive Z, floor at Y=0
- body landmarks: waist 1.05, bust 1.29, shoulders 1.49, neck 1.70
- mannequin path: `/assets/models/mannequin.glb`
- garment paths come from `GarmentDefinition.modelUrl`
- editable meshes declare `extras.partId` or start their name with `<partId>.`
- fixed attachments declare `extras.fixedMaterial=true`

## Materials

- each editable part receives an independent `MeshPhysicalMaterial`
- color textures use sRGB, repeat wrapping, centred rotation, and `flipY=false`
- document rotations are degrees; offsets and catalog repeats map directly to texture transforms
- fixed gold buttons retain authored materials
- decoded source textures are cached; per-part clones keep rotation and offset independent
- textured parts use white base colour so swatch colours are not multiplied by preview colours

## Runtime

- one renderer survives document assignment changes; garment changes reload both GLBs
- stale loads are discarded by generation and disposed after async completion
- capture waits for assignment textures, temporarily removes selection, and returns PNG data
- unknown `/api/*` routes remain backend errors; the SPA owns public client routes
- reduced-motion mode renders on state or control changes instead of animating continuously

## Lighting

- `RoomEnvironment` supplies neutral reflections through PMREM
- warm key, cool fill, and warm rim lights preserve textile relief
- a transparent canvas and soft authored contact shadow keep surrounding UI responsible for backdrop color
