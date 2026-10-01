import { computed, ref, watch } from "vue";
import {
  GARMENTS,
  getGarment,
  getMaterial,
  isMaterialApplicable,
} from "../../domain/studio/catalog";
import {
  cloneDocument,
  createDesignDocument,
} from "../../domain/studio/document";
import type {
  DesignDocument,
  MaterialScaleLibrary,
  SavedLook,
} from "../../domain/studio/types";

interface MaterialEditorOptions {
  selectedId: string;
  document: DesignDocument;
  looks: readonly SavedLook[];
  library: MaterialScaleLibrary;
}

/** Keeps uncommitted material previews separate from the shared library and saved designs. */
export function useMaterialEditor(options: () => MaterialEditorOptions) {
  const material = computed(() => getMaterial(options().selectedId));
  const uses = computed(() => {
    const { document, looks, selectedId } = options();
    return [
      { document, label: `${document.name} · Current design` },
      ...looks.map((look) => ({
        document: look.document,
        label: `${look.document.name} · Saved look`,
      })),
    ]
      .map((use) => ({
        ...use,
        parts: Object.entries(use.document.parts).filter(
          ([, assignment]) => assignment?.materialId === selectedId,
        ),
      }))
      .filter((use) => use.parts.length > 0);
  });
  const storedScale = computed(
    () =>
      options().library[options().selectedId]?.scale ??
      uses.value[0]?.parts[0]?.[1]?.placement.scale ??
      1,
  );
  const scale = ref(storedScale.value);
  const baseline = ref(storedScale.value);
  const revision = ref(options().library[options().selectedId]?.revision ?? 0);
  const changed = computed(() => scale.value !== baseline.value);
  const varied = computed(
    () =>
      new Set(
        uses.value.flatMap((use) =>
          use.parts.map(([, assignment]) => assignment!.placement.scale),
        ),
      ).size > 1,
  );
  const outdated = computed(
    () =>
      revision.value !==
      (options().library[options().selectedId]?.revision ?? 0),
  );
  const previewDocument = computed(() => {
    const { selectedId, document } = options();
    const hasMaterial = Object.values(document.parts).some(
      (part) => part?.materialId === selectedId,
    );
    const compatible = GARMENTS.find((garment) =>
      garment.parts.some((part) =>
        isMaterialApplicable(garment.id, part.id, selectedId),
      ),
    );
    const preview = hasMaterial
      ? cloneDocument(document)
      : createDesignDocument(
          compatible?.id ?? document.garmentId,
          document.createdAt,
        );
    for (const part of getGarment(preview.garmentId).parts) {
      const assignment = preview.parts[part.id]!;
      if (
        hasMaterial
          ? assignment.materialId === selectedId
          : isMaterialApplicable(preview.garmentId, part.id, selectedId)
      ) {
        assignment.materialId = selectedId;
        assignment.placement.scale = scale.value;
      }
    }
    return preview;
  });
  watch(() => options().selectedId, reset);
  watch(storedScale, () => {
    if (!changed.value) reset();
  });
  function reset() {
    baseline.value = storedScale.value;
    scale.value = storedScale.value;
    revision.value = options().library[options().selectedId]?.revision ?? 0;
  }
  function setScale(value: number) {
    if (Number.isFinite(value))
      scale.value = Math.min(4, Math.max(0.25, value));
  }
  return {
    material,
    uses,
    scale,
    changed,
    varied,
    outdated,
    previewDocument,
    reset,
    setScale,
  };
}
