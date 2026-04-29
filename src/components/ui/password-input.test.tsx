import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("renders as a password field by default", () => {
    render(<PasswordInput aria-label="Password" defaultValue="hunter2" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.value).toBe("hunter2");
  });

  it("toggles the visibility on toggle click and back", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" defaultValue="hunter2" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    const toggle = screen.getByRole("button", { name: /show password/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(input.type).toBe("password");

    await user.click(toggle);
    expect(input.type).toBe("text");
    const hideBtn = screen.getByRole("button", { name: /hide password/i });
    expect(hideBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(hideBtn);
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: /show password/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("preserves the entered value across visibility toggles", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    await user.type(input, "S3cret-Pass");
    expect(input.value).toBe("S3cret-Pass");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(input.value).toBe("S3cret-Pass");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input.value).toBe("S3cret-Pass");
  });

  it("forwards arbitrary input props (autoComplete, minLength, required, id)", () => {
    render(
      <PasswordInput
        aria-label="Password"
        autoComplete="new-password"
        minLength={8}
        required
        id="signup-password"
      />,
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input).toHaveAttribute("autoComplete", "new-password");
    expect(input).toHaveAttribute("minLength", "8");
    expect(input).toBeRequired();
    expect(input.id).toBe("signup-password");
  });

  it("does not submit a parent form when the toggle is clicked", async () => {
    const user = userEvent.setup();
    let submitted = false;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitted = true;
        }}
      >
        <PasswordInput aria-label="Password" />
      </form>,
    );
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(submitted).toBe(false);
  });
});
