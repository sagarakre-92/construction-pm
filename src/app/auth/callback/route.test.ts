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

describe("GET /auth/callback", () => {
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

  it("uses verifyOtp for token_hash + type=signup (email apps / no PKCE verifier)", async () => {
    const res = await GET(
      requestFor(
        "https://construction-pm.vercel.app/auth/callback?token_hash=th1&type=signup&next=/login",
      ),
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "th1",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?verified=1");
  });

  it("uses exchangeCodeForSession when only code is present (PKCE)", async () => {
    const res = await GET(
      requestFor(
        "https://construction-pm.vercel.app/auth/callback?code=auth-code&next=/login",
      ),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?verified=1");
  });

  it("sends users with type=recovery and code to reset-password without signOut first branch hit", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    const res = await GET(
      requestFor(
        "https://construction-pm.vercel.app/auth/callback?code=rec&next=/reset-password&type=recovery",
      ),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("rec");
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/reset-password");
  });

  it("redirects to login error when exchangeCodeForSession fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: "invalid request" },
    });
    const res = await GET(
      requestFor(
        "https://construction-pm.vercel.app/auth/callback?code=bad&next=/login",
      ),
    );
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("redirects to login error when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({
      data: null,
      error: { message: "invalid or expired token" },
    });
    const res = await GET(
      requestFor(
        "https://construction-pm.vercel.app/auth/callback?token_hash=x&type=signup",
      ),
    );
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
  });

  it("redirects to login error when neither code nor token_hash is present", async () => {
    const res = await GET(
      requestFor("https://construction-pm.vercel.app/auth/callback?next=/login"),
    );
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
