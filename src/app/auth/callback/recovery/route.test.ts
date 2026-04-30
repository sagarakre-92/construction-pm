import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { exchangeCodeForSession, verifyOtp, signOut } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession,
      verifyOtp,
      signOut,
    },
  })),
}));

import { GET } from "./route";

function requestFor(url: string) {
  return new NextRequest(url);
}

describe("GET /auth/callback/recovery", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    signOut.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("exchanges PKCE code and redirects to reset-password without extra query params", async () => {
    const res = await GET(
      requestFor("https://example.com/auth/callback/recovery?code=abc"),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/reset-password");
  });

  it("uses verifyOtp for token_hash + type=recovery", async () => {
    const res = await GET(
      requestFor(
        "https://example.com/auth/callback/recovery?token_hash=th&type=recovery",
      ),
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "th",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/reset-password");
  });

  it("fails for token_hash with non-recovery type", async () => {
    const res = await GET(
      requestFor(
        "https://example.com/auth/callback/recovery?token_hash=th&type=signup",
      ),
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
  });

  it("redirects to login error when only code param is missing pieces", async () => {
    const res = await GET(
      requestFor("https://example.com/auth/callback/recovery"),
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
  });
});
