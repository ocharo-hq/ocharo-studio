/** Reads only public build metadata; this never transports a session or access ticket. */
export async function readBuildIdentity(signal: AbortSignal): Promise<string> {
  try {
    const response = await fetch("/api/system/version", {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) return "Unavailable";
    const data: unknown = await response.json();
    return typeof data === "object" &&
      data !== null &&
      "version" in data &&
      typeof data.version === "string"
      ? data.version
      : "Unavailable";
  } catch {
    return "Unavailable";
  }
}
