/**
 * Dev / fallback email provider. Logs the would-be email to stdout instead of
 * making a network call so local dev (and CI) can run without an account or
 * outbound network access. Also used as the safety net when RESEND_API_KEY is
 * not configured in production — in that case it warns once so operators
 * notice that emails aren't actually being sent.
 */

import type {
  SendInvitationEmailArgs,
  SendInvitationEmailResult,
} from "../index";
import { renderInvitationEmail } from "../templates/invitation";

let warned = false;

export async function sendViaConsole(
  args: SendInvitationEmailArgs,
): Promise<SendInvitationEmailResult> {
  const { subject } = renderInvitationEmail(args);

  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn(
      "[email] RESEND_API_KEY is not set; invitation emails will be logged only and not delivered.",
    );
  }

  console.info(`[email] Would send to ${args.to}: ${subject}`);
  console.info(`[email] Invite URL: ${args.inviteUrl}`);

  return { ok: true };
}
