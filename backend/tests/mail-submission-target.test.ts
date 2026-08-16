import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { SmtpSender, type SmtpOptions } from "../src/notifications/smtp.js";
import { readBackendRuntimeConfig } from "../src/config/runtime.js";
import { notificationModule } from "../src/config/notification.js";

/**
 * "Mail is only submitted to the configured host, and never to port 25."
 *
 * Both halves were weaker than they read. The port half rested on one string
 * comparison in `readBackendRuntimeConfig`, exercised with the single value
 * `"25"`. The host half rested on nothing at all: the only assertion about
 * transport settings read `sender.transportOptions`, a public field, while the
 * factory that actually receives them (`smtp.ts`'s `transportFactory(...)`
 * call) was handed a `() => transport` that discards its argument. A sender
 * that built its transport from a different host, or with `direct: true` — the
 * nodemailer setting that turns submission into MX-lookup delivery straight to
 * the Internet on port 25, which is exactly the thing the deploys manifests
 * deny at the network level — would have passed.
 *
 * So the assertions here capture what the factory is called with, and check
 * the shape of that object rather than a copy of it.
 */

const smtpOptions: SmtpOptions = {
  host: "smtp.example.test",
  port: 587,
  username: "smtp-user",
  password: "smtp-password",
  envelopeFrom: "orders@example.test",
};

function captureTransportOptions(options: SmtpOptions): Record<string, unknown> {
  const factory = vi.fn().mockReturnValue({ sendMail: vi.fn() });
  new SmtpSender(options, factory as never);
  expect(factory).toHaveBeenCalledOnce();
  return (factory.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

describe("the transport is built for the configured submission host", () => {
  it("hands the factory the configured host and port, not a copy kept on the side", () => {
    const captured = captureTransportOptions(smtpOptions);

    expect(captured).toEqual({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "smtp-user", pass: "smtp-password" },
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
  });

  it("follows the configured host when it changes, rather than a constant", () => {
    const captured = captureTransportOptions({ ...smtpOptions, host: "submission.other.test" });
    expect(captured.host).toBe("submission.other.test");
  });

  /**
   * The negative that matters. `toEqual` above already forbids an extra key,
   * but naming these makes the failure legible: each one is a documented
   * nodemailer setting that would take mail somewhere other than the
   * configured submission host.
   */
  it("declares no setting that would deliver mail anywhere but that host", () => {
    const captured = captureTransportOptions(smtpOptions);

    for (const forbidden of ["direct", "sendmail", "service", "url", "proxy", "socket", "streamTransport", "jsonTransport"]) {
      expect(Object.hasOwn(captured, forbidden), `transport declares "${forbidden}"`).toBe(false);
    }
  });

  it("requires STARTTLS with a verified certificate, so a downgrade is not a silent one", () => {
    const captured = captureTransportOptions(smtpOptions);
    expect(captured.requireTLS).toBe(true);
    expect(captured.secure).toBe(false);
    expect(captured.tls).toEqual({ rejectUnauthorized: true, minVersion: "TLSv1.2" });
  });

  /**
   * The default factory is never invoked by a test — invoking it would open a
   * connection — so the wiring is asserted at the source instead: the default
   * parameter is nodemailer's own `createTransport`, and nothing in this module
   * reads an environment variable to decide where mail goes.
   */
  it("defaults to nodemailer's createTransport and reads no environment of its own", () => {
    const source = readFileSync(join(__dirname, "..", "src", "notifications", "smtp.ts"), "utf8");
    expect(source).toContain("transportFactory: TransportFactory = nodemailer.createTransport");
    expect(source).not.toContain("process.env");
  });
});

describe("port 25 cannot be configured, by any spelling of it", () => {
  const environment = {
    DATABASE_URL: "postgres://app:password@database:5432/medusa",
    JWT_SECRET: "jwt",
    COOKIE_SECRET: "cookie",
    STORE_CORS: "",
    ADMIN_CORS: "",
    AUTH_CORS: "",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec",
    STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USERNAME: "smtp-user",
    SMTP_PASSWORD: "smtp-password",
    SMTP_ENVELOPE_FROM: "orders@example.test",
    CONTACT_MAIL_RECIPIENT: "contact@example.test",
    TURNSTILE_SECRET_KEY: "turnstile",
    MERCHANT_LEGAL_NAME: "Example Games OU",
    MERCHANT_REGISTERED_ADDRESS: "Example Street 1, Tallinn",
    MERCHANT_CONTACT_ADDRESS: "legal@example.test",
    MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
  } as const;

  it("accepts submission and nothing else", () => {
    expect(readBackendRuntimeConfig({ ...environment }).smtp.port).toBe(587);

    // `requireEnvironmentValue` trims, so surrounding whitespace is not a
    // different port — asserted rather than assumed, because it is also why
    // `" 25"` below is refused rather than slipping past a literal compare.
    expect(readBackendRuntimeConfig({ ...environment, SMTP_PORT: " 587 " }).smtp.port).toBe(587);

    for (const port of ["25", " 25", "025", "465", "2525", "1025", "0587", "587a", "", "smtp"]) {
      expect(
        () => readBackendRuntimeConfig({ ...environment, SMTP_PORT: port }),
        `SMTP_PORT=${JSON.stringify(port)} was accepted`,
      ).toThrow();
    }
  });

  it("carries the validated host and port through to the notification module unchanged", () => {
    const runtime = readBackendRuntimeConfig({ ...environment });
    const module = notificationModule(runtime.smtp);
    const options = module.options.providers[0]?.options as Record<string, unknown>;

    expect(options.host).toBe("smtp.example.test");
    expect(options.port).toBe(587);
    expect(captureTransportOptions(runtime.smtp).host).toBe("smtp.example.test");
  });
});
