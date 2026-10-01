# Studio renderer

*Last updated: 2026-09-28*

> Three.js rendering contract for the garment studio viewport.

## Coordinates and assets

- models use metres, Y-up, front toward positive Z, floor at Y=0
- body landmarks: waist 1.05, bust 1.29, shoulders 1.49, neck 1.70
- mannequin path: `/assets/models/mannequin.glb` (the silhouette); render-only model path: `/assets/models/model.glb`
- garment paths come from `GarmentDefinition.modelUrl`
- editable meshes declare `extras.partId` or start their name with `<partId>.`
- fixed attachments declare `extras.fixedMaterial=true`

## Materials

- each editable part receives an independent `MeshPhysicalMaterial` from `FabricShading.createFabricMaterial`
- every cloth kind has a finish: weave relief (plain, twill, satin, rib or pile normal map, generated at runtime),
  sheen, and satin anisotropy for silks; the weave keeps a physical thread pitch and turns with the pattern rotation
- holder cloth (the silhouette's form and skirt, the model's dress) gets the same treatment; skin and hair stay authored
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
- warm key, cool fill, and warm rim lights preserve textile relief; the key casts soft PCF shadows (radius 7)
- neutral (Khronos PBR) tone mapping at exposure 0.78 keeps textile colours close to their swatches
- the composer's render target is 4× multisampled, so edges stay smooth through the outline pass
- a transparent canvas, a shadow-catcher floor and the authored contact shadow keep the UI responsible for backdrop color

## Studio render

- `integration/studio/render/FinalRender.ts` renders one offscreen PNG at 1600×2000 or 2400×3000 on the silhouette
  or the model, from the front, three-quarter, side or back, on four backdrops (one transparent)
- framing fits the holder and garment bounds floor to crown for every view (`RenderFraming.frameView`)
- 8× multisampling, GTAO ambient occlusion and a 4096 shadow map; software WebGL (SwiftShader, llvmpipe) switches to
  2× multisampling, no occlusion and a 2048 shadow map
- the renderer is disposed and its context released after each render
