/**
 * Tests for the @/lib/email facade — sendInvitationEmail.
 *
 * The facade picks a provider based on env: when RESEND_API_KEY is set it
 * POSTs to Resend; otherwise it falls back to a console "no-op" provider so
 * dev environments don't need an email account. The shared template builder
 * is also exercised via the body of the Resend POST.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { sendInvitationEmail } from "./index";

const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_EMAIL_FROM = process.env.EMAIL_FROM;
const ORIGINAL_VERCEL = process.env.VERCEL;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function restoreEnv() {
  if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY;
  if (ORIGINAL_EMAIL_FROM === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = ORIGINAL_EMAIL_FROM;
  if (ORIGINAL_VERCEL === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = ORIGINAL_VERCEL;
  if (ORIGINAL_VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
}

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetch(response: {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}): FetchMock {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sendInvitationEmail", () => {
  let consoleInfoSpy: MockInstance | undefined;
  let consoleWarnSpy: MockInstance | undefined;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
    vi.unstubAllGlobals();
    restoreEnv();
  });

  describe("when RESEND_API_KEY is unset (dev / console provider)", () => {
    it("returns ok and writes a [email] notice to the console", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendInvitationEmail({
        to: "maria@example.com",
        inviteUrl: "https://app.example.com/invite/abc",
        organizationName: "Acme",
        inviterName: "Jane Doe",
      });

      expect(result.ok).toBe(true);
      expect(result.delivered).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      const consoleOutput = (consoleInfoSpy?.mock.calls ?? [])
        .flat()
        .join(" ");
      expect(consoleOutput).toContain("[email]");
      expect(consoleOutput).toContain("maria@example.com");
    });
  });

  describe("when RESEND_API_KEY is set (Resend provider)", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "test-api-key";
    });

    it("POSTs to https://api.resend.com/emails with bearer auth and JSON body", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        body: { id: "msg_123" },
      });

      const result = await sendInvitationEmail({
        to: "maria@example.com",
        inviteUrl: "https://app.example.com/invite/xyz",
        organizationName: "Acme",
        inviterName: "Jane Doe",
      });

      expect(result.ok).toBe(true);
      expect(result.delivered).toBe(true);
      expect(result.providerMessageId).toBe("msg_123");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [
        string,
        {
          method: string;
          headers: Record<string, string>;
          body: string;
        },
      ];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init.method).toBe("POST");
      expect(init.headers["Authorization"]).toBe("Bearer test-api-key");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body) as {
        from: string;
        to: string[];
        subject: string;
        html: string;
        text: string;
      };
      expect(body.to).toEqual(["maria@example.com"]);
      expect(typeof body.subject).toBe("string");
      expect(body.subject.length).toBeGreaterThan(0);
      expect(body.html).toContain("https://app.example.com/invite/xyz");
      expect(body.text).toContain("https://app.example.com/invite/xyz");
    });

    it("uses EMAIL_FROM when set; falls back to default Alino sender otherwise", async () => {
      process.env.EMAIL_FROM = "Custom Sender <hello@custom.dev>";
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        body: { id: "msg_1" },
      });

      await sendInvitationEmail({
        to: "x@y.com",
        inviteUrl: "https://app.example.com/invite/t",
        organizationName: "Org",
        inviterName: "Inviter",
      });

      const customBody = JSON.parse(
        fetchMock.mock.calls[0][1].body as string,
      ) as { from: string };
      expect(customBody.from).toBe("Custom Sender <hello@custom.dev>");

      delete process.env.EMAIL_FROM;
      const fetchMock2 = mockFetch({
        ok: true,
        status: 200,
        body: { id: "msg_2" },
      });
      await sendInvitationEmail({
        to: "x@y.com",
        inviteUrl: "https://app.example.com/invite/t",
        organizationName: "Org",
        inviterName: "Inviter",
      });
      const defaultBody = JSON.parse(
        fetchMock2.mock.calls[0][1].body as string,
      ) as { from: string };
      expect(defaultBody.from).toContain("Alino");
      expect(defaultBody.from).toMatch(/noreply@alinoapp\.com/);
    });

    it("returns ok=false with the upstream error message when Resend responds non-2xx", async () => {
      mockFetch({
        ok: false,
        status: 422,
        body: { message: "Invalid recipient address" },
      });

      const result = await sendInvitationEmail({
        to: "not-an-email",
        inviteUrl: "https://app.example.com/invite/t",
        organizationName: "Org",
        inviterName: "Inviter",
      });

      expect(result.ok).toBe(false);
      expect(result.delivered).toBe(false);
      expect(result.error).toMatch(/Invalid recipient address|422/);
    });

    it("returns ok=false with the network error message when fetch throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network is down")),
      );

      const result = await sendInvitationEmail({
        to: "x@y.com",
        inviteUrl: "https://app.example.com/invite/t",
        organizationName: "Org",
        inviterName: "Inviter",
      });

      expect(result.ok).toBe(false);
      expect(result.delivered).toBe(false);
      expect(result.error).toContain("Network is down");
    });
  });

  describe("template content", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "test-api-key";
    });

    it("includes invite URL, org name, inviter name, and (when given) project name and recipient first name", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        body: { id: "x" },
      });

      await sendInvitationEmail({
        to: "maria@example.com",
        inviteUrl: "https://app.example.com/invite/TOKEN42",
        organizationName: "Acme Corp",
        inviterName: "Jane Doe",
        recipientFirstName: "Maria",
        projectName: "Tower 5 Renovation",
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        subject: string;
        html: string;
        text: string;
      };

      expect(body.subject).toContain("Acme Corp");
      expect(body.html).toContain("Acme Corp");
      expect(body.html).toContain("Jane Doe");
      expect(body.html).toContain("Tower 5 Renovation");
      expect(body.html).toContain("https://app.example.com/invite/TOKEN42");
      expect(body.text).toContain("https://app.example.com/invite/TOKEN42");
      expect(body.text).toContain("Maria");
    });

    it("renders without optional fields", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        body: { id: "x" },
      });

      await sendInvitationEmail({
        to: "x@y.com",
        inviteUrl: "https://app.example.com/invite/T",
        organizationName: "Solo Org",
        inviterName: "Solo Inviter",
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        html: string;
      };
      expect(body.html).toContain("Solo Org");
      expect(body.html).toContain("Solo Inviter");
    });
  });

  describe("production delivery requirement (no Resend key)", () => {
    it("fails on Vercel production when RESEND_API_KEY is unset", async () => {
      process.env.VERCEL = "1";
      process.env.VERCEL_ENV = "production";
      process.env.NODE_ENV = "production";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendInvitationEmail({
        to: "maria@example.com",
        inviteUrl: "https://app.example.com/invite/abc",
        organizationName: "Acme",
        inviterName: "Jane Doe",
      });

      expect(result.ok).toBe(false);
      expect(result.delivered).toBe(false);
      expect(result.error).toMatch(/RESEND_API_KEY/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses the console provider on Vercel preview when the key is unset", async () => {
      process.env.VERCEL = "1";
      process.env.VERCEL_ENV = "preview";
      process.env.NODE_ENV = "production";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendInvitationEmail({
        to: "maria@example.com",
        inviteUrl: "https://app.example.com/invite/abc",
        organizationName: "Acme",
        inviterName: "Jane Doe",
      });

      expect(result.ok).toBe(true);
      expect(result.delivered).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fails on non-Vercel Node production when the key is unset", async () => {
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      process.env.NODE_ENV = "production";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendInvitationEmail({
        to: "x@y.com",
        inviteUrl: "https://app.example.com/invite/t",
        organizationName: "Org",
        inviterName: "Inviter",
      });

      expect(result.ok).toBe(false);
      expect(result.delivered).toBe(false);
      expect(result.error).toMatch(/RESEND_API_KEY/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
