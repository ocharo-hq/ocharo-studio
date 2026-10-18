import {
  computed,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import {
  isVisitInvitationDue,
  useVisitInvitation,
} from "@wow-two-beta/fe/foundation/hooks";

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_POLICY = {
  maxInvitations: 2,
  retryDelayMs: TWELVE_HOURS,
  completedRetryDelayMs: SEVEN_DAYS,
};

export interface OnboardingRecord {
  invitations: number;
  lastInvitationAt?: string;
  completedAt?: string;
  hiddenPermanently: boolean;
}

export interface StudioOnboardingControls {
  isOpen: boolean;
  isGuide: boolean;
  showLauncher: boolean;
  start(): void;
  skip(): void;
  complete(): void;
  openGuide(): void;
  close(): void;
}

export function shouldInvite(
  record: OnboardingRecord,
  now = Date.now(),
): boolean {
  return isVisitInvitationDue(record, INVITATION_POLICY, now);
}

interface StudioOnboardingOptions {
  value?: OnboardingRecord;
  onChange(record: OnboardingRecord): void;
  enabled?: boolean;
}

const EMPTY_RECORD: OnboardingRecord = {
  invitations: 0,
  hiddenPermanently: false,
};

/** Controls invitations and the manually reopened studio guide. */
export function useStudioOnboarding(
  options: MaybeRefOrGetter<StudioOnboardingOptions>,
): StudioOnboardingControls {
  const record = computed(() => toValue(options).value ?? EMPTY_RECORD);
  const enabled = computed(() => toValue(options).enabled ?? true);
  const isOpen = shallowRef(enabled.value && shouldInvite(record.value));
  const isGuide = shallowRef(false);
  const automatic = shallowRef(isOpen.value);
  const invitation = useVisitInvitation({
    record: () => record.value,
    policy: INVITATION_POLICY,
    onChange: (next) => toValue(options).onChange(next),
  });

  watch(
    enabled,
    (value) => {
      if (value) automatic.value = true;
    },
    { immediate: true },
  );
  watch([automatic, enabled, isOpen, record], () => {
    if (
      enabled.value &&
      automatic.value &&
      !isOpen.value &&
      shouldInvite(record.value)
    )
      isOpen.value = true;
  });

  function persist(next: OnboardingRecord): void {
    toValue(options).onChange(next);
  }

  function markInvitation(): OnboardingRecord {
    if (!automatic.value) return record.value;
    const next = invitation.recordInvitation();
    automatic.value = false;
    persist(next);
    return next;
  }

  function start(): void {
    const next = markInvitation();
    if (next.invitations >= 2) persist({ ...next, hiddenPermanently: true });
    isGuide.value = true;
  }

  function skip(): void {
    const next = markInvitation();
    if (next.invitations >= 2) persist({ ...next, hiddenPermanently: true });
    isOpen.value = false;
    isGuide.value = false;
  }

  function complete(): void {
    const next = markInvitation();
    persist({
      ...next,
      completedAt: new Date().toISOString(),
      hiddenPermanently: next.invitations >= 2,
    });
    isOpen.value = false;
    isGuide.value = false;
  }

  function openGuide(): void {
    automatic.value = false;
    isGuide.value = true;
    isOpen.value = true;
  }

  return {
    get isOpen() {
      return isOpen.value;
    },
    get isGuide() {
      return isGuide.value;
    },
    get showLauncher() {
      return (
        record.value.invitations === 1 &&
        !record.value.completedAt &&
        !record.value.hiddenPermanently
      );
    },
    start,
    skip,
    complete,
    openGuide,
    close: () => {
      isOpen.value = false;
      isGuide.value = false;
    },
  };
}
