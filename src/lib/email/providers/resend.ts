/**
 * Resend HTTP transport. Uses fetch directly so we don't pull in the `resend`
 * npm package (the bundle is intentionally small per AGENTS.md). The Resend
 * API contract: POST https://api.resend.com/emails with bearer auth and a
 * JSON body containing { from, to, subject, html, text }; success returns
 * { id }.
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

import type {
  SendInvitationEmailArgs,
  SendInvitationEmailResult,
} from "../index";
import { renderInvitationEmail } from "../templates/invitation";

const RESEND_URL = "https://api.resend.com/emails";

type ResendResponseBody = {
  id?: string;
  message?: string;
  name?: string;
};

export async function sendViaResend(
  args: SendInvitationEmailArgs,
  apiKey: string,
  from: string,
): Promise<SendInvitationEmailResult> {
  const { subject, html, text } = renderInvitationEmail(args);

  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        html,
        text,
      }),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown email provider error";
    return { ok: false, error: message };
  }

  let body: ResendResponseBody = {};
  try {
    body = (await response.json()) as ResendResponseBody;
  } catch {
    body = {};
  }

  if (!response.ok) {
    const message =
      body.message ?? body.name ?? `Resend returned status ${response.status}`;
    return { ok: false, error: message };
  }

  return { ok: true, providerMessageId: body.id };
}
