import { describe, expect, it } from "vitest";

import {
  shouldInvite,
  type OnboardingRecord,
} from "../src/application/onboarding/UseStudioOnboarding";

const NOW = Date.parse("2026-09-25T12:00:00.000Z");

function record(update: Partial<OnboardingRecord> = {}): OnboardingRecord {
  return { invitations: 0, hiddenPermanently: false, ...update };
}

describe("studio onboarding invitation policy", () => {
  it("invites a first-time visitor", () => {
    expect(shouldInvite(record(), NOW)).toBe(true);
  });

  it("waits twelve hours after the first skipped invitation", () => {
    const skipped = record({
      invitations: 1,
      lastInvitationAt: "2026-09-25T01:00:01.000Z",
    });
    expect(shouldInvite(skipped, NOW)).toBe(false);
    expect(
      shouldInvite(
        { ...skipped, lastInvitationAt: "2026-09-25T00:00:00.000Z" },
        NOW,
      ),
    ).toBe(true);
  });

  it("waits seven days after the first completed guide", () => {
    const completed = record({
      invitations: 1,
      lastInvitationAt: "2026-09-19T12:00:01.000Z",
      completedAt: "2026-09-19T12:05:00.000Z",
    });
    expect(shouldInvite(completed, NOW)).toBe(false);
    expect(
      shouldInvite(
        { ...completed, lastInvitationAt: "2026-09-18T12:00:00.000Z" },
        NOW,
      ),
    ).toBe(true);
  });

  it("never invites after two invitations or a permanent dismissal", () => {
    expect(shouldInvite(record({ invitations: 2 }), NOW)).toBe(false);
    expect(shouldInvite(record({ hiddenPermanently: true }), NOW)).toBe(false);
  });
});
