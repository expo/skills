import { afterEach, expect, spyOn, test } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let fixture: string;
let fetchSpy: ReturnType<typeof spyOn>;

afterEach(() => {
  fetchSpy?.mockRestore();
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});

async function loadFetcher() {
  fixture = mkdtempSync(join(tmpdir(), "expo-workflow-fetch-"));
  const script = join(fixture, "fetch.mjs");
  copyFileSync(
    join(import.meta.dir, "../plugins/expo/skills/eas-workflows/scripts/fetch.js"),
    script,
  );
  return (await import(pathToFileURL(script).href)).fetchCached;
}

for (const cacheControl of ["no-cache", "public, max-age=3600, No-Cache"]) {
  test(`revalidates ${cacheControl} after both 200 and 304 responses`, async () => {
    const fetchCached = await loadFetcher();
    fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("old schema", {
        headers: { "cache-control": cacheControl, etag: '"v1"' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response("new schema", {
        headers: { "cache-control": "max-age=3600", etag: '"v2"' },
      }));

    expect(await fetchCached("https://example.test/schema")).toBe("old schema");
    expect(await fetchCached("https://example.test/schema")).toBe("old schema");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][1].headers["If-None-Match"]).toBe('"v1"');
    expect(await fetchCached("https://example.test/schema")).toBe("new schema");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(await fetchCached("https://example.test/schema")).toBe("new schema");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
}

test("reuses fresh max-age responses without another request", async () => {
  const fetchCached = await loadFetcher();
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("schema", {
    headers: { "cache-control": "max-age=3600" },
  }));
  expect(await fetchCached("https://example.test/schema")).toBe("schema");
  expect(await fetchCached("https://example.test/schema")).toBe("schema");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});
