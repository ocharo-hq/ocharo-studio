import {
  useConfirmation,
  type ConfirmationController,
} from "@wow-two-beta/ui-vue/foundation/hooks";

/** The content shown by the studio confirmation modal. */
export interface StudioConfirmationRequest {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
}

/** The controlled state and actions for one confirmation modal host. */
export type StudioConfirmation =
  ConfirmationController<StudioConfirmationRequest>;

/** Owns an asynchronous confirmation request without invoking browser-native UI. */
export function useStudioConfirmation(): StudioConfirmation {
  return useConfirmation<StudioConfirmationRequest>();
}
