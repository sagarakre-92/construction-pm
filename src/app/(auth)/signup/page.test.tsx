import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();
const getSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: (args: unknown) => signUp(args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => getSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/signup",
}));

import SignUpPage from "./page";

describe("SignUpPage", () => {
  beforeEach(() => {
    signUp.mockReset();
    signUp.mockResolvedValue({ error: null });
    getSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("does NOT show 'already registered' when the email exists (anti-enumeration)", async () => {
    signUp.mockResolvedValueOnce({
      error: {
        name: "AuthApiError",
        status: 400,
        code: "user_already_exists",
        message: "User already registered",
      },
    });
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^email$/i), "existing@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "MyP@ssw0rd1!");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "MyP@ssw0rd1!",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByText(/already registered/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/error sending confirmation email/i),
    ).not.toBeInTheDocument();
  });

  it("calls supabase signUp with the normalized email on the happy path", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(
      screen.getByLabelText(/^email$/i),
      "  Foo@Example.com  ",
    );
    await user.type(screen.getByLabelText(/^password$/i), "MyP@ssw0rd1!");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "MyP@ssw0rd1!",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await new Promise((r) => setTimeout(r, 50));
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "foo@example.com",
        password: "MyP@ssw0rd1!",
      }),
    );
    const opts = signUp.mock.calls[0][0] as {
      options?: { emailRedirectTo?: string };
    };
    expect(opts.options?.emailRedirectTo).toMatch(/\/auth\/callback$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pre-fills and locks email when next is an invite link and email query is set", () => {
    getSearchParams.mockReturnValue(
      new URLSearchParams(
        `next=${encodeURIComponent("/invite/deadbeef0123456789")}&email=${encodeURIComponent("Invited@Example.com")}`,
      ),
    );
    render(<SignUpPage />);
    const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    expect(emailInput.value).toBe("invited@example.com");
    expect(emailInput.readOnly).toBe(true);
    expect(
      screen.getByText(/matches your invitation/i),
    ).toBeInTheDocument();
  });

  it("includes next in emailRedirectTo when signing up from an invitation", async () => {
    getSearchParams.mockReturnValue(
      new URLSearchParams(
        `next=${encodeURIComponent("/invite/deadbeef0123456789")}`,
      ),
    );
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^email$/i), "invitee@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "MyP@ssw0rd1!");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "MyP@ssw0rd1!",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await new Promise((r) => setTimeout(r, 50));
    expect(signUp).toHaveBeenCalledTimes(1);
    const opts = signUp.mock.calls[0][0] as {
      options?: { emailRedirectTo?: string };
    };
    expect(opts.options?.emailRedirectTo).toContain("/auth/callback?");
    expect(opts.options?.emailRedirectTo).toContain(
      encodeURIComponent("/invite/deadbeef0123456789"),
    );
  });

  it("shows a network-themed message and logs when sign up throws", async () => {
    signUp.mockRejectedValueOnce(new Error("Failed to fetch"));
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(
      screen.getByLabelText(/^email$/i),
      "user@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "MyP@ssw0rd1!");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "MyP@ssw0rd1!",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/network error\. please check your connection/i),
    ).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith(
      "signUp threw",
      expect.any(Error),
    );
  });

  it("shows the real Supabase error message when sign up fails", async () => {
    signUp.mockResolvedValueOnce({
      error: {
        name: "AuthApiError",
        status: 500,
        message: "Error sending confirmation email",
      },
    });
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(
      screen.getByLabelText(/^email$/i),
      "sagarakre92+test1@gmail.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "MyP@ssw0rd1!");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "MyP@ssw0rd1!",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/error sending confirmation email/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong\. please try again\./i),
    ).not.toBeInTheDocument();
  });
});
