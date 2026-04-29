"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Live password strength feedback for the sign-up form.
 *
 * Pure scoring (no zxcvbn dependency): we award one point per rule the
 * password satisfies and pick a label from the total. The rule list is
 * exposed so the form can show "what counts as a strong password" before
 * the user has typed anything.
 */

export const MIN_PASSWORD_LENGTH = 8;
const RECOMMENDED_PASSWORD_LENGTH = 12;

export type PasswordStrengthLabel = "Weak" | "Medium" | "Strong";

export interface PasswordStrengthRule {
  id: "length" | "lowercase" | "uppercase" | "digit" | "symbol" | "long";
  label: string;
  satisfied: boolean;
}

export interface PasswordStrengthResult {
  /** 0-6 inclusive: 1 per satisfied rule. */
  score: number;
  label: PasswordStrengthLabel;
  /** True iff the password is acceptable for submission. */
  meetsPolicy: boolean;
  rules: PasswordStrengthRule[];
  /**
   * Human-readable rule labels the password still needs to satisfy in order
   * to meet the minimum policy. Empty when `meetsPolicy` is true.
   */
  missing: string[];
}

const SYMBOL_REGEX = /[^A-Za-z0-9]/;

export function scorePassword(password: string): PasswordStrengthResult {
  const rules: PasswordStrengthRule[] = [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      satisfied: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: "lowercase",
      label: "Contains a lowercase letter",
      satisfied: /[a-z]/.test(password),
    },
    {
      id: "uppercase",
      label: "Contains an uppercase letter",
      satisfied: /[A-Z]/.test(password),
    },
    {
      id: "digit",
      label: "Contains a number",
      satisfied: /[0-9]/.test(password),
    },
    {
      id: "symbol",
      label: "Contains a symbol",
      satisfied: SYMBOL_REGEX.test(password),
    },
    {
      id: "long",
      label: `${RECOMMENDED_PASSWORD_LENGTH}+ characters (bonus)`,
      satisfied: password.length >= RECOMMENDED_PASSWORD_LENGTH,
    },
  ];

  const score = rules.reduce((acc, r) => acc + (r.satisfied ? 1 : 0), 0);

  let label: PasswordStrengthLabel;
  if (score >= 5) label = "Strong";
  else if (score >= 3) label = "Medium";
  else label = "Weak";

  // Minimum acceptable: at least 8 chars + 2 character-class rules (== Medium).
  const lengthOk = rules[0].satisfied;
  const classCount =
    (rules[1].satisfied ? 1 : 0) +
    (rules[2].satisfied ? 1 : 0) +
    (rules[3].satisfied ? 1 : 0) +
    (rules[4].satisfied ? 1 : 0);
  const meetsPolicy = lengthOk && classCount >= 2;

  const missing: string[] = [];
  if (!lengthOk) missing.push(rules[0].label);
  if (classCount < 2) {
    missing.push("at least 2 of: lowercase, uppercase, number, symbol");
  }

  return { score, label, meetsPolicy, rules, missing };
}

const labelStyles: Record<PasswordStrengthLabel, string> = {
  Weak: "text-red-600 dark:text-red-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Strong: "text-green-600 dark:text-green-400",
};

const segmentStyles: Record<PasswordStrengthLabel, string> = {
  Weak: "bg-red-500",
  Medium: "bg-amber-500",
  Strong: "bg-green-500",
};

const segmentCount: Record<PasswordStrengthLabel, number> = {
  Weak: 1,
  Medium: 2,
  Strong: 3,
};

export interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
  /** id of the element that gets `aria-describedby`'d into the password field. */
  id?: string;
}

const PasswordStrengthMeter = React.forwardRef<
  HTMLDivElement,
  PasswordStrengthMeterProps
>(({ password, className, id }, ref) => {
  const result = React.useMemo(() => scorePassword(password), [password]);
  const filled = password.length === 0 ? 0 : segmentCount[result.label];

  return (
    <div ref={ref} id={id} className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2" aria-hidden={password.length === 0}>
        <div className="flex flex-1 gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors",
                i < filled && segmentStyles[result.label],
              )}
            />
          ))}
        </div>
        {password.length > 0 && (
          <span
            className={cn(
              "min-w-[3.5rem] text-right text-xs font-semibold",
              labelStyles[result.label],
            )}
            aria-live="polite"
          >
            {result.label}
          </span>
        )}
      </div>
      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
        {result.rules.map((rule) => {
          const Icon = rule.satisfied ? Check : Minus;
          return (
            <li key={rule.id} className="flex items-center gap-1.5">
              <Icon
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  rule.satisfied
                    ? "text-green-600 dark:text-green-400"
                    : "text-slate-400 dark:text-slate-500",
                )}
              />
              <span
                className={cn(
                  rule.satisfied && "text-slate-800 dark:text-slate-200",
                )}
              >
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
PasswordStrengthMeter.displayName = "PasswordStrengthMeter";

export { PasswordStrengthMeter };
