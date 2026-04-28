/**
 * Email facade. Sole entry point used by server actions and other features.
 *
 * Provider selection is environment-driven so server actions don't need to
 * know which transport is in use:
 *   - `RESEND_API_KEY` set       → POST to Resend over HTTP
 *   - `RESEND_API_KEY` unset     → console fallback (dev / no-network)
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
}

const DEFAULT_FROM = "ORAT <noreply@orat.app>";

export async function sendInvitationEmail(
  args: SendInvitationEmailArgs,
): Promise<SendInvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;

  if (apiKey) {
    return sendViaResend(args, apiKey, from);
  }
  return sendViaConsole(args);
}

export { renderInvitationEmail } from "./templates/invitation";
