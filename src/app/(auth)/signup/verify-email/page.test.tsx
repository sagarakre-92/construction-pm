import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockResend = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resend: (...args: unknown[]) => mockResend(...args),
    },
  }),
}));

import VerifyEmailPage from "./page";

describe("VerifyEmailPage", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    mockResend.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
  });

  it("renders title and resend button", () => {
    render(<VerifyEmailPage />);
    expect(
      screen.getByRole("heading", { name: /please verify your email/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend verification email/i }),
    ).toBeInTheDocument();
  });

  it("shows a validation hint when resend is clicked with no email", async () => {
    render(<VerifyEmailPage />);
    const button = screen.getByRole("button", {
      name: /resend verification email/i,
    });
    fireEvent.click(button);
    expect(
      await screen.findByText(/please enter the email address/i),
    ).toBeInTheDocument();
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("links back to log in", () => {
    render(<VerifyEmailPage />);
    const link = screen.getByRole("link", { name: /back to log in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
