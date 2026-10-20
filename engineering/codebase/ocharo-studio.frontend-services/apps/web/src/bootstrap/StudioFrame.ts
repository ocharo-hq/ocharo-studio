import {
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from "vue";

/** The element in the frame's top bar the open place teleports its own controls into. */
export const StudioFrameBarId = "studio-frame-bar";

/** How the account menu is about to change the session. */
export type StudioSessionChange = "reconnect" | "sign-out";

/**
 * What the open Studio place lends the frame: its settings, its notices, and whether unsaved or in-flight work holds
 * the account session where it is.
 */
export interface StudioPlaceControls {
  /** Opens Studio settings: the Desk connection, sync recovery and the guide. */
  readonly openSettings: () => void;
  /**
   * The notice owed while unsaved or in-flight work must finish before the account session changes — a reconnect
   * leaves the page, a sign-out ends sync — or `null` when it may change now.
   */
  readonly holdSession: (change: StudioSessionChange) => string | null;
  /** Shows one short message in the place's notification area. */
  readonly notify: (message: string) => void;
}

/** @internal The registration slot the frame provides. */
const StudioFrameKey: InjectionKey<ShallowRef<StudioPlaceControls | null>> =
  Symbol("StudioFrame");

/** Opens the slot the place below registers its controls in; the frame reads it. */
export function provideStudioFrame(): ShallowRef<StudioPlaceControls | null> {
  const place = shallowRef<StudioPlaceControls | null>(null);
  provide(StudioFrameKey, place);
  return place;
}

/** Lends the frame this place's controls until the place unmounts; outside a frame it does nothing. */
export function useStudioFrame(controls: StudioPlaceControls): void {
  const place = inject(StudioFrameKey, null);
  if (!place) return;
  place.value = controls;
  onScopeDispose(() => {
    if (place.value === controls) place.value = null;
  });
}
