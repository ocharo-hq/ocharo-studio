import { loadVerifiedModel } from "../modelAssets";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { DEFAULT_PLACEMENT } from "../../../domain/studio/document";
import { materialTransform } from "../../../domain/studio/placement";
import { findSurfaceAnchor, mapSurfaceCoordinates } from "./SurfaceCoordinates";
import {
  createFabricMaterial,
  dressHolderCloth,
  placeFabric,
} from "./FabricShading";
import { disposeObject, fitMannequin, meshPartId } from "./SceneObjects";
import {
  classifyWheelGesture,
  interpolateCameraPose,
  type CameraPose,
} from "./CameraMotion";
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
  onSelectPart: (id: PartId, additive?: boolean) => void;
  onPlaceAnchor?: (x: number, y: number) => void;
  onPlacementStart?: () => void;
  onPlacementEnd?: () => void;
}

// Frames the silhouette (floor to its neck cap at 1.51 m) with a little room above and below.
const CAMERA_TARGET = new THREE.Vector3(0, 0.76, 0);
const CAMERA_VIEWS: Record<ViewPreset, readonly [number, number, number]> = {
  front: [0, 0.86, 3.3],
  back: [0, 0.86, -3.3],
  side: [3.3, 0.86, 0],
  detail: [0.7, 1.35, 1.65],
};
const CAMERA_ANIMATION_MS = 420;

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export class StudioScene implements StudioViewportApi {
  readonly #canvas: HTMLCanvasElement;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #composer: EffectComposer;
  readonly #outline: OutlinePass;
  readonly #orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xe7b44c, toneMapped: false }),
  );
  readonly #selectionEdges = new THREE.Group();
  #selectionEdgeMeshes: readonly THREE.Mesh[] = [];
  #placementMode = false;
  #draggingAnchor = false;
  #dirty = true;
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
  #selectedPartIds: readonly PartId[] = [];
  #loadGeneration = 0;
  #disposed = false;
  #frame = 0;
  #cameraAnimation: {
    startedAt: number;
    from: CameraPose;
    to: CameraPose;
  } | null = null;
  #pointerStart: { x: number; y: number } | null = null;
  #reducedMotion = false;
  #ready = false;
  #hasFramed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: SceneCallbacks) {
    this.#canvas = canvas;
    this.#callbacks = callbacks;
    this.#renderer = createRenderer(canvas);
    // Multisampled so garment edges stay smooth through the outline and output passes.
    this.#composer = new EffectComposer(
      this.#renderer,
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        // Phones already render at a reduced pixel ratio; fewer samples keep them responsive.
        samples: window.innerWidth < 700 ? 2 : 4,
      }),
    );
    this.#composer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#outline = new OutlinePass(
      new THREE.Vector2(1, 1),
      this.#scene,
      this.#camera,
    );
    this.#outline.visibleEdgeColor.set("#dca94e");
    this.#outline.hiddenEdgeColor.set("#786141");
    this.#outline.edgeStrength = 5;
    this.#outline.edgeGlow = 0.7;
    this.#outline.edgeThickness = 2;
    this.#composer.addPass(this.#outline);
    this.#composer.addPass(new OutputPass());
    this.#orb.visible = false;
    this.#orb.renderOrder = 5;
    this.#selectionEdges.name = "selection-boundaries";
    this.#scene.add(this.#orb, this.#selectionEdges);
    this.#camera.position.set(...CAMERA_VIEWS.front);
    this.#controls = new OrbitControls(this.#camera, canvas);
    this.#controls.target.copy(CAMERA_TARGET);
    this.#controls.enableDamping = true;
    this.#controls.dampingFactor = 0.07;
    this.#controls.minDistance = 1.15;
    this.#controls.maxDistance = 6;
    this.#controls.maxPolarAngle = Math.PI * 0.86;
    this.#controls.enableZoom = false;
    this.#controls.addEventListener("change", this.#requestRender);
    this.#controls.addEventListener("start", this.#cancelCameraAnimation);

    this.#configureEnvironment();
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener("pointerdown", this.#onPointerDown);
    canvas.addEventListener("pointermove", this.#onPointerMove);
    canvas.addEventListener("pointercancel", this.#onPointerCancel);
    canvas.addEventListener("pointerup", this.#onPointerUp);
    canvas.addEventListener("wheel", this.#onWheel, { passive: false });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#reducedMotion = media.matches;
    this.#controls.enableDamping = !this.#reducedMotion;
    media.addEventListener("change", this.#onMotionPreference);
    this.#motionMedia = media;
    this.#resize();
    this.#requestRender();
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
    this.setSelectedParts(partId ? [partId] : []);
  }

  setSelectedParts(partIds: readonly PartId[]): void {
    this.#selectedPartIds = [...new Set(partIds)];
    this.#applySelection();
    this.#requestRender();
  }

  setPlacementMode(enabled: boolean): void {
    this.#placementMode = enabled;
    this.#controls.enabled = !enabled;
    this.#canvas.style.cursor = enabled ? "crosshair" : "grab";
    this.#updateAnchor();
    this.#requestRender();
  }

  setDark(dark: boolean): void {
    this.#scene.fog = new THREE.FogExp2(dark ? 0x101218 : 0xf4efe8, 0.055);
    this.#requestRender();
  }

  capture(): string {
    if (!this.#ready) throw new Error("The studio assets are still loading.");
    const selected = this.#selectedPartIds;
    this.#selectedPartIds = [];
    this.#applySelection();
    this.#orb.visible = false;
    this.#composer.render();
    const image = this.#canvas.toDataURL("image/png");
    this.#selectedPartIds = selected;
    this.#applySelection();
    requestAnimationFrame(() => {
      if (!this.#disposed) {
        this.#updateAnchor();
        this.#requestRender();
      }
    });
    return image;
  }

  view(preset: ViewPreset): void {
    this.#animateCamera({
      position: new THREE.Vector3(...CAMERA_VIEWS[preset]),
      target:
        preset === "detail"
          ? new THREE.Vector3(0, 1.3, 0)
          : CAMERA_TARGET.clone(),
    });
  }

  zoom(delta: number): void {
    this.#cancelCameraAnimation();
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
    this.#requestRender();
  }

  reset(): void {
    this.view("front");
  }

  #animateCamera(to: CameraPose): void {
    this.#cancelCameraAnimation();
    const from = {
      position: this.#camera.position.clone(),
      target: this.#controls.target.clone(),
    };
    if (this.#reducedMotion) {
      this.#applyCameraPose(to);
      return;
    }
    this.#cameraAnimation = { startedAt: performance.now(), from, to };
    this.#requestRender();
  }

  #applyCameraPose(pose: CameraPose): void {
    const damping = this.#controls.enableDamping;
    this.#controls.enableDamping = false;
    this.#camera.position.copy(pose.position);
    this.#controls.target.copy(pose.target);
    this.#controls.update();
    this.#controls.enableDamping = damping;
    this.#requestRender();
  }

  #cancelCameraAnimation = (): void => {
    this.#cameraAnimation = null;
  };

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#loadGeneration += 1;
    this.#cancelCameraAnimation();
    cancelAnimationFrame(this.#frame);
    this.#resizeObserver.disconnect();
    this.#motionMedia.removeEventListener("change", this.#onMotionPreference);
    this.#canvas.removeEventListener("pointerdown", this.#onPointerDown);
    this.#canvas.removeEventListener("pointermove", this.#onPointerMove);
    this.#canvas.removeEventListener("pointercancel", this.#onPointerCancel);
    this.#canvas.removeEventListener("pointerup", this.#onPointerUp);
    this.#canvas.removeEventListener("wheel", this.#onWheel);
    this.#controls.removeEventListener("change", this.#requestRender);
    this.#controls.removeEventListener("start", this.#cancelCameraAnimation);
    this.#controls.dispose();
    this.#clearSelectionEdges();
    this.#scene.environment?.dispose();
    for (const pending of this.#textureCache.values())
      void pending.then((texture) => texture.dispose()).catch(() => {});
    this.#textureCache.clear();
    for (const child of this.#scene.children) disposeObject(child);
    for (const pass of this.#composer.passes) pass.dispose();
    this.#composer.dispose();
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
    key.position.set(2.2, 5.6, 3);
    key.target.position.set(0, 0.8, 0);
    // Soft shadows give garments depth: hems, collars and arms settle onto the form.
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 11;
    Object.assign(key.shadow.camera, {
      left: -1.1,
      right: 1.1,
      top: 1.3,
      bottom: -1.3,
    });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.radius = 7;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.#scene.add(key, key.target);
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
        // A transparent shadow carries coverage only; coloured fog would amplify low-alpha RGB in PNGs.
        color: 0x000000,
        fog: false,
        transparent: true,
        depthWrite: false,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    const catcher = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.ShadowMaterial({ opacity: 0.1, depthWrite: false, fog: false }),
    );
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.001;
    catcher.receiveShadow = true;
    this.#scene.add(floor, catcher);
  }

  async #loadAssets(document: DesignDocument): Promise<void> {
    const generation = ++this.#loadGeneration;
    this.#loadingGarmentId = document.garmentId;
    this.#callbacks.onLoading(true);
    this.#callbacks.onError(null);
    const garment = getGarment(document.garmentId);
    try {
      const loaded = await Promise.allSettled([
        loadVerifiedModel(this.#loader, "/assets/models/mannequin.glb"),
        loadVerifiedModel(this.#loader, garment.modelUrl),
      ]);
      if (loaded.some((result) => result.status === "rejected")) {
        for (const result of loaded)
          if (result.status === "fulfilled") disposeObject(result.value.scene);
        const rejected = loaded.find((result) => result.status === "rejected");
        throw rejected?.status === "rejected"
          ? rejected.reason
          : new Error("The model could not be loaded.");
      }
      const mannequinGltf = (
        loaded[0] as PromiseFulfilledResult<
          Awaited<ReturnType<GLTFLoader["loadAsync"]>>
        >
      ).value;
      const garmentGltf = (
        loaded[1] as PromiseFulfilledResult<
          Awaited<ReturnType<GLTFLoader["loadAsync"]>>
        >
      ).value;
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
      fitMannequin(
        this.#mannequin,
        garment.parts.map((part) => part.id),
      );
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
        if (!this.#hasFramed) {
          this.#hasFramed = true;
          this.#applyCameraPose({
            position: new THREE.Vector3(...CAMERA_VIEWS.front),
            target: CAMERA_TARGET.clone(),
          });
        }
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
      this.#clearSelectionEdges();
      this.#selectableMeshes.length = 0;
      this.#partMeshes.clear();
    }
    const textureAnisotropy = Math.min(
      8,
      this.#renderer.capabilities.getMaxAnisotropy(),
    );
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (!selectable) dressHolderCloth(child, textureAnisotropy);
      if (!selectable || child.userData.fixedMaterial === true) return;
      const partId = meshPartId(child);
      if (!partId) return;
      mapSurfaceCoordinates(child);
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
      const meshes = this.#partMeshes.get(part.id) ?? [];
      const changed = meshes.some(
        (mesh) => mesh.userData.materialId !== material.id,
      );
      const texture =
        changed && material.textureUrl
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
      const placement = assignment?.placement ?? DEFAULT_PLACEMENT;
      const transform = materialTransform(placement, [
        material.repeat[0],
        material.repeat[1] * 2.075,
      ]);
      for (const mesh of meshes) {
        if (mesh.userData.materialId !== material.id) {
          const previous = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const item of previous) {
            if (item instanceof THREE.MeshStandardMaterial) {
              item.map?.dispose();
              item.normalMap?.dispose();
            }
            item.dispose();
          }
          mesh.material = createFabricMaterial(
            material,
            texture?.clone() ?? null,
            Math.min(8, this.#renderer.capabilities.getMaxAnisotropy()),
          );
          mesh.userData.materialId = material.id;
        }
        placeFabric(
          mesh.material as THREE.MeshPhysicalMaterial,
          material.kind,
          transform,
          placement.rotation,
        );
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
    this.#updateAnchor();
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
    const selected = this.#selectedPartIds.flatMap(
      (partId) => this.#partMeshes.get(partId) ?? [],
    );
    this.#outline.selectedObjects = selected;
    this.#outline.enabled = this.#outline.selectedObjects.length > 0;
    const boundariesChanged =
      selected.length !== this.#selectionEdgeMeshes.length ||
      selected.some((mesh, index) => mesh !== this.#selectionEdgeMeshes[index]);
    if (!boundariesChanged) {
      this.#updateAnchor();
      return;
    }
    this.#clearSelectionEdges();
    for (const mesh of selected) {
      const geometry = new THREE.EdgesGeometry(mesh.geometry, 32);
      if (geometry.getAttribute("position").count === 0) {
        geometry.dispose();
        continue;
      }
      const boundary = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0xf0ad38,
          depthTest: true,
          depthWrite: false,
          toneMapped: false,
          transparent: true,
          opacity: 0.96,
        }),
      );
      mesh.updateWorldMatrix(true, false);
      boundary.name = `selection.${mesh.name}`;
      boundary.matrix.copy(mesh.matrixWorld);
      boundary.matrixAutoUpdate = false;
      boundary.renderOrder = 8;
      this.#selectionEdges.add(boundary);
    }
    this.#selectionEdgeMeshes = [...selected];
    this.#updateAnchor();
  }

  #clearSelectionEdges(): void {
    this.#selectionEdgeMeshes = [];
    for (const child of [...this.#selectionEdges.children]) {
      this.#selectionEdges.remove(child);
      if (!(child instanceof THREE.LineSegments)) continue;
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) material.dispose();
    }
  }

  #updateAnchor(): void {
    this.#orb.visible = false;
    const selectedPartId =
      this.#selectedPartIds.length === 1 ? this.#selectedPartIds[0] : null;
    if (!this.#placementMode || !selectedPartId || !this.#document) return;
    const placement =
      this.#document.parts[selectedPartId]?.placement ?? DEFAULT_PLACEMENT;
    const point = findSurfaceAnchor(
      this.#partMeshes.get(selectedPartId) ?? [],
      placement.garmentAnchorX,
      placement.garmentAnchorY,
    );
    if (!point) return;
    // The centre of an open garment may be empty; its origin still remains on the front centreline.
    if (placement.garmentAnchorX === 0.5 && placement.garmentAnchorY === 0.5) {
      point.x = 0;
      point.y = 1.17;
    }
    const outward = new THREE.Vector3(point.x, 0, point.z)
      .normalize()
      .multiplyScalar(0.013);
    this.#orb.position.copy(point).add(outward);
    this.#orb.visible = true;
  }

  #resize = (): void => {
    const parent = this.#canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? this.#canvas.clientWidth);
    const height = Math.max(
      1,
      parent?.clientHeight ?? this.#canvas.clientHeight,
    );
    const ratio = Math.min(
      window.devicePixelRatio,
      window.innerWidth < 700 ? 1.5 : 2,
    );
    this.#renderer.setPixelRatio(ratio);
    this.#composer.setPixelRatio(ratio);
    this.#renderer.setSize(width, height, false);
    this.#composer.setSize(width, height);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#requestRender();
  };

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.#cancelCameraAnimation();
    this.#pointerStart = { x: event.clientX, y: event.clientY };
    if (this.#placementMode) {
      this.#draggingAnchor = true;
      this.#canvas.setPointerCapture(event.pointerId);
      this.#callbacks.onPlacementStart?.();
      this.#placeAnchor(event);
    }
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (this.#draggingAnchor) this.#placeAnchor(event);
  };

  #onPointerCancel = (): void => {
    if (this.#draggingAnchor) this.#callbacks.onPlacementEnd?.();
    this.#draggingAnchor = false;
    this.#pointerStart = null;
  };

  #hit(event: PointerEvent): THREE.Intersection | undefined {
    const rect = this.#canvas.getBoundingClientRect();
    this.#pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.#raycaster.setFromCamera(this.#pointer, this.#camera);
    const targets = [this.#mannequin, this.#garment].filter(
      (object): object is THREE.Object3D => object !== null,
    );
    return this.#raycaster.intersectObjects(targets, true)[0];
  }

  #placeAnchor(event: PointerEvent): void {
    const hit = this.#hit(event);
    if (
      !hit ||
      !(hit.object instanceof THREE.Mesh) ||
      meshPartId(hit.object) !==
        (this.#selectedPartIds.length === 1
          ? this.#selectedPartIds[0]
          : null) ||
      !hit.uv
    )
      return;
    const x = ((hit.uv.x % 1) + 1) % 1;
    this.#callbacks.onPlaceAnchor?.(x, THREE.MathUtils.clamp(hit.uv.y, 0, 1));
  }

  #onPointerUp = (event: PointerEvent): void => {
    if (this.#draggingAnchor) {
      this.#placeAnchor(event);
      this.#onPointerCancel();
      if (this.#canvas.hasPointerCapture(event.pointerId))
        this.#canvas.releasePointerCapture(event.pointerId);
      return;
    }
    const start = this.#pointerStart;
    this.#pointerStart = null;
    if (
      !start ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
    )
      return;
    const hit = this.#hit(event)?.object;
    if (!(hit instanceof THREE.Mesh) || !this.#selectableMeshes.includes(hit))
      return;
    const partId = meshPartId(hit);
    if (partId)
      this.#callbacks.onSelectPart(
        partId,
        event.shiftKey || event.metaKey || event.ctrlKey,
      );
  };

  #onWheel = (event: WheelEvent): void => {
    if (this.#placementMode) return;
    event.preventDefault();
    this.#cancelCameraAnimation();
    const gesture = classifyWheelGesture(event);
    if (gesture.kind === "zoom") {
      this.zoom(gesture.amount);
      return;
    }
    const offset = this.#camera.position.clone().sub(this.#controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= gesture.x * 0.003;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + gesture.y * 0.003,
      0.08,
      this.#controls.maxPolarAngle,
    );
    this.#camera.position
      .copy(this.#controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    this.#controls.update();
    this.#requestRender();
  };

  #onMotionPreference = (event: MediaQueryListEvent): void => {
    this.#reducedMotion = event.matches;
    this.#controls.enableDamping = !event.matches;
    if (event.matches && this.#cameraAnimation) {
      const target = this.#cameraAnimation.to;
      this.#cancelCameraAnimation();
      this.#applyCameraPose(target);
    }
    this.#requestRender();
  };

  #requestRender = (): void => {
    this.#dirty = true;
    if (this.#frame === 0)
      this.#frame = requestAnimationFrame(this.#renderFrame);
  };

  #renderFrame = (now: number): void => {
    this.#frame = 0;
    if (this.#disposed) return;
    if (this.#cameraAnimation) {
      const elapsed = now - this.#cameraAnimation.startedAt;
      const progress = THREE.MathUtils.clamp(
        elapsed / CAMERA_ANIMATION_MS,
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      this.#applyCameraPose(
        interpolateCameraPose(
          this.#cameraAnimation.from,
          this.#cameraAnimation.to,
          eased,
        ),
      );
      if (progress >= 1) this.#cameraAnimation = null;
    }
    this.#controls.update();
    if (this.#dirty) {
      this.#dirty = false;
      this.#composer.render();
    }
    if (this.#cameraAnimation) this.#requestRender();
  };
}
