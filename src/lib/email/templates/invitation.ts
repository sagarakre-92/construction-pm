/**
 * Pure renderer for the invitation email. Returns subject + HTML + text bodies
 * derived from invitation arguments. Keeps HTML minimal and inline-styled so
 * it survives email clients that strip <style> blocks.
 */

import type { SendInvitationEmailArgs } from "../index";

export interface InvitationEmailContent {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toUTCString();
}

export function renderInvitationEmail(
  args: Pick<
    SendInvitationEmailArgs,
    | "inviteUrl"
    | "organizationName"
    | "inviterName"
    | "recipientFirstName"
    | "projectName"
    | "expiresAt"
  >,
): InvitationEmailContent {
  const {
    inviteUrl,
    organizationName,
    inviterName,
    recipientFirstName,
    projectName,
    expiresAt,
  } = args;

  const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : "Hi,";

  const subject = projectName
    ? `You're invited to ${projectName} on ${organizationName}`
    : `You're invited to join ${organizationName} on Alino`;

  const intro = projectName
    ? `${inviterName} invited you to collaborate on the project "${projectName}" in ${organizationName} on Alino.`
    : `${inviterName} invited you to join ${organizationName} on Alino.`;

  const expiryHuman = formatExpiry(expiresAt);
  const expiresLine = expiryHuman
    ? `This invitation expires on ${expiryHuman}.`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escapeHtml(subject)}</h1>
      <p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;line-height:1.5;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(inviteUrl)}"
           style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Accept invitation
        </a>
      </p>
      <p style="margin:0 0 12px;line-height:1.5;font-size:13px;color:#475569;">
        Or open this link in your browser:<br>
        <a href="${escapeHtml(inviteUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(inviteUrl)}</a>
      </p>
      ${expiresLine ? `<p style="margin:24px 0 0;font-size:12px;color:#64748b;">${escapeHtml(expiresLine)}</p>` : ""}
    </div>
  </body>
</html>`;

  const text = [
    greeting,
    "",
    intro,
    "",
    `Accept the invitation: ${inviteUrl}`,
    expiresLine,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
