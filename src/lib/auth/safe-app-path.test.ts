import { describe, expect, it } from "vitest";
import { safeAppInternalPath } from "./safe-app-path";

describe("safeAppInternalPath", () => {
  it("returns null for null, empty, or non-path values", () => {
    expect(safeAppInternalPath(null)).toBeNull();
    expect(safeAppInternalPath(undefined)).toBeNull();
    expect(safeAppInternalPath("")).toBeNull();
    expect(safeAppInternalPath("   ")).toBeNull();
    expect(safeAppInternalPath("https://evil.com")).toBeNull();
    expect(safeAppInternalPath("//evil.com")).toBeNull();
  });

  it("allows same-origin style relative paths", () => {
    expect(safeAppInternalPath("/orat")).toBe("/orat");
    expect(safeAppInternalPath("/invite/abc")).toBe("/invite/abc");
    expect(safeAppInternalPath(" /foo/bar ")).toBe("/foo/bar");
  });

  it("rejects null bytes", () => {
    expect(safeAppInternalPath("/orat\0")).toBeNull();
  });
});
