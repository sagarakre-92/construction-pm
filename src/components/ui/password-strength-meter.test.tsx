import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PasswordStrengthMeter,
  scorePassword,
} from "./password-strength-meter";

describe("scorePassword", () => {
  it("scores a short, lowercase-only password as Weak and missing length", () => {
    const result = scorePassword("abc");
    expect(result.label).toBe("Weak");
    expect(result.meetsPolicy).toBe(false);
    expect(result.missing).toContain("At least 8 characters");
  });

  it("scores an 8-char single-class password as Weak (does not meet policy)", () => {
    const result = scorePassword("password");
    expect(result.label).toBe("Weak");
    expect(result.meetsPolicy).toBe(false);
    expect(result.missing.join(" ")).toMatch(/at least 2 of/i);
  });

  it("scores an 8-char three-class password as Medium and meeting policy", () => {
    const result = scorePassword("Pass1234");
    expect(result.label).toBe("Medium");
    expect(result.meetsPolicy).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("scores a long, four-class password as Strong", () => {
    const result = scorePassword("Pa$$word123Strong");
    expect(result.label).toBe("Strong");
    expect(result.meetsPolicy).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(5);
  });
});

describe("PasswordStrengthMeter", () => {
  it("renders all rules even before any input (so users see the policy)", () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/lowercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/contains a number/i)).toBeInTheDocument();
    expect(screen.getByText(/contains a symbol/i)).toBeInTheDocument();
  });

  it("does not render a label badge before the user types", () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.queryByText("Weak")).not.toBeInTheDocument();
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
    expect(screen.queryByText("Strong")).not.toBeInTheDocument();
  });

  it("renders the strength label once the user has typed", () => {
    render(<PasswordStrengthMeter password="Pa$$word123Strong" />);
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });
});
