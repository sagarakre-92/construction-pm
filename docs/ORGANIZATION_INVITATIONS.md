# Organization invitation system

## Overview

- **Who can invite:** Organization owners and admins only (enforced in DB and server).
- **Flow:** Owner/admin creates an invitation (email + role) → system generates a secure token and invite link → invitee opens link → if not logged in, signs in (or signs up with email + `next` preserved) → completes profile on the invite screen → accept adds them to the organization (see **New user flow** below).

## Invite link

- **URL shape:** `{APP_ORIGIN}/invite/{token}`
- **Token:** 64-char hex, unique, stored in `organization_invitations.token`.
- **Expiry:** Invitations expire 7 days after creation (configurable in migration `015_organization_invitations.sql`: `expires_at` default).

## Sending the invite email

The server action **`createInvitation`** calls **`sendInvitationEmail`** (`src/lib/email/index.ts`) immediately after the invitation row is created.

| Environment | `RESEND_API_KEY` | Behavior |
|-------------|------------------|----------|
| **Vercel Production** (`VERCEL_ENV=production`) | Set | Invitation email is sent via [Resend](https://resend.com). |
| **Vercel Production** | Unset | Send **fails** with a clear error; the invitation row is rolled back so users are not told an email was sent when none can be delivered. |
| **Local / Preview / test** | Unset | **Console provider**: the invite URL is logged to stdout; the UI explains that no inbox email was sent and copies the link to the clipboard. |

To deliver real email in production, set **`RESEND_API_KEY`** (and optionally **`EMAIL_FROM`** with a sender on a domain you have verified in Resend). See `.env.local.example`.

Legacy note: Supabase Auth’s built-in “invite user” is a different flow; Alino uses custom tokens in `organization_invitations`, so outbound mail goes through Resend (or the console fallback above), not Supabase’s invite template alone.

## Environment

- **`NEXT_PUBLIC_APP_URL`** (optional): Full app URL (e.g. `https://yourapp.com`). Used to build the invite link returned to the client and for logging. If unset, the link is relative (`/invite/{token}`); the UI can still build a full URL with `window.location.origin` for copy.
- **`VERCEL_URL`**: On Vercel this is set automatically; the action uses it to build the invite link when `NEXT_PUBLIC_APP_URL` is not set.

## New user flow (sign up from invite)

1. The invite page links to **`/signup?next=/invite/{token}&email=…`** so the email field is pre-filled and read-only, and **`/login?redirect=…&email=…`** for the same prefill on sign-in.
2. Supabase **`emailRedirectTo`** includes **`/auth/callback?next=…`** so after email verification the session returns to the invite page.
3. If the user hits **`/orat`** or **`/onboarding`** before accepting while a **pending** org invite still matches their auth email and they are **not** in any org, the app redirects to **`/invite/{token}`** (RPC **`orat_get_pending_organization_invite_token_for_user`** in migration `022_pending_invite_token_for_user.sql`).
4. **Accept invitation** collects first name, last name, and role, then runs **`acceptInvitationWithProfile`** (accept RPC + profile upsert) so they are not sent through “create your organization” onboarding.

## Security

- Only owners/admins can create invites (RPC `orat_create_organization_invitation`).
- Token is single-use: accept flow marks the invitation as `accepted`.
- Expired invites cannot be accepted (RPC checks `expires_at`).
- RLS on `organization_invitations` restricts access to owners/admins of the org; accept is done via SECURITY DEFINER RPC that validates the token.
