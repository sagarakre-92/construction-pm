import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("lowercases an uppercase address", () => {
    expect(normalizeEmail("Foo@Example.com")).toBe("foo@example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  bar@example.com  ")).toBe("bar@example.com");
  });

  it("combines trim and lowercase in one pass", () => {
    expect(normalizeEmail("  CAROL@example.com\n")).toBe("carol@example.com");
  });

  it("leaves an already-normalized address alone", () => {
    expect(normalizeEmail("baz@example.com")).toBe("baz@example.com");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeEmail("")).toBe("");
  });
});
