import { loadVerifiedModel } from "../modelAssets";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DEFAULT_PLACEMENT } from "../../../domain/studio/document";
import { materialTransform } from "../../../domain/studio/placement";
import { getGarment, getMaterial } from "../../../domain/studio/catalog";
import type { DesignDocument } from "../../../domain/studio/types";
import {
  createFabricMaterial,
  dressHolderCloth,
  placeFabric,
} from "../scene/FabricShading";
import { disposeObject, fitMannequin, meshPartId } from "../scene/SceneObjects";
import { mapSurfaceCoordinates } from "../scene/SurfaceCoordinates";
import {
  BACKDROPS,
  frameView,
  HOLDER_MODELS,
  type FinalRenderOptions,
} from "./RenderFraming";

const VERTICAL_FOV = 26;

/** Devices without a GPU (software WebGL) get lighter settings so a render takes seconds, not minutes. */
function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(
    gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
  );
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
}

/** The authored contact shadow: a soft darkening right under the hem, as in the viewport. */
function contactShadow(): THREE.Mesh {
  const canvas = window.document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(30,35,28,.34)");
  gradient.addColorStop(0.4, "rgba(30,35,28,.14)");
  gradient.addColorStop(1, "rgba(30,35,28,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.1),
    new THREE.MeshBasicMaterial({
      map: texture,
      color: 0x000000,
      fog: false,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.002;
  return decal;
}

/**
 * Paints a studio sweep behind the render: the backdrop colour, a little brighter behind the figure and
 * falling off toward the edges. Painted after rendering, so tone mapping never shifts the chosen colour.
 */
function paintBackdrop(
  render: HTMLCanvasElement,
  colour: string,
): HTMLCanvasElement {
  const canvas = window.document.createElement("canvas");
  canvas.width = render.width;
  canvas.height = render.height;
  const context = canvas.getContext("2d")!;
  const base = new THREE.Color(colour);
  const centre = base.clone().lerp(new THREE.Color("#ffffff"), 0.22);
  const edge = base.clone().multiplyScalar(0.86);
  const { width, height } = canvas;
  const sweep = context.createRadialGradient(
    width / 2,
    height * 0.42,
    height * 0.05,
    width / 2,
    height * 0.5,
    height * 0.78,
  );
  sweep.addColorStop(0, `#${centre.getHexString()}`);
  sweep.addColorStop(1, `#${edge.getHexString()}`);
  context.fillStyle = sweep;
  context.fillRect(0, 0, width, height);
  context.drawImage(render, 0, 0);
  return canvas;
}

async function loadTexture(
  url: string,
  repeat: readonly [number, number],
  anisotropy: number,
): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.center.set(0.5, 0.5);
  texture.flipY = false;
  texture.anisotropy = anisotropy;
  return texture;
}

function studioLights(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  shadowSize: number,
): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff3df, 1.5);
  key.position.set(2.2, 5.6, 3);
  key.target.position.set(0, 0.8, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 11;
  Object.assign(key.shadow.camera, {
    left: -1.1,
    right: 1.1,
    top: 1.3,
    bottom: -1.3,
  });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.radius = 9;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xcfd9ff, 0.7);
  fill.position.set(-3, 2.6, 2);
  const rim = new THREE.DirectionalLight(0xffd8b1, 1.1);
  rim.position.set(0, 3, -3);
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.ShadowMaterial({ opacity: 0.16, depthWrite: false, fog: false }),
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.001;
  catcher.receiveShadow = true;
  scene.add(key, key.target, fill, rim, catcher, contactShadow());
}

async function dress(
  design: DesignDocument,
  garment: THREE.Object3D,
  anisotropy: number,
): Promise<void> {
  const definition = getGarment(design.garmentId);
  const meshes: THREE.Mesh[] = [];
  garment.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  const textures = new Map<string, Promise<THREE.Texture>>();
  await Promise.all(
    meshes.map(async (mesh) => {
      mesh.castShadow = mesh.receiveShadow = true;
      if (mesh.userData.fixedMaterial === true) return;
      const partId = meshPartId(mesh);
      const part = definition.parts.find((item) => item.id === partId);
      if (!part) return;
      const assignment = design.parts[part.id];
      const material = getMaterial(
        assignment?.materialId ?? part.defaultMaterialId,
      );
      mapSurfaceCoordinates(mesh);
      let texture: THREE.Texture | null = null;
      if (material.textureUrl) {
        let pending = textures.get(material.id);
        if (!pending) {
          pending = loadTexture(
            material.textureUrl,
            material.repeat,
            anisotropy,
          );
          textures.set(material.id, pending);
        }
        texture = (await pending).clone();
      }
      const previous = mesh.material;
      mesh.material = createFabricMaterial(material, texture, anisotropy);
      (Array.isArray(previous) ? previous : [previous]).forEach((item) =>
        item.dispose(),
      );
      const placement = assignment?.placement ?? DEFAULT_PLACEMENT;
      placeFabric(
        mesh.material as THREE.MeshPhysicalMaterial,
        material.kind,
        materialTransform(placement, [
          material.repeat[0],
          material.repeat[1] * 2.075,
        ]),
        placement.rotation,
      );
    }),
  );
  for (const pending of textures.values()) (await pending).dispose();
}

/**
 * Renders the design once, offscreen, at print size: 8x multisampling, ambient occlusion,
 * soft key-light shadows and the studio's fabric shading. Resolves to a PNG.
 */
export async function renderFinalImage(
  design: DesignDocument,
  options: FinalRenderOptions,
): Promise<Blob> {
  const canvas = window.document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  const scene = new THREE.Scene();
  const passes: { dispose(): void }[] = [];
  try {
    const limit = renderer.capabilities.maxTextureSize;
    if (options.width > limit || options.height > limit)
      throw new Error(
        `This device can render up to ${limit} pixels on a side; choose a smaller size.`,
      );
    renderer.setPixelRatio(1);
    renderer.setSize(options.width, options.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.78;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Always rendered on transparency; the backdrop is painted underneath afterwards.
    const backdrop = BACKDROPS[options.backdrop];
    renderer.setClearColor(0x000000, 0);
    const software = isSoftwareRenderer(renderer);
    studioLights(scene, renderer, software ? 2048 : 4096);

    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const loader = new GLTFLoader();
    const garmentDefinition = getGarment(design.garmentId);
    const [holderGltf, garmentGltf] = await Promise.all([
      loadVerifiedModel(loader, HOLDER_MODELS[options.holder]),
      loadVerifiedModel(loader, garmentDefinition.modelUrl),
    ]);
    const holder = holderGltf.scene;
    fitMannequin(
      holder,
      garmentDefinition.parts.map((part) => part.id),
    );
    holder.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = child.receiveShadow = true;
      dressHolderCloth(child, anisotropy);
    });
    const garment = garmentGltf.scene;
    await dress(design, garment, anisotropy);
    scene.add(holder, garment);

    const bounds = new THREE.Box3().setFromObject(holder);
    bounds.union(new THREE.Box3().setFromObject(garment));
    const frame = frameView(
      {
        min: [bounds.min.x, bounds.min.y, bounds.min.z],
        max: [bounds.max.x, bounds.max.y, bounds.max.z],
      },
      options.view,
      options.width / options.height,
      VERTICAL_FOV,
    );
    const camera = new THREE.PerspectiveCamera(
      VERTICAL_FOV,
      options.width / options.height,
      0.05,
      50,
    );
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);

    const target = new THREE.WebGLRenderTarget(options.width, options.height, {
      type: THREE.HalfFloatType,
      samples: Math.min(software ? 2 : 8, renderer.capabilities.maxSamples),
    });
    const composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(1);
    composer.setSize(options.width, options.height);
    composer.addPass(new RenderPass(scene, camera));
    if (!software) {
      const occlusion = new GTAOPass(
        scene,
        camera,
        options.width,
        options.height,
      );
      occlusion.updateGtaoMaterial({
        radius: 0.12,
        distanceExponent: 1.4,
        thickness: 1,
        scale: 1,
        samples: 16,
      });
      occlusion.blendIntensity = 0.75;
      occlusion.setSceneClipBox(bounds);
      composer.addPass(occlusion);
    }
    composer.addPass(new OutputPass());
    passes.push(composer, ...composer.passes);
    composer.render();

    const output = backdrop ? paintBackdrop(canvas, backdrop) : canvas;
    return await new Promise<Blob>((resolve, reject) =>
      output.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("The render was empty.")),
        "image/png",
      ),
    );
  } finally {
    for (const pass of passes) pass.dispose();
    scene.environment?.dispose();
    for (const child of scene.children) disposeObject(child);
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
