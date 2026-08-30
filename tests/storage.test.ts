import { describe, it, expect } from "vitest";
import { generateObjectKey } from "../lib/services/storage";

describe("generateObjectKey", () => {
  it("uses the covers prefix and a UUID by default", () => {
    const key = generateObjectKey();
    expect(key).toMatch(
      /^covers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("appends a sanitized extension", () => {
    const key = generateObjectKey({ extension: "JPEG" });
    expect(key).toMatch(/\.jpeg$/);
  });

  it("strips path characters from the extension", () => {
    const key = generateObjectKey({
      extension: "../../etc/passwd.jpg",
    });
    expect(key).not.toContain("..");
    expect(key).toMatch(
      /^covers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.etcpasswdjpg$/,
    );
  });

  it("ignores unsafe prefix characters", () => {
    const key = generateObjectKey({ prefix: "../secret" });
    expect(key.startsWith("secret/")).toBe(true);
  });
});
