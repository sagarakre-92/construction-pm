# Organization invitation system

## Overview

- **Who can invite:** Organization owners and admins only (enforced in DB and server).
- **Flow:** Owner/admin creates an invitation (email + role) → system generates a secure token and invite link → invitee opens link → if not logged in, signs in (or signs up) → invite is accepted and user is added to the organization.

## Invite link

- **URL shape:** `{APP_ORIGIN}/invite/{token}`
- **Token:** 64-char hex, unique, stored in `organization_invitations.token`.
- **Expiry:** Invitations expire 7 days after creation (configurable in migration `015_organization_invitations.sql`: `expires_at` default).

## Sending the invite email (recommended approach)

Right now the app **does not send email**. After creating an invite, the server logs the link and the UI can copy it to the clipboard. To actually email the link:

1. **Option A – Supabase Auth (custom email):**  
   Use a custom email template or Supabase’s “Invite user by email” if you want to rely on Supabase. Our flow is custom (invite token, not Supabase invite), so you’d still need to trigger your own “send email” step with the invite link.

2. **Option B – Your own email provider (recommended):**  
   - Add a service (e.g. Resend, SendGrid, Postmark, AWS SES).
   - After `createInvitation` succeeds, call your email API with:
     - To: `invite.email`
     - Subject: e.g. “You’re invited to join {orgName}”
     - Body: include the invite link: `inviteLink` returned from the action (or build `{baseUrl}/invite/{token}`).
   - You can do this in the same server action after the RPC, or in an API route that the client calls after createInvitation.

3. **Option C – Log only (current):**  
   The create-invitation action logs the link with `console.info("[Invite] Created invitation link for", email, ":", inviteLink)`. Use this in development; in production, replace with one of the options above.

## Environment

- **`NEXT_PUBLIC_APP_URL`** (optional): Full app URL (e.g. `https://yourapp.com`). Used to build the invite link returned to the client and for logging. If unset, the link is relative (`/invite/{token}`); the UI can still build a full URL with `window.location.origin` for copy.
- **`VERCEL_URL`**: On Vercel this is set automatically; the action uses it to build the invite link when `NEXT_PUBLIC_APP_URL` is not set.

## Security

- Only owners/admins can create invites (RPC `orat_create_organization_invitation`).
- Token is single-use: accept flow marks the invitation as `accepted`.
- Expired invites cannot be accepted (RPC checks `expires_at`).
- RLS on `organization_invitations` restricts access to owners/admins of the org; accept is done via SECURITY DEFINER RPC that validates the token.
