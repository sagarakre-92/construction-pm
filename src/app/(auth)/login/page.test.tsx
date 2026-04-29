import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSearchParams = vi.fn();

vi.mock("next/navigation", async () => {
  const actual =
    await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useSearchParams: () => mockSearchParams(),
  };
});

import LoginPage from "./page";

function paramsFrom(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("LoginPage", () => {
  afterEach(() => {
    mockSearchParams.mockReset();
  });

  it("renders login form with email and password", () => {
    mockSearchParams.mockReturnValue(paramsFrom(""));
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("has link to sign up", () => {
    mockSearchParams.mockReturnValue(paramsFrom(""));
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("has link to forgot-password page", () => {
    mockSearchParams.mockReturnValue(paramsFrom(""));
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("annotates inputs for password managers", () => {
    mockSearchParams.mockReturnValue(paramsFrom(""));
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("autoComplete", "email");
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      "autoComplete",
      "current-password",
    );
  });

  it("shows the password-updated banner when ?reset=1", async () => {
    mockSearchParams.mockReturnValue(paramsFrom("reset=1"));
    render(<LoginPage />);
    expect(
      await screen.findByText(/password updated\. please log in\./i),
    ).toBeInTheDocument();
  });

  it("shows the email-verified banner when ?verified=1", async () => {
    mockSearchParams.mockReturnValue(paramsFrom("verified=1"));
    render(<LoginPage />);
    expect(
      await screen.findByText(/email verified\. you can now log in\./i),
    ).toBeInTheDocument();
  });
});
