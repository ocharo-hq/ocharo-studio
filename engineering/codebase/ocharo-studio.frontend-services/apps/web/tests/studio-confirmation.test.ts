import { effectScope, nextTick, type EffectScope } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import { useStudioConfirmation } from "../src/presentation/studio/UseStudioConfirmation";

const scopes: EffectScope[] = [];

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
});

describe("studio confirmation", () => {
  it("resolves an accepted request and clears its content", async () => {
    const scope = effectScope();
    scopes.push(scope);
    const confirmation = scope.run(useStudioConfirmation)!;
    const result = confirmation.confirm({
      title: "Delete this look?",
      description: "The saved look will be removed from this studio.",
      confirmLabel: "Delete look",
    });
    expect(confirmation.request.value?.title).toBe("Delete this look?");
    confirmation.accept();
    await expect(result).resolves.toBe(true);
    expect(confirmation.request.value).toBeNull();
  });

  it("cancels superseded and disposed requests", async () => {
    const scope = effectScope();
    scopes.push(scope);
    const confirmation = scope.run(useStudioConfirmation)!;
    const superseded = confirmation.confirm({
      title: "First",
      description: "First request",
      confirmLabel: "Continue",
    });
    const active = confirmation.confirm({
      title: "Second",
      description: "Second request",
      confirmLabel: "Continue",
    });
    await expect(superseded).resolves.toBe(false);
    expect(confirmation.request.value?.title).toBe("Second");
    scope.stop();
    await nextTick();
    await expect(active).resolves.toBe(false);
  });
});
