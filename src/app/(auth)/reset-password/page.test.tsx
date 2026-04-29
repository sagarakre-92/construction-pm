import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ResetPasswordPage from "./page";

const getSession = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => getSession(),
      updateUser: (args: unknown) => updateUser(args),
      signOut: () => signOut(),
    },
  }),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    getSession.mockReset();
    updateUser.mockReset();
    signOut.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("renders both password fields and submit when session is valid", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
    });
    render(<ResetPasswordPage />);
    expect(
      await screen.findByLabelText(/^new password$/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/confirm new password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /update password/i }),
    ).toBeInTheDocument();
  });

  it("shows an invalid-link message when there is no recovery session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordPage />);
    expect(
      await screen.findByRole("heading", {
        name: /reset link is no longer valid/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a new reset link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("disables submit when passwords do not match", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
    });
    const user = userEvent.setup();
    render(<ResetPasswordPage />);
    const pw = await screen.findByLabelText(/^new password$/i);
    const confirm = screen.getByLabelText(/confirm new password/i);
    const submit = screen.getByRole("button", { name: /update password/i });

    await user.type(pw, "longenoughpw");
    await user.type(confirm, "differentpw");

    expect(submit).toBeDisabled();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("disables submit when password is shorter than 8 characters", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
    });
    const user = userEvent.setup();
    render(<ResetPasswordPage />);
    const pw = await screen.findByLabelText(/^new password$/i);
    const confirm = screen.getByLabelText(/confirm new password/i);
    const submit = screen.getByRole("button", { name: /update password/i });

    await user.type(pw, "short");
    await user.type(confirm, "short");

    expect(submit).toBeDisabled();
  });

  it("enables submit when both passwords match and meet length", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
    });
    const user = userEvent.setup();
    render(<ResetPasswordPage />);
    const pw = await screen.findByLabelText(/^new password$/i);
    const confirm = screen.getByLabelText(/confirm new password/i);

    await user.type(pw, "longenoughpw");
    await user.type(confirm, "longenoughpw");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /update password/i }),
      ).toBeEnabled();
    });
  });
});
