import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.resolve(currentDir, "../../public/sw.js");

describe("service worker private API caching policy", () => {
  it("does not cache private authenticated API endpoints", () => {
    const swSource = fs.readFileSync(swPath, "utf8");

    expect(swSource.includes("/api/v1/feed")).toBe(false);
    expect(swSource.includes("/api/v1/orders")).toBe(false);
    expect(swSource.includes("cache.put(request")).toBe(true);
    expect(swSource.includes("TRAILFORGE_CLEAR_PRIVATE_CACHES")).toBe(true);
  });
});
