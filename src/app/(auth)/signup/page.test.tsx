import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SignUpPage from "./page";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe("SignUpPage", () => {
  it("renders email, password, and confirm-password fields", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("shows the 8-character minimum hint up front", () => {
    const { container } = render(<SignUpPage />);
    const hint = container.querySelector("#password-hint");
    expect(hint).not.toBeNull();
    expect(hint).toHaveTextContent(/at least 8 characters/i);
  });

  it("annotates inputs for password managers", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute(
      "autoComplete",
      "email",
    );
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      "autoComplete",
      "new-password",
    );
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
      "autoComplete",
      "new-password",
    );
  });

  it("renders the password strength rules before any typing", () => {
    render(<SignUpPage />);
    expect(screen.getByText(/contains a lowercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/contains an uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/contains a number/i)).toBeInTheDocument();
    expect(screen.getByText(/contains a symbol/i)).toBeInTheDocument();
  });

  it("disables submit when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^email$/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Pass1234");
    await user.type(screen.getByLabelText(/confirm password/i), "Different1");
    await user.tab();

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDisabled();
  });

  it("clears the mismatch message and enables submit once values match", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^email$/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Pass1234");

    const confirm = screen.getByLabelText(/confirm password/i);
    await user.type(confirm, "Different1");
    await user.tab();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();

    await user.clear(confirm);
    await user.type(confirm, "Pass1234");

    expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeEnabled();
  });

  it("disables submit until the password meets minimum length", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^email$/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Ab1!");
    await user.type(screen.getByLabelText(/confirm password/i), "Ab1!");
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDisabled();
  });
});
