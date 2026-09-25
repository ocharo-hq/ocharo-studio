import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  DesignDocument,
  MaterialDefinition,
  PartId,
} from "../../../domain/studio/types";
import { getGarment, getMaterial } from "../../../domain/studio/catalog";

export type ViewPreset = "front" | "back" | "side" | "detail";

export interface StudioViewportApi {
  capture(): string;
  view(preset: ViewPreset): void;
  zoom(delta: number): void;
  reset(): void;
}

interface SceneCallbacks {
  onLoading: (loading: boolean) => void;
  onError: (message: string | null) => void;
  onSelectPart: (id: PartId) => void;
}

const PART_IDS = new Set<PartId>(["body", "collar", "sleeves", "trim", "belt"]);
const CAMERA_TARGET = new THREE.Vector3(0, 0.9, 0);
const CAMERA_VIEWS: Record<ViewPreset, readonly [number, number, number]> = {
  front: [0, 1.08, 3.5],
  back: [0, 1.08, -3.5],
  side: [3.5, 1.08, 0],
  detail: [0.7, 1.35, 1.65],
};

function isPartId(value: unknown): value is PartId {
  return typeof value === "string" && PART_IDS.has(value as PartId);
}

function meshPartId(mesh: THREE.Mesh): PartId | null {
  const extraPart = mesh.userData.partId;
  if (isPartId(extraPart)) return extraPart;
  const namePart = mesh.name.split(".")[0];
  return isPartId(namePart) ? namePart : null;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshBasicMaterial
      )
        material.map?.dispose();
      material.dispose();
    }
  });
}

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export class StudioScene implements StudioViewportApi {
  readonly #canvas: HTMLCanvasElement;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  readonly #controls: OrbitControls;
  readonly #loader = new GLTFLoader();
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointer = new THREE.Vector2();
  readonly #callbacks: SceneCallbacks;
  readonly #resizeObserver: ResizeObserver;
  readonly #selectableMeshes: THREE.Mesh[] = [];
  readonly #partMeshes = new Map<PartId, THREE.Mesh[]>();
  readonly #textureCache = new Map<string, Promise<THREE.Texture>>();
  #mannequin: THREE.Object3D | null = null;
  #garment: THREE.Object3D | null = null;
  #garmentId: string | null = null;
  #loadingGarmentId: string | null = null;
  #document: DesignDocument | null = null;
  #selectedPartId: PartId | null = null;
  #loadGeneration = 0;
  #disposed = false;
  #frame = 0;
  #pointerStart: { x: number; y: number } | null = null;
  #reducedMotion = false;
  #ready = false;

  constructor(canvas: HTMLCanvasElement, callbacks: SceneCallbacks) {
    this.#canvas = canvas;
    this.#callbacks = callbacks;
    this.#renderer = createRenderer(canvas);
    this.#camera.position.set(...CAMERA_VIEWS.front);
    this.#controls = new OrbitControls(this.#camera, canvas);
    this.#controls.target.copy(CAMERA_TARGET);
    this.#controls.enableDamping = true;
    this.#controls.dampingFactor = 0.07;
    this.#controls.minDistance = 1.15;
    this.#controls.maxDistance = 6;
    this.#controls.maxPolarAngle = Math.PI * 0.86;
    this.#controls.addEventListener("change", this.#requestRender);

    this.#configureEnvironment();
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener("pointerdown", this.#onPointerDown);
    canvas.addEventListener("pointerup", this.#onPointerUp);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#reducedMotion = media.matches;
    media.addEventListener("change", this.#onMotionPreference);
    this.#motionMedia = media;
    this.#resize();
    this.#renderLoop();
  }

  #motionMedia: MediaQueryList;

  async updateDocument(document: DesignDocument): Promise<void> {
    this.#ready = false;
    this.#document = document;
    if (
      this.#garmentId !== document.garmentId ||
      this.#loadingGarmentId !== null
    ) {
      await this.#loadAssets(document);
      return;
    }
    try {
      await this.#applyAssignments(document);
      this.#callbacks.onError(null);
    } catch (error) {
      if (this.#disposed || this.#document !== document) return;
      this.#ready = false;
      this.#callbacks.onError(
        error instanceof Error
          ? error.message
          : "The textile could not be loaded.",
      );
    }
  }

  get ready(): boolean {
    return this.#ready;
  }

  setSelectedPart(partId: PartId | null): void {
    this.#selectedPartId = partId;
    this.#applySelection();
    this.#requestRender();
  }

  setDark(dark: boolean): void {
    this.#scene.fog = new THREE.FogExp2(dark ? 0x101218 : 0xf4efe8, 0.055);
    this.#requestRender();
  }

  capture(): string {
    if (!this.#ready) throw new Error("The studio assets are still loading.");
    const selected = this.#selectedPartId;
    this.#selectedPartId = null;
    this.#applySelection();
    this.#renderer.render(this.#scene, this.#camera);
    const image = this.#canvas.toDataURL("image/png");
    this.#selectedPartId = selected;
    this.#applySelection();
    requestAnimationFrame(() => {
      if (!this.#disposed) this.#renderer.render(this.#scene, this.#camera);
    });
    return image;
  }

  view(preset: ViewPreset): void {
    const damping = this.#controls.enableDamping;
    this.#controls.enableDamping = false;
    this.#camera.position.set(...CAMERA_VIEWS[preset]);
    this.#controls.target.copy(
      preset === "detail" ? new THREE.Vector3(0, 1.3, 0) : CAMERA_TARGET,
    );
    this.#controls.update();
    this.#controls.enableDamping = damping;
    this.#requestRender();
  }

  zoom(delta: number): void {
    const direction = this.#camera.position
      .clone()
      .sub(this.#controls.target)
      .normalize();
    const distance = THREE.MathUtils.clamp(
      this.#camera.position.distanceTo(this.#controls.target) - delta,
      this.#controls.minDistance,
      this.#controls.maxDistance,
    );
    this.#camera.position
      .copy(this.#controls.target)
      .addScaledVector(direction, distance);
    this.#controls.update();
  }

  reset(): void {
    if (!this.#garment) {
      this.view("front");
      return;
    }
    const bounds = new THREE.Box3().setFromObject(this.#garment);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.#camera.fov / 2));
    const distance =
      Math.max(
        size.y / (2 * tangent),
        size.x / (2 * tangent * this.#camera.aspect),
      ) * 1.4;
    const damping = this.#controls.enableDamping;
    this.#controls.enableDamping = false;
    this.#controls.target.copy(center);
    this.#camera.position.set(
      center.x,
      center.y + 0.02,
      center.z + Math.max(1.2, distance),
    );
    this.#controls.update();
    this.#controls.enableDamping = damping;
    this.#requestRender();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#loadGeneration += 1;
    cancelAnimationFrame(this.#frame);
    this.#resizeObserver.disconnect();
    this.#motionMedia.removeEventListener("change", this.#onMotionPreference);
    this.#canvas.removeEventListener("pointerdown", this.#onPointerDown);
    this.#canvas.removeEventListener("pointerup", this.#onPointerUp);
    this.#controls.removeEventListener("change", this.#requestRender);
    this.#controls.dispose();
    this.#scene.environment?.dispose();
    for (const pending of this.#textureCache.values())
      void pending.then((texture) => texture.dispose()).catch(() => {});
    this.#textureCache.clear();
    if (this.#mannequin) disposeObject(this.#mannequin);
    if (this.#garment) disposeObject(this.#garment);
    for (const child of this.#scene.children) {
      if (child instanceof THREE.Mesh) disposeObject(child);
    }
    this.#renderer.dispose();
  }

  #configureEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.#renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    this.#scene.environment = environment;
    this.#scene.environmentIntensity = 0.6;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xfff3df, 1.5);
    key.position.set(2.7, 4.2, 3.2);
    key.castShadow = false;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 12;
    this.#scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfd9ff, 0.7);
    fill.position.set(-3, 2.6, 2);
    this.#scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd8b1, 1.1);
    rim.position.set(0, 3, -3);
    this.#scene.add(rim);

    const shadowCanvas = window.document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const context = shadowCanvas.getContext("2d")!;
    const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
    gradient.addColorStop(0, "rgba(30,35,28,.3)");
    gradient.addColorStop(0.4, "rgba(30,35,28,.12)");
    gradient.addColorStop(1, "rgba(30,35,28,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.1),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    this.#scene.add(floor);
  }

  async #loadAssets(document: DesignDocument): Promise<void> {
    const generation = ++this.#loadGeneration;
    this.#loadingGarmentId = document.garmentId;
    this.#callbacks.onLoading(true);
    this.#callbacks.onError(null);
    const garment = getGarment(document.garmentId);
    try {
      const [mannequinGltf, garmentGltf] = await Promise.all([
        this.#loader.loadAsync("/assets/models/mannequin.glb"),
        this.#loader.loadAsync(garment.modelUrl),
      ]);
      if (this.#disposed || generation !== this.#loadGeneration) {
        disposeObject(mannequinGltf.scene);
        disposeObject(garmentGltf.scene);
        return;
      }
      if (this.#mannequin) {
        this.#scene.remove(this.#mannequin);
        disposeObject(this.#mannequin);
      }
      if (this.#garment) {
        this.#scene.remove(this.#garment);
        disposeObject(this.#garment);
      }
      this.#mannequin = mannequinGltf.scene;
      this.#garment = garmentGltf.scene;
      this.#garmentId = document.garmentId;
      this.#prepareModel(this.#mannequin, false);
      this.#prepareModel(this.#garment, true);
      this.#scene.add(this.#mannequin, this.#garment);
      await this.#applyAssignments(document, generation);
      if (!this.#disposed && generation === this.#loadGeneration) {
        this.#loadingGarmentId = null;
        this.#ready = true;
        this.#callbacks.onLoading(false);
      }
    } catch (error) {
      if (this.#disposed || generation !== this.#loadGeneration) return;
      this.#loadingGarmentId = null;
      this.#callbacks.onLoading(false);
      this.#ready = false;
      this.#callbacks.onError(
        error instanceof Error
          ? error.message
          : "The 3D assets could not be loaded.",
      );
    }
  }

  #prepareModel(root: THREE.Object3D, selectable: boolean): void {
    if (selectable) {
      this.#selectableMeshes.length = 0;
      this.#partMeshes.clear();
    }
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (!selectable || child.userData.fixedMaterial === true) return;
      const partId = meshPartId(child);
      if (!partId) return;
      child.userData.partId = partId;
      this.#selectableMeshes.push(child);
      const meshes = this.#partMeshes.get(partId) ?? [];
      meshes.push(child);
      this.#partMeshes.set(partId, meshes);
    });
  }

  async #applyAssignments(
    document: DesignDocument,
    generation = this.#loadGeneration,
  ): Promise<void> {
    const garment = getGarment(document.garmentId);
    const tasks = garment.parts.map(async (part) => {
      const assignment = document.parts[part.id];
      const material = getMaterial(
        assignment?.materialId ?? part.defaultMaterialId,
      );
      const texture = material.textureUrl
        ? await this.#loadTexture(material)
        : null;
      if (
        this.#disposed ||
        generation !== this.#loadGeneration ||
        this.#document !== document
      ) {
        texture?.dispose();
        return;
      }
      const placement = assignment?.placement ?? {
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      };
      if (texture) {
        texture.rotation = THREE.MathUtils.degToRad(placement.rotation);
        texture.offset.set(placement.offsetX, placement.offsetY);
      }
      for (const mesh of this.#partMeshes.get(part.id) ?? []) {
        const previous = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const item of previous) {
          if (item instanceof THREE.MeshStandardMaterial) item.map?.dispose();
          item.dispose();
        }
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: texture ? "#ffffff" : material.color,
          map: texture?.clone() ?? null,
          roughness: material.roughness,
          metalness: material.metalness,
          side: THREE.DoubleSide,
          clearcoat: 0.08,
          clearcoatRoughness: 0.55,
        });
        const map = (mesh.material as THREE.MeshPhysicalMaterial).map;
        if (map) map.needsUpdate = true;
      }
      texture?.dispose();
    });
    await Promise.all(tasks);
    if (
      !this.#disposed &&
      generation === this.#loadGeneration &&
      this.#document === document
    )
      this.#ready = true;
    this.#applySelection();
    this.#requestRender();
  }

  async #loadTexture(material: MaterialDefinition): Promise<THREE.Texture> {
    let pending = this.#textureCache.get(material.id);
    if (!pending) {
      pending = new THREE.TextureLoader()
        .loadAsync(material.textureUrl!)
        .then((texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(...material.repeat);
          texture.center.set(0.5, 0.5);
          texture.flipY = false;
          texture.anisotropy = Math.min(
            8,
            this.#renderer.capabilities.getMaxAnisotropy(),
          );
          return texture;
        })
        .catch((error) => {
          this.#textureCache.delete(material.id);
          throw error;
        });
      this.#textureCache.set(material.id, pending);
    }
    return (await pending).clone();
  }

  #applySelection(): void {
    for (const [partId, meshes] of this.#partMeshes) {
      for (const mesh of meshes) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          const selected = partId === this.#selectedPartId;
          material.emissive.set(selected ? 0xc69a4a : 0x000000);
          material.emissiveIntensity = selected ? 0.045 : 0;
        }
      }
    }
  }

  #resize = (): void => {
    const parent = this.#canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? this.#canvas.clientWidth);
    const height = Math.max(
      1,
      parent?.clientHeight ?? this.#canvas.clientHeight,
    );
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#requestRender();
  };

  #onPointerDown = (event: PointerEvent): void => {
    this.#pointerStart = { x: event.clientX, y: event.clientY };
  };

  #onPointerUp = (event: PointerEvent): void => {
    const start = this.#pointerStart;
    this.#pointerStart = null;
    if (
      !start ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
    )
      return;
    const rect = this.#canvas.getBoundingClientRect();
    this.#pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.#raycaster.setFromCamera(this.#pointer, this.#camera);
    const targets = [this.#mannequin, this.#garment].filter(
      (object): object is THREE.Object3D => object !== null,
    );
    const hit = this.#raycaster.intersectObjects(targets, true)[0]?.object;
    if (!(hit instanceof THREE.Mesh) || !this.#selectableMeshes.includes(hit))
      return;
    const partId = meshPartId(hit);
    if (partId) this.#callbacks.onSelectPart(partId);
  };

  #onMotionPreference = (event: MediaQueryListEvent): void => {
    this.#reducedMotion = event.matches;
  };

  #requestRender = (): void => {
    if (!this.#disposed && this.#reducedMotion)
      this.#renderer.render(this.#scene, this.#camera);
  };

  #renderLoop = (): void => {
    if (this.#disposed) return;
    if (!this.#reducedMotion) {
      this.#controls.update();
      this.#renderer.render(this.#scene, this.#camera);
    }
    this.#frame = requestAnimationFrame(this.#renderLoop);
  };
}
