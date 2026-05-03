/**
 * Email facade. Sole entry point used by server actions and other features.
 *
 * Provider selection is environment-driven so server actions don't need to
 * know which transport is in use:
 *   - `RESEND_API_KEY` set → POST to Resend over HTTP (`delivered: true` on success)
 *   - `RESEND_API_KEY` unset → console fallback (local / Vercel preview) with
 *     `delivered: false` — no inbox delivery
 *   - Production on Vercel (`VERCEL_ENV=production`) without a key → fails
 *     with a clear error so invites are not silently "sent" without email
 *
 * The shape `SendInvitationEmailArgs` is shared across organization and
 * project-scoped invitations; consumers should pass `projectName` only when
 * the invitation is project-scoped.
 */

import { sendViaConsole } from "./providers/console";
import { sendViaResend } from "./providers/resend";

export interface SendInvitationEmailArgs {
  to: string;
  /** Absolute URL like https://app.example.com/invite/<token> */
  inviteUrl: string;
  organizationName: string;
  inviterName: string;
  recipientFirstName?: string;
  /** Present for project-scoped invitations. */
  projectName?: string;
  /** ISO-8601 timestamp at which the invitation expires. */
  expiresAt?: string;
}

export interface SendInvitationEmailResult {
  ok: boolean;
  error?: string;
  providerMessageId?: string;
  /** True only when Resend accepted the message for delivery. */
  delivered?: boolean;
}

const DEFAULT_FROM = "Alino <noreply@alinoapp.com>";

/**
 * When true, missing RESEND_API_KEY must fail the send (no log-only success).
 * Vercel preview uses NODE_ENV=production but VERCEL_ENV=preview — previews may
 * still use the console provider for local QA without Resend.
 */
function mustDeliverViaProvider(): boolean {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

export async function sendInvitationEmail(
  args: SendInvitationEmailArgs,
): Promise<SendInvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;

  if (apiKey) {
    const result = await sendViaResend(args, apiKey, from);
    if (result.ok) {
      return { ...result, delivered: true };
    }
    return { ...result, delivered: false };
  }

  if (mustDeliverViaProvider()) {
    return {
      ok: false,
      delivered: false,
      error:
        "Invitation email could not be sent: RESEND_API_KEY is not set for this production deployment. Add it under your host's environment variables (for Vercel: Project → Settings → Environment Variables → Production).",
    };
  }

  const result = await sendViaConsole(args);
  return { ...result, delivered: false };
}

export { renderInvitationEmail } from "./templates/invitation";
