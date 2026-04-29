import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ForgotPasswordPage from "./page";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmail(...args),
    },
  }),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("renders email field and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(
      screen.getByRole("heading", { name: /forgot your password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i }),
    ).toBeInTheDocument();
  });

  it("shows the same enumeration-safe success message after submit", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(
      await screen.findByText(
        /if an account exists for that email, a reset link has been sent\./i,
      ),
    ).toBeInTheDocument();
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("shows the same success message even if Supabase returns an error", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: "User not found" },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), "ghost@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(
      await screen.findByText(
        /if an account exists for that email, a reset link has been sent\./i,
      ),
    ).toBeInTheDocument();
  });

  it("links back to the login page", () => {
    render(<ForgotPasswordPage />);
    expect(
      screen.getByRole("link", { name: /back to log in/i }),
    ).toHaveAttribute("href", "/login");
  });
});
