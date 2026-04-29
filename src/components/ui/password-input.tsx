"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  /** Tailwind classes appended to the wrapping element. */
  containerClassName?: string;
  /**
   * Optional accessible label for the visibility toggle. Defaults follow the
   * "Show password" / "Hide password" convention used by major password
   * managers and screen readers.
   */
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      containerClassName,
      showPasswordLabel = "Show password",
      hidePasswordLabel = "Hide password",
      disabled,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
      <div className={cn("relative", containerClassName)}>
        <input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 pr-11 text-slate-900 shadow-sm transition-colors placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400",
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          tabIndex={0}
          disabled={disabled}
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200",
            "rounded-r-lg",
          )}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
